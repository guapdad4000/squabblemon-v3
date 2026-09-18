const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const source = process.argv[2];
if (!source || !fs.statSync(source).isDirectory()) throw new Error('Pass the source animation folder.');
const root = path.resolve(__dirname, '../artifacts/squabblemon');
const catalogPath = path.join(root, 'src/specialMoves.json');
const destination = path.join(root, 'public/assets/special-moves');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const unknown = fs.readdirSync(source).filter(file => /^char\d+_chroma\.mp4$/i.test(file)
  && !catalog.clips[file.replace('_chroma.mp4', '')]);
if (unknown.length) throw new Error(`Add these new character IDs to src/specialMoves.json before importing: ${unknown.join(', ')}`);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const imported = [], retained = [];
// Resolve stable character IDs, including the four original descriptive filenames.
for (const [id, clip] of Object.entries(catalog.clips)) {
  const candidates = [`${id}_chroma.mp4`, clip.file];
  const file = candidates.find(name => fs.existsSync(path.join(source, name)));
  if (file) {
    const bytes = fs.readFileSync(path.join(source, file));
    const target = path.join(destination, file);
    if (!fs.existsSync(target) || hash(fs.readFileSync(target)) !== hash(bytes)) fs.writeFileSync(target, bytes);
    clip.file = file;
    imported.push(id);
  } else retained.push(id);
  const bytes = fs.readFileSync(path.join(destination, clip.file));
  clip.revision = hash(bytes).slice(0, 16);
}
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
console.log(JSON.stringify({ imported: imported.length, retained: retained.length, retainedIds: retained }, null, 2));
