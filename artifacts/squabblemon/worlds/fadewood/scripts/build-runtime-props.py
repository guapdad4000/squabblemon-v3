#!/usr/bin/env python3
"""Build exact-art, albedo-only props from the immutable audited uploads.

Only the unused normal and metallic/roughness textures and their embedded image
views are omitted. Every other bufferView, accessor, scene transform, material
property and the original base-color JPEG is preserved. This targets the current
loadNeighborhoodProps MeshBasicMaterial conversion; it does not change that code.

Run from any directory: python3 playable/scripts/build-runtime-props.py
"""
from __future__ import annotations

import copy
import hashlib
import json
import math
from pathlib import Path
import struct
import subprocess

PLAYABLE = Path(__file__).resolve().parents[1]
ROOT = PLAYABLE.parent
SOURCE_AUDIT = ROOT / "outputs/props/asset-audit.json"
TARGET = PLAYABLE / "public/assets/props"
AUDIT = ROOT / "outputs/slim/props-audit.json"
COMPONENT_BYTES = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
TYPE_COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def read_glb(path):
    raw = path.read_bytes()
    assert struct.unpack_from("<III", raw) == (0x46546C67, 2, len(raw)), path
    offset, chunks = 12, {}
    while offset < len(raw):
        length, kind = struct.unpack_from("<II", raw, offset)
        assert length % 4 == 0 and offset + 8 + length <= len(raw), path
        assert kind not in chunks, path
        chunks[kind] = raw[offset + 8:offset + 8 + length]
        offset += 8 + length
    assert offset == len(raw) and set(chunks) == {0x4E4F534A, 0x004E4942}, path
    doc = json.loads(chunks[0x4E4F534A])
    assert len(doc["buffers"]) == 1 and "uri" not in doc["buffers"][0], path
    # Fail closed rather than silently dropping extension-owned dependencies.
    assert not doc.get("extensionsUsed") and not doc.get("extensionsRequired"), path
    assert not doc.get("animations") and not doc.get("skins"), path
    return raw, doc, chunks[0x004E4942]


def view_bytes(doc, binary, index):
    view = doc["bufferViews"][index]
    assert view.get("buffer", 0) == 0
    offset, length = view.get("byteOffset", 0), view["byteLength"]
    assert offset >= 0 and offset + length <= doc["buffers"][0]["byteLength"]
    return binary[offset:offset + length]


def accessor_bytes(doc, binary, index):
    accessor = doc["accessors"][index]
    assert "sparse" not in accessor
    view = doc["bufferViews"][accessor["bufferView"]]
    width = COMPONENT_BYTES[accessor["componentType"]] * TYPE_COMPONENTS[accessor["type"]]
    stride, offset = view.get("byteStride", width), accessor.get("byteOffset", 0)
    data = view_bytes(doc, binary, accessor["bufferView"])
    assert offset + (accessor["count"] - 1) * stride + width <= len(data)
    return b"".join(data[offset + row * stride:offset + row * stride + width]
                    for row in range(accessor["count"]))


def geometry_summary(doc, binary):
    vertices, triangles, bounds = 0, 0, []
    for mesh in doc["meshes"]:
        for primitive in mesh["primitives"]:
            assert primitive.get("mode", 4) == 4
            position = doc["accessors"][primitive["attributes"]["POSITION"]]
            assert position["type"] == "VEC3" and position["componentType"] == 5126
            points = list(struct.iter_unpack("<fff", accessor_bytes(doc, binary, primitive["attributes"]["POSITION"])))
            assert all(math.isfinite(value) for point in points for value in point)
            actual = {"min": [min(point[axis] for point in points) for axis in range(3)],
                      "max": [max(point[axis] for point in points) for axis in range(3)]}
            assert actual == {"min": position["min"], "max": position["max"]}
            bounds.append(actual)
            vertices += position["count"]
            count = doc["accessors"][primitive["indices"]]["count"] if "indices" in primitive else position["count"]
            assert count % 3 == 0
            triangles += count // 3
    return {"vertices": vertices, "triangles": triangles, "primitiveBounds": bounds}


def write_glb(doc, binary):
    doc["buffers"][0]["byteLength"] = len(binary)
    encoded = canonical(doc)
    encoded += b" " * (-len(encoded) % 4)
    binary += b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(encoded) + 8 + len(binary)
    return (struct.pack("<III", 0x46546C67, 2, total)
            + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
            + struct.pack("<II", len(binary), 0x004E4942) + binary)


def compact(record):
    source_path = Path(record["source"])
    source_raw, source, source_bin = read_glb(source_path)
    assert digest(source_raw) == record["sha256"] and len(source_raw) == record["bytes"], source_path
    doc = copy.deepcopy(source)
    assert len(doc["materials"]) == 1 and len(doc["images"]) == len(doc["textures"]) == 3, source_path
    material = doc["materials"][0]
    # Future maps need an explicit review of what the runtime displays.
    assert set(material) <= {"name", "doubleSided", "pbrMetallicRoughness", "normalTexture", "alphaMode", "alphaCutoff", "extras"}, source_path
    pbr = material["pbrMetallicRoughness"]
    assert set(pbr) <= {"baseColorTexture", "metallicRoughnessTexture", "baseColorFactor", "metallicFactor", "roughnessFactor"}, source_path
    keep_texture = pbr["baseColorTexture"]["index"]
    texture = copy.deepcopy(doc["textures"][keep_texture])
    keep_image = texture["source"]
    image = copy.deepcopy(doc["images"][keep_image])
    assert image["mimeType"] == "image/jpeg" and "uri" not in image, source_path
    assert {keep_texture, material["normalTexture"]["index"], pbr["metallicRoughnessTexture"]["index"]} == set(range(3)), source_path
    assert {item["source"] for item in doc["textures"]} == set(range(3)), source_path
    image_views = {item["bufferView"] for item in doc["images"]}
    assert len(image_views) == 3
    removed_views = image_views - {image["bufferView"]}
    assert not removed_views.intersection(accessor["bufferView"] for accessor in doc["accessors"]), source_path

    del material["normalTexture"]
    del pbr["metallicRoughnessTexture"]
    pbr["baseColorTexture"]["index"] = 0
    texture["source"] = 0
    doc["textures"], doc["images"] = [texture], [image]

    binary, views, view_indices, retained_views = bytearray(), [], {}, []
    for old_index, original in enumerate(source["bufferViews"]):
        if old_index in removed_views:
            continue
        data = view_bytes(source, source_bin, old_index)
        binary.extend(b"\0" * (-len(binary) % 4))
        view = copy.deepcopy(original)
        view["byteOffset"] = len(binary)
        view_indices[old_index] = len(views)
        retained_views.append({"sourceView": old_index, "runtimeView": len(views), "bytes": len(data), "sha256": digest(data)})
        views.append(view)
        binary.extend(data)
    doc["bufferViews"] = views
    doc["images"][0]["bufferView"] = view_indices[image["bufferView"]]
    for accessor in doc["accessors"]:
        accessor["bufferView"] = view_indices[accessor["bufferView"]]
    destination = TARGET / record["file"]
    destination.write_bytes(write_glb(doc, bytes(binary)))

    # Compare bytes reread from disk; metadata equality permits only the planned
    # texture/view remaps and the two removed material map references.
    runtime_raw, result, result_bin = read_glb(destination)
    restored = copy.deepcopy(result)
    restored["buffers"] = copy.deepcopy(source["buffers"])
    restored["bufferViews"] = copy.deepcopy(source["bufferViews"])
    restored["textures"], restored["images"] = copy.deepcopy(source["textures"]), copy.deepcopy(source["images"])
    restored["materials"][0]["normalTexture"] = copy.deepcopy(source["materials"][0]["normalTexture"])
    restored_pbr = restored["materials"][0]["pbrMetallicRoughness"]
    restored_pbr["baseColorTexture"]["index"] = keep_texture
    restored_pbr["metallicRoughnessTexture"] = copy.deepcopy(source["materials"][0]["pbrMetallicRoughness"]["metallicRoughnessTexture"])
    inverse_views = {new: old for old, new in view_indices.items()}
    for accessor in restored["accessors"]:
        accessor["bufferView"] = inverse_views[accessor["bufferView"]]
    assert restored == source, (source_path, "unexpected metadata change")
    for item in retained_views:
        before = view_bytes(source, source_bin, item["sourceView"])
        after = view_bytes(result, result_bin, item["runtimeView"])
        assert before == after
        old_meta = {key: value for key, value in source["bufferViews"][item["sourceView"]].items() if key != "byteOffset"}
        new_meta = {key: value for key, value in result["bufferViews"][item["runtimeView"]].items() if key != "byteOffset"}
        assert old_meta == new_meta
    retained_accessors = []
    for index in range(len(source["accessors"])):
        before, after = accessor_bytes(source, source_bin, index), accessor_bytes(result, result_bin, index)
        assert before == after
        retained_accessors.append({"sourceAccessor": index, "runtimeAccessor": index, "bytes": len(after), "sha256": digest(after)})
    source_albedo = view_bytes(source, source_bin, source["images"][keep_image]["bufferView"])
    runtime_albedo = view_bytes(result, result_bin, result["images"][0]["bufferView"])
    assert source_albedo == runtime_albedo
    geometry = geometry_summary(source, source_bin)
    assert geometry == geometry_summary(result, result_bin)
    assert geometry["vertices"] == record["vertices"] and geometry["triangles"] == record["triangles"]
    assert source_path.read_bytes() == source_raw, "Source file changed"
    return {
        "file": record["file"], "source": str(source_path),
        "sourceBytes": len(source_raw), "runtimeBytes": len(runtime_raw), "savedBytes": len(source_raw) - len(runtime_raw),
        "sourceSha256": digest(source_raw), "runtimeSha256": digest(runtime_raw),
        "sourceImages": len(source["images"]), "runtimeImages": len(result["images"]),
        "sourceTextures": len(source["textures"]), "runtimeTextures": len(result["textures"]),
        "sourceColorImageIndex": keep_image, "runtimeColorImageIndex": 0,
        "albedoBytes": len(source_albedo), "albedoSha256": digest(source_albedo),
        "retainedBufferViews": retained_views, "retainedAccessors": retained_accessors,
        **geometry, "allRetainedBytesEqual": True, "visibleMaterialPropertiesEqual": True, "sourceUnchanged": True,
    }


def main():
    historical_raw = SOURCE_AUDIT.read_bytes()
    historical = json.loads(historical_raw)
    assert len(historical["assets"]) == 5
    TARGET.mkdir(parents=True, exist_ok=True)
    assets = [compact(record) for record in historical["assets"]]
    source_bytes = sum(asset["sourceBytes"] for asset in assets)
    runtime_bytes = sum(asset["runtimeBytes"] for asset in assets)
    audit = {
        "purpose": "Exact-art albedo-only runtime prop GLBs for the existing MeshBasicMaterial conversion",
        "scope": "Download and image-decode budget; not a GPU appearance or target-device FPS claim",
        "sourceAudit": "outputs/props/asset-audit.json", "sourceAuditSha256": digest(historical_raw),
        "sourcePolicy": "Audited original source paths are immutable references and are never modified.",
        "runtimeDirectory": "playable/public/assets/props",
        "sourceBytes": source_bytes, "runtimeBytes": runtime_bytes, "savedBytes": source_bytes - runtime_bytes,
        "savedPercent": (source_bytes - runtime_bytes) / source_bytes * 100,
        "totalVertices": sum(asset["vertices"] for asset in assets),
        "totalTriangles": sum(asset["triangles"] for asset in assets),
        "sourceImages": sum(asset["sourceImages"] for asset in assets),
        "runtimeImages": sum(asset["runtimeImages"] for asset in assets),
        "allRetainedBytesEqual": True, "visibleMaterialPropertiesEqual": True,
        "assets": assets,
    }
    AUDIT.parent.mkdir(parents=True, exist_ok=True)
    AUDIT.write_text(json.dumps(audit, indent=2) + "\n")
    assert SOURCE_AUDIT.read_bytes() == historical_raw, "Historical audit changed"
    subprocess.run(["node", str(ROOT / "work/props/verify-assets.mjs"), "--write-audit"], cwd=ROOT, check=True)
    print(json.dumps({"assets": len(assets), "sourceBytes": source_bytes, "runtimeBytes": runtime_bytes,
                      "savedBytes": source_bytes - runtime_bytes, "vertices": audit["totalVertices"], "triangles": audit["totalTriangles"]}))


if __name__ == "__main__":
    main()
