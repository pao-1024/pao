import re, struct, os
import numpy as np

KIT = r"C:\Users\i\Documents\deepseek-harness\default-workspace\pao61\elastic"
PARTS = ["base-plate","striker","barrel","gearbox","band-frame","button-mount","gear-z10","gear-z50"]

def load(path):
    raw = open(path, "rb").read()
    if len(raw) > 84:
        n = struct.unpack("<I", raw[80:84])[0]
        if 84 + n * 50 == len(raw):
            d = np.frombuffer(raw[84:], dtype=np.uint8).reshape(n, 50)
            return d[:, 12:48].copy().view("<f4").reshape(n, 3, 3).astype(np.float64)
    v = np.array(re.findall(rb"vertex\s+(\S+)\s+(\S+)\s+(\S+)", raw), dtype=bytes)
    return v.astype(np.float64).reshape(-1, 3, 3)

print(f"{'part':16}{'tris':>7}{'vol cm3':>9}{'bbox mm':>24}{'manifold':>10}")
print("-" * 68)
tot = 0.0
for p in PARTS:
    t = load(os.path.join(KIT, p + ".stl"))
    v0, v1, v2 = t[:, 0], t[:, 1], t[:, 2]
    vol = abs(np.einsum("ij,ij->i", v0, np.cross(v1, v2)).sum() / 6.0) / 1000
    mn, mx = t.reshape(-1, 3).min(0), t.reshape(-1, 3).max(0)
    sz = mx - mn
    edges = {}
    for tri in t:
        for i in range(3):
            a, b = tuple(np.round(tri[i], 4)), tuple(np.round(tri[(i + 1) % 3], 4))
            k = (a, b) if a < b else (b, a)
            edges[k] = edges.get(k, 0) + 1
    bad = sum(1 for c in edges.values() if c != 2)
    tot += vol
    print(f"{p:16}{len(t):>7}{vol:>9.2f}"
          f"{'x'.join(f'{v:.1f}' for v in sz):>24}{'OK' if bad == 0 else 'BAD':>10}")
print("-" * 68)
print(f"{'TOTAL':16}{'':>7}{tot:>9.2f}")
print(f"{'PLA 20% fill':16}{'':>7}{tot*0.55*1.24:>9.1f} g")
