import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Masters, source frame cadence, clip duration, and encoded audio are retained.
// A new encoding recipe gets a new URL even when the source has not changed.
export const encoding = Object.freeze({ version: 3, aspect: 'exact-even-ratio', width: 320, scale: 'lanczos', codec: 'libx264', preset: 'slow', crf: 20, pixelFormat: 'yuv420p', frameSync: 'passthrough', audio: 'copy' });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const fileHash = async file => hash(await fs.readFile(file));

export function parseOptions(args) {
  const options = { all: false, check: false, threads: 2, width: 320, crf: 20, offset: 0, limit: Infinity, report: null, files: [] };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--all') options.all = true;
    else if (arg === '--check') options.check = true;
    else if (['--threads', '--offset', '--limit', '--report', '--width', '--crf'].includes(arg)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (arg === '--report') options.report = path.resolve(value);
      else {
        const number = Number(value);
        if (!Number.isSafeInteger(number) || number < (['--offset', '--crf'].includes(arg) ? 0 : 1) || (arg === '--threads' && number > 8) || (arg === '--width' && (number < 256 || number > 768 || number % 2)) || (arg === '--crf' && number > 35)) throw new Error(`Invalid ${arg}: ${value}`);
        options[arg.slice(2)] = number;
      }
    } else if (arg.endsWith('.mp4') && path.basename(arg) === arg) options.files.push(arg);
    else throw new Error(`Unknown option or invalid filename: ${arg}`);
  }
  if (options.all && options.files.length) throw new Error('Use --all or explicit filenames, not both.');
  if (!options.check && !options.all && !options.files.length) throw new Error('Specify authored MP4 filenames or --all. Use --limit and --offset for bounded batches.');
  return options;
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  try { await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n'); await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, { force: true }); }
}

function probe(file) {
  return JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]));
}
/** Even H.264 dimensions with the exact authored aspect ratio, never cropped. */
export function scaledDimensions(width, height, limit) {
  if (![width, height, limit].every(value => Number.isSafeInteger(value) && value > 0)) return null;
  let a = width, b = height;
  while (b) [a, b] = [b, a % b];
  const unitWidth = width / a, unitHeight = height / a;
  const multiple = Math.floor(Math.min(limit, width) / unitWidth / 2) * 2;
  return multiple >= 2 ? [unitWidth * multiple, unitHeight * multiple] : null;
}

function frameCount(file, stream) {
  if (Number(stream.nb_frames) > 0) return Number(stream.nb_frames);
  const result = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'json', file]));
  const count = Number(result.streams[0]?.nb_read_frames);
  if (!Number.isSafeInteger(count) || count <= 0) throw new Error(`Cannot verify video frame count: ${file}`);
  return count;
}
function sameRate(left, right) {
  const [ln, ld] = String(left).split('/').map(Number), [rn, rd] = String(right).split('/').map(Number);
  return ln > 0 && ld > 0 && rn > 0 && rd > 0 && ln * rd === rn * ld;
}
function assertDuration(left, right, label) {
  if (!Number.isFinite(Number(left)) || !Number.isFinite(Number(right)) || Math.abs(Number(left) - Number(right)) > .001) throw new Error(`${label} changed: ${left} -> ${right}`);
}

/** Validate temporal/encoded-audio parity; spatial quality still needs visual review. */
export function verifyMedia(input, output, recipe = encoding) {
  const before = probe(input), after = probe(output);
  const video = before.streams.find(stream => stream.codec_type === 'video'), derivative = after.streams.find(stream => stream.codec_type === 'video');
  if (!video || !derivative) throw new Error('Both files must contain video.');
  for (const rate of ['r_frame_rate', 'avg_frame_rate']) if (!sameRate(video[rate], derivative[rate])) throw new Error(`${rate} changed: ${video[rate]} -> ${derivative[rate]}`);
  const frames = frameCount(input, video), outputFrames = frameCount(output, derivative);
  if (frames !== outputFrames) throw new Error(`Frame count changed: ${frames} -> ${outputFrames}`);
  assertDuration(video.duration, derivative.duration, 'Video duration');
  assertDuration(video.start_time ?? 0, derivative.start_time ?? 0, 'Video start time');
  assertDuration(before.format.duration, after.format.duration, 'Container duration');
  if (derivative.width > Math.min(recipe.width, video.width) || derivative.width * video.height !== derivative.height * video.width || derivative.width % 2 || derivative.height % 2) throw new Error('Unexpected derivative dimensions/aspect ratio.');
  const audio = before.streams.filter(stream => stream.codec_type === 'audio'), outputAudio = after.streams.filter(stream => stream.codec_type === 'audio');
  if (audio.length !== outputAudio.length) throw new Error('Audio stream count changed.');
  const audioHashes = audio.map((stream, index) => {
    const copy = outputAudio[index];
    for (const key of ['codec_name', 'sample_rate', 'channels']) if (stream[key] !== copy[key]) throw new Error(`Audio ${index} ${key} changed.`);
    assertDuration(stream.duration, copy.duration, `Audio ${index} duration`);
    assertDuration(stream.start_time ?? 0, copy.start_time ?? 0, `Audio ${index} start time`);
    const checksum = file => run('ffmpeg', ['-nostdin', '-v', 'error', '-i', file, '-map', `0:a:${index}`, '-c:a', 'copy', '-f', 'hash', '-hash', 'sha256', '-']).trim();
    const originalHash = checksum(input), copiedHash = checksum(output);
    if (originalHash !== copiedHash) throw new Error(`Encoded audio stream ${index} changed.`);
    return originalHash;
  });
  return { frames, frameRate: video.r_frame_rate, averageFrameRate: video.avg_frame_rate, videoDuration: video.duration, containerDuration: before.format.duration, audioHashes, sourceDimensions: [video.width, video.height], dimensions: [derivative.width, derivative.height], visualParity: 'requires review at battle display size' };
}

export async function optimizeBattleMoves(root, options) {
  const recipe = { ...encoding, width: options.width, crf: options.crf };
  const configHash = hash(JSON.stringify(recipe));
  const sourceRoot = path.join(root, 'public/assets/special-moves'), outputRoot = path.join(root, 'public/assets/battle-moves');
  const manifestPath = path.join(root, 'src/lib/battleMoves.json');
  // Verification data is build-only; the app downloads only asset URLs/revisions.
  const buildsPath = path.join(root, 'scripts/battle-move-builds.json');
  let builds = {};
  try { builds = JSON.parse(await fs.readFile(buildsPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const catalog = JSON.parse(await fs.readFile(path.join(root, 'src/specialMoves.json'), 'utf8'));
  const clips = Object.values(catalog.clips), authored = new Set(clips.map(clip => clip.file));
  const revision = file => clips.find(clip => clip.file === file)?.revision ?? null;
  let manifest = {};
  try { manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const files = [...new Set(options.all ? [...authored].sort() : options.files.length ? options.files : Object.keys(manifest).sort())].slice(options.offset, options.offset + options.limit);
  const report = { encoding: recipe, configHash, mode: options.check ? 'check' : 'optimize', threads: options.threads, selected: files.length, results: [], totals: {} };
  const saveReport = async () => {
    report.totals = { accepted: report.results.filter(item => ['created', 'reused', 'verified'].includes(item.status)).length, rejected: report.results.filter(item => item.status === 'not-smaller').length, skippedGeometry: report.results.filter(item => ['skipped-geometry', 'verified-original'].includes(item.status)).length, sourceBytes: report.results.reduce((sum, item) => sum + (item.before ?? 0), 0), deliveredBytes: report.results.reduce((sum, item) => sum + (item.deliveredBytes ?? 0), 0) };
    if (options.report) await writeJson(options.report, report);
  };
  if (!options.check) await fs.mkdir(outputRoot, { recursive: true });
  for (const file of files) {
    if (!authored.has(file) || path.basename(file) !== file || !file.endsWith('.mp4')) throw new Error(`Not an authored special-move filename: ${file}`);
    const input = path.join(sourceRoot, file), bytes = await fs.readFile(input), sourceHash = hash(bytes), entry = manifest[file], previousBuild = builds[file], build = previousBuild ?? entry;
    const asset = `assets/battle-moves/${path.basename(file, '.mp4')}-${sourceHash.slice(0, 12)}-${configHash.slice(0, 12)}.mp4`;
    const output = path.join(root, 'public', asset);
    const checkedPath = entry?.asset?.startsWith('assets/battle-moves/') && path.basename(entry.asset) === entry.asset.slice('assets/battle-moves/'.length) ? path.join(root, 'public', entry.asset) : null;
    try {
      const existingHash = checkedPath ? await fileHash(checkedPath).catch(() => null) : null;
      const existingValid = build?.sourceHash === sourceHash && build.asset === entry?.asset && entry.revision === revision(file) && existingHash && (!build.outputHash || build.outputHash === existingHash);
      if (options.check) {
        if (!entry && options.all) {
          const original = probe(input).streams.find(stream => stream.codec_type === 'video');
          if (!original) throw new Error(`Missing video stream: ${file}`);
          if (!scaledDimensions(original?.width, original?.height, recipe.width)) {
            report.results.push({ file, status: 'verified-original', reason: 'Authored geometry requires retaining original media.', sourceHash, revision: revision(file), sourceDimensions: [original?.width, original?.height], before: bytes.length, deliveredBytes: bytes.length });
            console.log(JSON.stringify(report.results.at(-1)));
            await saveReport();
            continue;
          }
        }
        if (!entry || build?.sourceHash !== sourceHash || entry.revision !== revision(file) || !checkedPath) throw new Error(`Regenerate battle move: ${file}`);
        const outputHash = existingHash;
        if (!outputHash) throw new Error(`Missing derivative: ${file}`);
        if (build.outputHash && build.outputHash !== outputHash) throw new Error(`Derivative hash changed: ${file}`);
        const verification = build.outputHash && build.verification ? build.verification : verifyMedia(input, checkedPath, { ...recipe, width: Math.max(recipe.width, 432) });
        report.results.push({ file, status: 'verified', asset: entry.asset, before: bytes.length, deliveredBytes: (await fs.stat(checkedPath)).size, recipe: build.configHash === configHash ? 'current' : 'legacy', outputHash, verification });
      } else if (existingValid && build.configHash === configHash && entry.asset === asset && build.outputHash && build.verification) {
        report.results.push({ file, status: 'reused', asset, before: bytes.length, deliveredBytes: build.after, outputHash: build.outputHash, verification: build.verification });
      } else {
        const sourceVideo = probe(input).streams.find(stream => stream.codec_type === 'video');
        if (!sourceVideo) throw new Error(`Missing video stream: ${file}`);
        const dimensions = scaledDimensions(sourceVideo?.width, sourceVideo?.height, recipe.width);
        if (!dimensions) {
          if (entry && !existingValid) { delete manifest[file]; await writeJson(manifestPath, manifest); }
          report.results.push({ file, status: 'skipped-geometry', reason: 'No exact even aspect ratio fits the selected width.', sourceDimensions: [sourceVideo?.width, sourceVideo?.height], before: bytes.length, deliveredBytes: existingValid ? (await fs.stat(checkedPath)).size : bytes.length });
          console.log(JSON.stringify(report.results.at(-1)));
          await saveReport();
          continue;
        }
        const temporary = path.join(outputRoot, `.${path.basename(asset)}.${process.pid}.tmp.mp4`);
        try {
          run('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-threads', String(options.threads), '-filter_threads', '1', '-i', input, '-map', '0:v:0', '-map', '0:a?', '-vf', `scale=${dimensions[0]}:${dimensions[1]}:flags=${recipe.scale}`, '-c:v', recipe.codec, '-preset', recipe.preset, '-crf', String(recipe.crf), '-pix_fmt', recipe.pixelFormat, '-threads', String(options.threads), '-fps_mode', recipe.frameSync, '-c:a', recipe.audio, '-movflags', '+faststart', temporary]);
          const after = (await fs.stat(temporary)).size;
          if (after >= bytes.length * .85) {
            // A stale or damaged derivative must not remain selected at runtime.
            if (entry && !existingValid) { delete manifest[file]; await writeJson(manifestPath, manifest); }
            report.results.push({ file, status: 'not-smaller', before: bytes.length, candidateBytes: after, deliveredBytes: existingValid ? (await fs.stat(checkedPath)).size : bytes.length });
          } else {
            const verification = verifyMedia(input, temporary, recipe), outputHash = await fileHash(temporary);
            const outputExisted = await fs.access(output).then(() => true, () => false);
            await fs.rename(temporary, output);
            try {
              builds[file] = { asset, revision: revision(file), sourceHash, before: bytes.length, after, configHash, outputHash, verification };
              await writeJson(buildsPath, builds);
              manifest[file] = { asset, revision: revision(file) };
              await writeJson(manifestPath, manifest);
            } catch (error) {
              if (entry) manifest[file] = entry; else delete manifest[file];
              if (previousBuild) builds[file] = previousBuild; else delete builds[file];
              try { await writeJson(buildsPath, builds); }
              finally { if (!outputExisted) await fs.rm(output, { force: true }); }
              throw error;
            }
            report.results.push({ file, status: 'created', asset, before: bytes.length, deliveredBytes: after, outputHash, verification });
          }
        } finally { await fs.rm(temporary, { force: true }); }
      }
      console.log(JSON.stringify({ file, status: report.results.at(-1).status, before: bytes.length, after: report.results.at(-1).deliveredBytes }));
      await saveReport();
    } catch (error) {
      report.results.push({ file, status: 'failed', error: error.message });
      await saveReport();
      throw error;
    }
  }
  await saveReport();
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await optimizeBattleMoves(path.resolve(import.meta.dirname, '..'), parseOptions(process.argv.slice(2)));
}
