"""The Unreal Museum — V4 sculpted entrance + offline Cycles GI bake.

Build: blender --background --python empty-museum/blender/bake_entrance.py -- --out empty-museum/assets
No copyrighted assets or external textures. All architecture is modeled here.
The exported GLB contains geometry with an independently unwrapped, Cycles-baked
DIFFUSE texture (albedo + direct lighting + indirect bounce illumination).
It is *not* an HDR reflection capture or a dynamically relit world.

Blender world is Z-up. Exported glTF is Y-up: Blender (x,-museum_z,museum_y).
"""
import argparse
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument("--out", default="empty-museum/assets")
parser.add_argument("--size", type=int, default=1024)
parser.add_argument("--samples", type=int, default=14)
args, _unknown = parser.parse_known_args(
    __import__("sys").argv[__import__("sys").argv.index("--") + 1:]
    if "--" in __import__("sys").argv else []
)
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = max(4, min(64, args.samples))
scene.cycles.max_bounces = 4
scene.render.image_settings.file_format = "PNG"
scene.render.resolution_x = 960
scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.film_transparent = False

world = bpy.data.worlds.new("Soft museum daylight") if not bpy.data.worlds else bpy.data.worlds[0]
scene.world = world
world.use_nodes = True
background = world.node_tree.nodes.get("Background")
background.inputs["Color"].default_value = (.81, .84, .89, 1)
background.inputs["Strength"].default_value = .72

def surface(name, rgba, roughness=.9, metallic=0, emission=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    node = m.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = (*rgba, 1)
    node.inputs["Roughness"].default_value = roughness
    node.inputs["Metallic"].default_value = metallic
    if emission:
        node.inputs["Emission Color"].default_value = (*rgba, 1)
        node.inputs["Emission Strength"].default_value = emission
    return m

plaster = surface("warm ivory mineral plaster", (.84, .83, .805), .95)
limestone = surface("honed limestone edge", (.76, .735, .695), .82)
recess = surface("recessed shadow mineral", (.63, .61, .59), .96)
bronze = surface("satin champagne bronze", (.55, .46, .30), .44, .35)
opal = surface("diffused warm LED", (.93, .88, .76), .66, 0, .85)
floor_stage = surface("reference limestone stage", (.78, .75, .71), .83)
export_meshes = []

def museum_point(x, height, z):
    return (x, -z, height)

def block(name, x, y, z, w, h, depth, mat, radius=.0, export=True):
    bpy.ops.mesh.primitive_cube_add(size=1, location=museum_point(x, y, z))
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = (w, depth, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    if export and radius > 0:
        modifier = ob.modifiers.new("stone eased edges", "BEVEL")
        modifier.width = radius
        modifier.segments = 3
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        ob.modifiers.new("weighted normals", "WEIGHTED_NORMAL")
    if export:
        export_meshes.append(ob)
    return ob

# Receive lights and occlude rebounces during bake, but never ship stage geometry:
# the live museum already owns all the floor, wall, ceiling and collision meshes.
block("STAGE floor", 0, -.20, 4.0, 9.2, .21, 17, floor_stage, export=False)
for s in (-1, 1):
    block("STAGE left/right wall", s*4.66, 3.05, 6.0, .15, 6.2, 18, plaster, export=False)
block("STAGE ceiling", 0, 6.47, 6.5, 9.3, .16, 18, plaster, export=False)

# A gallery threshold inside the existing portal: the visitor sees a nested,
# physically sculpted entry, not one endless uniformly lit showroom corridor.
for side in (-1, 1):
    x = side*4.04
    block("Threshold honed limestone pier", x, 2.68, 3.38,
          .31, 5.20, .54, limestone, radius=.016)
    block("Threshold shadow inset", side*3.861, 2.66, 3.35,
          .026, 4.83, .58, recess, radius=.004)
    block("Pier ground reveal", x, .19, 3.37, .36, .14, .60, plaster, radius=.007)
    block("Pier restrained capital", x, 5.17, 3.38, .38, .11, .63, plaster, radius=.006)
    block("Bronze threshold reveal", side*3.829, 2.59, 3.34,
          .021, 4.59, .58, bronze, radius=.003)

    # Low, tactile limestone wall panels in the vestibule, entirely in front
    # of the first exhibitor bay (starts at z≈5.7). No art is occluded.
    for index in range(3):
        z=.79+index*.83
        block("Deep vestibule relief", side*4.43, 2.75, z,
              .095, 4.48, .65, plaster, radius=.02)
        block("Reveal hairline", side*4.351, 2.73, z+.32,
              .012, 4.24, .018, recess, radius=.002)
    block("Limestone baseboard", side*4.37, .27, 2.08,
          .13, .38, 3.93, limestone, radius=.01)
    block("Baseboard dark recessed line", side*4.276, .475, 2.08,
          .014, .024, 3.89, recess)
    block("Satin bronze toe trim", side*4.287, .13, 2.05,
          .012, .017, 3.88, bronze)

    # Low-profile integrated ceiling cove; it lights plaster, not the camera.
    block("Recessed ceiling cove return", side*2.72, 6.17, 3.24,
          .095, .14, 5.6, limestone, radius=.006)
    block("Cove diffuser", side*2.665, 6.103, 3.24,
          .062, .025, 5.55, opal, radius=.004)
    block("Cove satin lip", side*2.79, 6.081, 3.24,
          .016, .014, 5.55, bronze)

# A substantial top stone return frames the portal but never blocks sightlines.
block("Museum lintel", 0, 5.23, 3.38, 8.14, .36, .65, limestone, radius=.018)
block("Lintel lower shadow slot", 0, 5.012, 3.37, 7.82, .026, .69, recess)
block("Lintel underside gold inlay", 0, 4.982, 3.36, 7.77, .016, .65, bronze)
block("Lintel top crown", 0, 5.436, 3.38, 8.26, .05, .67, plaster, radius=.007)

# Three shallow central ceiling panels subtly interrupt the overly long tunnel.
for z in (1.15, 2.08, 3.01):
    block("Flush luminous ceiling raft", 0, 6.205, z, 1.56, .057, .62, plaster, radius=.018)
    block("Recessed warm diffuser", 0, 6.162, z, 1.32, .014, .44, opal, radius=.009)

def area(name, pos, power, color, sx, sy):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.color = color
    data.shape = "RECTANGLE"
    data.size = sx
    data.size_y = sy
    ob = bpy.data.objects.new(name, data)
    scene.collection.objects.link(ob)
    ob.location = museum_point(*pos)
    target = Vector(museum_point(0, 2.65, pos[2]+.65))
    direction = target - ob.location
    ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

area("warm indirect gallery wash", (0, 5.96, 2.1), 730, (1.0, .89, .76), 3.5, 2.4)
area("diffused entrance fill", (0, 5.95, 4.2), 860, (1, .95, .87), 4.2, 3.0)
for side in (-1, 1):
    area("wall grazing fill", (side*2.2, 5.4, 2.35),
         260, (1, .92, .82), 1.3, 2.0)

# Join the architecture into one GPU draw call with ONE unique bake UV atlas.
bpy.ops.object.select_all(action="DESELECT")
for ob in export_meshes:
    ob.select_set(True)
bpy.context.view_layer.objects.active = export_meshes[0]
bpy.ops.object.join()
hero = bpy.context.object
hero.name = "TEM_V4_CYCLES_BAKED_ENTRANCE"
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(island_margin=.016)
bpy.ops.object.mode_set(mode="OBJECT")
assert hero.data.uv_layers.active is not None, "Bake UV islands missing"

bake = bpy.data.images.new("V4_Cycles_diffuse_GI",
                           width=args.size, height=args.size, alpha=False)
bake.colorspace_settings.name = "sRGB"
for mat in hero.data.materials:
    mat.use_nodes = True
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.name = "TEM_BAKE_DESTINATION"
    tex.image = bake
    mat.node_tree.nodes.active = tex

scene.render.bake.use_clear = True
scene.render.bake.margin = 10
scene.render.bake.use_pass_color = True
scene.render.bake.use_pass_direct = True
scene.render.bake.use_pass_indirect = True
scene.render.bake.use_pass_diffuse = True
scene.render.bake.use_pass_glossy = False
scene.render.bake.use_pass_transmission = False
scene.render.bake.use_pass_emit = False
bpy.ops.object.select_all(action="DESELECT")
hero.select_set(True)
bpy.context.view_layer.objects.active = hero
print("TEM V4 | Baking Cycles diffuse + direct + bounced indirect illumination",
      flush=True)
bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR", "DIRECT", "INDIRECT"})
bake.filepath_raw = str(out / "entrance-v4-lightbake.png")
bake.file_format = "PNG"
bake.save()

# Export the Cycles result as a single self-contained GLB with no external
# dependencies. Three.js renders this using MeshBasicMaterial: no double-lighting.
baked_mat = surface("TEM_LIGHT_BAKED_DIFFUSE", (1, 1, 1), roughness=1)
bsdf = baked_mat.node_tree.nodes.get("Principled BSDF")
img = baked_mat.node_tree.nodes.new("ShaderNodeTexImage")
img.image = bake
baked_mat.node_tree.links.new(img.outputs["Color"], bsdf.inputs["Base Color"])
hero.data.materials.clear()
hero.data.materials.append(baked_mat)

bpy.ops.object.select_all(action="DESELECT")
hero.select_set(True)
bpy.context.view_layer.objects.active = hero
bpy.ops.export_scene.gltf(filepath=str(out / "entrance-v4-baked.glb"),
                          export_format="GLB", use_selection=True,
                          export_yup=True, export_apply=True,
                          export_materials="EXPORT", export_texcoords=True,
                          export_normals=True, export_colors=False,
                          export_cameras=False, export_lights=False)
assert (out / "entrance-v4-baked.glb").stat().st_size > 5000

# Render a staging image using the baked appearance, including the receiver
# geometry: a real-world orientation check, NOT a marketing illustration.
cam = bpy.data.cameras.new("Gallery staging camera")
camera = bpy.data.objects.new("Gallery staging camera", cam)
scene.collection.objects.link(camera)
camera.location = museum_point(0, 1.72, .85)
look = Vector(museum_point(0, 3.1, 6.5)) - camera.location
camera.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
cam.type = "PERSP"
cam.lens = 22
scene.camera = camera
scene.render.filepath = str(out / "entrance-v4-blender-preview.png")
scene.render.resolution_x = 1000
scene.render.resolution_y = 650
scene.cycles.samples = 12
bpy.ops.render.render(write_still=True)
print("TEM V4 | baked GLB and Blender preview generated successfully", flush=True)
