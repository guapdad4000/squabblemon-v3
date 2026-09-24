import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// This is a read-only coverage check, not a SQL executor. Development migrations
// may be consolidated into a native baseline, so compare DDL rather than filenames.
const identifier = String.raw`(?:"([a-z_][a-z_0-9]*)"|([a-z_][a-z_0-9]*))`;
const name = (match, offset = 1) => match[offset] || match[offset + 1];
const type = String.raw`(?:timestamp(?:\s+with\s+time\s+zone)?|timestamptz|double\s+precision|uuid|text|integer|serial|boolean|jsonb|varchar(?:\(\d+\))?|numeric(?:\(\d+(?:,\s*\d+)?\))?|bigint|bigserial|date|real|smallint)`;

function normalizedType(value) {
  return value.toLowerCase().replace(/\s+/g, ' ').replace(/^timestamp with time zone$/, 'timestamptz');
}

function addColumn(coverage, table, column, definition = null) {
  if (!coverage.tables.has(table)) coverage.tables.set(table, new Map());
  const previous = coverage.tables.get(table).get(column);
  coverage.tables.get(table).set(column, definition ?? previous ?? null);
}

function columnDefinition(entry, field) {
  const suffix = entry.slice(field[0].length);
  const reference = suffix.match(new RegExp(String.raw`\bREFERENCES\s+(?:public\.)?${identifier}\s*\(\s*${identifier}\s*\)`, 'i'));
  const defaultValue = suffix.match(/\bDEFAULT\s+('(?:''|[^'])*'(?:\s*::\s*\w+)?|[\w.]+(?:\([^)]*\))?)/i);
  return {
    type: normalizedType(field[3]),
    notNull: /\bNOT\s+NULL\b|\bPRIMARY\s+KEY\b/i.test(suffix),
    reference: reference ? `${name(reference)}.${name(reference, 3)}` : null,
    defaultValue: defaultValue?.[1].replace(/\s+/g, '').toLowerCase() ?? null,
  };
}

function addIndex(coverage, match) {
  const index = name(match, 2);
  const table = name(match, 4);
  const columns = match[6].replace(/["\s]/g, '').toLowerCase();
  const predicate = (match[7] || '').replace(/["\s]/g, '').toLowerCase();
  coverage.indexes.set(index, `${match[1] ? 'unique' : 'index'}:${table}:${columns}:${predicate}`);
}

function normalizeConstraint(value) {
  return value.toLowerCase().replace(/"public"\./g, '').replace(/\bpublic\./g, '')
    .replace(/["\s]/g, '').replace(/^\s*constraint[a-z_0-9]+/i, '');
}

function sqlCoverage(sql, file, strict = false) {
  const coverage = { tables: new Map(), indexes: new Map(), constraints: new Map(), foreignKeys: new Map(), droppedIndexes: new Set() };
  const clean = sql.replace(/--[^\n]*/g, '');
  if (strict) {
    for (const statement of clean.split(';').map(part => part.trim()).filter(Boolean)) {
      if (!/^(?:BEGIN|COMMIT|CREATE\s+TABLE\b|ALTER\s+TABLE\b|CREATE\s+(?:UNIQUE\s+)?INDEX\b|DROP\s+INDEX\b)/i.test(statement)) {
        throw new Error(`Unsupported development migration statement in ${file}: ${statement.slice(0, 80)}`);
      }
    }
  }
  const creates = new RegExp(String.raw`CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?${identifier}\s*\(`, 'gi');
  for (const match of clean.matchAll(creates)) {
    const table = name(match);
    if (!coverage.tables.has(table)) coverage.tables.set(table, new Map());
    let depth = 1;
    let quoted = false;
    let start = match.index + match[0].length;
    let end = start;
    const entries = [];
    for (; end < clean.length; end++) {
      const char = clean[end];
      if (char === "'" && clean[end + 1] === "'" && quoted) { end++; continue; }
      if (char === "'") quoted = !quoted;
      if (!quoted) {
        if (char === '(') depth++;
        if (char === ')') depth--;
        if ((char === ',' && depth === 1) || depth === 0) {
          entries.push(clean.slice(start, end).trim());
          start = end + 1;
        }
        if (depth === 0) break;
      }
    }
    if (depth !== 0) throw new Error(`Unclosed CREATE TABLE ${table} in ${file}`);
    const column = new RegExp(String.raw`^${identifier}\s+(${type})\b`, 'i');
    for (const entry of entries) {
      const field = entry.match(column);
      if (field) addColumn(coverage, table, name(field), columnDefinition(entry, field));
      else if (strict && !/^(?:CONSTRAINT|PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY)\b/i.test(entry)) {
        throw new Error(`Unsupported development CREATE TABLE column in ${file}: ${entry.slice(0, 80)}`);
      }
    }
    if (!coverage.tables.get(table).size) throw new Error(`No recognized columns in CREATE TABLE ${table} in ${file}`);
  }
  const alters = new RegExp(String.raw`ALTER\s+TABLE\s+${identifier}\s+([\s\S]*?);`, 'gi');
  const added = new RegExp(String.raw`ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?${identifier}\s+(${type})\b([^,;]*)`, 'gi');
  const namedConstraint = new RegExp(String.raw`ADD\s+CONSTRAINT\s+${identifier}\s+([\s\S]+)`, 'i');
  for (const alter of clean.matchAll(alters)) {
    const table = name(alter);
    let addedCount = 0;
    for (const field of alter[3].matchAll(added)) {
      const entry = `${field[1] || field[2]} ${field[3]} ${field[4]}`;
      // Reuse the definition parser with a field prefix (without ADD COLUMN).
      const prefix = entry.match(new RegExp(String.raw`^${identifier}\s+(${type})\b`, 'i'));
      addColumn(coverage, table, name(field), columnDefinition(entry, prefix));
      addedCount++;
    }
    const constraint = alter[3].match(namedConstraint);
    if (constraint) coverage.constraints.set(`${table}.${name(constraint)}`, normalizeConstraint(constraint[3]));
    if (strict && (!addedCount && !constraint ||
      /\bADD\s+COLUMN\b/i.test(alter[3]) && !addedCount ||
      /\bADD\s+CONSTRAINT\b/i.test(alter[3]) && !constraint)) {
      throw new Error(`Unsupported development ALTER TABLE ${table} in ${file}; add coverage before releasing.`);
    }
  }
  const index = new RegExp(String.raw`CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?${identifier}\s+ON\s+${identifier}\s*(?:USING\s+\w+\s*)?\(([^)]+)\)(?:\s+WHERE\s+([^;]+))?`, 'gi');
  if (strict) for (const statement of clean.split(';').map(part => part.trim()).filter(Boolean)) {
    if (/^CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(statement) && !statement.match(new RegExp(index.source, 'i'))) {
      throw new Error(`Unsupported development CREATE INDEX in ${file}: ${statement.slice(0, 80)}`);
    }
  }
  for (const match of clean.matchAll(index)) addIndex(coverage, match);
  const droppedIndex = new RegExp(String.raw`DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?${identifier}`, 'gi');
  if (strict) for (const statement of clean.split(';').map(part => part.trim()).filter(Boolean)) {
    if (/^DROP\s+INDEX\b/i.test(statement) && !statement.match(new RegExp(droppedIndex.source, 'i'))) {
      throw new Error(`Unsupported development DROP INDEX in ${file}: ${statement.slice(0, 80)}`);
    }
  }
  for (const match of clean.matchAll(droppedIndex)) coverage.droppedIndexes.add(name(match));
  const fk = new RegExp(String.raw`ALTER\s+TABLE\s+${identifier}\s+ADD\s+CONSTRAINT\s+${identifier}\s+FOREIGN\s+KEY\s*\(\s*${identifier}\s*\)\s+REFERENCES\s+(?:(?:"public"|public)\.)?${identifier}\s*\(\s*${identifier}\s*\)`, 'gi');
  for (const match of clean.matchAll(fk)) {
    coverage.foreignKeys.set(`${name(match)}.${name(match, 5)}`, `${name(match, 7)}.${name(match, 9)}`);
  }
  return coverage;
}

function merge(into, from) {
  for (const [table, columns] of from.tables) {
    if (!columns.size && !into.tables.has(table)) into.tables.set(table, new Map());
    for (const [column, definition] of columns) addColumn(into, table, column, definition);
  }
  for (const key of ['indexes', 'constraints', 'foreignKeys']) {
    for (const [name, signature] of from[key]) into[key].set(name, signature);
  }
  for (const name of from.droppedIndexes) into.droppedIndexes.add(name);
}

function schemaCoverage(root) {
  const coverage = { tables: new Map(), indexes: new Map(), constraints: new Map(), foreignKeys: new Map(), droppedIndexes: new Set() };
  const directory = path.join(root, 'lib/db/src/schema');
  for (const file of readdirSync(directory).filter(file => file.endsWith('.ts'))) {
    const source = readFileSync(path.join(directory, file), 'utf8');
    const definitions = [...source.matchAll(new RegExp(String.raw`pgTable\(\s*${identifier}\s*,\s*\{`, 'g'))];
    for (let i = 0; i < definitions.length; i++) {
      const table = name(definitions[i]);
      if (!coverage.tables.has(table)) coverage.tables.set(table, new Map());
      const body = source.slice(definitions[i].index + definitions[i][0].length, definitions[i + 1]?.index ?? source.length);
      // Column declarations are keyed properties; callbacks and index declarations
      // do not have this shape. This also handles columns declared across lines.
      const columns = body.matchAll(/\b[a-zA-Z]\w*\s*:\s*(?:uuid|text|integer|serial|boolean|jsonb|timestamp|varchar|numeric|bigint|bigserial|date|real|doublePrecision|smallint)\(\s*["']([a-z_][a-z_0-9]*)["']/g);
      for (const column of columns) addColumn(coverage, table, column[1]);
      if (!coverage.tables.get(table).size) throw new Error(`No recognized schema columns for ${table} in ${file}`);
    }
  }
  if (!coverage.tables.size) throw new Error('No database schema tables found.');
  return coverage;
}

export function checkNetlifyMigrationCoverage(root = process.cwd()) {
  const required = schemaCoverage(root);
  const devDir = path.join(root, 'lib/db/migrations');
  for (const file of readdirSync(devDir).filter(file => file.endsWith('.sql'))) {
    merge(required, sqlCoverage(readFileSync(path.join(devDir, file), 'utf8'), file, true));
  }
  const nativeDir = path.join(root, 'netlify/database/migrations');
  const native = { tables: new Map(), indexes: new Map(), constraints: new Map(), foreignKeys: new Map(), droppedIndexes: new Set() };
  const entries = readdirSync(nativeDir).sort();
  if (!entries.length) throw new Error('No Netlify-native migrations found.');
  for (const entry of entries) {
    const file = path.join(nativeDir, entry, 'migration.sql');
    merge(native, sqlCoverage(readFileSync(file, 'utf8'), file));
  }
  const missing = [];
  for (const [table, columns] of required.tables) {
    if (!native.tables.has(table)) missing.push(`table ${table}`);
    else for (const [column, definition] of columns) {
      const actual = native.tables.get(table).get(column);
      if (!actual) missing.push(`column ${table}.${column}`);
      else if (definition && (actual.type !== definition.type || (definition.notNull && !actual.notNull) ||
        definition.defaultValue !== actual.defaultValue)) {
        missing.push(`column definition ${table}.${column}`);
      } else if (definition?.reference && actual.reference !== definition.reference &&
        native.foreignKeys.get(`${table}.${column}`) !== definition.reference) {
        missing.push(`foreign key ${table}.${column}`);
      }
    }
  }
  for (const [index, signature] of required.indexes) {
    if (native.indexes.get(index) !== signature) missing.push(`index ${index}`);
  }
  for (const [constraint, signature] of required.constraints) {
    if (native.constraints.get(constraint) !== signature) missing.push(`constraint ${constraint}`);
  }
  for (const index of required.droppedIndexes) {
    if (!native.droppedIndexes.has(index)) missing.push(`drop index ${index}`);
  }
  if (missing.length) throw new Error(`Netlify-native migrations lack required production DDL:\n${missing.map(item => `  - ${item}`).join('\n')}`);
  return { tables: required.tables.size, nativeMigrations: entries.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = checkNetlifyMigrationCoverage();
  console.log(`Netlify migration coverage verified: ${result.tables} tables across ${result.nativeMigrations} native migrations.`);
}