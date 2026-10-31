#!/usr/bin/env python3
"""Slice generated cels and encode assets; never synthesize poses from stills.

Each row in each retained source sheet contains four independently drawn poses.
The only pixel operations here are fixed grid extraction, uniform fitting, and
codec encoding. Run from any directory with Python 3, Pillow, and NumPy installed.
"""
from hashlib import sha256
from pathlib import Path
import json

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/art-sources/anunaki-drawn-v2'
PUBLIC = ROOT / 'artifacts/squabblemon/public'
MANIFEST = ROOT / 'docs/events/anunaki-drawn-animation-sources.json'
EMOTIONS = ['laugh', 'rage', 'shocked', 'respect']
PHASES = ['idle', 'windup', 'strike', 'recoil']


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def separator(alpha, center, band):
    """Find the transparent gutter even when generated packing is not exact.

    alpha is arranged (travel steps, cross-axis positions). A minimal-alpha
    seam separates neighboring cutouts without collecting pieces of their hair
    or shoes. This changes only the extraction boundary, never the drawn pixels.
    """
    low = max(0, round(center - band))
    high = min(alpha.shape[1], round(center + band))
    positions = np.arange(low, high)
    cost = alpha[:, low:high].astype(float) ** 2
    cost += 0.025 * (positions - center) ** 2
    previous = cost[0]
    paths = np.zeros(cost.shape, dtype=np.int16)
    for step in range(1, len(cost)):
        choices = np.vstack([np.r_[np.inf, previous[:-1]], previous,
                             np.r_[previous[1:], np.inf]])
        direction = np.argmin(choices, axis=0)
        paths[step] = direction - 1
        previous = cost[step] + choices[direction, np.arange(len(positions))]
    result = np.zeros(len(cost), dtype=int)
    position = int(np.argmin(previous))
    for step in range(len(cost) - 1, -1, -1):
        result[step] = position + low
        position += int(paths[step, position])
    return result


def extracted_cels(sheet, row, rows=4):
    image = Image.open(sheet).convert('RGBA')
    pixels = np.asarray(image)
    alpha = pixels[:, :, 3]
    height, width = alpha.shape
    y, x = np.indices(alpha.shape)
    seams = [np.zeros(width, dtype=int)] + [separator(alpha.T, height * n / rows, height / (rows * 5))
              for n in range(1, rows)] + [np.full(width, height, dtype=int)]
    row_mask = (y >= seams[row][None, :]) & (y < seams[row + 1][None, :])
    top, bottom = int(seams[row].min()), int(seams[row + 1].max())
    row_alpha = (alpha * row_mask)[top:bottom]
    column_seams = [np.zeros(bottom - top, dtype=int)] + [separator(row_alpha, width * n / 4, width / 15)
                   for n in range(1, 4)] + [np.full(bottom - top, width, dtype=int)]
    cels = []
    for column in range(4):
        mask = row_mask[top:bottom] & (x[top:bottom] >= column_seams[column][:, None]) & (x[top:bottom] < column_seams[column + 1][:, None])
        selected = pixels[top:bottom].copy()
        selected[:, :, 3] *= mask
        cel = Image.fromarray(selected)
        bounds = cel.getchannel('A').point(lambda a: 255 if a >= 16 else 0).getbbox()
        cels.append(cel.crop(bounds))
    return cels


def frames(sheet, row, size, inset=5, rows=4):
    """Uniform row scale and a shared baseline preserve full isolated cutouts."""
    cels = extracted_cels(sheet, row, rows)
    scale = min((size[0] - 2 * inset) / max(cel.width for cel in cels),
                (size[1] - 2 * inset) / max(cel.height for cel in cels))
    output = []
    for cel in cels:
        fitted = cel.resize((round(cel.width * scale), round(cel.height * scale)), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', size)
        canvas.alpha_composite(fitted, ((size[0] - fitted.width) // 2, size[1] - inset - fitted.height))
        output.append(canvas)
    return output


def gif_frame(image):
    # Reserve palette index 255 for real transparency rather than black matting.
    palette = image.convert('RGB').quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    alpha = image.getchannel('A').point(lambda value: 255 if value < 96 else 0)
    palette.paste(255, mask=alpha)
    palette.info['transparency'] = 255
    return palette


def webp(path, cels, sequence, duration, loop=0):
    selected = [cels[index] for index in sequence]
    selected[0].save(path, format='WEBP', save_all=True, append_images=selected[1:],
                     duration=duration, loop=loop, quality=85, method=4,
                     background=(0, 0, 0, 0))


def source_info(path, rows=4):
    im = Image.open(path)
    return {'path': str(path.relative_to(ROOT)), 'sha256': digest(path),
            'width': im.width, 'height': im.height, 'grid': {'columns': 4, 'rows': rows},
            'generatedBy': 'built-in image_gen', 'transparent': True}


manifest = {'revision': 'anunaki-drawn-v2', 'created': '2026-10-29',
            'method': 'Four different generated hand-drawn cels per emotion/phase; extraction follows transparent gutters between neighboring cutouts. No affine pose animation.',
            'sources': [], 'assets': []}

for character in ['yakub', 'anu']:
    sheet = SOURCE / f'{character}-reactions-sheet.png'
    manifest['sources'].append(source_info(sheet))
    destination = PUBLIC / 'assets/reactions/anunaki-drawn-v2' / character
    destination.mkdir(parents=True, exist_ok=True)
    for row, emotion in enumerate(EMOTIONS):
        cels = frames(sheet, row, (256, 256))
        sequence = [0, 1, 2, 3, 2, 1]
        durations = [180, 130, 250, 180, 130, 130]
        still = destination / f'{emotion}.webp'
        animated = destination / f'{emotion}-animated.webp'
        fallback = destination / f'{emotion}.gif'
        cels[2].save(still, format='WEBP', quality=90, method=6)
        webp(animated, cels, sequence, durations)
        gif_cels = [gif_frame(cels[index]) for index in sequence]
        gif_cels[0].save(fallback, format='GIF', save_all=True, append_images=gif_cels[1:],
                         duration=durations, loop=0, disposal=2, transparency=255, optimize=False)
        manifest['assets'].append({'character': character, 'emotion': emotion,
            'source': str(sheet.relative_to(ROOT)), 'sourceRow': row, 'distinctDrawnCels': 4,
            'celPixelSha256': [sha256(cel.tobytes()).hexdigest() for cel in cels],
            'sequence': sequence, 'durationsMs': durations, 'size': [256, 256],
            'files': [{ 'path': str(path.relative_to(PUBLIC)), 'sha256': digest(path), 'bytes': path.stat().st_size }
                      for path in [still, animated, fallback]]})

sheet = SOURCE / 'anu-boss-sheet.png'
manifest['sources'].append(source_info(sheet))
destination = PUBLIC / 'assets/boss-raid/anunaki-motion-v1'
destination.mkdir(parents=True, exist_ok=True)
for row, phase in enumerate(PHASES):
    cels = frames(sheet, row, (320, 480), inset=8)
    sequence = [0, 1, 2, 3, 2, 1] if phase == 'idle' else [0, 1, 2, 3]
    durations = [190, 170, 200, 190, 170, 200] if phase == 'idle' else {
        'windup': [180, 180, 240, 280], 'strike': [110, 110, 180, 120], 'recoil': [140, 180, 160, 160]
    }[phase]
    animated = destination / f'boss-anu-{phase}.webp'
    webp(animated, cels, sequence, durations, loop=0 if phase == 'idle' else 1)
    still = destination / ('boss-anu-still.webp' if phase == 'idle' else f'boss-anu-{phase}-still.webp')
    cels[0].save(still, format='WEBP', quality=90, method=6)
    manifest['assets'].append({'character': 'anu', 'phase': phase,
        'source': str(sheet.relative_to(ROOT)), 'sourceRow': row, 'distinctDrawnCels': 4,
        'celPixelSha256': [sha256(cel.tobytes()).hexdigest() for cel in cels],
        'sequence': sequence, 'durationsMs': durations, 'size': [320, 480],
        'files': [{ 'path': str(path.relative_to(PUBLIC)), 'sha256': digest(path), 'bytes': path.stat().st_size }
                  for path in [still, animated]]})

# Existing encounter actors use four newly drawn poses from the same atlas row.
npc_rows = [
    ('anunaki-npc-sheet-a.png', ['utu', 'enki', 'nabu', 'ninhursag']),
    ('anunaki-npc-sheet-b.png', ['inanna', 'enlil', 'ereshkigal', 'caucus-mountaineer']),
]
for filename, characters in npc_rows:
    sheet = SOURCE / filename
    manifest['sources'].append(source_info(sheet))
    for row, character in enumerate(characters):
        cels = frames(sheet, row, (320, 480), inset=8)
        sequence = [0, 1, 2, 3, 2, 1]
        durations = [300, 180, 210, 300, 180, 180]
        animated = destination / f'{character}-idle.webp'
        still = destination / f'{character}-still.webp'
        webp(animated, cels, sequence, durations)
        cels[0].save(still, format='WEBP', quality=90, method=6)
        manifest['assets'].append({'character': character, 'phase': 'encounter-idle',
            'source': str(sheet.relative_to(ROOT)), 'sourceRow': row, 'distinctDrawnCels': 4,
            'celPixelSha256': [sha256(cel.tobytes()).hexdigest() for cel in cels],
            'sequence': sequence, 'durationsMs': durations, 'size': [320, 480],
            'files': [{ 'path': str(path.relative_to(PUBLIC)), 'sha256': digest(path), 'bytes': path.stat().st_size }
                      for path in [still, animated]]})

# Yakub has a dedicated full-body strip; Anu reuses his full-body boss idle cels.
manifest['sources'].append(source_info(SOURCE / 'yakub-fullbody-sheet.png', rows=1))
for character, filename, row, rows in [('yakub', 'yakub-fullbody-sheet.png', 0, 1), ('anu', 'anu-boss-sheet.png', 0, 4)]:
    sheet = SOURCE / filename
    cels = frames(sheet, row, (320, 480), inset=8, rows=rows)
    sequence = [0, 1, 2, 3, 2, 1]
    durations = [300, 180, 210, 300, 180, 180]
    animated = destination / f'{character}-idle.webp'
    still = destination / f'{character}-still.webp'
    webp(animated, cels, sequence, durations)
    cels[0].save(still, format='WEBP', quality=90, method=6)
    manifest['assets'].append({'character': character, 'phase': 'encounter-idle',
        'source': str(sheet.relative_to(ROOT)), 'sourceRow': row, 'distinctDrawnCels': 4,
        'celPixelSha256': [sha256(cel.tobytes()).hexdigest() for cel in cels],
        'sequence': sequence, 'durationsMs': durations, 'size': [320, 480],
        'files': [{ 'path': str(path.relative_to(PUBLIC)), 'sha256': digest(path), 'bytes': path.stat().st_size }
                  for path in [still, animated]]})

MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Encoded {len(manifest["assets"])} animations from {len(manifest["sources"])} retained generated sheets.')
print(f'Runtime bytes: {sum(file["bytes"] for asset in manifest["assets"] for file in asset["files"]):,}')
