# Gacha media delivery — final optimization, 2026-10-24

The second pass reduces the current new-media set from **15,769,163 to 12,691,089 bytes**, saving another **3,078,074 bytes (19.52%)**. Compared with the original 20,701,530-byte design-update set, the combined saving is **8,010,441 bytes (38.695%)**. The approved artwork, 1600×900 video framing, source windows, frame counts, timing and transparency remain unchanged.

| Active delivery category | Before this pass | Final | Further saving |
|---|---:|---:|---:|
| Seven MP4s | 11,493,737 B | 8,895,525 B | 2,598,212 B |
| Seven authored WebPs | 2,715,716 B | 2,383,720 B | 331,996 B |
| Six POV fallback posters | 1,367,570 B | 1,219,704 B | 147,866 B |
| Two Clout images | 132,060 B | 132,060 B | 0 B |
| Four active MP3s | 60,080 B | 60,080 B | 0 B |
| **Total** | **15,769,163 B** | **12,691,089 B** | **3,078,074 B** |

Only the selected POV and shared landing are requested by the normal-motion flow. Their combined bytes now range from **2,928,541 to 3,799,353**, compared with 3,798,291–4,889,748 after the first pass and 4,275,255–5,503,591 originally. These figures describe the two selected video files, not an entire page/network trace.

## Encoding choice and review

Video candidates were encoded from the untouched user sources using the approved trims and normalization. Compared 900p CRF21/22 veryslow against the current CRF20 slow; also tested 720p CRF20 for the demanding neutral footage. The 720p candidate saved only 96,877 bytes beyond 900p CRF22 while its source-aligned SSIM/PSNR and fine detail were worse, so it was rejected. All shipped clips remain **1600×900, H.264 high/level 4.1, yuv420p, 30fps, faststart, silent, references 3 and B-frames 3**. Chosen encoding is **CRF22, preset veryslow**, with at most two encoder threads. Encoder effort happens offline; no new runtime effects or media formats were introduced.

Final source-aligned video scores span **SSIM 0.976112–0.985283 / PSNR 39.315–42.391dB**. Metrics compare every decoded frame against the lossless normalized source, aligned by frame index on a 1/30 timebase. They do not compare against a previous lossy export. Full-frame and 1:1 detail comparisons of neutral/purple/landing were independently reviewed by the media agent and parent before approval. Early/middle/final contact sheets for all six POVs preserve the attached bottom semicircle with no detached-sphere or lift frames. No obvious visual loss was found in reviewed comparisons; compressed output is not mathematically identical.

Seven illustrations use **WebP quality 80**, compression level6, directly from the original generated PNGs. Their dimensions and alpha bytes match the approved assets exactly. Full-art and 1:1 detail pairs were reviewed for all seven. Dark/cream composited PSNR to PNG masters spans 31.191–34.475dB; hidden RGB in transparent regions is excluded from those visible-image comparisons. Six 1600×900 posters use quality 80 from frame0 of the lossless normalized original source, avoiding another lossy-video generation. Neutral/purple poster pairs were reviewed. Four active audio files and two 512×512 Clout icons remain byte-identical.

## Verified invariants

- Six POVs: 42frames, 1.400000seconds each. Landing: 80frames, 2.666667seconds. Same original source windows, frame rate, retiming and 150ms authored wall-still blend.
- All seven files decode successfully, have exactly one video stream and no audio, and place the MP4 `moov` atom before `mdat`.
- Every original source MP4 hash remains unchanged. Every pre-pass delivery file was archived and hash-verified before replacement.
- Source PNGs and original MP4/WAV files were not modified. No resize, crop, recolor, stabilization, interpolation, deleted frames or generated art was used in this pass.
- Public URLs are unchanged. No TypeScript/CSS runtime files were edited by the media audit.

## Files and evidence

Current provenance remains outside `public`, in `design/media/gacha-2026-10-24/`: `cinematic-v2-generation.json`, `rarity-flight-v1-generation.json`, `video-flight-v1-manifest.json`, `gym-audio-trim-manifest.json`, and `delivery-audit.json`. The delivery audit lists exact 26 active media paths, hashes, original bytes, prior-pass bytes and current bytes. It also retains trial metrics and verification results.

Second-pass archive and comparisons: `/home/falcon/Documents/New project 9/output/gacha-media-optimization-v2/`. `before/` contains all 26 previous derivatives plus metadata. `comparisons/` contains full/detail candidates, six sequence sheets and poster comparisons; `verification.json` records final probes. First-pass archives and historical removed-media provenance remain under `/home/falcon/Documents/New project 9/output/gacha-media-optimization-v1/`.

The first pass additionally archived and removed eight unused/duplicate media files totaling 2,917,348 bytes and moved four original provenance JSON files totaling 38,770 bytes outside the public deployment. Its historical report remains in the first-pass output directory. The shared landing target uses the same supplied wall-hole artwork; the manifest distinguishes its preserved baked source hash from the separately optimized delivery still hash.

Browser behavior and production build checks are owned by the parent/browser agent after the media freeze. These results establish source, codec, asset and visual-comparison evidence; they are not physical-device or deployment proof. No commit or push was performed.
