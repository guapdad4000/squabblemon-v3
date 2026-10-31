#!/usr/bin/env python3
"""Build/verify pixel-identical WebP world textures; preserve the GLB master."""
from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
from pathlib import Path
import struct

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "playable/public/assets/squabble-block.glb"
MASTER = ROOT / "work/slim/squabble-block-master.glb"
REPORT = ROOT / "outputs/slim/world-audit.json"
MASTER_SHA = "3ec72bf8ee013859b71e2d9141a27b63393973a4242a35dd49e48757b65aa50c"
EXT = "EXT_texture_webp"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def parse(raw):
    assert struct.unpack_from("<III", raw) == (0x46546C67, 2, len(raw))
    offset, chunks = 12, {}
    while offset < len(raw):
        length, kind = struct.unpack_from("<II", raw, offset)
        assert length % 4 == 0 and kind not in chunks
        chunks[kind] = raw[offset + 8:offset + 8 + length]
        assert len(chunks[kind]) == length
        offset += 8 + length
    assert offset == len(raw) and set(chunks) == {0x4E4F534A, 0x004E4942}
    doc = json.loads(chunks[0x4E4F534A])
    assert len(doc["buffers"]) == 1 and "uri" not in doc["buffers"][0]
    return doc, chunks[0x004E4942]


def view(doc, binary, index):
    data = doc["bufferViews"][index]
    assert data.get("buffer", 0) == 0
    start, length = data.get("byteOffset", 0), data["byteLength"]
    assert start % 4 == 0 and start + length <= doc["buffers"][0]["byteLength"]
    return binary[start:start + length]


def encode(doc, binary):
    doc["buffers"][0]["byteLength"] = len(binary)
    data = canonical(doc)
    data += b" " * (-len(data) % 4)
    binary += b"\0" * (-len(binary) % 4)
    length = 28 + len(data) + len(binary)
    return (struct.pack("<III", 0x46546C67, 2, length)
            + struct.pack("<II", len(data), 0x4E4F534A) + data
            + struct.pack("<II", len(binary), 0x004E4942) + binary)


def build(source_doc, source_bin):
    doc = copy.deepcopy(source_doc)
    replacements = {}
    assert len(doc["images"]) == 7
    for index, image in enumerate(doc["images"]):
        if image["mimeType"] != "image/png":
            assert image["mimeType"] == "image/jpeg"
            continue
        original = Image.open(io.BytesIO(view(source_doc, source_bin, image["bufferView"])))
        assert original.mode == "RGB" and not original.info.get("icc_profile")
        output = io.BytesIO()
        original.save(output, format="WEBP", lossless=True, exact=True, method=6)
        replacements[image["bufferView"]] = output.getvalue()
        image["mimeType"] = "image/webp"
        for texture in doc["textures"]:
            if texture.get("source") == index:
                assert not texture.get("extensions")
                del texture["source"]
                texture["extensions"] = {EXT: {"source": index}}
    assert len(replacements) == 6
    for field in ["extensionsUsed", "extensionsRequired"]:
        doc[field] = [*doc.get(field, []), EXT]
    binary = bytearray()
    for index, buffer_view in enumerate(doc["bufferViews"]):
        binary.extend(b"\0" * (-len(binary) % 4))
        data = replacements.get(index, view(source_doc, source_bin, index))
        buffer_view["byteOffset"] = len(binary)
        buffer_view["byteLength"] = len(data)
        binary.extend(data)
    return encode(doc, bytes(binary))


def verify(master_raw, runtime_raw):
    assert sha(master_raw) == MASTER_SHA, "The preserved world master changed."
    source, source_bin = parse(master_raw)
    target, target_bin = parse(runtime_raw)
    assert len(source["bufferViews"]) == len(target["bufferViews"])
    assert len(source["images"]) == len(target["images"]) == 7
    expected = copy.deepcopy(source)
    expected["buffers"] = copy.deepcopy(target["buffers"])
    expected["bufferViews"] = copy.deepcopy(target["bufferViews"])
    for field in ["extensionsUsed", "extensionsRequired"]:
        expected[field] = [*source.get(field, []), EXT]
    records, images = [], {image["bufferView"] for image in source["images"]}
    for index, (old_image, new_image) in enumerate(zip(source["images"], target["images"])):
        old_bytes = view(source, source_bin, old_image["bufferView"])
        new_bytes = view(target, target_bin, new_image["bufferView"])
        old = Image.open(io.BytesIO(old_bytes))
        new = Image.open(io.BytesIO(new_bytes))
        assert old.size == new.size
        assert old.convert("RGBA").tobytes() == new.convert("RGBA").tobytes(), old_image.get("name")
        if old_image["mimeType"] == "image/png":
            assert new_image["mimeType"] == "image/webp" and new.format == "WEBP"
            assert not new.info.get("icc_profile")
            expected["images"][index]["mimeType"] = "image/webp"
            for texture in expected["textures"]:
                if texture.get("source") == index:
                    del texture["source"]
                    texture["extensions"] = {EXT: {"source": index}}
        else:
            assert old_bytes == new_bytes, "Preserve the profiled JPEG byte-for-byte."
        records.append({"index": index, "name": old_image.get("name"), "sourceMime": old_image["mimeType"],
                        "runtimeMime": new_image["mimeType"], "width": old.width, "height": old.height,
                        "sourceBytes": len(old_bytes), "runtimeBytes": len(new_bytes),
                        "sourceSha256": sha(old_bytes), "runtimeSha256": sha(new_bytes),
                        "rgbaSha256": sha(old.convert("RGBA").tobytes()) if old_image["mimeType"] == "image/png" else None,
                        "pixelsIdentical": True})
    assert target == expected, "Only texture format/routing, offsets and extension declarations may change."
    retained = []
    for index, (old, new) in enumerate(zip(source["bufferViews"], target["bufferViews"])):
        if index in images:
            continue
        assert {k: v for k, v in old.items() if k != "byteOffset"} == {k: v for k, v in new.items() if k != "byteOffset"}
        old_bytes, new_bytes = view(source, source_bin, index), view(target, target_bin, index)
        assert old_bytes == new_bytes, f"Geometry/rig/animation bufferView {index} changed."
        retained.append(old_bytes)
    aggregate = b"".join(retained)
    assert sha(aggregate) == "f109a353b8edd5bfbf6d9945ae371e0a6df91999e17c0e815cd16419bbb8ed29"
    return {"master": str(MASTER.relative_to(ROOT)), "runtime": str(TARGET.relative_to(ROOT)),
            "sourceBytes": len(master_raw), "runtimeBytes": len(runtime_raw),
            "savedBytes": len(master_raw) - len(runtime_raw), "sourceSha256": sha(master_raw),
            "runtimeSha256": sha(runtime_raw), "images": records,
            "nonImageBufferViews": len(retained), "nonImageBytes": len(aggregate),
            "nonImageSha256": sha(aggregate), "allNonImageViewsIdentical": True,
            "sceneMaterialsSamplersGeometryRigsAndAllFourClipsIdentical": True,
            "scope": "Encoded file bytes and exact decoded pixel/data equivalence; runtime decoding checked separately in browser."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true", help="Read and verify saved artifacts without modifying files.")
    args = parser.parse_args()
    if args.verify:
        report = verify(MASTER.read_bytes(), TARGET.read_bytes())
        saved = json.loads(REPORT.read_text())
        assert report == saved, "Saved world audit differs from actual artifacts."
    else:
        MASTER.parent.mkdir(parents=True, exist_ok=True)
        if not MASTER.exists():
            original = TARGET.read_bytes()
            assert sha(original) == MASTER_SHA
            MASTER.write_bytes(original)
        original = MASTER.read_bytes()
        assert sha(original) == MASTER_SHA
        doc, binary = parse(original)
        runtime = build(doc, binary)
        report = verify(original, runtime)
        TARGET.write_bytes(runtime)
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: report[key] for key in ["sourceBytes", "runtimeBytes", "savedBytes", "allNonImageViewsIdentical"]}))


if __name__ == "__main__":
    main()
