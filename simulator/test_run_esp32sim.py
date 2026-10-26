"""Check simulator startup without building or running firmware."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import uuid


SPEC = importlib.util.spec_from_file_location("run_esp32sim", Path(__file__).with_name("run-esp32sim.py"))
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)
TEST_TEMP = runner.ROOT / "tmp/temp"
TEST_TEMP.mkdir(parents=True, exist_ok=True)


class RomTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=TEST_TEMP)
        self.addCleanup(self.temp.cleanup)
        self.root = patch.object(runner, "ROOT", Path(self.temp.name))
        self.root.start()
        self.addCleanup(self.root.stop)
        self.rom_dir = Path(self.temp.name) / "ROM files"
        self.rom_dir.mkdir()
        self.rom = self.rom_dir / "esp32s3_rev0_rom.elf"
        self.rom.touch()
        self.environment = patch.dict(runner.os.environ, {}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_explicit_rom_takes_priority_over_environment_and_eim(self):
        runner.os.environ["ESP_ROM_ELF_DIR"] = "/missing"
        with patch.object(runner.subprocess, "run", side_effect=AssertionError("EIM invoked")):
            self.assertEqual(runner.find_rom(self.rom), self.rom.resolve())

    def test_activated_environment_does_not_need_eim(self):
        runner.os.environ["ESP_ROM_ELF_DIR"] = str(self.rom_dir)
        with patch.object(runner.subprocess, "run", side_effect=AssertionError("EIM invoked")):
            self.assertEqual(runner.find_rom(), self.rom.resolve())

    def test_project_local_rom_is_used_without_eim(self):
        local = runner.ROOT / "tmp/idf-tools/tools/esp-rom-elfs/20241011/esp32s3_rev0_rom.elf"
        local.parent.mkdir(parents=True)
        local.touch()
        with patch.object(runner.subprocess, "run", side_effect=AssertionError("EIM invoked")):
            self.assertEqual(runner.find_rom(), local.resolve())
            runner.os.environ["ESP_ROM_ELF_DIR"] = str(self.rom_dir)
            self.assertEqual(runner.find_rom(), self.rom.resolve())

    def test_selected_eim_environment_is_used_despite_log_output(self):
        result = runner.subprocess.CompletedProcess(
            [], 0, stdout=f"EIM environment setup logs\nPAO_SIM_ROM_DIR={self.rom_dir}\n", stderr="")
        with patch.object(runner.shutil, "which", return_value="/usr/bin/eim"), \
                patch.object(runner.subprocess, "run", return_value=result):
            self.assertEqual(runner.find_rom(), self.rom.resolve())

    def test_missing_explicit_rom_is_reported_without_using_eim(self):
        with patch.object(runner.subprocess, "run", side_effect=AssertionError("EIM invoked")):
            with self.assertRaisesRegex(ValueError, "Missing.*missing.elf"):
                runner.find_rom(self.rom_dir / "missing.elf")

    def test_missing_environment_and_eim_gives_configuration_hint(self):
        with patch.object(runner.shutil, "which", return_value=None):
            with self.assertRaisesRegex(ValueError, "eim select"):
                runner.find_rom()

    def test_eim_failure_gives_configuration_hint(self):
        result = runner.subprocess.CompletedProcess([], 1, stdout="", stderr="No selected IDF")
        with patch.object(runner.shutil, "which", return_value="/usr/bin/eim"), \
                patch.object(runner.subprocess, "run", return_value=result):
            with self.assertRaisesRegex(ValueError, "eim select"):
                runner.find_rom()

    def test_eim_without_rom_directory_gives_configuration_hint(self):
        result = runner.subprocess.CompletedProcess(
            [], 0, stdout="Environment setup logs\nPAO_SIM_ROM_DIR=\n", stderr="")
        with patch.object(runner.shutil, "which", return_value="/usr/bin/eim"), \
                patch.object(runner.subprocess, "run", return_value=result):
            with self.assertRaisesRegex(ValueError, "--rom"):
                runner.find_rom()


class IdentityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=TEST_TEMP)
        self.addCleanup(self.temp.cleanup)
        self.state = Path(self.temp.name) / "state"

    def test_first_start_creates_local_unicast_mac_and_uuid(self):
        identity = runner.load_identity(self.state)

        self.assertEqual(json.loads((self.state / "identity.json").read_text()), identity)
        octets = bytes.fromhex(identity["mac"].replace(":", ""))
        self.assertEqual(len(octets), 6)
        self.assertEqual(octets[0] & 3, 2)
        self.assertEqual(uuid.UUID(identity["uuid"]).version, 4)

    def test_later_start_reuses_file_without_generating_identity(self):
        identity = runner.load_identity(self.state)
        before = (self.state / "identity.json").read_bytes()

        with patch.object(runner.os, "urandom", side_effect=AssertionError("MAC regenerated")), \
                patch.object(runner.uuid, "uuid4", side_effect=AssertionError("UUID regenerated")):
            self.assertEqual(runner.load_identity(self.state), identity)

        self.assertEqual((self.state / "identity.json").read_bytes(), before)

    def test_invalid_identity_is_not_overwritten(self):
        self.state.mkdir()
        identity_file = self.state / "identity.json"
        for content in ["{", "[]", "{}", '{"mac": 123, "uuid": null}',
                        '{"mac": "invalid", "uuid": "invalid"}',
                        '{"mac": "02:00:00:00:00:01", "uuid": "invalid"}']:
            with self.subTest(content=content):
                identity_file.write_text(content)
                with self.assertRaises(ValueError):
                    runner.load_identity(self.state)
                self.assertEqual(identity_file.read_text(), content)

    def test_existing_flash_without_identity_is_preserved(self):
        self.state.mkdir()
        flash = self.state / "interactive.bin"
        flash.write_bytes(b"existing device state")

        with self.assertRaisesRegex(ValueError, "identity.json"):
            runner.load_identity(self.state)

        self.assertFalse((self.state / "identity.json").exists())
        self.assertEqual(flash.read_bytes(), b"existing device state")

    def test_launcher_uses_same_identity_for_flash_and_emulator(self):
        root = Path(self.temp.name)
        build = root / "tmp/build/test-revision"
        emulator = root / "tmp/esp32sim-build/release/pao-sim"
        rom = root / "esp32s3_rev0_rom.elf"
        for path in [build / "xiaozhi.elf", emulator, rom]:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.touch()
        (root / "tmp/base-revision.json").write_text('{"commit": "test-revision"}')
        (build / "flasher_args.json").write_text('{"flash_files": {}}')

        def create_flash(build_dir, flash, device_uuid, nvs_python):
            self.assertEqual(build_dir, build)
            self.assertEqual(str(device_uuid), identity_from_file()["uuid"])
            flash.touch()

        def identity_from_file():
            return json.loads((root / "tmp/esp32sim-full-flow/identity.json").read_text())

        with patch.object(runner, "ROOT", root), \
                patch("sys.argv", ["run-esp32sim.py"]), \
                patch.dict(runner.os.environ, {"ESP_ROM_ELF_DIR": str(root)}), \
                patch.object(runner, "create_flash", side_effect=create_flash) as create, \
                patch.object(runner.os, "execv") as execute:
            runner.main()
            first_identity = identity_from_file()
            command = execute.call_args.args[1]
            self.assertEqual(command[command.index("--rom") + 1], str(rom.resolve()))
            self.assertEqual(command[command.index("--mac") + 1], first_identity["mac"])
            runner.main()

        self.assertEqual(identity_from_file(), first_identity)
        self.assertEqual(create.call_count, 1)
        self.assertEqual(execute.call_count, 2)

    def test_packaged_firmware_uses_explicit_paths_without_sdk_metadata(self):
        root = Path(self.temp.name)
        build = root / "firmware"
        emulator = root / "tmp/esp32sim-build/release/pao-sim"
        rom = root / "rom.elf"
        for path in [build / "xiaozhi.elf", emulator, rom]:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.touch()
        (build / "flasher_args.json").write_text('{"flash_files": {}}')
        state = root / "volume"
        python = Path("/usr/local/bin/python3")
        with patch.object(runner, "ROOT", root), \
                patch("sys.argv", ["run-esp32sim.py", "--rom", str(rom),
                                   "--firmware-dir", str(build), "--state-dir", str(state),
                                   "--nvs-python", str(python)]), \
                patch.object(runner, "create_flash") as create, \
                patch.object(runner.os, "execv") as execute:
            runner.main()
        identity = json.loads((state / "identity.json").read_text())
        create.assert_called_once_with(build, state / "interactive.bin", identity["uuid"], python)
        command = execute.call_args.args[1]
        self.assertEqual(command[command.index("--flash-file") + 1], str(state / "interactive.bin"))


if __name__ == "__main__":
    unittest.main()
