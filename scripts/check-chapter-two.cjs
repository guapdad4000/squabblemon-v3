const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const storyRoot = path.join(root, 'artifacts/squabblemon/scripts/story');
const chapterRoot = path.join(storyRoot, 'chapters/red-side-tapes');
const read = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
function loadEngine(name, dependencies = {}) {
  const source = read(path.join(root, 'lib/squabblemon-engine/src', `${name}.ts`));
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: id => {
    if (!(id in dependencies)) throw new Error(`Unexpected runtime import ${id}`);
    return dependencies[id];
  } }, { filename: `${name}.ts` });
  return exports;
}
const data = loadEngine('data', { './commonCards': loadEngine('commonCards') });
const engine = loadEngine('story', { './data': data, './chapterOneDialogue': loadEngine('chapterOneDialogue') });
const chapter = JSON.parse(read(path.join(chapterRoot, 'chapter-two.proposed.json')));
const screenplay = JSON.parse(read(path.join(chapterRoot, 'chapter-two.screenplay.json')));
const assert = (ok, message) => { if (!ok) throw new Error(message); };
engine.validateStoryContent({ version: engine.storyContent.version + 1, chapters: [...engine.storyContent.chapters, chapter] });
assert(chapter.nodes.length === 9, 'Expected nine nodes');
const battles = chapter.nodes.filter(n => n.kind === 'battle');
assert(battles.length === 6, 'Expected six battles');
const tokens = new Set();
let dialogueCount = 0, defeatCount = 0;
const mainText = read(path.join(chapterRoot, 'CHAPTER_TWO_READTHROUGH.md'));
for (const [i, scene] of screenplay.scenes.entries()) {
  const node = chapter.nodes[i];
  assert(node.id === scene.id, `Node mismatch ${i}`);
  const filename = `${String(i + 1).padStart(2, '0')}-${scene.id}.md`;
  const sceneText = read(path.join(chapterRoot, 'scenes', filename));
  assert(sceneText.includes(scene.stage), `Stage drift ${scene.id}`);
  assert(mainText.includes(scene.stage), `Read-through stage drift ${scene.id}`);
  assert(sceneText.includes(scene.exit) && mainText.includes(scene.exit), `Exit drift ${scene.id}`);
  for (const section of ['main', 'pre', 'post', 'defeat']) {
    const lines = scene[section] ?? [];
    const proposed = section === 'main' ? node.scenes : section === 'pre' ? node.preDialogue : section === 'post' ? node.postDialogue : undefined;
    if (proposed) assert(lines.length === proposed.length, `Count drift ${scene.id}:${section}`);
    for (const [j, [speaker, text]] of lines.entries()) {
      const token = `${scene.id}:${section}:${j}`;
      assert(!tokens.has(token), `Duplicate ${token}`); tokens.add(token);
      assert(sceneText.includes(`lineToken: "${token}"`), `Missing ${token}`);
      assert(sceneText.includes(`text: ${JSON.stringify(text)}`), `Scene text drift ${token}`);
      assert(mainText.includes(text), `Read-through drift ${token}`);
      if (proposed) {
        assert(proposed[j].speaker === speaker && proposed[j].text === text, `Proposed line drift ${token}`);
        assert(fs.existsSync(path.join(root, 'artifacts/squabblemon/public', proposed[j].portraitAssetId)), `Missing portrait ${token}`);
      }
      section === 'defeat' ? defeatCount++ : dialogueCount++;
    }
  }
}
for (const n of battles) {
  assert(n.encounter.enemy.cardIds.length === 7 && new Set(n.encounter.enemy.cardIds).size === 7, `Bad deck ${n.id}`);
  assert(n.encounter.enemy.cardIds.every(k => data.cards[k]), `Unknown card ${n.id}`);
  assert(JSON.stringify(n.encounter.starObjectives) === JSON.stringify(n.starObjectives), `Snapshot objective drift ${n.id}`);
}
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
for (const file of walk(storyRoot).filter(f => f.endsWith('.md'))) {
  for (const [, target] of read(file).matchAll(/\]\(([^)]+)\)/g)) {
    if (target.includes('://') || target.startsWith('#')) continue;
    const t = target.split('#')[0];
    assert(fs.existsSync(path.resolve(path.dirname(file), t)), `Broken link ${file}: ${target}`);
  }
}
assert(dialogueCount === 158 && defeatCount === 6, 'Unexpected dialogue totals');
const existingPacket = path.join(root, 'artifacts/deliverables/Squabblemon_Chapter_One_Video_Agent_Pack_v1.zip');
const packetHash = crypto.createHash('sha256').update(fs.readFileSync(existingPacket)).digest('hex').toUpperCase();
assert(packetHash === '1BBED3A7A10A06B760EB95A97FA7C0760B59955EF9797859E7177F387B09E892', 'Handed-off Chapter One ZIP changed');
console.log(JSON.stringify({ engineContentValidation: 'passed', nodes: 9, battles: 6, normalDialogue: dialogueCount, optionalDefeat: defeatCount, uniqueTokens: tokens.size, decks: 'six valid seven-card decks', links: 'passed', chapterOnePacket: 'unchanged', limits: 'proposed content only; no balance or runtime playthrough performed' }, null, 2));
