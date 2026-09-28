export type ElementBalanceAuditOptions = {
  seeded: boolean;
  quick: boolean;
  outDir?: string;
  label?: string;
};

export function parseElementBalanceAuditArgs(args: readonly string[]): ElementBalanceAuditOptions {
  const options: ElementBalanceAuditOptions = { seeded: false, quick: false };
  const seen = new Set<string>();

  for (const arg of args) {
    if (arg === '--seeded' || arg === '--quick') {
      if (seen.has(arg)) throw new Error(`Duplicate flag: ${arg}`);
      seen.add(arg);
      if (arg === '--seeded') options.seeded = true;
      else options.quick = true;
      continue;
    }
    if (arg.startsWith('--out-dir=')) {
      if (seen.has('--out-dir')) throw new Error('Duplicate flag: --out-dir');
      seen.add('--out-dir');
      const value = arg.slice('--out-dir='.length).trim();
      if (!value) throw new Error('--out-dir requires a non-empty PATH (use --out-dir=PATH)');
      options.outDir = value;
      continue;
    }
    if (arg.startsWith('--label=')) {
      if (seen.has('--label')) throw new Error('Duplicate flag: --label');
      seen.add('--label');
      const value = arg.slice('--label='.length).trim();
      if (!value) throw new Error('--label requires a non-empty LABEL (use --label=LABEL)');
      if (value === '.' || value === '..' || value.includes('/') || value.includes('\\') || value.includes('\0')) {
        throw new Error('--label must not contain path separators or NUL');
      }
      options.label = value;
      continue;
    }
    throw new Error(`Unknown flag: ${arg}`);
  }

  return options;
}