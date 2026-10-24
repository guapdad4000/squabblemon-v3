import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { broadTypographyExclusions, broadGroupHasFilters, broadPanelClassExclusions, checkStyleInvalidation } from './check-style-invalidation.mjs';
import { panelSurfaceClasses, verifyPanelExemptions, checkPanelSurfaces } from './check-panel-surfaces.mjs';

const tracedSelector = ':not(:where([class~=not-prose],[class~=not-prose] *))';
const tracedGroupHas = String.raw`:is(:where(.group\/input-group):has(>input) *)`;
const tracedPanel = ".panel-section:not([class*=-paper])";

test('detects the traced generated exclusions across minifier spellings', () => {
  for (const selector of [tracedSelector,
    ':not(:where([class~="not-prose"], [class~="not-prose"] *))',
    ":not( :where( [class ~= 'not-prose'], [class ~= 'not-prose'] * ) )",
    ':not(:where(.not-prose, .not-prose *))']) {
    assert.deepEqual(broadTypographyExclusions(`.prose :where(p)${selector}{margin:1em}`), [selector]);
  }
});

test('allows ordinary component selectors and ignores comments', () => {
  assert.deepEqual(broadTypographyExclusions(`/* ${tracedSelector} */
    .battle-arena :not(:where(.selected,.disabled)){color:white}
    .dossier :not(:where([hidden])){display:block}`), []);
});

test('rejects generated group-has descendant filters including nested functional conditions', () => {
  for (const selector of [tracedGroupHas,
    String.raw`:is(:where(.group\/item):has([data-slot=item-description]) *)`,
    ':is( :where(.group) :has(:is(input, textarea)) * )']) {
    assert.deepEqual(broadGroupHasFilters(`.generated-utility${selector}{padding-top:1rem}`), [selector]);
  }
});

test('allows the equivalent ancestor-first rules without banning ordinary group states', () => {
  assert.deepEqual(broadGroupHasFilters(String.raw`
    /* ${tracedGroupHas} */
    :where(.group\/input-group):has(>input) .input-group-addon-input-top{padding-top:1rem}
    .group-hover\:opacity-100:is(:where(.group):hover *){opacity:1}
    .field:has([aria-invalid=true]){color:red}`), []);
});

test('rejects the traced panel class-substring exclusion across emitted spellings', () => {
  for (const selector of [tracedPanel,
    '.panel-section:not([class*="-paper"])',
    ".panel-section:not( [class *= '-paper'] )",
    '.panel-section:not([class*="-paper" i])']) {
    assert.deepEqual(broadPanelClassExclusions(`html :is(.glass-panel,${selector}) span{color:white}`), [selector]);
  }
});

test('allows explicit paper-panel exclusions and does not blame adjacent interactive exclusions', () => {
  assert.deepEqual(broadPanelClassExclusions(`/* ${tracedPanel} */
    html .panel-section:not(.profile-progress-paper, .profile-badges-paper) span
    :not(:is(button,a,input,select,textarea,[role=switch],[role=checkbox]) *){color:white}
    .unrelated[class*="-paper"]{color:black}`), []);
});

test('checks every generated chunk and rejects a missing build', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'squabblemon-css-'));
  try {
    await assert.rejects(checkStyleInvalidation(directory), /No emitted CSS/);
    await mkdir(path.join(directory, 'assets'));
    await writeFile(path.join(directory, 'assets', 'battle.css'), '.battle-card{color:white}');
    assert.equal((await checkStyleInvalidation(directory)).files, 1);
    await writeFile(path.join(directory, 'assets', 'index.css'), `.prose p${tracedSelector}{color:black}`);
    await assert.rejects(checkStyleInvalidation(directory), /index\.css: 1 broad typography exclusions/);
    await writeFile(path.join(directory, 'assets', 'index.css'), `.generated-utility${tracedGroupHas}{padding-top:1rem}`);
    await assert.rejects(checkStyleInvalidation(directory), /index\.css: 1 broad group-has descendant filters/);
    await writeFile(path.join(directory, 'assets', 'index.css'), String.raw`:where(.group\/input-group):has(>input) .input-group-addon-input-top{padding-top:1rem}`);
    assert.equal((await checkStyleInvalidation(directory)).files, 2);
    await writeFile(path.join(directory, 'assets', 'index.css'), `${tracedPanel} span{color:white}`);
    await assert.rejects(checkStyleInvalidation(directory), /index\.css: 1 broad panel class-substring exclusions/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('AST panel audit accepts static JSX forms and ignores unrelated classes and prose', () => {
  const source = '<><section className="panel-section profile-progress-paper"/><section className={"panel-section profile-badges-paper"}/><section className={`panel-section`}/><h2 className="panel-section-title"/></>';
  assert.deepEqual(panelSurfaceClasses(source), ['panel-section profile-progress-paper', 'panel-section profile-badges-paper', 'panel-section']);
  assert.deepEqual(panelSurfaceClasses('// panel-section\nconst example = <h2 className={dynamicTitle}/>;'), []);
});

test('AST panel audit rejects dynamic templates, helpers, aliases and spread overrides', () => {
  for (const source of [
    '<section className={`panel-section ${paper}`}/>',
    '<section className={cn("panel-section", paper)}/>',
    'const surface = "panel-section profile-progress-paper"; const panel = <section className={surface}/>;',
    '<section className={"panel-section " + variant}/>',
    '<section className="panel-section" {...props}/>',
  ]) assert.throws(() => panelSurfaceClasses(source, 'FuturePanel.tsx'), /FuturePanel.tsx:1: panel-section requires a complete literal/);
});

test('new paper variants must be covered by every explicit CSS exemption list', () => {
  const panels = ['panel-section', 'panel-section profile-progress-paper', 'panel-section profile-badges-paper'];
  const rule = '.panel-section:not(.profile-progress-paper, .profile-badges-paper) span{color:white}';
  assert.equal(verifyPanelExemptions(panels, rule + rule).exemptionRules, 2);
  assert.throws(() => verifyPanelExemptions([...panels, 'panel-section new-paper'], rule), /new-paper/);
  assert.throws(() => verifyPanelExemptions(panels, rule + '.panel-section:not(.profile-progress-paper){color:white}'), /must match literal JSX/);
  assert.throws(() => verifyPanelExemptions(panels, '.panel-section:not([class*=-paper]){color:white}'), /must match literal JSX/);
  assert.throws(() => verifyPanelExemptions([], rule), /No literal panel-section surfaces/);
});

test('source validation scans real files and fails before a new paper panel can ship unstyled', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'squabblemon-panels-'));
  try {
    await mkdir(path.join(directory, 'styles'));
    await writeFile(path.join(directory, 'styles', 'tokens.css'), '.panel-section:not(.known-paper){color:white}');
    await writeFile(path.join(directory, 'Panel.tsx'), '<section className="panel-section known-paper"/>');
    assert.deepEqual((await checkPanelSurfaces(directory)).paperClasses, ['known-paper']);
    await writeFile(path.join(directory, 'NewPanel.tsx'), '<section className="panel-section new-paper"/>');
    await assert.rejects(checkPanelSurfaces(directory), /new-paper/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
