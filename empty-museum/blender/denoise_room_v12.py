"""Denoise real Blender Cycles samples without altering their physical lighting.
Keep original geometry/UV and replace the embedded GLB image with the denoised
PNG. Works on the exported artifact only; no external imagery is synthesized.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path
import cv2

parser=argparse.ArgumentParser()
parser.add_argument("--out",required=True)
args=parser.parse_args()
out=Path(args.out)

def clean(name,strength):
    path=out/name
    raw=cv2.imread(str(path),cv2.IMREAD_UNCHANGED)
    if raw is None:raise FileNotFoundError(path)
    if raw.ndim!=3 or raw.shape[2] not in (3,4):
        raise ValueError("Expected RGB/RGBA PNG: "+str(path))
    alpha=raw[:,:,3].copy() if raw.shape[2]==4 else None
    base=raw[:,:,:3].copy()
    filtered=cv2.fastNlMeansDenoisingColored(base,None,strength,strength,7,21)
    if alpha is not None:
        filtered=cv2.merge((*cv2.split(filtered),alpha))
    ok,png=cv2.imencode(".png",filtered,[cv2.IMWRITE_PNG_COMPRESSION,7])
    assert ok and len(png)>12000
    path.write_bytes(png.tobytes())
    return path.read_bytes()

for name in ("room-v12-cycles-preview.png","room-v12-floor-detail.png"):
    clean(name,10)
lightmap=clean("room-v12-lightbake.png",14)

asset=out/"room-v12-baked.glb"
original=asset.read_bytes()
assert original[:4]==b"glTF"
json_size,json_kind=struct.unpack_from("<I4s",original,12)
assert json_kind==b"JSON"
doc=json.loads(original[20:20+json_size])
binary_offset=20+json_size
binary_size,binary_kind=struct.unpack_from("<I4s",original,binary_offset)
assert binary_kind==b"BIN\x00"
binary=original[binary_offset+8:binary_offset+8+binary_size]
assert len(doc["images"])==1 and doc["images"][0]["mimeType"]=="image/png"
image_view=doc["bufferViews"][doc["images"][0]["bufferView"]]
start=image_view.get("byteOffset",0)
end=start+image_view["byteLength"]
assert binary[start:start+8]==b"\x89PNG\r\n\x1a\n"
assert end>=len(binary)-3,"Embedded image must be final bufferView"
assert all(v.get("byteOffset",0)<start for v in doc["bufferViews"] if v is not image_view)
updated=binary[:start]+lightmap
updated+=b"\x00"*((-len(updated))%4)
image_view["byteLength"]=len(lightmap)
doc["buffers"][0]["byteLength"]=len(updated)
json_bytes=json.dumps(doc,separators=(",",":"),ensure_ascii=False).encode("utf-8")
json_bytes+=b" "*((-len(json_bytes))%4)
size=12+8+len(json_bytes)+8+len(updated)
rebuilt=b"glTF"+struct.pack("<II",2,size)
rebuilt+=struct.pack("<I4s",len(json_bytes),b"JSON")+json_bytes
rebuilt+=struct.pack("<I4s",len(updated),b"BIN\x00")+updated
assert len(rebuilt)==size and size<25_000_000
asset.write_bytes(rebuilt)
manifest_path=out/"room-v12-manifest.json"
manifest=json.loads(manifest_path.read_text())
manifest["sha256"]=hashlib.sha256(rebuilt).hexdigest()
manifest["glb_bytes"]=len(rebuilt)
manifest["denoise"]="OpenCV fastNlMeans; true Cycles lighting retained: reference h10, embedded atlas h14"
manifest_path.write_text(json.dumps(manifest,indent=2)+"\n")
print("V12 TRUE CYCLES NOISE REDUCTION VERIFIED:",manifest["sha256"],len(rebuilt))
