import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const isPanel = value => value.split(/\s+/).includes('panel-section');
const isLiteral = node => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

/** Panels must declare their full surface classes where JSX can be audited.
 * Fail closed on helper/template/alias forms rather than silently missing paper. */
export function panelSurfaceClasses(source, fileName = 'Panel.tsx') {
  if (!source.includes('panel-section')) return [];
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true,
    /\.jsx?$/.test(fileName) ? ts.ScriptKind.JSX : ts.ScriptKind.TSX);
  const classes = [], allowedLiterals = new Set();
  const fail = node => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    throw new Error(`${fileName}:${line + 1}: panel-section requires a complete literal JSX className; enumerate dynamic panel surfaces before changing paper exclusions.`);
  };
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(file) === 'className') {
      const value = node.initializer && ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (value && isLiteral(value) && isPanel(value.text)) {
        const attributes = node.parent.properties;
        if (attributes.some(ts.isJsxSpreadAttribute) || attributes.filter(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(file) === 'className').length !== 1) fail(node);
        classes.push(value.text.trim().split(/\s+/).join(' '));
        allowedLiterals.add(value);
      } else if (value && !isLiteral(value) && /\bpanel-section(?![\w-])/.test(node.initializer.getText(file))) fail(node);
    }
    const stringPart = isLiteral(node) || [ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail].includes(node.kind);
    if (stringPart && isPanel(node.text) && !allowedLiterals.has(node)) fail(node);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return classes;
}

export function verifyPanelExemptions(panelClasses, css) {
  if (!panelClasses.length) throw new Error('No literal panel-section surfaces found; panel source validation cannot be skipped.');
  const paperClasses = [...new Set(panelClasses.flatMap(value => value.split(/\s+/).filter(name => name.includes('-paper'))))].sort();
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const exemptions = [...withoutComments.matchAll(/\.panel-section:not\(([^()]*)\)/g)];
  if (!exemptions.length) throw new Error('Missing explicit paper-panel exclusions in tokens.css.');
  for (const [, list] of exemptions) {
    const selectors = list.split(',').map(selector => selector.trim());
    const actual = selectors.map(selector => selector.slice(1)).sort();
    if (!selectors.every(selector => /^\.[a-zA-Z_][\w-]*$/.test(selector)) || JSON.stringify(actual) !== JSON.stringify(paperClasses)) {
      throw new Error(`tokens.css paper-panel exemptions must match literal JSX surfaces: ${paperClasses.join(', ') || '(none)'}. Found: ${list.trim()}. Update every exclusion and the browser parity cases.`);
    }
  }
  return { surfaces: new Set(panelClasses).size, paperClasses, exemptionRules: exemptions.length };
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(file);
    return /\.[jt]sx?$/.test(entry.name) && !/\.(?:test|spec)\.[jt]sx?$|\.d\.ts$/.test(entry.name) ? [file] : [];
  }));
  return files.flat();
}

export async function checkPanelSurfaces(directory = fileURLToPath(new URL('../src', import.meta.url))) {
  const classes = [];
  for (const file of await sourceFiles(directory)) classes.push(...panelSurfaceClasses(await readFile(file, 'utf8'), path.relative(directory, file)));
  return verifyPanelExemptions(classes, await readFile(path.join(directory, 'styles/tokens.css'), 'utf8'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkPanelSurfaces(process.argv[2]).then(result => console.log(`PASS panel sources: ${result.surfaces} literal surface combinations, ${result.paperClasses.length} paper variants, ${result.exemptionRules} consistent CSS rules.`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
