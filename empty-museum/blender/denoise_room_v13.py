"""Preserve physical Cycles illumination, denoise only reference renders & GI atlas."""
import argparse,json
from pathlib import Path
import cv2

arg=argparse.ArgumentParser();arg.add_argument("--out",required=True)
p=Path(arg.parse_args().out)
for filename,strength in [
 ("room-v13-cycles-preview.png",10),
 ("room-v13-floor-detail.png",10),
 ("room-v13-indirect-gi.png",13)
]:
 file=p/filename
 original=cv2.imread(str(file),cv2.IMREAD_COLOR)
 if original is None:raise FileNotFoundError(file)
 filtered=cv2.fastNlMeansDenoisingColored(original,None,strength,strength,7,21)
 ok,out=cv2.imencode(".png",filtered,[cv2.IMWRITE_PNG_COMPRESSION,7])
 assert ok and len(out)>16000
 file.write_bytes(out.tobytes())
manifest=p/"room-v13-manifest.json"
data=json.loads(manifest.read_text())
data["denoise"]="OpenCV nonlocal means of true Blender Cycles samples; GI remains separate"
manifest.write_text(json.dumps(data,indent=2)+"\n")
print("DENOISED V13 TRUE CYCLES GI AND REFERENCE PNGS")
