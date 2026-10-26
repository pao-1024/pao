# /// script
# requires-python = ">=3.11"
# dependencies = ["gerbonara==1.6.3", "shapely==2.1.2"]
# ///
"""Check the actual exported CAM files with independent Gerber and geometry engines."""
import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
import zipfile

from gerbonara import LayerStack
from gerbonara.rs274x import GerberFile
from gerbonara.excellon import ExcellonFile
from gerbonara.graphic_objects import Flash, Line
from shapely.geometry import Point, LineString, Polygon
from shapely.ops import unary_union


def check(path):
    with zipfile.ZipFile(path) as archive:
        if archive.testzip():
            raise ValueError("ZIP CRC mismatch")
        files = {n: archive.read(n).decode() for n in archive.namelist()}
    data = json.loads(files["pcb.json"])
    fs = json.loads(files["footprints.json"])
    rules = json.loads(files["drc.json"])["rules"]
    height, width = data["board"]["height"], data["board"]["width"]
    pads = {p["key"]: p for f in fs for p in f["pads"]}
    parents = {k: k for k in pads}

    def root(k):
        while parents[k] != k:
            parents[k] = parents[parents[k]]
            k = parents[k]
        return k

    def join(a, b):
        parents[root(a)] = root(b)

    for c in data["connections"]:
        join(c["a"], c["b"])
    for f in fs:
        if f["type"] == "esp":
            for keys in (["J1-1", "J1-2"], ["J1-22", "J3-1", "J3-21", "J3-22"]):
                for pin in keys[1:]:
                    join(f'{f["id"]}:{keys[0]}', f'{f["id"]}:{pin}')

    def at(p):
        return p["x"], height - p["y"]

    def flash_key(p):
        return tuple(round(n, 5) for n in (*at(p), p["diameter"]))

    def stroke_key(a, b, diameter):
        return tuple(sorted((tuple(round(v, 5) for v in a), tuple(round(v, 5) for v in b)))) + (round(diameter, 5),)

    strokes = {"F.Cu": {}, "B.Cu": {}}
    expected_strokes = {"F.Cu": Counter(), "B.Cu": Counter()}
    via_pads = []
    wires = {c["id"]: c for c in data["connections"]}
    for t in data["traces"]:
        c = wires[t["connection"]]
        net = root(c["a"])
        vias = t.get("vias", [])
        via_pads.extend({**v, "diameter": rules["viaDiameter"], "drill": rules["viaDrill"], "net": net} for v in vias)
        anchors = [pads[t.get("from", c["a"])] , *t["points"], pads[t.get("to", c["b"])]]
        points = [anchors[0]]
        for b in anchors[1:]:
            a = points[-1]
            dx, dy = b["x"] - a["x"], b["y"] - a["y"]
            diagonal = min(abs(dx), abs(dy))
            elbow = {"x": a["x"] + (1 if dx > 0 else -1 if dx < 0 else 0) * diagonal,
                     "y": a["y"] + (1 if dy > 0 else -1 if dy < 0 else 0) * diagonal}
            for p in (elbow, b):
                if abs(p["x"] - points[-1]["x"]) + abs(p["y"] - points[-1]["y"]) > 1e-8:
                    points.append(p)
        layer = t["layer"]
        for a, b in zip(points, points[1:]):
            if any(abs(a["x"] - v["x"]) + abs(a["y"] - v["y"]) < 1e-6 for v in vias):
                layer = "B.Cu" if layer == "F.Cu" else "F.Cu"
            key = stroke_key(at(a), at(b), t["width"])
            strokes[layer][key] = net
            expected_strokes[layer][key] += 1
    all_pads = [{**p, "net": root(k)} for k, p in pads.items()] + via_pads
    flash_nets = {flash_key(p): p["net"] for p in all_pads}
    expected_flashes = Counter(flash_key(p) for p in all_pads)
    copper = {"F.Cu": defaultdict(list), "B.Cu": defaultdict(list)}
    for layer, file in (("F.Cu", "pao.gtl"), ("B.Cu", "pao.gbl")):
        parsed = GerberFile.from_string(files[file])
        flashes, segments = Counter(), Counter()
        for obj in parsed.objects:
            if isinstance(obj, Flash):
                key = tuple(round(n, 5) for n in (obj.x, obj.y, obj.aperture.diameter))
                flashes[key] += 1
                shape = Point(obj.x, obj.y).buffer(obj.aperture.diameter / 2, quad_segs=64)
                copper[layer][flash_nets[key]].append(shape)
            elif isinstance(obj, Line):
                key = stroke_key((obj.x1, obj.y1), (obj.x2, obj.y2), obj.aperture.diameter)
                segments[key] += 1
                shape = LineString([(obj.x1, obj.y1), (obj.x2, obj.y2)]).buffer(obj.aperture.diameter / 2, quad_segs=64)
                copper[layer][strokes[layer][key]].append(shape)
            else:
                raise ValueError(f"Unexpected CAM object: {obj}")
        assert flashes == expected_flashes, f"{file}: pad/via coordinates differ"
        assert segments == expected_strokes[layer], f"{file}: routed copper differs"
    for file in ("pao.gts", "pao.gbs"):
        objects = GerberFile.from_string(files[file]).objects
        expected = Counter(tuple(round(v, 5) for v in (*at(p), p["diameter"] + 2 * rules["maskExpansion"])) for p in all_pads)
        assert Counter((round(o.x, 5), round(o.y, 5), round(o.aperture.diameter, 5)) for o in objects) == expected, f"{file}: mask mismatch"
        for i, a in enumerate(objects):
            for b in objects[i + 1:]:
                assert ((a.x - b.x)**2 + (a.y - b.y)**2)**0.5 - (a.aperture.diameter + b.aperture.diameter) / 2 >= rules["maskWeb"] - 1e-5, "Mask web below rule"
    holes = [h for f in fs for h in f["holes"]]
    for file, expected in (("pao-PTH.drl", all_pads), ("pao-NPTH.drl", holes)):
        objects = ExcellonFile.from_string(files[file], plated="NPTH" not in file).objects
        actual = Counter((round(o.x, 5), round(o.y, 5), round(o.aperture.diameter, 5)) for o in objects)
        wanted = Counter(tuple(round(v, 5) for v in (*at(p), p["drill"])) for p in expected)
        assert actual == wanted, f"{file}: drill coordinates or sizes differ"
    profile = GerberFile.from_string(files["pao.gm1"])
    profile_points = [(o.x1, o.y1) for o in profile.objects] + [(profile.objects[-1].x2, profile.objects[-1].y2)]
    assert all(abs(a.x2 - b.x1) + abs(a.y2 - b.y1) < 1e-6 for a, b in zip(profile.objects, profile.objects[1:])), "Profile is not continuous"
    assert profile_points[0] == profile_points[-1], "Profile is not closed"
    board = Polygon(profile_points)
    assert board.is_valid and board.bounds == (0, 0, width, height), "Invalid board profile"
    for layer, groups in copper.items():
        merged = {net: unary_union(shapes) for net, shapes in groups.items()}
        for net, shape in merged.items():
            assert board.buffer(-rules["edge"] + 1e-5).covers(shape), f"{layer}: copper to edge"
            for h in holes:
                assert shape.distance(Point(*at(h)).buffer(h["drill"] / 2, quad_segs=64)) >= rules["holeCopper"] - 1e-5, f"{layer}: copper to NPTH"
            for other, other_shape in merged.items():
                if net < other:
                    assert shape.distance(other_shape) >= rules["clearance"] - 1e-5, f"{layer}: different nets violate clearance: {net}/{other}"
    for c in data["connections"]:
        net = root(c["a"])
        components = []
        for layer in ("F.Cu", "B.Cu"):
            shape = unary_union(copper[layer][net])
            components.extend(list(shape.geoms) if hasattr(shape, "geoms") else [shape])
        groups = list(range(len(components)))

        def find(i):
            while groups[i] != i:
                i = groups[i]
            return i

        def touching(p):
            return [i for i, shape in enumerate(components) if shape.covers(Point(*at(p)))]

        # Crossing traces on opposite layers connect only at an actual plated pad or via.
        for p in all_pads:
            if p["net"] == net:
                indices = touching(p)
                for i in indices[1:]:
                    groups[find(i)] = find(indices[0])
        a, b = touching(pads[c["a"]]), touching(pads[c["b"]])
        assert a and b and find(a[0]) == find(b[0]), f"Disconnected copper: {c['id']}"
    # Build from parsed files directly: ZIP extraction must not create files in the system temporary directory.
    layers = {("top", "copper"): "pao.gtl", ("bottom", "copper"): "pao.gbl", ("top", "mask"): "pao.gts", ("bottom", "mask"): "pao.gbs", ("top", "silk"): "pao.gto", ("mechanical", "outline"): "pao.gm1"}
    graphic_layers = {key: GerberFile.from_string(files[name]) for key, name in layers.items()}
    graphic_layers[("top", "paste")] = GerberFile()  # The THT assembly has no solder paste.
    stack = LayerStack(graphic_layers=graphic_layers,
                       drill_pth=ExcellonFile.from_string(files["pao-PTH.drl"], plated=True),
                       drill_npth=ExcellonFile.from_string(files["pao-NPTH.drl"], plated=False))
    output = Path(path).with_suffix(".cam.svg")
    output.write_text(str(stack.to_pretty_svg(side="top")))
    print(json.dumps({"passed": True, "modules": len(fs), "connections": len(data["connections"]), "vias": len(via_pads), "pth": len(all_pads), "npth": len(holes), "board_mm": [width, height], "cam_svg": str(output)}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip", type=Path)
    args = parser.parse_args()
    check(args.zip)
