#!/usr/bin/env python3
"""Compact the NPCs for the existing albedo-only runtime without changing art.

The original GLBs stay untouched. Unused normal/roughness image data and clips
are removed. Geometry, UVs, joints, the selected loop's samples and the original
base-color JPEG remain byte-for-byte. Only referenced accessors are retained.
Run from any directory: python3 playable/scripts/build-mobile-characters.py
"""
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
import struct
import subprocess

PLAYABLE = Path(__file__).resolve().parents[1]
SOURCE = PLAYABLE / "public/assets/characters"
TARGET = PLAYABLE / "public/assets/characters-mobile"
AUDIT = PLAYABLE.parent / "outputs/mobile-asset-audit.json"


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
    assert not doc.get("extensionsUsed") and not doc.get("extensionsRequired"), path
    return raw, doc, chunks[0x004E4942]


def view_bytes(doc, binary, index):
    view = doc["bufferViews"][index]
    assert view.get("buffer", 0) == 0
    offset, length = view.get("byteOffset", 0), view["byteLength"]
    assert offset >= 0 and offset + length <= doc["buffers"][0]["byteLength"]
    return binary[offset:offset + length]


def write_glb(doc, binary):
    doc["buffers"][0]["byteLength"] = len(binary)
    encoded = canonical(doc)
    encoded += b" " * (-len(encoded) % 4)
    binary += b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(encoded) + 8 + len(binary)
    return (struct.pack("<III", 0x46546C67, 2, total)
            + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
            + struct.pack("<II", len(binary), 0x004E4942) + binary)


COMPONENT_BYTES = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
TYPE_COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT2": 4, "MAT3": 9, "MAT4": 16}


def accessor_bytes(doc, binary, index):
    accessor = doc["accessors"][index]
    assert "sparse" not in accessor
    view = doc["bufferViews"][accessor["bufferView"]]
    size = COMPONENT_BYTES[accessor["componentType"]] * TYPE_COMPONENTS[accessor["type"]]
    # The supplied matrices are FLOAT MAT4, so no integer-matrix padding rules.
    assert not accessor["type"].startswith("MAT") or accessor["componentType"] == 5126
    stride = view.get("byteStride", size)
    offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    assert accessor.get("byteOffset", 0) + (accessor["count"] - 1) * stride + size <= view["byteLength"]
    return b"".join(binary[offset + row * stride:offset + row * stride + size]
                    for row in range(accessor["count"]))


def remap_accessors(doc, indices):
    for mesh in doc.get("meshes", []):
        for primitive in mesh["primitives"]:
            if "indices" in primitive:
                primitive["indices"] = indices[primitive["indices"]]
            primitive["attributes"] = {name: indices[index] for name, index in primitive["attributes"].items()}
            for target in primitive.get("targets", []):
                for name in target:
                    target[name] = indices[target[name]]
    for skin in doc.get("skins", []):
        if "inverseBindMatrices" in skin:
            skin["inverseBindMatrices"] = indices[skin["inverseBindMatrices"]]
    for animation in doc.get("animations", []):
        for sampler in animation["samplers"]:
            sampler["input"] = indices[sampler["input"]]
            sampler["output"] = indices[sampler["output"]]


def compact(path, selected_clip):
    source_raw, source, source_bin = read_glb(path)
    doc = copy.deepcopy(source)
    # These derivatives serve the current baked-color MeshBasicMaterial cast.
    # Fail closed if a future upload introduces another material dependency.
    assert len(doc["materials"]) == 1, path
    material = doc["materials"][0]
    assert set(material) <= {"name", "doubleSided", "pbrMetallicRoughness", "normalTexture"}, path
    pbr = material["pbrMetallicRoughness"]
    assert set(pbr) == {"baseColorTexture", "metallicRoughnessTexture"}, path
    assert len(doc["images"]) == 3 and len(doc["textures"]) == 3, path
    keep_texture = pbr["baseColorTexture"]["index"]
    texture = doc["textures"][keep_texture]
    keep_image = texture["source"]
    image = doc["images"][keep_image]
    assert image["mimeType"] == "image/jpeg" and "uri" not in image, path
    keep_view = image["bufferView"]
    source_albedo = view_bytes(source, source_bin, keep_view)
    image_views = {image["bufferView"] for image in doc["images"]}
    assert len(image_views) == 3

    del material["normalTexture"]
    del pbr["metallicRoughnessTexture"]
    pbr["baseColorTexture"]["index"] = 0
    doc["textures"] = [copy.deepcopy(texture)]
    doc["textures"][0]["source"] = 0
    doc["images"] = [copy.deepcopy(image)]

    selected = [animation for animation in source["animations"] if animation["name"] == selected_clip]
    assert len(selected) == 1, (path, selected_clip)
    doc["animations"] = copy.deepcopy(selected)
    used = set()
    for mesh in doc["meshes"]:
        for primitive in mesh["primitives"]:
            used.update(primitive["attributes"].values())
            if "indices" in primitive:
                used.add(primitive["indices"])
            for target in primitive.get("targets", []):
                used.update(target.values())
    used.update(skin["inverseBindMatrices"] for skin in doc["skins"] if "inverseBindMatrices" in skin)
    for animation in doc["animations"]:
        for sampler in animation["samplers"]:
            used.update((sampler["input"], sampler["output"]))

    # Preserve interleaved vertex/index views whole. Non-interleaved clip and
    # inverse-bind samples are copied into tight views so unused clips vanish.
    views, accessors, binary, retained_views, retained_accessors = [], [], bytearray(), [], []
    copied_views, accessor_indices = {}, {}

    def append_view(data, properties, source_view, source_offset):
        binary.extend(b"\0" * (-len(binary) % 4))
        index = len(views)
        replacement = copy.deepcopy(properties)
        replacement["byteOffset"] = len(binary)
        replacement["byteLength"] = len(data)
        replacement["buffer"] = 0
        views.append(replacement)
        binary.extend(data)
        retained_views.append({"sourceView": source_view, "sourceByteOffset": source_offset,
                               "mobileView": index, "bytes": len(data), "sha256": digest(data)})
        return index

    doc["images"][0]["bufferView"] = append_view(source_albedo, {}, keep_view, 0)
    for old_index in sorted(used):
        accessor = copy.deepcopy(source["accessors"][old_index])
        view_index = accessor["bufferView"]
        view = source["bufferViews"][view_index]
        assert view_index not in image_views and "sparse" not in accessor
        if view.get("byteStride") or view.get("target"):
            if view_index not in copied_views:
                copied_views[view_index] = append_view(view_bytes(source, source_bin, view_index), view, view_index, 0)
            accessor["bufferView"] = copied_views[view_index]
        else:
            data = accessor_bytes(source, source_bin, old_index)
            accessor["bufferView"] = append_view(data, {}, view_index, accessor.get("byteOffset", 0))
            accessor["byteOffset"] = 0
        accessor_indices[old_index] = len(accessors)
        retained_accessors.append({"sourceAccessor": old_index, "mobileAccessor": len(accessors),
                                   "bytes": len(accessor_bytes(source, source_bin, old_index)),
                                   "sha256": digest(accessor_bytes(source, source_bin, old_index))})
        accessors.append(accessor)
    doc["bufferViews"] = views
    doc["accessors"] = accessors
    remap_accessors(doc, accessor_indices)
    output = write_glb(doc, bytes(binary))
    destination = TARGET / path.name
    destination.write_bytes(output)

    # Verify against bytes reread from the finished file, never the work buffer.
    reread, result, result_bin = read_glb(destination)
    restored = copy.deepcopy(result)
    remap_accessors(restored, {new: old for old, new in accessor_indices.items()})
    for key in ("meshes", "nodes", "skins", "scenes", "scene", "samplers"):
        assert restored.get(key) == source.get(key), (path, key)
    assert restored["animations"] == selected, path
    for item in retained_accessors:
        before = accessor_bytes(source, source_bin, item["sourceAccessor"])
        after = accessor_bytes(result, result_bin, item["mobileAccessor"])
        assert before == after, (path, item)
        old = {key: value for key, value in source["accessors"][item["sourceAccessor"]].items() if key not in ("bufferView", "byteOffset")}
        new = {key: value for key, value in result["accessors"][item["mobileAccessor"]].items() if key not in ("bufferView", "byteOffset")}
        assert old == new, (path, item)
    for item in retained_views:
        before = view_bytes(source, source_bin, item["sourceView"])[item["sourceByteOffset"]:item["sourceByteOffset"] + item["bytes"]]
        after = view_bytes(result, result_bin, item["mobileView"])
        assert before == after, (path, item)
    result_albedo = view_bytes(result, result_bin, result["images"][0]["bufferView"])
    assert result_albedo == source_albedo
    assert path.read_bytes() == source_raw, "Source file changed"
    triangles = sum(source["accessors"][primitive["indices"]]["count"] // 3
                    for mesh in source["meshes"] for primitive in mesh["primitives"])
    domains = {key: source.get(key) for key in ("meshes", "nodes", "skins")}
    domains.update(animations=selected, accessors={index: source["accessors"][index] for index in sorted(used)})
    return {
        "file": path.name,
        "sourceBytes": len(source_raw), "mobileBytes": len(reread),
        "savedBytes": len(source_raw) - len(reread),
        "sourceSha256": digest(source_raw), "mobileSha256": digest(reread),
        "albedoSha256": digest(source_albedo), "albedoBytes": len(source_albedo),
        "rigGeometrySelectedAnimationSha256": digest(canonical(domains)),
        "triangles": triangles, "skins": len(source.get("skins", [])),
        "sourceClips": len(source.get("animations", [])), "mobileClips": len(result["animations"]),
        "selectedClip": selected_clip,
        "sourceImages": len(source["images"]), "mobileImages": len(result["images"]),
        "retainedBufferViews": retained_views, "retainedAccessors": retained_accessors,
        "allRetainedBytesEqual": True, "sourceUnchanged": True,
    }


def main():
    TARGET.mkdir(parents=True, exist_ok=True)
    paths = sorted(SOURCE.glob("*.glb"))
    assert len(paths) == 11, f"Expected the uploaded eleven NPC models, found {len(paths)}"
    exported = subprocess.run(["node", "--input-type=module", "-e",
        "import {CHARACTER_PLACEMENTS as p} from './src/character-placements.js'; console.log(JSON.stringify(p));"],
        cwd=PLAYABLE, check=True, capture_output=True, text=True)
    placements = json.loads(exported.stdout)
    selected = {item["asset"]: item["animation"]["clip"] for item in placements}
    assert len(selected) == len(paths)
    assets = [compact(path, selected[path.name]) for path in paths]
    source_bytes = sum(asset["sourceBytes"] for asset in assets)
    mobile_bytes = sum(asset["mobileBytes"] for asset in assets)
    audit = {
        "purpose": "Exact-art albedo-only GLB derivatives retaining each NPC's configured loop",
        "scope": "Download and image-decode budget; not a measured device FPS claim",
        "sourceDirectory": "playable/public/assets/characters",
        "mobileDirectory": "playable/public/assets/characters-mobile",
        "characters": len(assets), "sourceBytes": source_bytes, "mobileBytes": mobile_bytes,
        "savedBytes": source_bytes - mobile_bytes,
        "savedPercent": round((1 - mobile_bytes / source_bytes) * 100, 2),
        "imageDependenciesBefore": sum(asset["sourceImages"] for asset in assets),
        "imageDependenciesAfter": sum(asset["mobileImages"] for asset in assets),
        "triangles": sum(asset["triangles"] for asset in assets),
        "sourceClips": sum(asset["sourceClips"] for asset in assets),
        "mobileClips": sum(asset["mobileClips"] for asset in assets),
        "allAlbedoJpegsUnchanged": True, "allGeometryRigsSelectedLoopsUnchanged": True,
        "assets": assets,
    }
    AUDIT.write_text(json.dumps(audit, indent=2) + "\n")
    print(json.dumps({key: value for key, value in audit.items() if key != "assets"}, indent=2))


if __name__ == "__main__":
    main()
