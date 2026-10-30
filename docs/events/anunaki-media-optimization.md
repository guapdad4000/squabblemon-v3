# Anunaki media compression — 2026-10-30

Local pending-patch media audit, with publication still held.

- Public directory baseline: 2,255,046,082 bytes. This is the whole existing game, not an initial player download.
- Pending public files at audit start: 87 files / 29,515,651 bytes.
- 85 supported media files reviewed: 29,265,373 → 23,138,056 bytes, a 6,127,317-byte reduction (20.9%). Two other pending files are unchanged.
- Entire pending public-file footprint after compression: 23,388,334 bytes (20.8% smaller). These are filesystem payload measurements, not Git transport sizes or measured player network traffic.

The encoder preserves dimensions, framing, every drawn animation frame and its duration, exact decoded alpha, and copied audio. WebPs use quality 80/method 6. H.264 uses slow encoding and CRF 25, falling back to 23/21 if full-frame SSIM is below 0.98. Minimum accepted video SSIM was 0.980603. Lossy RGB/video is not pixel-identical. GIF fallbacks are retained unchanged.

Originals and the complete side-by-side gallery are retained outside deployment assets at `output/anunaki-media-review/` (a sibling of this checkout). `anunaki-media-optimization.json` records input/output hashes, bytes, dimensions, timing and encoding choices. Existing source-art hashes remain intact; delivery manifests were refreshed.

The existing offscreen/hidden/reduced-motion sprite gating remains unchanged. Older Anunaki reaction paths remain available because the previous client references them. Existing Kumite films, unrelated artwork, source masters, gameplay rules and animation timing were not rewritten.

## Reproduce

From the checkout root, use an external review directory:

```
python3 scripts/optimize-pending-media.py --review-dir ../anunaki-media-review --apply
python3 scripts/verify-pending-media.py --review-dir ../anunaki-media-review
python3 scripts/refresh-anunaki-media-provenance.py
```

The optimizer reuses retained pre-compression inputs, preventing accumulated lossy passes. Without `--apply`, it only writes review candidates. It uses two FFmpeg encoder threads. The apply run refreshes the optimization report; refresh the delivery provenance afterward and do not publish stale hashes. The raw generator still produces its higher-quality first-stage derivatives; compression is a separate delivery stage.

Browser checks use `verify-anunaki-drawn-lifecycle.mjs` and `verify-anunaki-media-compression.mjs` with `MEDIA_REVIEW_DIR` and `ARCADE_BASE_URL`. The latter captures both original and optimized versions of all ten special clips through the same GPU/CPU chromakey fixture. These are local Chromium checks, not physical-phone or production evidence.

No assets were removed based only on a text search. Further large reductions to the whole game's existing media would require a separate film/audio quality pass; they should not be confused with reducing this expansion patch.
