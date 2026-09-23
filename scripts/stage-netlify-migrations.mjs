import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Netlify Build stages migrations under PACKAGE_PATH, whereas deployment
// collectors may resolve the internal directory from the repository build root.
// Stage identical native artifacts at both locations. Netlify, not this script,
// validates migration history and executes SQL before publishing the deploy.
export function stageNetlifyMigrations(root = process.cwd()) {
  const source = path.join(root, 'netlify/database/migrations');
  const names = readdirSync(source).sort();
  const versions = new Set();
  for (const name of names) {
    if (!/^\d+_[a-z0-9_-]+$/.test(name)) throw new Error(`Invalid migration directory: ${name}`);
    const version = name.split('_')[0].replace(/^0+/, '') || '0';
    if (versions.has(version)) throw new Error(`Duplicate migration version: ${version}`);
    versions.add(version);
    const sql = path.join(source, name, 'migration.sql');
    if (!existsSync(sql) || !readFileSync(sql, 'utf8').trim()) throw new Error(`Missing or empty migration: ${name}`);
  }
  if (!names.length) throw new Error('Native Netlify migration history must not be empty.');
  const destinations = [
    path.join(root, '.netlify/internal/db/migrations'),
    path.join(root, 'artifacts/squabblemon/.netlify/internal/db/migrations'),
  ];
  for (const destination of destinations) {
    rmSync(destination, { recursive: true, force: true });
    mkdirSync(destination, { recursive: true });
    for (const name of names) {
      const output = path.join(destination, name);
      mkdirSync(output);
      cpSync(path.join(source, name, 'migration.sql'), path.join(output, 'migration.sql'));
    }
  }
  return names;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(`Staged native Netlify migration artifacts: ${stageNetlifyMigrations().join(', ')}`);
}