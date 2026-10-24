import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPanelSurfaces } from './check-panel-surfaces.mjs';

// These unused Tailwind typography exclusions registered an all-descendants
// class invalidation set in Chrome, forcing every battle card to restyle when
// its arena phase changed. Check emitted CSS: source scans miss plugin output.
export function broadTypographyExclusions(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...withoutComments.matchAll(/:not\(\s*:where\(([^()]*)\)\s*\)/g)]
    .filter(([, exclusion]) => /(?:\.not-prose|\[class\s*~=\s*(["']?)not-prose\1\s*\])\s+\*/.test(exclusion))
    .map(([selector]) => selector);
}

// A second Chrome trace identified global group-has descendant filters as
// another all-descendants invalidator. Ancestor-first component rules preserve
// matching/specificity without this generated right-hand :is(... *) filter.
export function broadGroupHasFilters(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...withoutComments.matchAll(/:is\(\s*:where\(([^()]*)\)\s*:has\(([^{}]*?)\)\s+\*\s*\)/g)]
    .filter(([, ancestor]) => /(?:^|[\s,])\.group(?:\\\/|(?=\s*(?:,|$)))/.test(ancestor))
    .map(([selector]) => selector);
}

// The panel rule's class-substring exclusion put ordinary class changes into
// the same generic invalidation set as its many text descendants. Match that
// traced trigger, not the unrelated interactive-element exclusion beside it.
export function broadPanelClassExclusions(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...withoutComments.matchAll(/\.panel-section:not\(\s*\[\s*class\s*\*=\s*(["']?)-paper\1\s*(?:[is]\s*)?\]\s*\)/g)]
    .map(([selector]) => selector);
}

async function cssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? cssFiles(file) : entry.isFile() && entry.name.endsWith('.css') ? [file] : [];
  }));
  return nested.flat();
}

export async function checkStyleInvalidation(directory) {
  const files = await cssFiles(directory);
  if (!files.length) throw new Error(`No emitted CSS found in ${directory}; build the app before validating styles.`);
  const violations = [];
  for (const file of files) {
    const css = await readFile(file, 'utf8');
    const typography = broadTypographyExclusions(css);
    const relational = broadGroupHasFilters(css);
    const panels = broadPanelClassExclusions(css);
    if (typography.length) violations.push(`${path.relative(directory, file)}: ${typography.length} broad typography exclusions`);
    if (relational.length) violations.push(`${path.relative(directory, file)}: ${relational.length} broad group-has descendant filters`);
    if (panels.length) violations.push(`${path.relative(directory, file)}: ${panels.length} broad panel class-substring exclusions`);
  }
  if (violations.length) throw new Error(`CSS invalidation guard failed:\n${violations.join('\n')}\nKeep unused typography plugin selectors out of emitted CSS; use ancestor-first relational rules and explicit paper-panel classes.`);
  return { files: files.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const directory = path.resolve(process.argv[2] || fileURLToPath(new URL('../dist/public', import.meta.url)));
  Promise.all([checkStyleInvalidation(directory), checkPanelSurfaces()]).then(([{ files }, panels]) => {
    console.log(`PASS CSS invalidation guard: ${files} emitted stylesheets, no traced broad CSS invalidation selectors.`);
    console.log(`PASS panel sources: ${panels.surfaces} literal surface combinations, ${panels.paperClasses.length} paper variants, ${panels.exemptionRules} consistent CSS rules.`);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
