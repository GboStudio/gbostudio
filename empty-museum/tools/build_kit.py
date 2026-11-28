"""Headless architecture kit for the origin room.

Modelled in metres, then exported as a meshopt-compressed glTF binary.
UV0 is a metre-scale marble unwrap. UV1 repeats it so the lightmap lands
on TEXCOORD_2 (UV2), left empty of lighting for the later bake.

Run from the repository root:

  blender --background --factory-startup --python empty-museum/tools/build_kit.py -- \\
    --out empty-museum/assets/kit/origin-kit.glb

The script shells out to `npx @gltf-transform/cli meshopt` for the compression
the page decoder already understands. Nothing here is a paid asset.
"""
import math
import shutil
import subprocess
import sys
from pathlib import Path

import bpy
import bmesh

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "assets" / "kit" / "origin-kit.glb"

# These sizes are the live layout in origin-room-build.js.
# Pilaster footprint stays inside the collider (0.46 into the room, 0.36 along).
PILASTER = [
    (0.00, 0.44, -0.17, 0.17, 0.00, 0.055),
    (0.015, 0.40, -0.155, 0.155, 0.045, 0.105),
    (0.04, 0.34, -0.135, 0.135, 0.095, 0.155),
    (0.06, 0.30, -0.12, 0.12, 0.145, 0.21),
    (0.075, 0.275, -0.105, 0.105, 0.20, 5.78),
    (0.055, 0.31, -0.12, 0.12, 5.76, 5.86),
    (0.03, 0.38, -0.15, 0.15, 5.84, 5.96),
    (0.00, 0.44, -0.17, 0.17, 5.94, 6.10),
]
PLINTH_PROFILE = [
    (0.003, 0.000), (0.095, 0.000), (0.095, 0.028), (0.072, 0.040),
    (0.072, 0.085), (0.050, 0.098), (0.050, 0.140), (0.030, 0.152),
    (0.030, 0.180), (0.003, 0.180),
]
CORNICE_PROFILE = [
    (0.003, 0.000), (0.045, 0.000), (0.055, 0.035), (0.105, 0.055),
    (0.125, 0.095), (0.160, 0.115), (0.160, 0.155), (0.075, 0.175),
    (0.055, 0.220), (0.003, 0.220),
]
PANEL_HEIGHT = 5.90
PANEL_WIDE = 4.08
PANEL_NARROW = 0.92
MODULE_ALONG = 2.0
BENCH = [
    (-0.20, 0.20, -0.62, -0.40, 0.00, 0.08),
    (-0.20, 0.20, 0.40, 0.62, 0.00, 0.08),
    (-0.16, 0.16, -0.56, -0.42, 0.06, 0.32),
    (-0.16, 0.16, 0.42, 0.56, 0.06, 0.32),
    (-0.18, 0.18, -0.58, 0.58, 0.28, 0.36),
    (-0.24, 0.24, -0.66, 0.66, 0.34, 0.45),
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


def marble_material():
    mat = bpy.data.materials.new("marble")
    mat.use_nodes = True
    return mat


def assign_material(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)


def cube(x0, x1, y0, y1, z0, z1):
    bpy.ops.mesh.primitive_cube_add(location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    obj = bpy.context.active_object
    obj.scale = ((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj


def apply_boolean_union(parts):
    base = parts[0]
    for other in parts[1:]:
        mod = base.modifiers.new("union", "BOOLEAN")
        mod.operation = "UNION"
        mod.solver = "EXACT"
        mod.object = other
    depsgraph = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(base.evaluated_get(depsgraph), depsgraph=depsgraph)
    world = base.matrix_world.copy()
    base.modifiers.clear()
    old = base.data
    base.data = baked
    bpy.data.meshes.remove(old)
    for vertex in base.data.vertices:
        vertex.co = world @ vertex.co
    base.location = (0, 0, 0)
    base.rotation_euler = (0, 0, 0)
    base.scale = (1, 1, 1)
    for other in parts[1:]:
        bpy.data.objects.remove(other, do_unlink=True)
    return base


def tidy(obj):
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0004)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def boxes_to_object(name, boxes, material):
    parts = [cube(*box) for box in boxes]
    obj = apply_boolean_union(parts)
    obj.name = name
    obj.data.name = name
    tidy(obj)
    assign_material(obj, material)
    return obj


def extrude_profile(name, profile, y0, y1, material):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for y in (y0, y1):
        rings.append([bm.verts.new((x, y, z)) for x, z in profile])
    count = len(profile)
    for index in range(count):
        nxt = (index + 1) % count
        bm.faces.new((rings[0][index], rings[0][nxt], rings[1][nxt], rings[1][index]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    tidy(obj)
    assign_material(obj, material)
    return obj


def frame_boxes(width, height, border, x0, x1):
    half = width / 2
    return [
        (x0, x1, -half, half, 0.0, border),
        (x0, x1, -half, half, height - border, height),
        (x0, x1, -half, -half + border, 0.0, height),
        (x0, x1, half - border, half, 0.0, height),
    ]


def make_panel(name, width, material):
    border = 0.08 if width > 2 else 0.055
    lip = border * 0.62
    boxes = frame_boxes(width, PANEL_HEIGHT, border, 0.004, 0.018)
    boxes += frame_boxes(width - border, PANEL_HEIGHT - border, lip, 0.014, 0.034)
    return boxes_to_object(name, boxes, material)


def uv0_metres(mesh):
    layer = mesh.uv_layers["UV0"]
    for poly in mesh.polygons:
        normal = poly.normal
        axis = max(range(3), key=lambda i: abs(normal[i]))
        for loop_index in poly.loop_indices:
            co = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            if axis == 0:
                layer.data[loop_index].uv = (co.y, co.z)
            elif axis == 1:
                layer.data[loop_index].uv = (co.x, co.z)
            else:
                layer.data[loop_index].uv = (co.x, co.y)


def copy_uv(mesh, source, target):
    src = mesh.uv_layers[source]
    dst = mesh.uv_layers[target]
    for index in range(len(src.data)):
        dst.data[index].uv = src.data[index].uv


def uv2_lightmap(mesh):
    """Pack each face into 0–1 with no overlap. Reserved for the J2 bake."""
    layer = mesh.uv_layers["UV2"]
    items = []
    for poly in mesh.polygons:
        normal = poly.normal
        axis = max(range(3), key=lambda i: abs(normal[i]))
        axes = [0, 1, 2]
        axes.remove(axis)
        a_axis, b_axis = axes
        coords = []
        for loop_index in poly.loop_indices:
            co = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            coords.append((co[a_axis], co[b_axis], loop_index))
        min_a = min(c[0] for c in coords)
        min_b = min(c[1] for c in coords)
        width = max(max(c[0] for c in coords) - min_a, 1e-4)
        height = max(max(c[1] for c in coords) - min_b, 1e-4)
        items.append((width, height, coords, min_a, min_b))
    items.sort(key=lambda item: -item[1])
    area = sum(item[0] * item[1] for item in items) or 1e-8
    scale = math.sqrt(0.78 / area)
    cursor_x, cursor_y, row_h = 0.02, 0.02, 0.0
    placed = []
    for width, height, coords, min_a, min_b in items:
        packed_w, packed_h = width * scale, height * scale
        if cursor_x + packed_w > 0.98:
            cursor_x = 0.02
            cursor_y += row_h + 0.008
            row_h = 0.0
        placed.append((cursor_x, cursor_y, packed_w, packed_h, coords, min_a, min_b, width, height))
        row_h = max(row_h, packed_h)
        cursor_x += packed_w + 0.008
    used = max((y + h for _, y, _, h, *_ in placed), default=1.0)
    fit = 0.98 / max(used, 1e-6)
    if fit < 1:
        placed = [(x * fit, y * fit, w * fit, h * fit, *rest) for x, y, w, h, *rest in placed]
    for px, py, pw, ph, coords, min_a, min_b, width, height in placed:
        for a_coord, b_coord, loop_index in coords:
            layer.data[loop_index].uv = (
                px + (a_coord - min_a) / width * pw,
                py + (b_coord - min_b) / height * ph,
            )


def add_uvs(obj):
    mesh = obj.data
    # Cube primitives bring their own UV map. Drop it so UV0 is TEXCOORD_0
    # and the lightmap is TEXCOORD_2, not an accidental later slot.
    while mesh.uv_layers:
        mesh.uv_layers.remove(mesh.uv_layers[0])
    mesh.uv_layers.new(name="UV0")
    uv0_metres(mesh)
    mesh.uv_layers.new(name="UV1")
    copy_uv(mesh, "UV0", "UV1")
    mesh.uv_layers.new(name="UV2")
    uv2_lightmap(mesh)
    mesh.uv_layers["UV0"].active = True
    mesh.uv_layers["UV0"].active_render = True


def bounds(obj):
    xs, ys, zs = [], [], []
    for vertex in obj.data.vertices:
        xs.append(vertex.co.x)
        ys.append(vertex.co.y)
        zs.append(vertex.co.z)
    return (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs), len(obj.data.vertices))


def compress(raw, dest):
    npx = shutil.which("npx")
    if not npx:
        raise SystemExit("npx is required to meshopt-compress the kit")
    cmd = [npx, "--yes", "@gltf-transform/cli@4.2.1", "meshopt", str(raw), str(dest)]
    print("COMPRESS", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


def main():
    dest = output_path()
    dest.parent.mkdir(parents=True, exist_ok=True)
    reset_scene()
    material = marble_material()
    pieces = [
        boxes_to_object("pilaster", PILASTER, material),
        extrude_profile("plinth", PLINTH_PROFILE, -MODULE_ALONG / 2, MODULE_ALONG / 2, material),
        extrude_profile("cornice", CORNICE_PROFILE, -MODULE_ALONG / 2, MODULE_ALONG / 2, material),
        make_panel("panel-wide", PANEL_WIDE, material),
        make_panel("panel-narrow", PANEL_NARROW, material),
        boxes_to_object("bench", BENCH, material),
    ]
    for obj in pieces:
        add_uvs(obj)
        lo_x, hi_x, lo_y, hi_y, lo_z, hi_z, verts = bounds(obj)
        print(
            f"PIECE {obj.name} verts={verts} "
            f"X {lo_x:.3f}..{hi_x:.3f} Y {lo_y:.3f}..{hi_y:.3f} Z {lo_z:.3f}..{hi_z:.3f}",
            flush=True,
        )
        obj.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
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
    print(f"KIT {dest} bytes={dest.stat().st_size}", flush=True)


if __name__ == "__main__":
    main()
