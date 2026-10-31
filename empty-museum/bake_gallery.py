# Bake de GI / diffuse indirect pour The Empty Museum.
# Usage : blender --background --python bake_gallery.py -- /absolute/output
# Crée une scène témoin cohérente avec la galerie, puis bake Cycles.
# IMPORTANT : la scène live doit être exportée avec les MÊMES UV2 pour exploiter les maps.
import bpy, math, os, sys, json
from mathutils import Vector

args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
OUT=os.path.abspath(args[0]) if args else os.path.join(os.getcwd(),"tem-bake")
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
sc=bpy.context.scene
sc.render.engine="CYCLES"
sc.cycles.samples=96
sc.render.bake.use_clear=True
sc.render.bake.margin=12
sc.render.bake.target="IMAGE_TEXTURES"
sc.view_settings.view_transform="Standard"

def mat(name,rgba=(.88,.87,.84,1)):
    m=bpy.data.materials.new(name)
    m.diffuse_color=rgba
    m.use_nodes=True
    bsdf=m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value=rgba
    bsdf.inputs["Roughness"].default_value=.86
    return m

plaster=mat("White plaster",(.85,.85,.83,1))
mineral=mat("Mineral floor",(.72,.69,.65,1))
ceil=mat("White ceiling",(.92,.91,.89,1))
def cube(name,location,scale,material):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location)
    o=bpy.context.object;o.name=name
    o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    if not o.data.uv_layers:
        o.data.uv_layers.new(name="TEXCOORD_0")
    return o
surfaces=[
  cube("Wall",(0,3.4,-14.20),(32,.0+6.8,.04),plaster),
  cube("Floor",(0,-.08,-3.6),(32,.14,26),mineral),
  cube("Ceiling",(0,6.8,-3.6),(32,.16,26),ceil),
  cube("Left wall",(-16,3.4,-3.6),(.1,6.8,26),plaster),
  cube("Right wall",(16,3.4,-3.6),(.1,6.8,26),plaster)
]
for idx in range(10):
    x=-14.4+3.2*idx
    datab=bpy.data.lights.new("Area light %02d"%idx,'AREA')
    datab.energy=240
    datab.shape='RECTANGLE'
    datab.size=1.05
    datab.size_y=.45
    ob=bpy.data.objects.new(datab.name,datab)
    sc.collection.objects.link(ob)
    ob.location=(x,6.25,-10.3)
    direction=Vector((x,3.0,-14.0))-ob.location
    ob.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
sc.world.color=(.37,.37,.37)
saved=[]
for obj in surfaces:
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(island_margin=.025)
    bpy.ops.object.mode_set(mode='OBJECT')
    uv=obj.data.uv_layers.active
    uv.name="LIGHTMAP_UV2"
    image=bpy.data.images.new(obj.name.replace(" ","_")+"_GI",width=1024,height=1024,alpha=False,float_buffer=False)
    image.generated_color=(.15,.15,.15,1)
    m=obj.active_material.copy()
    obj.data.materials.clear()
    obj.data.materials.append(m)
    nodes=m.node_tree.nodes
    bakeNode=nodes.new("ShaderNodeTexImage")
    bakeNode.name="TEM_GI_BAKE_TARGET"
    bakeNode.image=image
    nodes.active=bakeNode
    try:
        bpy.ops.object.bake(type="DIFFUSE",pass_filter={"DIRECT","INDIRECT"})
        image.filepath_raw=os.path.join(OUT,"gi_"+obj.name.lower().replace(" ","_")+".png")
        image.file_format="PNG"
        image.save()
        saved.append(os.path.basename(image.filepath_raw))
    except Exception as e:
        print("Bake failed for",obj.name,":",e)
        raise
with open(os.path.join(OUT,"manifest.json"),"w",encoding="utf-8") as f:
    json.dump({"blender":bpy.app.version_string,"samples":sc.cycles.samples,"files":saved,"note":"Must match final engine geometry/UV2 to use in production"},f,indent=2)
print("TEM GI bake generated",saved)
