"""Modelled bay walls and a coffered ceiling for the origin room.

Original geometry, metres, Blender Z up. The page lights it with Marble019
(CC0). No downloaded mesh and no paid texture.

  blender --background --factory-startup --python empty-museum/tools/build_partitions.py -- \\
    --out empty-museum/assets/kit/origin-partitions.glb
"""
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "assets" / "kit" / "origin-partitions.glb"

HALF = 4.52
HEIGHT = 6.4
THICK = 0.25
LINTEL = 3.05


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


def cube(x0, x1, y0, y1, z0, z1):
    bpy.ops.mesh.primitive_cube_add(location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    obj = bpy.context.active_object
    obj.scale = ((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj


def union_boxes(name, boxes, material):
    parts = [cube(*box) for box in boxes]
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
    base.name = name
    base.data.name = name
    base.data.materials.clear()
    base.data.materials.append(material)
    return base


def wall_boxes(x0, x1):
    trim = 0.22
    jamb = 0.34
    boxes = [
        (-HALF, x0, -THICK, THICK, 0.0, HEIGHT),
        (x1, HALF, -THICK, THICK, 0.0, HEIGHT),
        (x0, x1, -THICK, THICK, LINTEL, HEIGHT),
        (-HALF, x0, -0.40, 0.40, 0.0, 0.42),
        (x1, HALF, -0.40, 0.40, 0.0, 0.42),
        (x0 - trim, x0, -jamb, jamb, 0.0, LINTEL),
        (x1, x1 + trim, -jamb, jamb, 0.0, LINTEL),
        (x0 - trim, x1 + trim, -jamb, jamb, LINTEL, LINTEL + trim),
        (-HALF, x0 - trim, -0.32, 0.32, 2.42, 2.56),
        (x1 + trim, HALF, -0.32, 0.32, 2.42, 2.56),
        (-HALF, HALF, -0.46, 0.46, 6.02, 6.32),
        (-HALF, HALF, -0.34, 0.34, 6.26, 6.40),
    ]
    return boxes


def coffer_boxes():
    """Cornice on the opening edge, coffers only toward the wall.

    Nothing crosses the sky. The fascia is a tall marble face, not a flat bar.
    """
    boxes = []
    y0, y1 = -1.75, 1.75
    for sign in (-1, 1):
        lip = sign * 2.50
        outer = sign * HALF
        def span(a, b):
            return tuple(sorted((a, b)))
        # Vertical fascia against the sky, then two moulding steps.
        boxes.append((*span(lip, lip + sign * 0.14), y0, y1, 5.92, 6.28))
        boxes.append((*span(lip + sign * 0.08, lip + sign * 0.32), y0, y1, 6.16, 6.32))
        boxes.append((*span(lip + sign * 0.24, lip + sign * 0.58), y0, y1, 6.26, 6.40))
        field = span(lip + sign * 0.58, outer)
        boxes.append((*field, y0, y1, 6.24, 6.40))
        for y in (-1.62, 0.02, 1.58):
            boxes.append((*field, y, y + 0.18, 6.08, 6.40))
    return boxes


def main():
    dest = output_path()
    dest.parent.mkdir(parents=True, exist_ok=True)
    reset_scene()
    material = marble_material()
    pieces = [
        union_boxes("partition-side", wall_boxes(1.55, 3.65), material),
        union_boxes("partition-center", wall_boxes(-1.1, 1.1), material),
        union_boxes("coffer", coffer_boxes(), material),
    ]
    for obj in pieces:
        obj.select_set(True)
        print(f"PIECE {obj.name} verts={len(obj.data.vertices)}", flush=True)
    bpy.context.view_layer.objects.active = pieces[0]
    bpy.ops.export_scene.gltf(
        filepath=str(dest),
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
    print(f"PARTITIONS {dest} bytes={dest.stat().st_size}", flush=True)


if __name__ == "__main__":
    main()
