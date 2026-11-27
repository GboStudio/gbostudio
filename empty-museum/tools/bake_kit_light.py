"""Short UV2 light bake for the origin-room kit.

Rebuilds the same meshes as build_kit.py (Blender cannot import the
meshopt GLB), packs UV2 into one atlas, and bakes a low-sample Cycles
pass: contact occlusion against the floor plus a soft light from above.
No denoiser, no long sample count.

  blender --background --factory-startup --python empty-museum/tools/bake_kit_light.py -- \\
    --out empty-museum/assets/kit --size 1024 --samples 8

Writes origin-kit-light.webp (desktop), origin-kit-light-512.webp (mobile)
and origin-kit-light.json (atlas rectangles).
"""
import json
import subprocess
import sys
from pathlib import Path

import bpy

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import build_kit  # noqa: E402

ROOT = TOOLS.parent
DEFAULT_OUT = ROOT / "assets" / "kit"

# offset U, offset V, scale U, scale V. Margins keep the bleed inside the cell.
CELLS = {
    "pilaster": (0.02, 0.52, 0.46, 0.46),
    "plinth": (0.52, 0.52, 0.46, 0.46),
    "cornice": (0.02, 0.27, 0.46, 0.22),
    "panel-wide": (0.52, 0.27, 0.46, 0.22),
    "panel-narrow": (0.02, 0.02, 0.46, 0.22),
    "bench": (0.52, 0.02, 0.46, 0.22),
}


def args_after_double_dash():
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1:]


def option(flag, default):
    argv = args_after_double_dash()
    if flag in argv:
        return argv[argv.index(flag) + 1]
    return default


def fit_uv2(obj, cell):
    layer = obj.data.uv_layers["UV2"]
    u0, v0, su, sv = cell
    for loop in layer.data:
        loop.uv.x = u0 + loop.uv.x * su
        loop.uv.y = v0 + loop.uv.y * sv
    layer.active = True
    layer.active_render = True


def bake_target(obj, image):
    material = obj.data.materials[0]
    material.use_nodes = True
    tree = material.node_tree
    node = tree.nodes.new("ShaderNodeTexImage")
    node.image = image
    node.select = True
    tree.nodes.active = node
    principled = next((n for n in tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if principled:
        principled.inputs["Base Color"].default_value = (0.92, 0.90, 0.86, 1)
        principled.inputs["Roughness"].default_value = 0.72


def add_stage():
    bpy.ops.mesh.primitive_plane_add(size=14, location=(0.4, 0, -0.004))
    ground = bpy.context.active_object
    ground.name = "bake-ground"
    scene = bpy.context.scene
    world = bpy.data.worlds.new("kit-bake-world")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs[0].default_value = (0.78, 0.84, 0.92, 1)
    background.inputs[1].default_value = 0.22
    bpy.ops.object.light_add(type="SUN", location=(0.4, -1.2, 9))
    sun = bpy.context.active_object
    sun.data.energy = 2.4
    sun.data.angle = 0.55
    sun.data.color = (1.0, 0.94, 0.84)
    sun.rotation_euler = (0.15, 0.05, 0.2)
    return ground


def main():
    out = Path(option("--out", str(DEFAULT_OUT))).resolve()
    size = int(option("--size", "1024"))
    samples = int(option("--samples", "8"))
    out.mkdir(parents=True, exist_ok=True)
    build_kit.reset_scene()
    material = build_kit.marble_material()
    pieces = [
        build_kit.boxes_to_object("pilaster", build_kit.PILASTER, material),
        build_kit.extrude_profile("plinth", build_kit.PLINTH_PROFILE, -1, 1, material),
        build_kit.extrude_profile("cornice", build_kit.CORNICE_PROFILE, -1, 1, material),
        build_kit.make_panel("panel-wide", build_kit.PANEL_WIDE, material),
        build_kit.make_panel("panel-narrow", build_kit.PANEL_NARROW, material),
        build_kit.boxes_to_object("bench", build_kit.BENCH, material),
    ]
    image = bpy.data.images.new("kit-light", size, size, alpha=False, float_buffer=False)
    image.colorspace_settings.name = "Non-Color"
    for obj in pieces:
        build_kit.add_uvs(obj)
        fit_uv2(obj, CELLS[obj.name])
        obj.select_set(False)
    bake_target(pieces[0], image)
    ground = add_stage()
    bpy.ops.object.select_all(action="DESELECT")
    for obj in pieces:
        obj.select_set(True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 2
    scene.cycles.diffuse_bounces = 1
    scene.cycles.bake_type = "COMBINED"
    scene.render.bake.margin = 8
    scene.render.bake.use_clear = True
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    bpy.context.view_layer.objects.active = pieces[0]
    print(f"BAKE size={size} samples={samples}", flush=True)
    bpy.ops.object.bake(type="COMBINED")
    png = out / "origin-kit-light.png"
    image.filepath_raw = str(png)
    image.file_format = "PNG"
    image.save()
    meta = {
        "atlas": "origin-kit-light.webp",
        "mobile": "origin-kit-light-512.webp",
        "size": [size, size],
        "samples": samples,
        "cells": {name: list(cell) for name, cell in CELLS.items()},
        "uv": "UV2",
    }
    (out / "origin-kit-light.json").write_text(json.dumps(meta, indent=2) + "\n")
    pack = r'''
import sys
from PIL import Image
png, desktop, mobile = sys.argv[1:]
image = Image.open(png).convert("RGB")
# Spread island edges so a UV seam does not read the empty atlas as a black cut.
for _ in range(6):
    grown = image.copy()
    src, dst = image.load(), grown.load()
    w, h = image.size
    for y in range(h):
        for x in range(w):
            if src[x, y][0] > 10:
                continue
            total = [0, 0, 0]
            count = 0
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < w and 0 <= yy < h and src[xx, yy][0] > 10:
                        pix = src[xx, yy]
                        total[0] += pix[0]; total[1] += pix[1]; total[2] += pix[2]
                        count += 1
            if count:
                dst[x, y] = tuple(channel // count for channel in total)
    image = grown
samples = sorted(pixel[0] for pixel in image.getdata() if pixel[0] > 16)
high = samples[int(len(samples) * 0.92)] if samples else 255
scale = 255 / max(40, high)
lifted = image.point(lambda channel: min(255, int(channel * scale)))
lifted.save(desktop, "WEBP", quality=82, method=4)
lifted.resize((512, 512), Image.Resampling.LANCZOS).save(mobile, "WEBP", quality=80, method=4)
print("LIGHTMAP", desktop, lifted.size, "scale", round(scale, 3))
'''
    subprocess.run([
        "python3", "-c", pack,
        str(png), str(out / "origin-kit-light.webp"), str(out / "origin-kit-light-512.webp"),
    ], check=True)
    png.unlink(missing_ok=True)
    ground.hide_render = True
    print("BAKE DONE", flush=True)


if __name__ == "__main__":
    main()
