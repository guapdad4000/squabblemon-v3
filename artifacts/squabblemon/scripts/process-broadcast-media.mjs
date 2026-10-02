#!/usr/bin/env node

import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const publicRoot = path.join(root, "public");
const assetRoot = path.join(publicRoot, "brand/broadcast");
const jsonPath = path.join(root, "docs/broadcast-media-manifest.json");
const markdownPath = path.join(root, "docs/broadcast-media-manifest.md");

const sources = {
  sunset: {
    id: "loading-sunset-street",
    title: "Sunset street brawl",
    kind: "loading",
    source: "../../attached_assets/grok-video-d94e8556-0973-42a4-9c71-93ab89f91961_(1)_1790777681163.mp4",
    video: "brand/broadcast/loading/sunset-street.mp4",
    poster: "brand/broadcast/loading/sunset-street.jpg",
    crop: ["center 54%", "center 50%"],
    posterAt: 1.7,
    range: [0, 6.0417],
  },
  house: {
    id: "loading-squabblehouse",
    title: "Nighttime Squabblehouse",
    kind: "loading",
    source: "../../attached_assets/grok-video-f8ade026-eb3d-443d-9f78-75819c986e38_(1)_1790777700939.mp4",
    video: "brand/broadcast/loading/squabblehouse.mp4",
    poster: "brand/broadcast/loading/squabblehouse.jpg",
    crop: ["center 48%", "center 50%"],
    posterAt: 1.8,
    range: [0, 6.0417],
  },
  fade: {
    id: "loading-fade-park",
    title: "Crowded Fade Park",
    kind: "loading",
    source: "../../attached_assets/grok-video-537afb19-2f61-48ab-bd14-8cdd47ae03ac_1790777728143.mp4",
    video: "brand/broadcast/loading/fade-park.mp4",
    poster: "brand/broadcast/loading/fade-park.jpg",
    crop: ["center 50%", "center 51%"],
    posterAt: 1.6,
    range: [0, 6.0417],
  },
};

const montageSources = {
  live: {
    key: "source-a-live-action",
    file: "../../attached_assets/d779446a-0f1_ae3862ef_1790742851727_1790778124763.mp4",
    style: "live-action",
  },
  anime: {
    key: "source-b-anime",
    file: "../../attached_assets/openart-c9e95da7-239_3660c019_1790762667633_1790778146400.mp4",
    style: "anime",
  },
};

const clips = [
  {
    id: "anime-opponent-down",
    source: "anime",
    start: 24,
    duration: 1,
    description: "The blue-bandana fighter falls and lies down as the opponent remains standing; cut before the K.O. title.",
    tags: ["victory"],
    edit: "Source frames 24.00–25.00 only; excludes the K.O. title that starts at 25.00.",
  },
  {
    id: "anime-crowd-draw",
    source: "anime",
    start: 59,
    duration: 1,
    description: "Wide, unresolved brawl beat with several fighters still active and no clear winner.",
    tags: ["draw"],
    edit: "Color-only wide cut before the close first-punch insert at source 60.00; valid only for draw outcomes.",
  },
  {
    id: "anime-first-impact",
    source: "anime",
    start: 60,
    duration: 1,
    sourceDuration: 0.5,
    playbackSpeed: 0.5,
    description: "First face punch from the later fight sequence.",
    tags: ["victory"],
    edit: "Continuous colored impact action, slowed from 0.50 s at 0.5x to a 1.00 s output; ends before the boot/cloth insert.",
  },
  {
    id: "anime-second-impact",
    source: "anime",
    start: 63.25,
    duration: 1,
    sourceDuration: 0.75,
    playbackSpeed: 0.75,
    description: "A distinct later face punch by a different fighter in the second brawl sequence.",
    tags: ["victory"],
    edit: "Continuous color punch take after monochrome panels; 0.75 s source retimed to 1.00 s at 0.75x, before the sunny street cut.",
  },
  {
    id: "anime-uppercut-safe-edit",
    source: "anime",
    start: 65.25,
    duration: 1,
    sourceDuration: 0.5,
    playbackSpeed: 0.5,
    description: "The later uppercut/third-punch beat followed by the opponent's reaction.",
    tags: ["victory"],
    edit: "Safe continuous color action starts after monochrome panels at 64.75–65.25; 0.50 s source retimed to 1.00 s at 0.5x, before unrelated street/car shots.",
  },
  {
    id: "anime-car-launch",
    source: "anime",
    start: 69,
    duration: 1,
    sourceDuration: 0.75,
    playbackSpeed: 0.75,
    description: "A fighter is thrown beside a parked car in a brief action insert.",
    tags: ["victory"],
    edit: "0.75 s continuous car-side action retimed to 1.00 s at 0.75x; ends before the chef-at-the-window scene.",
  },
  {
    id: "anime-fight-clears",
    source: "anime",
    start: 66,
    duration: 2,
    description: "Wide fight-clears aftermath with a standing fighter and several opponents down on the street.",
    tags: ["victory"],
    edit: "Continuous color street aftermath at 66.00–68.00, distinct from the earlier unresolved crowd brawl; no title or monochrome flash.",
  },
  {
    id: "anime-chef-forward-punch",
    source: "anime",
    start: 70.5,
    duration: 1.5,
    description: "The Squabblehouse-apron fighter steps forward and thrusts a fist from the kitchen doorway.",
    tags: ["victory"],
    edit: "Continuous kitchen-doorway action from 70.50–72.00 includes the turn, windup, and forward-fist extension at 71.75; ends before the unrelated night-street cut.",
  },
  {
    id: "anime-falling-bandana",
    source: "anime",
    start: 61.25,
    duration: 1.15,
    description: "A red bandana drifts against a dark field, with only partial raised hands at the lower edge; no punch landing or KO is shown.",
    tags: ["reward"],
    edit: "Context-neutral object insert; ends before the next face-punch shot at source 62.50.",
  },
  {
    id: "anime-street-aftermath",
    source: "anime",
    start: 84.25,
    duration: 1,
    sourceDuration: 0.5,
    playbackSpeed: 0.5,
    description: "Quiet lamp-lit street with a fallen fighter, after the action has cleared.",
    tags: ["defeat"],
    edit: "Stable-lit 0.50 s view of the fallen fighter retimed to 1.00 s at 0.5x; excludes later alternating lamp/dark frames.",
  },
  {
    id: "live-first-impact",
    source: "live",
    start: 16,
    duration: 1.8,
    description: "Close-range punch lands against the blue-bandana fighter.",
    tags: ["victory"],
    edit: "Different action and live-action framing from the later faceoff punches; no frame inversion or inserted monochrome flash.",
  },
  {
    id: "live-finishing-punch",
    source: "live",
    start: 22.25,
    duration: 1,
    description: "A gloved fist connects in the close-range finishing punch.",
    tags: ["victory"],
    edit: "Isolated the point of contact and immediate settle; continuous color frames.",
  },
  {
    id: "live-knockdown",
    source: "live",
    start: 25.5,
    duration: 1.8,
    description: "The opponent lies on the ground while the red-bandana fighter stands; no title card.",
    tags: ["victory"],
    edit: "Outcome aftermath only; does not claim a player-specific result.",
  },
  {
    id: "live-isolated-fist",
    source: "live",
    start: 32,
    duration: 1.5,
    description: "A ring-gloved fist held close to camera with no target/person visible.",
    tags: ["reward"],
    edit: "Tight object-only crop, deliberately context-neutral; the fist does not strike anyone.",
  },
  {
    id: "live-sunglasses-jab",
    source: "live",
    start: 39.5,
    duration: 1.25,
    description: "The sunglasses fighter's separate jab, with the red-suited figure only in the background.",
    tags: ["victory"],
    edit: "The 39.50–40.75 jab take is separate from the later red-suited boss hold/entrance.",
  },
  {
    id: "live-side-kick",
    source: "live",
    start: 34.5,
    duration: 1,
    sourceDuration: 0.75,
    playbackSpeed: 0.75,
    description: "The side kick and opponent recoil, distinct from either close-up punch.",
    tags: ["victory"],
    edit: "0.75 s continuous side-kick/recoil take retimed to 1.00 s at 0.75x; cuts before the red-plaid close-up.",
  },
  {
    id: "live-chef-counter",
    source: "live",
    start: 52.25,
    duration: 1.8,
    description: "Chef counterattack in the crowd brawl.",
    tags: ["victory"],
    edit: "Brief action-specific cut; inspected for continuity and high-contrast frames.",
  },
  {
    id: "live-falling-bandana",
    source: "live",
    start: 61.25,
    duration: 1.7,
    description: "The red bandana falls and comes to rest on the pavement; no target or KO is visible.",
    tags: ["reward"],
    edit: "Starts on cloth motion rather than the preceding fist insert; ends on the fabric alone.",
  },
  {
    id: "live-ground-fist",
    source: "live",
    start: 60.25,
    duration: 1,
    description: "A ground-fist impact against pavement with no opponent struck and no outcome shown.",
    tags: ["draw"],
    edit: "Combat-only impact insert, not eligible for reward; cuts before the falling-bandana composition.",
  },
  {
    id: "live-crowd-draw",
    source: "live",
    start: 57.75,
    duration: 2,
    description: "Several fighters exchange blows in a wide street view with no clear winner.",
    tags: ["draw"],
    edit: "Wide unresolved fight view; starts after the doorway faceoff, ends before the ground-fist close-up.",
  },
  {
    id: "live-last-collapse",
    source: "live",
    start: 78.25,
    duration: 1.5,
    description: "The final fighter collapses onto the pavement after the red-eyed figure's approach.",
    tags: ["defeat"],
    edit: "Action/reaction frames only; starts after the separate threat portrait and is not the later quiet hold.",
  },
  {
    id: "live-quiet-aftermath",
    source: "live",
    start: 83.75,
    duration: 2,
    description: "Quiet street closing shot with a fallen fighter under the lamp.",
    tags: ["defeat"],
    edit: "Single aftermath composition; avoids the red-eyed figure's approach.",
  },
];

const candidates = [
  ["A", "0–9", "Crowd gathers / arena arrival", "Opening-only establishing material; deferred, not exported."],
  ["B", "0–9.5", "Squabblehouse arrival / crowd", "Opening-only establishing material; deferred, not exported."],
  ["B", "9.5–11", "Split-bandana eyes and FIGHT title", "Pre-fight title/faceoff; deferred."],
  ["A", "9–15", "Bandana fighters square up", "Faceoff; deferred."],
  ["B", "11–15", "Bandana fighters square up", "Faceoff; deferred."],
  ["A", "15–18.5", "Fist toward camera / impact close-up", "Exported as live-first-impact (16.00–17.80); outcome-specific victory."],
  ["B", "15–17.5", "First monochrome impact", "High-contrast monochrome impact panel; excluded for rapid flash risk."],
  ["A", "18.5–21", "Crowd arena view", "Repeated establishing view; excluded and opening use is deferred."],
  ["B", "17.5–21", "Arena/crowd view", "A wide unresolved brawl take at 59–60 is exported as anime-crowd-draw; the earlier arena establishing view remains deferred."],
  ["A", "21–24", "Close-range finishing punch", "Exported as live-finishing-punch (22.25–23.25); victory."],
  ["B", "21–24", "Close-range finishing punch", "Mostly setup/pose; impact is followed by monochrome panels, excluded as an unsafe near-duplicate."],
  ["A", "24–27", "Opponent down / K.O. beat", "Exported as live-knockdown (25.50–27.30), title omitted; victory-only."],
  ["B", "24–27", "Opponent down / K.O. title", "Frames 24.00–25.00 are exported as anime-opponent-down; the K.O. title starts at 25.00 and is excluded."],
  ["A", "27–31", "New challenger squares up", "Faceoff material; deferred."],
  ["B", "27–30.5", "New challenger squares up", "Faceoff material; deferred."],
  ["A", "31–33", "Ring-fist / sunglasses punch", "Ring-fist object detail exported as live-isolated-fist (32.00–33.50) for reward only; no person is hit."],
  ["B", "30.5–33", "Ring-fist / sunglasses punch", "Fast portrait-to-punch transition and white/monochrome frames; excluded for flash risk."],
  ["A", "33–36", "Side kick / opponent recoils", "Exported as live-side-kick (34.50–35.25), retimed from 0.75 s to 1.00 s to avoid the red-plaid close-up; victory."],
  ["B", "33–35.5", "Side kick / opponent recoils", "The presumed kick is a monochrome/white flash sequence; the remaining color interval cuts directly into the red-plaid threat portrait, leaving no safe coherent >=1-second take. Deferred/excluded."],
  ["A", "36–39", "Red-plaid fighter grin/portrait", "Threat portrait; opening placement deferred."],
  ["B", "35.5–39", "Red-plaid fighter grin/monochrome portrait", "Threat portrait and high-contrast manga flashes; deferred/excluded."],
  ["A", "39–42", "Sunglasses boxer and red-suited boss", "The red-suited boss portrait remains deferred; the separate sunglasses-boxer jab is exported as live-sunglasses-jab (39.50–40.75), victory."],
  ["B", "39–41.5", "Red-eyed figure arrives", "Threat/entrance portrait; deferred."],
  ["A", "42–45", "Red-eyed figure arrival/close-up", "Threat portrait; deferred."],
  ["B", "41.5–45.5", "Red-eyed figure arrival/close-up", "Threat portrait; deferred."],
  ["A", "45–48", "Chef at window", "Entrance/portrait; deferred."],
  ["B", "45.5–48.5", "Chef at window", "Entrance/portrait; deferred."],
  ["A", "48–51", "Chef emerges/winds up", "Chef entrance; deferred."],
  ["B", "48.5–51.5", "Chef dining/portrait", "Unrelated held food portrait; not a distinct reward action, excluded."],
  ["A", "51–54", "Chef counterattack / impact", "Exported as live-chef-counter (52.25–54.05); victory."],
  ["B", "51.5–54.5", "Chef at the table / eating", "Not a combat counterattack in inspected frames; held eating portrait, excluded."],
  ["A", "54–57", "Doorway challenge", "Faceoff/challenge; deferred."],
  ["B", "54.5–58", "Doorway challenge", "Faceoff/challenge; deferred."],
  ["A", "57–60", "Full crowd brawl", "Exported as live-crowd-draw (57.75–59.75), draw-only: broad unresolved combat, never a noncombat reward."],
  ["B", "58–60", "Crowd brawl", "Exported as anime-crowd-draw (59.00–60.00), draw-only: several fighters remain active with no declared winner."],
  ["A", "60–61", "Ground-fist insert", "Exported as live-ground-fist (60.25–61.25), draw-only combat impact; not context-neutral and never a generic reward."],
  ["B", "60–61.2", "First face punch", "Exported as anime-first-impact (60.00–60.50), a continuous color hit slowed from 0.50 s to 1.00 s; victory."],
  ["A", "61–63", "Falling red bandana", "Exported as live-falling-bandana (61.25–62.95) as isolated falling cloth; reward-only."],
  ["B", "61.2–62.5", "Falling red bandana", "Exported as anime-falling-bandana (61.25–62.40), ending before the next person-impact shot; reward-only."],
  ["A", "63–66", "Ground reaction", "The face reaction is a very brief, motion-blurred close-up followed immediately by lights/pavement; no coherent >=1-second portrait take, so audit-only."],
  ["B", "62.5–64", "Second face punch", "A distinct later punch by a different fighter is exported as anime-second-impact (63.25–64.00) at 0.75x, victory; separate from the first punch at 60–61.2."],
  ["B", "64–66", "Third face punch / uppercut", "Monochrome panels at 64.75–65.25 are excluded; a color-only uppercut/reaction edit is exported as anime-uppercut-safe-edit (65.25–65.75) at 0.5x, victory."],
  ["A", "66–69", "Fight clears / fighters down", "Crowded multi-fall brawl has no clean short single-take outcome; excluded, not collapsed into a neutral reward or one winner."],
  ["B", "66–69", "Fight clears / fighters down", "Continuous, color-only street aftermath exported as anime-fight-clears (66.00–68.00): one fighter remains upright while several others are down, distinct from the earlier wide draw brawl."],
  ["B", "69–70", "Car-side launch", "Exported as anime-car-launch (69.00–69.75) at 0.75x; ends before the following unrelated shot."],
  ["B", "70–72", "Chef-forward punch", "The Squabblehouse-apron fighter turns and thrusts a fist; exported as anime-chef-forward-punch (70.50–72.00), victory, ending before the night-street cut."],
  ["A", "69–78", "Lone threatening figure after brawl", "Threat/entrance material; deferred, not a reward outcome."],
  ["B", "72–78", "Lone threatening figure after brawl", "Threat/entrance material; deferred."],
  ["A", "78–81", "Last fighter collapses", "Exported as live-last-collapse (78.25–79.75), defeat-only action, separate from the later quiet aftermath."],
  ["B", "78–81", "Last fighter collapses", "Outcome frames mix standing threat and falls; excluded for clarity."],
  ["A", "81–90", "Quiet street / fallen fighter under lamp", "One static closing composition exported as live-quiet-aftermath (83.75–85.75); defeat-only, separate from live-last-collapse."],
  ["B", "81–90", "Quiet street / fallen fighter under lamp", "One stable-light composition exported as anime-street-aftermath (84.25–84.75) at half speed; later alternating lamp/dark frames are omitted."],
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function absSource(relativePath) {
  return path.resolve(root, relativePath);
}

async function bytes(file) {
  return (await stat(file)).size;
}

function probe(file) {
  return JSON.parse(
    run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration,size",
      "-show_entries", "stream=codec_name,codec_type,width,height",
      "-of", "json", file,
    ]),
  );
}

async function extractPoster(source, timestamp, destination, width, maxBytes) {
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", timestamp.toFixed(3), "-i", source,
    "-map", "0:v:0", "-frames:v", "1",
    "-vf", `scale=${width}:-2`,
    "-q:v", "4", "-map_metadata", "-1",
    destination,
  ]);
  const fileBytes = await bytes(destination);
  if (fileBytes > maxBytes) throw new Error(`${destination} poster ${fileBytes} exceeds ${maxBytes} bytes`);
  return fileBytes;
}

async function encodeLoading(scene) {
  const source = absSource(scene.source);
  const destination = path.join(publicRoot, scene.video);
  const poster = path.join(publicRoot, scene.poster);
  await mkdir(path.dirname(destination), { recursive: true });
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", source, "-t", scene.range[1].toFixed(3),
    "-map", "0:v:0", "-an", "-sn", "-dn",
    "-vf", "scale=960:540:flags=lanczos,fps=24,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", "26",
    "-maxrate", "2000k", "-bufsize", "4000k",
    "-movflags", "+faststart", "-map_metadata", "-1",
    destination,
  ]);
  const videoProbe = probe(destination);
  const videoBytes = await bytes(destination);
  if (videoBytes > 2_000_000) throw new Error(`${destination} is ${videoBytes} bytes (> 2 MB)`);
  const posterBytes = await extractPoster(source, scene.posterAt, poster, 800, 200_000);
  return {
    id: scene.id,
    label: scene.title,
    source: path.relative(root, source),
    sourceRange: { start: 0, end: Number(videoProbe.format.duration) },
    duration: Number(videoProbe.format.duration),
    video: scene.video,
    videoBytes,
    poster: scene.poster,
    posterBytes,
    videoCodec: videoProbe.streams[0].codec_name,
    audio: "removed",
    portraitPosition: scene.crop[0],
    landscapePosition: scene.crop[1],
  };
}

async function encodeClip(clip) {
  const source = montageSources[clip.source];
  const sourceFile = absSource(source.file);
  const sourceDuration = clip.sourceDuration ?? clip.duration;
  const playbackSpeed = clip.playbackSpeed ?? 1;
  const ptsFactor = (1 / playbackSpeed).toFixed(6);
  const base = `brand/broadcast/rewards/${clip.id}`;
  const video = `${base}.mp4`;
  const poster = `${base}.jpg`;
  const destination = path.join(publicRoot, video);
  await mkdir(path.dirname(destination), { recursive: true });
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", clip.start.toFixed(3), "-t", sourceDuration.toFixed(3), "-i", sourceFile,
    "-map", "0:v:0", "-an", "-sn", "-dn",
    "-vf", `setpts=${ptsFactor}*PTS,scale=540:960:flags=lanczos,fps=24,format=yuv420p`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "25",
    "-maxrate", "1000k", "-bufsize", "2000k",
    "-movflags", "+faststart", "-map_metadata", "-1",
    destination,
  ]);
  const videoProbe = probe(destination);
  const videoBytes = await bytes(destination);
  if (videoBytes > 1_000_000) throw new Error(`${destination} is ${videoBytes} bytes (> 1 MB)`);
  const actualDuration = Number(videoProbe.format.duration);
  if (actualDuration < 1 || actualDuration > 3) {
    throw new Error(`${destination} duration ${actualDuration} is outside 1–3 seconds`);
  }
  const posterBytes = await extractPoster(
    sourceFile,
    clip.start + sourceDuration / 2,
    path.join(publicRoot, poster),
    480,
    150_000,
  );
  return {
    id: clip.id,
    source: path.relative(root, sourceFile),
    sourceRange: { start: clip.start, end: Number((clip.start + sourceDuration).toFixed(3)) },
    duration: actualDuration,
    playbackSpeed,
    video,
    videoBytes,
    poster,
    posterBytes,
    style: source.style,
    tags: clip.tags,
    description: clip.description,
    edit: clip.edit,
    videoCodec: videoProbe.streams[0].codec_name,
    dimensions: `${videoProbe.streams[0].width}x${videoProbe.streams[0].height}`,
    audio: "removed",
  };
}

function markdownReport(manifest) {
  const size = (value) => `${(value / 1024).toFixed(1)} KiB (${value.toLocaleString()} bytes)`;
  const sceneRows = manifest.loadingScenes.map((scene) =>
    `| ${scene.id} | ${scene.source} ${scene.sourceRange.start.toFixed(2)}–${scene.sourceRange.end.toFixed(2)} s | ${scene.duration.toFixed(3)} s | ${scene.video} (${size(scene.videoBytes)}) | ${scene.poster} (${size(scene.posterBytes)}) | ${scene.portraitPosition} / ${scene.landscapePosition} |`,
  );
  const clipRows = manifest.rewardClips.map((clip) => {
    const definition = clips.find((entry) => entry.id === clip.id);
    return `| ${clip.id} | ${clip.style} | ${clip.sourceRange.start.toFixed(2)}–${clip.sourceRange.end.toFixed(2)} s | ${clip.duration.toFixed(3)} s | ${clip.video} (${size(clip.videoBytes)}) | ${clip.poster} (${size(clip.posterBytes)}) | ${clip.tags.join(", ")} | ${definition.description} |`;
  });
  const candidateRows = manifest.portraitAudit.candidates.map(
    (entry) => `| ${entry.source} | ${entry.range} s | ${entry.moment} | ${entry.disposition} |`,
  );
  return `# Broadcast media preparation — Task 265, step 1

## Catalog contract

\`src/lib/broadcastCatalog.ts\` exports \`LoadingScene\`, \`RewardClip\`, \`loadingScenes\`, and \`rewardClips\`. The reward type is \`type RewardClip = {id:string,video:string,poster:string,duration:number,style:"anime"|"live-action",tags:ReadonlyArray<"victory"|"defeat"|"draw"|"reward">}\`. All URLs are base-relative (no leading slash), unique IDs are used, and every runtime item has at least one reachable placement tag. This is metadata only; media consumers remain outside this step.

## Delivery totals

- Landscape scenes: ${manifest.totals.loadingVideoBytes.toLocaleString()} video bytes / ${manifest.loadingScenes.length} loops; ${manifest.totals.loadingPosterBytes.toLocaleString()} poster bytes / ${manifest.loadingScenes.length} posters.
- Portrait clips: ${manifest.totals.rewardVideoBytes.toLocaleString()} video bytes / ${manifest.rewardClips.length} clips; ${manifest.totals.rewardPosterBytes.toLocaleString()} poster bytes / ${manifest.rewardClips.length} posters.
- Combined runtime derivatives: ${manifest.totals.runtimeBytes.toLocaleString()} bytes (video + posters).
- Limits met: landscape video <=2,000,000 bytes; loading posters <=200,000 bytes; each reward video <=1,000,000 bytes and 1–3 seconds; reward posters <=150,000 bytes. All MP4 derivatives are silent H.264 with only the primary video stream; the original AAC and attached thumbnail stream are not included.

## Landscape loading scenes

| ID | Source range | Delivered duration | Video and actual size | Poster and actual size | Portrait / landscape position |
|---|---|---:|---|---|---|
${sceneRows.join("\n")}

## Reward clips

| ID | Style | Source range | Duration | Video and actual size | Poster and actual size | Reachable tags | Edit |
|---|---|---:|---:|---|---|---|---|
${clipRows.join("\n")}

## Portrait-montage source audit and omissions

| Source | Audited range | Moment | Decision / rationale |
|---|---:|---|---|
${candidateRows.join("\n")}

### Frame review, editing, and safety

- Reviewed full-timeline half-second contact sheets for both 90-second sources and quarter-second detail sheets around candidate action/ending windows. High-rate frame checks cover the chef forward punch, the 66–68 fight-clears aftermath, the live chef counter, and the live sunglasses jab. Files are listed in \`portraitAudit.contactSheets\` and are at \`docs/media-audit/contact-sheets/\`: full-timeline anime/live sheets, detail/boundary sheets, source loading-scene sheets, high-rate action checks, and \`exported-clips-review.jpg\`. The export review sheet includes every encoded portrait cut sampled at 4 fps, with per-cut sheets in \`docs/media-audit/exports/\`.
- Monochrome manga impact panels and abrupt color/black/white alternations were identified in anime around 15.5–19.0, 31.25–34.0, 38.75–39.75, 53.75–54.5, 62.75–63.25, and 64.75–65.25 seconds. Selected clips omit those high-contrast panels: the first face-punch cut uses 60.00–60.50; the second-punch cut uses 63.25–64.00; and the uppercut safe edit 65.25–65.75, then retimes each continuous color take to one second. The 66.00–68.00 fight-clears aftermath is continuous color at the original frame rate. The quiet street defeat clip is slowed from a stable-lit half-second to avoid alternating lamp/dark frames. The colored K.O. title at 25.00 is excluded from the anime opponent-down cut.
- Live-action exports were inspected at quarter-second boundaries; selected takes use normal color footage without inserted monochrome flashes. The isolated-glove-fist and falling-bandana clips alone carry \`reward\` and do not show a punch landing on a person or a KO. These object cuts are distinct from combat-only ground-fist/crowd-brawl cuts, which carry \`draw\`, not \`reward\`. Victory punches/kicks/knockdowns are tagged \`victory\`; last-collapse/quiet aftermath clips are tagged \`defeat\`; broad unresolved brawls and ground-fist impact carry \`draw\`. The inspected 63–66-second ground reaction is omitted because the close-up is too brief and motion-blurred to yield a coherent one-second cut.
- The anime falling-bandana cut ends before the next face-punch shot. Source A's chef counterattack (52.25–54.05) is exported as live-chef-counter. Source B's 51–54.5 chef-table sequence is held eating/dining rather than a strike; separately, the Squabblehouse-apron character turns and extends a fist from the kitchen doorway at 70.50–72.00, including the arm extension through 71.75 and ending before the unrelated night-street cut. The sunglasses-boxer jab at 39.50–40.75 is distinct from the red-suited boss portrait/hold and is exported as victory. The 66–68 multibody fight-clears view is a continuous, color-only aftermath and is separately included rather than conflated with the earlier unresolved crowd draw. The final-collapse action and quiet aftermath remain separate. Openings, faceoffs, threat/entrance portraits, and FIGHT lettering remain deferred, not runtime exports. A held repeated shot does not become several exports. No generated content or audio was added.
- Review contact sheets are audit documents only; no source montage or contact sheet is referenced at runtime. Original files remain in \`attached_assets\` and no runtime derivative links to them.

## All five supplied sources

${manifest.sources.map((source) => `- **${source.id}**: \`${source.path}\` (${source.bytes.toLocaleString()} bytes, ${source.duration.toFixed(3)} s, ${source.dimensions}, ${source.streams.join(", ")}). ${source.use}`).join("\n")}

## Processing provenance

Run \`node scripts/process-broadcast-media.mjs\` from \`artifacts/squabblemon\` to re-encode the authored edit ranges and refresh actual sizes in the manifests. The script maps only stream 0 (primary video), omits audio/subtitles/data/metadata, generates matched JPEG posters, probes outputs, and fails when a stated byte or duration cap is exceeded.
`;
}

await mkdir(path.dirname(jsonPath), { recursive: true });
await mkdir(path.join(assetRoot, "loading"), { recursive: true });
await mkdir(path.join(assetRoot, "rewards"), { recursive: true });
const expectedRewardFiles = new Set(clips.flatMap((clip) => [
  `${clip.id}.mp4`,
  `${clip.id}.jpg`,
]));
for (const file of await readdir(path.join(assetRoot, "rewards"))) {
  if (!expectedRewardFiles.has(file)) {
    await unlink(path.join(assetRoot, "rewards", file));
  }
}

const loadingScenes = [];
for (const scene of Object.values(sources)) {
  loadingScenes.push(await encodeLoading(scene));
}

const rewardClips = [];
for (const clip of clips) {
  rewardClips.push(await encodeClip(clip));
}

const exportReviewDir = path.join(root, "docs/media-audit/exports");
const contactSheetDir = path.join(root, "docs/media-audit/contact-sheets");
await mkdir(exportReviewDir, { recursive: true });
const expectedReviewSheets = new Set(clips.map((clip) => `${clip.id}.jpg`));
for (const file of await readdir(exportReviewDir)) {
  if (!expectedReviewSheets.has(file)) {
    await unlink(path.join(exportReviewDir, file));
  }
}
for (const clip of clips) {
  const file = path.join(publicRoot, `brand/broadcast/rewards/${clip.id}.mp4`);
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", file,
    "-vf", "fps=4,scale=100:178,drawtext=text='%{pts\\:hms}':x=2:y=2:fontsize=9:fontcolor=white:box=1:boxcolor=black@0.7,tile=5x2",
    "-frames:v", "1", "-q:v", "4",
    path.join(exportReviewDir, `${clip.id}.jpg`),
  ]);
}
run("magick", [
  "montage",
  ...clips.map((clip) => path.join(exportReviewDir, `${clip.id}.jpg`)),
  "-tile", "4x", "-geometry", "500x356+4+10", "-set", "label", "%t",
  "-background", "white", "-font", "DejaVu-Sans", "-pointsize", "16",
  path.join(contactSheetDir, "exported-clips-review.jpg"),
]);

const sourceAudit = [];
for (const source of Object.values(sources)) {
  const file = absSource(source.source);
  const info = probe(file);
  sourceAudit.push({
    id: source.id,
    path: path.relative(root, file),
    bytes: await bytes(file),
    duration: Number(info.format.duration),
    dimensions: `${info.streams[0].width}x${info.streams[0].height}`,
    streams: info.streams.map((stream) => stream.codec_type === "video" ? `${stream.codec_name} ${stream.width}x${stream.height}` : stream.codec_name),
    use: "Landscape loading-scene loop; primary video stream only in public derivative.",
  });
}
for (const source of Object.values(montageSources)) {
  const file = absSource(source.file);
  const info = probe(file);
  sourceAudit.push({
    id: source.key,
    path: path.relative(root, file),
    bytes: await bytes(file),
    duration: Number(info.format.duration),
    dimensions: `${info.streams[0].width}x${info.streams[0].height}`,
    streams: info.streams.map((stream) => stream.codec_type === "video" ? `${stream.codec_name} ${stream.width}x${stream.height}` : stream.codec_name),
    use: `Source for ${rewardClips.filter((clip) => clip.style === source.style).length} short silent ${source.style} edits; original is not a runtime asset.`,
  });
}

const auditEntries = candidates.map(([source, range, moment, disposition]) => ({
  source,
  range,
  moment,
  disposition,
}));
const contactSheets = (await readdir(contactSheetDir))
  .filter((file) => file.endsWith(".jpg"))
  .sort()
  .map((file) => `docs/media-audit/contact-sheets/${file}`);

const manifest = {
  task: 265,
  step: 1,
  catalogContract: {
    loadingScenes: ["id", "label", "video", "poster", "portraitPosition", "landscapePosition"],
    rewardClips: ["id", "video", "poster", "duration", "style", "tags"],
    rewardStyle: ["anime", "live-action"],
    rewardTags: ["victory", "defeat", "draw", "reward"],
    paths: "Base-relative; no leading slash.",
    runtimeRules: "Metadata only; unique IDs; no original montage or contact sheet URL; every clip has >=1 reachable tag.",
  },
  sources: sourceAudit,
  loadingScenes,
  rewardClips,
  portraitAudit: {
    contactSheets,
    notes: [
      "Half-second full-timeline and quarter-second action-window contact sheets reviewed visually.",
      "Manga monochrome impact panels and abrupt black/white alternation were excluded from exports; see report for identified intervals.",
      "Faceoffs, FIGHT title, entrances, threat portraits, lone red-eyed figure, and opening-only establishing footage are audit-only.",
      "Reward-tagged clips are limited to isolated fist/falling fabric with no visible punch-on-person or KO; crowd brawls and ground-fist impacts are draw-only combat footage.",
      "Draw pool includes actual unresolved action/crowd-fight material and is not treated as a generic noncombat reward.",
      "Distinct action differences between source A and B are recorded in the candidate table below.",
      "No added audio, generated content, original montages or audit contact sheets are shipped as runtime media.",
    ],
    candidates: auditEntries,
  },
  totals: {
    loadingVideoBytes: loadingScenes.reduce((sum, scene) => sum + scene.videoBytes, 0),
    loadingPosterBytes: loadingScenes.reduce((sum, scene) => sum + scene.posterBytes, 0),
    rewardVideoBytes: rewardClips.reduce((sum, clip) => sum + clip.videoBytes, 0),
    rewardPosterBytes: rewardClips.reduce((sum, clip) => sum + clip.posterBytes, 0),
    runtimeBytes: [...loadingScenes, ...rewardClips].reduce(
      (sum, media) => sum + media.videoBytes + media.posterBytes,
      0,
    ),
  },
};

await writeFile(jsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(markdownPath, markdownReport(manifest));
console.log(
  `Prepared ${loadingScenes.length} loading scenes and ${rewardClips.length} reward clips; ` +
  `${manifest.totals.runtimeBytes.toLocaleString()} total runtime bytes.`,
);