"""Check persistent simulator identity without building or running firmware."""
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


class IdentityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
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
        rom = root / "rom.elf"
        for path in [build / "xiaozhi.elf", emulator, rom]:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.touch()
        (root / "tmp/base-revision.json").write_text('{"commit": "test-revision"}')
        (build / "flasher_args.json").write_text('{"flash_files": {}}')

        def create_flash(build_dir, flash, device_uuid):
            self.assertEqual(build_dir, build)
            self.assertEqual(str(device_uuid), identity_from_file()["uuid"])
            flash.touch()

        def identity_from_file():
            return json.loads((root / "tmp/esp32sim-full-flow/identity.json").read_text())

        with patch.object(runner, "ROOT", root), \
                patch("sys.argv", ["run-esp32sim.py", "--rom", str(rom)]), \
                patch.object(runner, "create_flash", side_effect=create_flash) as create, \
                patch.object(runner.os, "execv") as execute:
            runner.main()
            first_identity = identity_from_file()
            command = execute.call_args.args[1]
            self.assertEqual(command[command.index("--mac") + 1], first_identity["mac"])
            runner.main()

        self.assertEqual(identity_from_file(), first_identity)
        self.assertEqual(create.call_count, 1)
        self.assertEqual(execute.call_count, 2)


if __name__ == "__main__":
    unittest.main()
