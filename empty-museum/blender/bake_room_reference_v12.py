"""THE UNREAL MUSEUM — V12 architectural reference room.
Standalone, true Blender Cycles test room (14 m). Nothing in this script replaces
the production gallery or alters the real exhibit inventory/navigation.

Two separate deliverables:
1. Physically shaded Cycles reference images (look-development truth).
2. A STATIC diffuse+direct+indirect UV bake embedded in a GLB for WebGL tests.
A baked diffuse GLB does not encode specular highlights or realtime GI.
Run:
 blender --background --factory-startup --python \
   empty-museum/blender/bake_room_reference_v12.py -- \
   --out /tmp/tem-v12 --samples 20 --size 1024
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

cli=argparse.ArgumentParser()
cli.add_argument("--out",default="/tmp/tem-v12")
cli.add_argument("--size",type=int,default=1024)
cli.add_argument("--samples",type=int,default=20)
args=cli.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
assert 512<=args.size<=2048
out=Path(args.out).resolve()
out.mkdir(parents=True,exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.device="CPU"
scene.cycles.samples=max(8,min(48,args.samples))
scene.cycles.max_bounces=5
scene.render.resolution_x=1040
scene.render.resolution_y=680
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.film_transparent=False
for layer in scene.view_layers:
    # Ubuntu Blender lacks OpenImageDenoiser. Disable to avoid runtime crash.
    if hasattr(layer.cycles,"use_denoising"):
        layer.cycles.use_denoising=False
if hasattr(scene.cycles,"use_denoising"):
    scene.cycles.use_denoising=False
scene.view_settings.view_transform="Standard"
scene.view_settings.look="Medium High Contrast"
scene.view_settings.exposure=-1.3

world=bpy.data.worlds.new("Museum neutral environment")
scene.world=world
world.use_nodes=True
bg=world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value=(.83,.85,.88,1)
bg.inputs["Strength"].default_value=.15

def material(name,color,roughness=.88,metalness=0):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    bsdf=m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value=(*color,1)
    bsdf.inputs["Roughness"].default_value=roughness
    bsdf.inputs["Metallic"].default_value=metalness
    return m,bsdf

def mineral(name,light,dark,macro_scale,micro_scale,bump_distance,roughness):
    m,bsdf=material(name,light,roughness)
    nodes=m.node_tree.nodes
    links=m.node_tree.links
    coords=nodes.new("ShaderNodeTexCoord")
    macro=nodes.new("ShaderNodeTexNoise")
    macro.inputs["Scale"].default_value=macro_scale
    macro.inputs["Detail"].default_value=2.5
    macro.inputs["Roughness"].default_value=.68
    links.new(coords.outputs["Generated"],macro.inputs["Vector"])
    # Deliberately low contrast: natural mineral/cloud variation, not marble veins.
    ramp=nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position=.22
    ramp.color_ramp.elements[0].color=(*dark,1)
    ramp.color_ramp.elements[1].position=.78
    ramp.color_ramp.elements[1].color=(*light,1)
    links.new(macro.outputs["Fac"],ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"],bsdf.inputs["Base Color"])
    micro=nodes.new("ShaderNodeTexNoise")
    micro.inputs["Scale"].default_value=micro_scale
    micro.inputs["Detail"].default_value=2
    links.new(coords.outputs["Generated"],micro.inputs["Vector"])
    bump=nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value=.055
    bump.inputs["Distance"].default_value=bump_distance
    links.new(micro.outputs["Fac"],bump.inputs["Height"])
    links.new(bump.outputs["Normal"],bsdf.inputs["Normal"])
    rough=nodes.new("ShaderNodeMapRange")
    rough.inputs["From Min"].default_value=.05
    rough.inputs["From Max"].default_value=.95
    rough.inputs["To Min"].default_value=roughness-.038
    rough.inputs["To Max"].default_value=roughness+.038
    links.new(micro.outputs["Fac"],rough.inputs["Value"])
    links.new(rough.outputs["Result"],bsdf.inputs["Roughness"])
    return m

# No artificial square slab pattern or faux painted joints in the floor.
microcement=mineral("V12 continuous honed microcement",
    (.755,.741,.715),(.744,.728,.707),.47,225,.0008,.82)
plaster=mineral("V12 fine warm ivory plaster",
    (.84,.833,.815),(.835,.827,.81),.65,260,.00045,.94)
stone=mineral("V12 honed limestone plinth",
    (.79,.781,.759),(.773,.763,.742),1.8,170,.0008,.85)
bronze,_=material("V12 aged brushed brass",(.49,.42,.31),.56,.63)
shadow,_=material("V12 recessed neutral reveals",(.56,.55,.535),.94)
white,_=material("V12 soft matte frame",(.89,.88,.864),.9)
art,_=material("V12 neutral demonstration paintings",(.62,.65,.66),.91)
opal,opal_bsdf=material("V12 recessed diffusers",(.92,.917,.89),.62)
if "Emission Color" in opal_bsdf.inputs:
    opal_bsdf.inputs["Emission Color"].default_value=(.97,.96,.94,1)
    opal_bsdf.inputs["Emission Strength"].default_value=.17

# Blender Z up; museum y vertical and z forward. glTF export converts to Y up.
def pt(x,y,z):return (x,-z,y)
meshes=[]
def box(name,x,y,z,w,h,d,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pt(x,y,z))
    ob=bpy.context.object
    ob.name=name
    ob.dimensions=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    ob.data.materials.append(mat)
    if bevel:
        mod=ob.modifiers.new("physically eased edge","BEVEL")
        mod.width=bevel
        mod.segments=2
        bpy.context.view_layer.objects.active=ob
        bpy.ops.object.modifier_apply(modifier=mod.name)
    meshes.append(ob)
    return ob

ROOM_W=9.2
ROOM_L=14.
ROOM_H=6.4
# The floor is ONE physically continuous cast surface, not 4x60 game tiles.
box("ONE CONTINUOUS MICROCEMENT FLOOR",0,-.135,ROOM_L/2,ROOM_W,.25,ROOM_L,microcement,.007)
for side in (-1,1):
    box("plaster wall",side*4.63,3.2,ROOM_L/2,.16,ROOM_H,ROOM_L,plaster)
    box("real white stone skirting",side*4.49,.13,ROOM_L/2,.135,.245,ROOM_L,stone,.008)
    box("skirting shadow reveal",side*4.41,.265,ROOM_L/2,.014,.018,ROOM_L,shadow)
box("far gallery wall",0,3.2,ROOM_L+.045,ROOM_W,ROOM_H,.10,plaster)
box("ceiling slab",0,6.48,ROOM_L/2,ROOM_W,.16,ROOM_L,plaster)
for side in (-1,1):
    box("continuous concealed ceiling cove",side*3.24,6.34,ROOM_L/2,.21,.11,ROOM_L,stone,.008)
    box("opal concealed ceiling diffuser",side*3.09,6.278,ROOM_L/2,.085,.028,ROOM_L,opal)
    box("fine ceiling reveal",side*3.39,6.33,ROOM_L/2,.021,.032,ROOM_L,shadow)

# One understated vestibule opening: normal human scale, light on the wall.
for side in (-1,1):
    box("stone threshold pier",side*4.04,2.65,3.35,.29,5.15,.33,stone,.012)
    box("shadow line threshold",side*3.858,2.60,3.35,.021,4.85,.38,shadow)
box("white threshold lintel",0,5.27,3.35,8.08,.29,.42,stone,.012)
box("underside reveal",0,5.085,3.35,7.96,.022,.44,shadow)

# Uncopyrighted sample works for material and lighting calibration only:
# no production artwork, price, placement ID, or reservation state is touched.
for side in (-1,1):
    for i,z in enumerate((5.4,9.6)):
        x=side*4.485
        box("art contact shadow",x,2.30,z,.075,1.82,2.26,shadow,.008)
        box("floating natural wood/stone frame",side*4.425,2.30,z,.12,1.74,2.17,bronze,.008)
        box("warm white mat board",side*4.34,2.30,z,.023,1.61,2.00,white)
        box("placeholder artwork matte",side*4.316,2.30,z,.009,1.41,1.80,art)
        box("brass wall label",side*4.39,1.45,z+1.30,.036,.18,.29,bronze,.004)
        box("plaque inset",side*4.365,1.45,z+1.30,.009,.145,.26,stone)
# Physically grounded visitor seat: realistic contact shadow, no fantasy CGI.
box("quiet limestone bench seat",1.7,.53,11.05,1.12,.15,1.95,stone,.035)
for z in (10.43,11.66):
    box("bench pedestal",1.7,.245,z,.68,.48,.23,stone,.02)

def area(name,x,y,z,power,sizex,sizey,target_x,target_y,target_z):
    data=bpy.data.lights.new(name,"AREA")
    data.energy=power
    data.shape="RECTANGLE"
    data.size=sizex
    data.size_y=sizey
    data.color=(1.0,.975,.95)
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=pt(x,y,z)
    obj.rotation_euler=(Vector(pt(target_x,target_y,target_z))-obj.location).to_track_quat("-Z","Y").to_euler()

for z in (2.2,6.2,10.4):
    area("large diffused ceiling source",0,6.12,z,108,3.4,2.4,0,.8,z+.3)
for side in (-1,1):
    for z in (5.4,9.6):
        area("gentle framed artwork wallwasher",side*2.45,5.74,z-.25,175,1.45,.8,side*4.4,2.35,z)

def camera_for(name,x,y,z,aim_x,aim_y,aim_z,lens):
    data=bpy.data.cameras.new(name)
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=pt(x,y,z)
    obj.rotation_euler=(Vector(pt(aim_x,aim_y,aim_z))-obj.location).to_track_quat("-Z","Y").to_euler()
    data.lens=lens
    data.clip_end=70
    scene.camera=obj
    return obj

def render(name,x,y,z,tx,ty,tz,lens):
    camera_for(name+" camera",x,y,z,tx,ty,tz,lens)
    scene.render.filepath=str(out/name)
    scene.cycles.samples=max(12,min(args.samples,40))
    bpy.ops.render.render(write_still=True)

# These images are real Cycles calculations, not generated concept art.
render("room-v12-cycles-preview.png",.15,1.72,-.9,0,2.35,8.2,30)
render("room-v12-floor-detail.png",1.45,1.68,4.3,.0,.07,8.8,35)

# Bake the EXACT room geometry used for these reference shots.
bpy.ops.object.select_all(action="DESELECT")
for ob in meshes:ob.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.join()
room=bpy.context.object
room.name="TEM_V12_REFERENCE_ROOM_STATIC"
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(island_margin=.012)
bpy.ops.object.mode_set(mode="OBJECT")
assert room.data.uv_layers.active is not None
tex=bpy.data.images.new("V12_static_Cycles_color_direct_indirect",width=args.size,height=args.size,alpha=False)
tex.colorspace_settings.name="sRGB"
for mat in room.data.materials:
    target=mat.node_tree.nodes.new("ShaderNodeTexImage")
    target.name="V12_BAKE_TARGET"
    target.image=tex
    mat.node_tree.nodes.active=target
scene.render.bake.margin=9
scene.render.bake.use_clear=True
scene.render.bake.use_pass_color=True
scene.render.bake.use_pass_direct=True
scene.render.bake.use_pass_indirect=True
scene.render.bake.use_pass_glossy=False
scene.render.bake.use_pass_transmission=False
scene.render.bake.use_pass_emit=False
bpy.ops.object.select_all(action="DESELECT")
room.select_set(True)
bpy.context.view_layer.objects.active=room
print("V12 | Baking EXACT reference geometry via Cycles indirect bounce",flush=True)
scene.cycles.samples=max(8,min(args.samples,40))
bpy.ops.object.bake(type="DIFFUSE",pass_filter={"COLOR","DIRECT","INDIRECT"})
tex.filepath_raw=str(out/"room-v12-lightbake.png")
tex.file_format="PNG"
tex.save()

m,_=material("V12_GLTF_baked_light_only",(1,1,1),1)
image=m.node_tree.nodes.new("ShaderNodeTexImage")
image.image=tex
m.node_tree.links.new(image.outputs["Color"],m.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
room.data.materials.clear()
room.data.materials.append(m)
bpy.ops.object.select_all(action="DESELECT")
room.select_set(True)
bpy.context.view_layer.objects.active=room
asset=out/"room-v12-baked.glb"
bpy.ops.export_scene.gltf(filepath=str(asset),export_format="GLB",
  use_selection=True,export_yup=True,export_apply=True,
  export_materials="EXPORT",export_texcoords=True,export_normals=True,
  export_colors=False,export_cameras=False,export_lights=False)

data=asset.read_bytes()
assert len(data)>10000
report={
 "asset":"TEM_V12_CYCLES_REFERENCE_ROOM",
 "status":"STAGING_ONLY_NOT_LIVE",
 "room_dimensions_m":[ROOM_W,ROOM_H,ROOM_L],
 "floor_type":"continuous mineral microcement, no tiled slab pattern",
 "lightmap":"Cycles DIFFUSE COLOR + DIRECT + INDIRECT",
 "reference_images":["room-v12-cycles-preview.png","room-v12-floor-detail.png"],
 "asset_file":asset.name,"bake_file":"room-v12-lightbake.png",
 "sha256":hashlib.sha256(data).hexdigest(),"glb_bytes":len(data),
 "samples":scene.cycles.samples,"atlas_size":[args.size,args.size],
 "caveat":"GLB stores static baked diffuse illumination, NOT dynamic physical reflections"
}
(out/"room-v12-manifest.json").write_text(json.dumps(report,indent=2)+"\n")
print("V12 CYCLES ROOM GENERATED:",json.dumps(report),flush=True)
