import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
const root = path.resolve(import.meta.dirname, "..");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
/** Verify selected cells, alpha, provenance and static delivery budgets; never rewrites art. */
export async function checkBreakthroughMedia() {
  const manifest = JSON.parse(
    await readFile(
      path.join(root, "src/components/breakthrough/assets/media-stills.json"),
      "utf8",
    ),
  );
  let stillBytes = 0,
    decodedBytes = 0;
  for (const asset of manifest.assets) {
    const source = await readFile(path.join(root, asset.source)),
      still = await readFile(path.join(root, asset.still));
    if (
      digest(source) !== asset.sourceSha256 ||
      digest(still) !== asset.stillSha256
    )
      throw new Error(
        `Media source changed; regenerate and verify its still: ${asset.still}`,
      );
    const image = sharp(still),
      metadata = await image.metadata();
    if (
      metadata.width !== asset.size[0] ||
      metadata.height !== asset.size[1] ||
      (metadata.pages ?? 1) !== 1
    )
      throw new Error(`Still dimensions/pages changed: ${asset.still}`);
    if (
      Math.max(metadata.width, metadata.height) > manifest.budget.maxStillAxis
    )
      throw new Error(
        `Static texture exceeds its bounded delivery size: ${asset.still}`,
      );
    const expected = await sharp(
      source,
      asset.pages > 1 ? { page: asset.frame, pages: 1 } : {},
    )
      .extract({
        left: asset.origin[0],
        top: asset.origin[1],
        width: asset.size[0],
        height: asset.size[1],
      })
      .ensureAlpha()
      .raw()
      .toBuffer();
    const actual = await image.ensureAlpha().raw().toBuffer();
    if (!actual.equals(expected))
      throw new Error(
        `Still pixels/alpha differ from its approved frame: ${asset.still}`,
      );
    stillBytes += still.length;
    decodedBytes += actual.length;
  }
  if (stillBytes > manifest.budget.totalStillBytes)
    throw new Error(
      `Reduced-motion media exceeds the1MiB budget: ${stillBytes}`,
    );
  return {
    assets: manifest.assets.length,
    stillBytes,
    decodedBytes,
    pixelAndAlphaParity: true,
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(JSON.stringify(await checkBreakthroughMedia()));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
