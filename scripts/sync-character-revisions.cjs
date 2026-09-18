const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '../artifacts/squabblemon');
const directory = path.join(root, 'public/assets/characters');
const revisions = Object.fromEntries(fs.readdirSync(directory).filter(file => file.endsWith('.webp')).sort().map(file => [
  file.slice(0, -5), createHash('sha256').update(fs.readFileSync(path.join(directory, file))).digest('hex').slice(0, 16),
]));
fs.writeFileSync(path.join(root, 'src/characterRevisions.json'), JSON.stringify(revisions, null, 2) + '\n');
console.log(`Updated artwork revisions for ${Object.keys(revisions).length} character portraits.`);
