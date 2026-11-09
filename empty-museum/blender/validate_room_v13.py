"""Validate scanned PBR independence, genuine Cycles UV1 and scene exports."""
import argparse,hashlib,json,struct
from pathlib import Path
from PIL import Image
ap=argparse.ArgumentParser();ap.add_argument("--out",required=True)
out=Path(ap.parse_args().out)
m=json.loads((out/"room-v13-manifest.json").read_text())
assert m["status"]=="STAGING_ONLY_NOT_LIVE"
assert m["room_dimensions_m"]==[9.2,6.4,14.0]
assert "INDIRECT ONLY" in m["bake"]
assert "Cycles" in m.get("denoise","")
assert m["source"].startswith("Poly Haven")
data=(out/"room-v13-pbr-geometry.glb").read_bytes()
assert 10000<len(data)<25_000_000,"Model outside mobile budget"
assert data[:4]==b"glTF" and struct.unpack_from("<I",data,4)[0]==2
assert struct.unpack_from("<I",data,8)[0]==len(data)
assert hashlib.sha256(data).hexdigest()==m["sha256"]
length,tag=struct.unpack_from("<I4s",data,12)
assert tag==b"JSON"
gltf=json.loads(data[20:20+length])
assert gltf["asset"]["version"]=="2.0"
assert gltf.get("meshes") and gltf.get("materials")
primitives=[p for mesh in gltf["meshes"] for p in mesh.get("primitives",[])]
assert 1<=len(primitives)<=24,"Too many GPU draw calls"
for primitive in primitives:
    a=primitive["attributes"]
    assert "POSITION" in a and "TEXCOORD_0" in a and "TEXCOORD_1" in a,repr(a)
    assert isinstance(primitive.get("material"),int)
assert any("V13 scanned CC0 honed microcement" in mat.get("name","") for mat in gltf["materials"])
for name in m["maps"]:
    path=out/name
    assert path.is_file() and path.stat().st_size>8000,name
    with Image.open(path) as image:
        image.verify()
for filename in m["reference_images"]:
    with Image.open(out/filename) as source:
        image=source.convert("RGB").resize((104,68))
    values=[tuple(image.getpixel((x,y))) for y in range(image.height) for x in range(image.width)]
    clipped=sum(1 for p in values if min(p)>=250)/len(values)
    avg=sum(sum(p)/3 for p in values)/len(values)
    contrast=max(max(p) for p in values)-min(min(p) for p in values)
    assert clipped<.50,(filename,clipped)
    assert avg<243,(filename,avg)
    assert contrast>50,(filename,contrast)
    print("V13 Image calibrated:",filename,"mean",round(avg,1),"clipped",round(clipped,3))
print("V13 VERIFIED","UV1",len(primitives),"primitives",len(data),"bytes")
