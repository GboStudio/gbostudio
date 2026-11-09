"""V12 reference room: validate actual Blender output without trusting filenames alone.
Run python3 empty-museum/blender/validate_room_v12.py --out /tmp/tem-v12
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument("--out",required=True)
args=parser.parse_args()
out=Path(args.out)
manifest=json.loads((out/"room-v12-manifest.json").read_text())
assert manifest["status"]=="STAGING_ONLY_NOT_LIVE"
assert "Cycles" in manifest.get("denoise",""),"Export must include denoised, still physically calculated GI"
assert manifest["room_dimensions_m"]==[9.2,6.4,14.0]
assert manifest["floor_type"].startswith("continuous mineral microcement")
binary=(out/"room-v12-baked.glb").read_bytes()
assert 10_000<len(binary)<25_000_000, "GLB outside mobile budget"
assert binary[:4]==b"glTF" and struct.unpack_from("<I",binary,4)[0]==2
assert struct.unpack_from("<I",binary,8)[0]==len(binary)
assert hashlib.sha256(binary).hexdigest()==manifest["sha256"]
assert manifest["glb_bytes"]==len(binary)
jsonlen,chunk=struct.unpack_from("<I4s",binary,12)
assert chunk==b"JSON" and jsonlen>100
doc=json.loads(binary[20:20+jsonlen])
assert doc["asset"]["version"]=="2.0"
assert doc.get("meshes") and doc.get("materials") and doc.get("images")
assert any("bufferView" in image for image in doc["images"])
assert any("baseColorTexture" in mat.get("pbrMetallicRoughness",{}) for mat in doc["materials"])
primitives=[p for mesh in doc["meshes"] for p in mesh.get("primitives",[])]
assert 1<=len(primitives)<=12,"GLB needs a bounded number of draw calls"
for p in primitives:
    assert {"POSITION","TEXCOORD_0"}.issubset(p.get("attributes",{}))
    assert isinstance(p.get("material"),int)
for name in ("room-v12-cycles-preview.png","room-v12-floor-detail.png","room-v12-lightbake.png"):
    file=out/name
    data=file.read_bytes()
    assert data[:8]==b"\x89PNG\r\n\x1a\n",name
    assert len(data)>15_000,"Missing actual nontrivial image: "+name
    w,h=struct.unpack(">II",data[16:24])
    assert w>=512 and h>=512
    print("Valid PNG:",name,w,h,len(data),"bytes")

# A syntactically valid GLB is not a visually acceptable gallery.
# Guard against extreme highlight clipping in the *real Cycles images*.
from PIL import Image, ImageStat
for name in ("room-v12-cycles-preview.png","room-v12-floor-detail.png"):
    with Image.open(out/name) as source:
        image=source.convert("RGB").resize((104,68))
    pixels=list(image.getdata())
    values=[sum(px)/3 for px in pixels]
    clipped=sum(1 for px in pixels if min(px)>=250)/len(pixels)
    mean=sum(values)/len(values)
    spread=max(values)-min(values)
    assert clipped<.55, f"{name}: highlights clipped across {clipped:.0%} of the image"
    assert mean<243, f"{name}: mean luminance {mean:.1f} is too bright"
    assert spread>50, f"{name}: contrast spread {spread:.1f} is implausibly flat"
    print(f"V12 PHOTOMETRIC ACCEPTANCE: {name} mean={mean:.1f} clipped={clipped:.1%} range={spread:.0f}")

print("VALIDATED V12:",json.dumps({
    "room_dimensions_m":manifest["room_dimensions_m"],
    "glb_bytes":len(binary),
    "primitives":len(primitives),
    "sha256":manifest["sha256"],
    "samples":manifest["samples"]
},indent=2))
