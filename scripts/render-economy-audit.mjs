// Offline document packaging only. No app, database or provider imports.
import { readFileSync, writeFileSync } from "node:fs";
import MarkdownIt from "markdown-it";

const dir = "docs/economy-audit-current-v1";
const s = JSON.parse(readFileSync(`${dir}/simulation.json`, "utf8"));
const f = (n, places = 2) => Number(n).toFixed(places);
const pct = n => `${f(n * 100, 4)}%`;
const q = x => `${f(x.mean)} [${f(x.p05, 0)}, ${f(x.p50, 0)}, ${f(x.p95, 0)}]`;
const table = (heads, rows) => [
  `| ${heads.join(" | ")} |`,
  `| ${heads.map(() => "---").join(" | ")} |`,
  ...rows.map(r => `| ${r.join(" | ")} |`),
].join("\n");
const tiers = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythical"];
const metric = (j, key) => j.metrics[key];
const selected = s.journeys.filter(j => j.priority === "save" && (j.days > 1 || j.cohort === "new"));
const summary = [
  "# Generated numeric results",
  "",
  `Model ${s.modelVersion}; seed ${s.seed}; ${s.iterations.toLocaleString("en-US")} independent pack trials per collection/type; 100 journey trials per scenario. See simulation.json for every quantile and balance. No telemetry.`,
  "",
  "## Rarity mathematics",
  "",
  "Per-pack/ten probabilities mean at least one result of that rarity, including duplicates. Effective ten includes guarantee replacement; it is not a new-card guarantee.",
  "",
  table(["Tier", "Cards", "Base slot", "Single pack", "Natural ten", "Effective ten", "Sole missing card p50/p95 packs"],
    Object.entries(s.analytical.byTier).map(([t, r]) => [t, r.count, pct(r.baseSlotProbability), pct(r.basePackProbability), pct(r.naturalTenProbability), pct(r.effectiveTenProbability), `${r.onlyMissingCardAcquisitionPackTails["0.5"]}/${r.onlyMissingCardAcquisitionPackTails["0.95"]}`])),
  "",
  "## Independent current pack outcomes",
  "",
  "Start with zero pity/styles. A ten advances ownership and pity across its ten packs. Means are not guaranteed outcomes.",
  "",
  table(["Collection", "Opening", "New cards mean [p05,p50,p95]", "Universal mean", "Clout mean", "Rare+ probability"],
    Object.entries(s.packs).flatMap(([cohort, types]) => Object.entries(types).map(([kind, p]) => [cohort, kind, q(p.newCards), f(p.universal.mean), f(p.clout.mean), pct(p.rarePlusHaulProbability)]))),
  "",
  "## Bonus and finite style supply",
  "",
  table(["State", "Style probability / expected count", "Universal EV", "Clout EV"], [
    ["Nominal / first pack at pity 0", pct(s.styleLifetime.nominalAndFirstPack.styleProbability), f(s.styleLifetime.nominalAndFirstPack.universalEV, 4), f(s.styleLifetime.nominalAndFirstPack.cloutEV, 4)],
    ["Ten packs from pity 0, eligible pool", `${f(s.styleLifetime.tenFromZero.expectedStyles, 4)} styles; at least one guaranteed`, f(s.styleLifetime.tenFromZero.universalEV, 4), f(s.styleLifetime.tenFromZero.cloutEV, 4)],
    ["Steady eligible single-pack average", pct(s.styleLifetime.steadyStateBeforeExhaustion.styleProbability), f(s.styleLifetime.steadyStateBeforeExhaustion.universalEV, 4), f(s.styleLifetime.steadyStateBeforeExhaustion.cloutEV, 4)],
    ["After pool exhausted", "0%", f(s.styleLifetime.afterExhaustion.universalEV, 4), f(s.styleLifetime.afterExhaustion.cloutEV, 4)],
  ]),
  "",
  `${s.styleLifetime.pool} styles; no crafting or paid acquisition. Exhaustion packs mean [p05,p50,p95]: **${q(s.styleLifetime.exhaustionPacks)}**; analytic mean ${f(s.styleLifetime.exactExpectedExhaustionPacks)}. Maximum ${s.styleLifetime.pool * s.analytical.pity.maximumWaitWhileEligible} packs, minimum ${s.styleLifetime.pool}; random named gameplay cards have no analogous finite guarantee. Crafting can exhaust styles earlier. Catalog growth changes this boundary.`,
  "",
  "## Coupled wallet journeys",
  "",
  "Save Clout, but open earned tickets. All numbers below are means except the explicit quantiles. New includes finite account/onboarding/Road claims; mature states start zero incremental wallet/XP with those claims already consumed. Casual misses Wednesday/Saturday; engaged logs in daily. 'Online' means no match progression but independent login/shop claims remain.",
  "",
  table(["Days / cadence / collection", "Settlement", "Sessions / matches", "Clout mean [p05,p50,p95]", "Random packs", "Owned cards", "Account XP", "Tracked card XP"],
    selected.map(j => [`${j.days} / ${j.cadence} / ${j.cohort}`, j.settlement === "verified-reward" ? "Solo" : "Online", `${metric(j, "sessions").mean}/${metric(j, "matches").mean}`, q(metric(j, "clout")), f(metric(j, "opened").mean), f(metric(j, "ownedCards").mean), f(metric(j, "profileXp").mean), f(metric(j, "cardXp").mean)])),
  "",
  "## Thirty-day spending tradeoffs: new collection",
  "",
  table(["Cadence / settlement", "Priority", "Clout left", "Random packs", "Owned cards", "Training/coaching spent", "Card XP / move tier"],
    s.journeys.filter(j => j.days === 30 && j.cohort === "new").map(j => [`${j.cadence} / ${j.settlement === "verified-reward" ? "Solo" : "Online"}`, j.priority, f(metric(j, "clout").mean), f(metric(j, "opened").mean), f(metric(j, "ownedCards").mean), f(metric(j, "trainingSpent").mean), `${f(metric(j, "cardXp").mean)}/${f(metric(j, "moveTier").mean)}`])),
  "",
  "Training priority deliberately buys Intensive Training aggressively before coaching; it is a spending choice, not an optimum. All three priorities still open earned tickets. Reactions are affordability goals, not automatic purchases in this grid.",
  "",
  "## Thirty-day shard balances with Clout saved",
  "",
  "Mean balances; **columns cannot be pooled**. 'Other tiers' means unavailable for a Mythical target, not globally useless.",
  "",
  table(["Cadence / collection / mode", "Universal", ...tiers, "Other tiers"],
    s.journeys.filter(j => j.days === 30 && j.priority === "save").map(j => [`${j.cadence}/${j.cohort}/${j.settlement === "verified-reward" ? "Solo" : "Online"}`, f(metric(j, "universal").mean), ...tiers.map(t => f(j.matching[t].mean)), f(metric(j, "strandedForMythical").mean)])),
  "",
  "## Chosen finish craft affordability, complete collection",
  "",
  "Sequential production packs, matching plus universal only; no competing shard spend. This measures affordability, not time to own: a bonus can grant the chosen finish earlier. Match/session equivalents use full-price packs, 62 Clout per mixed solo match, two matches/session; ignore rebates and claims.",
  "",
  table(["Tier", "Cost", "Packs mean [p05,p50,p95]", "Matches p50/p95", "Sessions p50/p95", "Other-tier shards mean"],
    Object.entries(s.finishTargetsCompleteCollection).flatMap(([t, rows]) => rows.map(r => [t, r.cost, q(r.packs), `${r.repeatOnlyMatchesIgnoringRebates.p50}/${r.repeatOnlyMatchesIgnoringRebates.p95}`, `${r.twoMatchSessionsIgnoringRebates.p50}/${r.twoMatchSessionsIgnoringRebates.p95}`, f(r.otherTierShardsUnavailableForTarget.mean)]))),
  "",
  "## Repeat-only affordability",
  "",
  "No missions, rebates or one-time grants; expected rate, not stopping-time guarantee. Online match-income equivalents are infinite/unreachable because match income is zero. Online players can still use independent claim income.",
  "",
  table(["Goal", "Clout", "Mixed solo matches", "Two-match sessions", "Six-match sessions"],
    s.repeatOnlyPacing.cloutTargets.filter(r => ["reaction-pack", "ticket", "ten-pull", "common-recruit", "training-intensive"].includes(r.id) || r.id.includes("reaction")).map(r => [r.id, r.cost, f(r.matches), f(r.twoMatchSessions), f(r.matches / 6)])),
  "",
  "Card move prerequisites and cap need both XP and coaching, not only Clout. Cadence is a modeling assumption. Available Intensive Training buys are discrete and only prorate at cap. The smaller 100-Clout session is sufficient for level 2; this table explicitly prices an Intensive-only strategy.",
  "",
  table(["Participation", "Level / XP", "Mixed matches", "Two-match sessions", "Six-match sessions", "Intensive-only Clout from zero", "Cumulative coaching Clout"],
    s.repeatOnlyPacing.participationTargets.flatMap(p => p.goals.map(g => [
      pct(p.participation), `${g.level}/${g.xp}`, f(g.mixedMatches), f(g.twoMatchSessions), f(g.sixMatchSessions),
      g.actualIntensiveCostToReachOrPass, ({ 2: 100, 5: 350, 8: 850, 10: "850 for all moves; 0 to level" })[g.level],
    ]))),
  "",
  "## Finite campaign boundary",
  "",
  `${s.campaignBoundary.battles} battles; ${s.campaignBoundary.accountXp} authored account XP, ${s.campaignBoundary.authoredClout} authored Clout, ${s.campaignBoundary.authoredAndPerfectTickets} authored plus perfect tickets. With the Chapter-5 starter Mythic and five milestones from authored XP alone: 3,000 Clout +227 tickets. Excludes match payouts, welcome, daily claims and Road. No campaign ticket spending is assumed in this boundary; use the independent pack and journey experiments for acquisition distributions, not an invented average campaign completion date.`,
  "",
  table(["Starting collection", "Direct new gameplay cards", "Story/starter duplicate universal shards"],
    Object.entries(s.campaignBoundary.byStartingCollection).map(([c, r]) => [c, r.newCards, r.storyAndStarterDuplicateUniversal])),
  "",
  "### Spending the finite campaign tickets",
  "",
  "Counterfactual order: all finite story/starter rewards first, then 22 ten-pulls and seven singles; no Road claims or Clout spending. This differs from opening packs between battles and is not an average completion forecast.",
  "",
  table(["Starting collection", "Random new cards mean [p05,p50,p95]", "Final owned", "Clout including rebates", "Universal"],
    Object.entries(s.supplemental.finiteCampaignTicketSpending).map(([c, row]) => [c, q(row.metrics.newCards), q(row.metrics.owned), q(row.metrics.clout), q(row.metrics.universal)])),
  "",
  table(["Collection", ...tiers],
    Object.entries(s.supplemental.finiteCampaignTicketSpending).map(([c, row]) => [c, ...tiers.map(t => f(row.metrics.matching[t].mean))])),
  "",
  "## Purchased and promotional overlays — never organic income",
  "",
  "Separate source-rule counterfactuals overlay the new/casual first-session save wallet. No payment, redemption, provider access or live-account mutation occurred. Added Clout/tickets remain unspent; base prices exclude any tax and imply nothing about checkout availability.",
  "",
  table(["Configured USD base", "Added Clout", "Organic Clout mean", "Final Clout mean [p05,p50,p95]", "Extra full-price singles / tens affordable, no rebates"],
    s.supplemental.purchased.map(r => [`$${f(r.offer.amountMinor / 100)}`, r.cloutAdded, f(r.organicClout.mean), q(r.finalClout), `${r.extraFullPriceSinglePacksWithoutRebate}/${r.extraFullPriceTenPullsWithoutRebate}`])),
  "",
  `Production-eligible KYLE + CITYLEGENDS overlay: **${s.supplemental.promotional.cloutAdded} Clout +${s.supplemental.promotional.ticketsAdded} tickets**, union of eight card IDs, no duplicate compensation. Final Clout: ${q(s.supplemental.promotional.finalClout)}; newly added promo cards: ${q(s.supplemental.promotional.newPromoCards)}. This is eligibility in source, not actual redemption evidence. See the ledger for exact separate code contents and restrictions.`,
  "",
].join("\n");
writeFileSync(`${dir}/results-summary.md`, summary);

const sections = [
  ["report", "README.md"],
  ["results", "results-summary.md"],
  ["methods", "simulation-notes.md"],
  ["ledger-notes", "ledger-notes.md"],
  ["modes", "modes.md"],
  ["paid-boundary", "paid-boundary.md"],
  ["verification", "verification.md"],
];
const jsons = ["ledger.json", "modes.json", "cosmetics.json", "simulation.json"];
const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
const escape = x => x.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const slug = text => text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
md.renderer.rules.heading_open = (tokens, idx) => {
  const title = tokens[idx + 1].content;
  return `<${tokens[idx].tag} id="${slug(title)}">`;
};
const link = md.renderer.rules.link_open || ((tokens, idx, opts, env, renderer) => renderer.renderToken(tokens, idx, opts));
md.renderer.rules.link_open = (tokens, idx, opts, env, renderer) => {
  const href = tokens[idx].attrGet("href") || "";
  const [file, fragment] = href.split("#");
  const section = sections.find(([, name]) => name === file);
  if (section) tokens[idx].attrSet("href", `#${fragment || section[0]}`);
  if (jsons.includes(file)) tokens[idx].attrSet("href", `#download-${file}`);
  // Source references remain explicit repository paths, not broken file links in a download.
  if (href.startsWith("../../")) {
    tokens[idx].attrSet("title", `Source at ${s.sourceRevision}: ${href.slice(6)}`);
    tokens[idx].attrSet("href", "#source-access");
  }
  return link(tokens, idx, opts, env, renderer);
};
const downloads = jsons.map(name => `<a id="download-${name}" download="${name}" href="data:application/json;base64,${readFileSync(`${dir}/${name}`).toString("base64")}">${escape(name)}</a>`).join(" ");
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Squabblemon economy audit · current-source v1</title>
<style>
:root{color-scheme:light;font:16px/1.65 system-ui,sans-serif;color:#172233;background:#f4f6f9}
body{margin:0}header,main{max-width:1200px;margin:auto;padding:30px}header{background:#152c44;color:white;max-width:none}header>div{max-width:1200px;margin:auto}header a{color:#d9eeff}
nav{display:flex;gap:18px;flex-wrap:wrap}section{background:white;padding:34px;margin:24px 0;border:1px solid #dce2e8;border-radius:8px;overflow-x:auto}
h1{font-size:2rem;line-height:1.2}h2{font-size:1.45rem;margin-top:2rem;color:#173c60}h3{font-size:1.15rem}a{color:#155a8e}p,li{max-width:100ch}table{border-collapse:collapse;width:100%;font-size:.84rem;margin:20px 0}th,td{text-align:left;vertical-align:top;padding:10px;border:1px solid #dce2e8}th{background:#edf3f8}tr:nth-child(even){background:#f8fafc}code{font-size:.85em;overflow-wrap:anywhere}pre{background:#eef2f6;padding:18px;white-space:pre-wrap}strong{font-weight:700}
.downloads{display:flex;flex-wrap:wrap;gap:12px}.downloads a{padding:10px 15px;border:1px solid #b5cadc;border-radius:5px}
@media(max-width:650px){header,main{padding:15px}section{padding:18px}h1{font-size:1.65rem}table{min-width:650px}}
@media print{body{background:white}header{color:black;background:white}section{padding:0;border:0;break-before:page}nav,.downloads{display:none}a{color:inherit}}
</style></head><body>
<header><div><p>Squabblemon · Audit and recommendations · Not implementation approval</p><nav>${sections.map(([id, file]) => `<a href="#${id}">${escape(file.replace(".md", "").replace("README", "Executive report"))}</a>`).join("")}</nav></div></header>
<main><section><h2>Evidence downloads</h2><p>Self-contained machine-readable evidence is embedded in this document. Save the JSON files for independent analysis.</p><div class="downloads">${downloads}</div><p id="source-access">Source citations refer to repository revision <code>${s.sourceRevision}</code>. Markdown source and the JSON ledger retain exact repository paths/symbols; inspect that revision in the project. No live account or provider information is embedded.</p></section>
${sections.map(([id, file]) => `<section id="${id}">${md.render(readFileSync(`${dir}/${file}`, "utf8"))}</section>`).join("\n")}
</main></body></html>`;
writeFileSync(`${dir}/squabblemon-economy-audit-v1.html`, html);
console.log(`Wrote results-summary.md and self-contained HTML (${Buffer.byteLength(html)} bytes).`);