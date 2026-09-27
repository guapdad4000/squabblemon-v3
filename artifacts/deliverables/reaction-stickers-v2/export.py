"""Package the Buddy refresh plus Kyle and Church Auntie reaction sheets."""
from pathlib import Path
from PIL import Image
import json
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "artifacts/squabblemon/public/assets/reactions/character-pack-v1"
CHARACTERS = [
    ("buddy", "Buddy", "buddy"),
    ("kyle", "Kyle", "kyle"),
    ("church-auntie", "Church Auntie", "church-auntie"),
]
REACTIONS = ["laugh", "rage", "shocked", "respect"]
ORDER = [0, 1, 2, 3, 2, 1]
DURATIONS = [220, 160, 260, 360, 160, 160]


def clean(frame: Image.Image) -> Image.Image:
    pixels = np.array(frame.convert("RGBA"))
    labels, _ = ndimage.label(pixels[:, :, 3] > 96)
    sizes = np.bincount(labels.ravel())
    # Keep the authored sticker body only. Decorative marks and the occasional
    # neighboring-cell sliver are disconnected from the character outline.
    largest = int(np.argmax(sizes[1:]) + 1)
    mask = ndimage.binary_dilation(labels == largest, iterations=1)
    pixels[:, :, 3] = np.where(mask, pixels[:, :, 3], 0)
    return Image.fromarray(pixels)


def tile(frame: Image.Image) -> Image.Image:
    frame = clean(frame)
    frame.thumbnail((228, 228), Image.Resampling.LANCZOS)
    result = Image.new("RGBA", (256, 256))
    result.alpha_composite(frame, ((256 - frame.width) // 2, (256 - frame.height) // 2))
    return result


manifest_path = OUT / "manifest.json"
manifest = json.loads(manifest_path.read_text())
new_slugs = {character[0] for character in CHARACTERS}
manifest["packs"] = [pack for pack in manifest["packs"] if pack["id"].split(":")[1] not in new_slugs]
manifest["reactions"] = [reaction for reaction in manifest["reactions"] if reaction["id"].split(":")[1] not in new_slugs]

for slug, name, card_id in CHARACTERS:
    source_path = OUT / slug / "source-sheet.png"
    source = Image.open(source_path).convert("RGBA")
    folder = OUT / slug
    folder.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (1024, 1024))
    reaction_ids = []
    xcuts = [round(index * source.width / 4) for index in range(5)]
    ycuts = [round(index * source.height / 4) for index in range(5)]
    for row, reaction_name in enumerate(REACTIONS):
        frames = []
        for col in range(4):
            frame = tile(source.crop((xcuts[col], ycuts[row], xcuts[col + 1], ycuts[row + 1])))
            frames.append(frame)
            sheet.alpha_composite(frame, (col * 256, row * 256))
        frames[0].save(folder / f"{reaction_name}.png")
        frames[0].save(folder / f"{reaction_name}.webp", lossless=True)
        frames[0].save(
            folder / f"{reaction_name}-animated.webp",
            save_all=True,
            append_images=[frames[index] for index in ORDER[1:]],
            duration=DURATIONS,
            loop=0,
            lossless=True,
        )
        palette_source = Image.new("RGB", (1024, 256))
        for index, frame in enumerate(frames):
            palette_source.paste(frame.convert("RGB"), (index * 256, 0))
        palette = palette_source.quantize(colors=255)
        gif_frames = []
        for index in ORDER:
            frame = frames[index]
            indexed = frame.convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE)
            indexed.paste(255, mask=frame.getchannel("A").point(lambda alpha: 255 if alpha < 96 else 0))
            gif_frames.append(indexed)
        gif_frames[0].save(
            folder / f"{reaction_name}.gif",
            save_all=True,
            append_images=gif_frames[1:],
            duration=DURATIONS,
            loop=0,
            disposal=2,
            transparency=255,
            optimize=False,
        )
        gif = Image.open(folder / f"{reaction_name}.gif")
        assert gif.n_frames == 6
        for index in range(gif.n_frames):
            gif.seek(index)
            assert gif.convert("RGBA").getpixel((0, 0))[3] == 0
        reaction_id = f"reaction:{slug}:{reaction_name}:v1"
        reaction_ids.append(reaction_id)
        base = f"assets/reactions/character-pack-v1/{slug}"
        manifest["reactions"].append({
            "id": reaction_id,
            "character": name,
            "catalogCardId": card_id,
            "reaction": reaction_name,
            "label": f"{name} — {reaction_name.title()}",
            "gif": f"{base}/{reaction_name}.gif",
            "animatedWebp": f"{base}/{reaction_name}-animated.webp",
            "poster": f"{base}/{reaction_name}.webp",
            "spriteSheet": f"{base}/spritesheet.png",
            "row": row,
            "frames": 4,
            "loopDurationMs": sum(DURATIONS),
            "width": 256,
            "height": 256,
        })
    sheet.save(folder / "spritesheet.png")
    manifest["packs"].append({"id": f"reaction-pack:{slug}:v1", "name": f"{name} Reactions", "reactionIds": reaction_ids})

manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
cards = "".join(
    f'<article><h2>{reaction["label"]}</h2><div class="sticker"><img src="{reaction["gif"].split("character-pack-v1/")[1]}" alt="{reaction["label"]}"></div></article>'
    for reaction in manifest["reactions"]
)
(OUT / "preview.html").write_text(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Squabblemon Reaction Collection</title>'
    '<style>body{background:#102522;color:#fff4d8;font:16px system-ui;margin:32px}h1{color:#ffda3a}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:20px}article{border:2px solid #3a7564;border-radius:16px;padding:14px}h2{font-size:16px}.sticker{background:repeating-conic-gradient(#294139 0% 25%,#1c302b 0% 50%) 0/24px 24px;border-radius:12px;text-align:center}img{max-width:100%;width:256px}</style>'
    f'<h1>Squabblemon • Reaction Collection 01</h1><p>{len(manifest["packs"])} characters · 4 reactions each · transparent six-frame loops</p><main>{cards}</main>'
)
print(f'Exported Buddy refresh, Kyle and Church Auntie. Catalog now has {len(manifest["packs"])} packs and {len(manifest["reactions"])} reactions.')
