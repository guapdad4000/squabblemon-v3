import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const outputDir = path.join(projectDir, 'dist/public');
const publicOrigin = 'https://squabblemon.example';
const basePaths = ['/', '/release-check/squabblemon/'];

function build(basePath) {
  const result = spawnSync('pnpm', ['run', 'build'], {
    cwd: projectDir,
    env: {
      ...process.env,
      BASE_PATH: basePath,
      PORT: '4173',
      PUBLIC_ORIGIN: publicOrigin,
    },
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`Squabblemon build failed for base path "${basePath}"`);
  }
}

function extractAttribute(html, selectorDescription, pattern) {
  const match = html.match(pattern);
  assert.ok(match, `Emitted HTML is missing ${selectorDescription}`);
  return match[1];
}

function assertScopedAsset(urlValue, basePath, label) {
  const pageUrl = new URL(basePath, publicOrigin);
  const resolvedUrl = new URL(urlValue, pageUrl);

  assert.equal(
    resolvedUrl.origin,
    publicOrigin,
    `${label} must stay on the configured public origin`,
  );
  assert.ok(
    resolvedUrl.pathname.startsWith(basePath),
    `${label} escaped base path "${basePath}": ${resolvedUrl.pathname}`,
  );

  const relativePath = decodeURIComponent(
    resolvedUrl.pathname.slice(basePath.length),
  );
  assert.ok(relativePath, `${label} does not point to a file`);

  const emittedPath = path.resolve(outputDir, relativePath);
  assert.ok(
    emittedPath.startsWith(`${outputDir}${path.sep}`),
    `${label} resolves outside the build output`,
  );
  assert.ok(existsSync(emittedPath), `${label} is missing: ${relativePath}`);

  return { emittedPath, resolvedUrl };
}

async function validateBuild(basePath) {
  const htmlPath = path.join(outputDir, 'index.html');
  const html = readFileSync(htmlPath, 'utf8');

  const references = [
    [
      'favicon',
      extractAttribute(
        html,
        'the favicon link',
        /<link\b(?=[^>]*\brel="icon")(?=[^>]*\bsizes="any")[^>]*\bhref="([^"]+)"/,
      ),
    ],
    [
      'touch icon',
      extractAttribute(
        html,
        'the Apple touch icon link',
        /<link\b(?=[^>]*\brel="apple-touch-icon")[^>]*\bhref="([^"]+)"/,
      ),
    ],
    [
      'manifest',
      extractAttribute(
        html,
        'the web manifest link',
        /<link\b(?=[^>]*\brel="manifest")[^>]*\bhref="([^"]+)"/,
      ),
    ],
    [
      'wordmark preload',
      extractAttribute(
        html,
        'the wordmark preload',
        /<link\b(?=[^>]*\brel="preload")(?=[^>]*\bas="image")[^>]*\bhref="([^"]*squabblemon-wordmark[^"]*)"/,
      ),
    ],
    [
      'share image',
      extractAttribute(
        html,
        'the Open Graph share image',
        /<meta\b(?=[^>]*\bproperty="og:image")[^>]*\bcontent="([^"]+)"/,
      ),
    ],
  ];

  const emittedReferences = new Map(
    references.map(([label, url]) => [
      label,
      assertScopedAsset(url, basePath, label),
    ]),
  );

  const shareImage = emittedReferences.get('share image');
  const twitterImage = extractAttribute(html, 'the Twitter share image',
    /<meta\b(?=[^>]*\bname="twitter:image")[^>]*\bcontent="([^"]+)"/);
  assert.equal(new URL(twitterImage, publicOrigin).href, shareImage.resolvedUrl.href,
    'Open Graph and Twitter must use the same current artwork');
  const shareMetadata = await sharp(shareImage.emittedPath).metadata();
  assert.deepEqual([shareMetadata.width, shareMetadata.height], [1200, 630],
    'Social artwork must match the advertised preview dimensions');

  const manifestReference = emittedReferences.get('manifest');
  assert.ok(manifestReference);
  const manifest = JSON.parse(
    readFileSync(manifestReference.emittedPath, 'utf8'),
  );
  const manifestScope = new URL(
    manifest.scope,
    manifestReference.resolvedUrl,
  );

  assert.equal(
    manifestScope.pathname,
    basePath,
    `Manifest scope must equal the artifact base path "${basePath}"`,
  );
  assert.equal(
    manifestScope.origin,
    publicOrigin,
    'Manifest scope must stay on the configured public origin',
  );
  assert.ok(
    Array.isArray(manifest.icons) && manifest.icons.length > 0,
    'Manifest must declare at least one install icon',
  );

  for (const [index, icon] of manifest.icons.entries()) {
    assert.equal(
      typeof icon.src,
      'string',
      `Manifest icon ${index + 1} must have a src`,
    );
    const iconReference = assertScopedAsset(
      new URL(icon.src, manifestReference.resolvedUrl).href,
      basePath,
      `manifest icon ${index + 1}`,
    );
    const dimensions = await sharp(iconReference.emittedPath).metadata();
    assert.equal(`${dimensions.width}x${dimensions.height}`, icon.sizes,
      `Manifest icon ${index + 1} must match its declared size`);
  }

  const errorHtml = readFileSync(path.join(outputDir, '404.html'), 'utf8');
  assert.ok(!errorHtml.includes('__SQUABBLEMON_ASSET_BASE__'),
    'Static 404 must resolve its asset base before publication');
  const errorArt = extractAttribute(errorHtml, 'the illustrated 404 image',
    /<img\b(?=[^>]*\bclass="art")[^>]*\bsrc="([^"]+)"/);
  const errorArtReference = assertScopedAsset(errorArt, basePath, '404 illustration');
  const errorArtDimensions = await sharp(errorArtReference.emittedPath).metadata();
  assert.deepEqual([errorArtDimensions.width, errorArtDimensions.height], [1200, 900],
    '404 illustration must preserve the supplied artwork aspect ratio');
  const errorWordmark = extractAttribute(errorHtml, 'the 404 wordmark',
    /<img\b(?=[^>]*\bclass="wordmark")[^>]*\bsrc="([^"]+)"/);
  assertScopedAsset(errorWordmark, basePath, '404 wordmark');
  const errorHome = extractAttribute(errorHtml, 'the 404 return link',
    /<a\b[^>]*\bhref="([^"]+)"/);
  assert.equal(new URL(errorHome, publicOrigin).pathname, basePath,
    '404 return link must stay inside the artifact base path');
}

for (const basePath of basePaths) {
  build(basePath);
  await validateBuild(basePath);
  console.log(`Brand metadata valid for base path "${basePath}"`);
}
