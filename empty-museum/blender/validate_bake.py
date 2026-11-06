"""Gate the actual baked GLB (not just the Blender script) before deployment.

Usage: python3 empty-museum/blender/validate_bake.py --asset-dir empty-museum/assets
No third-party Python packages required.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument("--asset-dir",default="empty-museum/assets")
args=parser.parse_args()
directory=Path(args.asset_dir)
glb=directory/"entrance-v4-baked.glb"
png=directory/"entrance-v4-lightbake.png"
preview=directory/"entrance-v4-blender-preview.png"
assert all(p.is_file() for p in [glb,png,preview]), "Missing baked GLB, PNG or Blender preview"
data=glb.read_bytes()
assert 10_000<len(data)<25_000_000, "GLB too small or over budget"
assert data[:4]==b"glTF" and struct.unpack_from("<I",data,4)[0]==2, "Not valid glTF 2.0"
assert struct.unpack_from("<I",data,8)[0]==len(data), "Corrupted GLB length"
length,kind=struct.unpack_from("<I4s",data,12)
assert kind==b"JSON" and 0<length<len(data)-20, "GLB JSON chunk missing"
doc=json.loads(data[20:20+length])
asset=doc.get("asset",{})
assert str(asset.get("version"))=="2.0", "GLB asset version is not 2.0"
assert doc.get("scenes") and doc.get("nodes") and doc.get("meshes"), "Architecture is empty"
images=doc.get("images",[])
assert images and any("bufferView" in i for i in images), "Baked light texture must be embedded"
materials=doc.get("materials",[])
textures=doc.get("textures",[])
assert any("baseColorTexture" in m.get("pbrMetallicRoughness",{}) for m in materials), "Lightmap is not attached to the GLB material"
assert textures, "No baked texture entries"
primitives=[p for mesh in doc["meshes"] for p in mesh.get("primitives",[])]
assert primitives and len(primitives)<=12, "Too many GPU draw calls"
for prim in primitives:
    assert "POSITION" in prim.get("attributes",{}), "Mesh lacks positions"
    assert "TEXCOORD_0" in prim["attributes"], "Mesh lacks unwrapped bake UV"
    assert "material" in prim, "Mesh is untextured"
accessors=doc.get("accessors",[])
vertices=sum(accessors[p["attributes"]["POSITION"]].get("count",0) for p in primitives)
assert 200<vertices<250_000, f"Unexpected geometry complexity: {vertices}"
assert png.read_bytes()[:8]==b"\x89PNG\r\n\x1a\n", "Lightmap not PNG"
pw,ph=struct.unpack(">II",png.read_bytes()[16:24])
assert pw>=512 and ph>=512 and pw==ph, "Bake texture resolution invalid"
assert preview.read_bytes()[:8]==b"\x89PNG\r\n\x1a\n", "Preview image not PNG"
assert png.stat().st_size>18_000, "Bake is suspiciously small or missing"
assert preview.stat().st_size>20_000, "Preview is suspiciously small or missing"
manifest={
  "asset":"TEM_V4_CYCLES_BAKED_ENTRANCE",
  "generator":"Blender Cycles diffuse bake (COLOR + DIRECT + INDIRECT)",
  "asset_file":glb.name,
  "bake_texture":png.name,
  "preview":preview.name,
  "sha256":hashlib.sha256(data).hexdigest(),
  "glb_bytes":len(data),
  "vertices":vertices,
  "primitives":len(primitives),
  "embedded_images":len(images),
  "texture_size":[pw,ph],
  "lighting":"static, baked; color/light do not react dynamically",
  "v3_fallback":True
}
(directory/"entrance-v4-manifest.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n")
print("V4 BAKED GLB VERIFIED:",json.dumps(manifest,ensure_ascii=False),flush=True)
