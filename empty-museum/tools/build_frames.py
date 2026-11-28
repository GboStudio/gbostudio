"""Ornate gilt frame kit for the origin room.

A one-metre moulding bar and a corner cartouche. The engine scales the bar
along its length and instances the corner, so every frame size stays sharp
without a draw call per size.

  blender --background --factory-startup --python empty-museum/tools/build_frames.py -- \\
    --out empty-museum/assets/kit/origin-frames.glb
"""
import shutil
import subprocess
import sys
from pathlib import Path

import bpy
import bmesh

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "assets" / "kit" / "origin-frames.glb"

# Cross-section of the gilt lip, metres. Y grows away from the painting,
# Z grows into the room. Closed loop.
PROFILE = [
    (0.000, 0.000),
    (0.000, 0.010),
    (0.006, 0.016),
    (0.010, 0.009),
    (0.016, 0.020),
    (0.022, 0.012),
    (0.028, 0.026),
    (0.038, 0.018),
    (0.046, 0.032),
    (0.058, 0.014),
    (0.066, 0.006),
    (0.066, 0.000),
]


def args_after_double_dash():
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1:]


def output_path():
    argv = args_after_double_dash()
    if "--out" in argv:
        return Path(argv[argv.index("--out") + 1]).resolve()
    return DEFAULT_OUT


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in list(bpy.data.meshes):
        bpy.data.meshes.remove(block)


def add_profile(bm, along0, along1, rotate=False):
    """Profile is (across, depth) in the final glTF axes.

    Blender is Z-up. The exporter maps (x, y, z) to (x, z, -y), so a point
    that should arrive as (along, across, depth) is stored as
    (along, -depth, across).
    """
    def co(across, along, depth):
        if rotate:
            return (across, -depth, along)
        return (along, -depth, across)
    rings = []
    for along in (along0, along1):
        rings.append([bm.verts.new(co(across, along, depth)) for across, depth in PROFILE])
    count = len(PROFILE)
    for index in range(count - 1):
        nxt = index + 1
        bm.faces.new((rings[0][index], rings[0][nxt], rings[1][nxt], rings[1][index]))
    bm.faces.new((rings[0][0], rings[1][0], rings[1][-1], rings[0][-1]))


def extrude_profile(name, y0, y1):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    add_profile(bm, y0, y1, rotate=False)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def leaf(bm, origin, scale, tilt):
    """A flat pointed leaf in final glTF axes: X along, Y across, Z into the room."""
    ox, oy, oz = origin
    sx, sy = scale[0], scale[1]
    cx, syaw = __import__("math").cos(tilt), __import__("math").sin(tilt)
    points = [(0.0, 0.0), (0.35, 0.16), (1.0, 0.0), (0.35, -0.16)]

    def vertex(px, py, lift):
        across = oy + (px * sx) * syaw + (py * sy) * cx
        along = ox + (px * sx) * cx - (py * sy) * syaw
        depth = oz + lift
        return (along, -depth, across)

    bm.faces.new([bm.verts.new(vertex(px, py, 0.0)) for px, py in points])
    bm.faces.new([bm.verts.new(vertex(px, py, 0.004)) for px, py in [(p[0] * 0.72, p[1] * 0.72) for p in points]])


def make_corner():
    mesh = bpy.data.meshes.new("corner")
    bm = bmesh.new()
    add_profile(bm, -0.02, 0.07, rotate=False)
    add_profile(bm, -0.02, 0.07, rotate=True)
    leaf(bm, (0.012, 0.012, 0.030), (0.055, 0.018, 0.0), 0.7)
    leaf(bm, (0.010, 0.014, 0.028), (0.042, 0.014, 0.0), 0.25)
    leaf(bm, (0.016, 0.008, 0.028), (0.040, 0.013, 0.0), 1.15)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("corner", mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def gold(obj):
    mat = bpy.data.materials.new("gilt")
    mat.use_nodes = True
    obj.data.materials.append(mat)


def compress(raw, dest):
    npx = shutil.which("npx")
    if not npx:
        raise SystemExit("npx is required to meshopt-compress the frames")
    subprocess.run(
        [npx, "--yes", "@gltf-transform/cli@4.2.1", "meshopt", str(raw), str(dest)],
        check=True,
    )


def main():
    dest = output_path()
    dest.parent.mkdir(parents=True, exist_ok=True)
    reset_scene()
    bar = extrude_profile("moulding", -0.5, 0.5)
    corner = make_corner()
    for obj in (bar, corner):
        gold(obj)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = bar
    raw = dest.with_suffix(".raw.glb")
    bpy.ops.export_scene.gltf(
        filepath=str(raw),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )
    compress(raw, dest)
    raw.unlink(missing_ok=True)
    print(f"FRAMES {dest} bytes={dest.stat().st_size}", flush=True)


if __name__ == "__main__":
    main()
