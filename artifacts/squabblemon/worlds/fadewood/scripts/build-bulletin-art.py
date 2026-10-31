#!/usr/bin/env python3
"""Create bounded delivery copies of existing host artwork without cropping it.
Requires Pillow only when rebuilding; shipped derivatives need no Python at runtime.
"""
from pathlib import Path
from hashlib import sha256
import json
from PIL import Image, __version__ as pillow_version

frontend = Path(__file__).resolve().parents[3]
public = frontend / "public"
output = public / "scenes/fadewood/assets/bulletin"
output.mkdir(parents=True, exist_ok=True)
art = [
    ("assets/events/generated/fadepark-board-texture.webp", "cork.webp", 1024),
    ("assets/layered/festival-street.webp", "block-party.webp", 512),
    ("brand/squabblemon-standard-gold-share.jpg", "roster-pass.jpg", 512),
    ("assets/fight-night/rooms/rooftop-court.webp", "fight-night.webp", 512),
]
records = []
for source_name, name, maximum in art:
    source, target = public / source_name, output / name
    with Image.open(source) as original:
        source_size = original.size
        image = original.convert("RGB")
        image.thumbnail((maximum, maximum), Image.Resampling.LANCZOS)
        if target.suffix == ".jpg":
            image.save(target, quality=95, subsampling=0, optimize=True)
        else:
            image.save(target, format="WEBP", quality=95, method=6)
        delivery_size = image.size
    records.append({
        "source": source_name, "sourceSha256": sha256(source.read_bytes()).hexdigest(),
        "sourceBytes": source.stat().st_size, "sourcePixels": list(source_size),
        "file": name, "sha256": sha256(target.read_bytes()).hexdigest(),
        "bytes": target.stat().st_size, "pixels": list(delivery_size),
        "maxDimension": maximum,
    })
manifest = {"version": 1, "generator": "worlds/fadewood/scripts/build-bulletin-art.py", "encoder": f"Pillow {pillow_version}",
    "resize": "LANCZOS, aspect-preserving, no crop", "quality": 95, "jpegSubsampling": 0, "webpMethod": 6,
    "sourceDecodedBytes": sum(w*h*4 for item in records for w,h in [item["sourcePixels"]]),
    "decodedBytes": sum(w*h*4 for item in records for w,h in [item["pixels"]]), "art": records}
(output / "provenance.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps({"sourceDecodedBytes": manifest["sourceDecodedBytes"], "decodedBytes": manifest["decodedBytes"], "encodedBytes": sum(item["bytes"] for item in records)}))
