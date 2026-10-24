import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const css = await readFile(new URL('../src/components/ui/relational-state.css', import.meta.url), 'utf8');
assert.match(css, /@layer utilities\s*\{/);
assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /:is\([^\n]*\*/);
// These declarations and selectors are the six original emitted Tailwind rules,
// with shorter test-only utility names. Their specificity and matching stay intact.
const rules = [
  { file: 'field.tsx', name: 'field-description-balance', group: 'field', qualifier: '<i data-orientation="horizontal"></i>', old: ':is(:where(.group\\/field):has([data-orientation="horizontal"]) *)', declaration: 'text-wrap:balance' },
  { file: 'input-group.tsx', name: 'input-group-addon-input-top', group: 'input-group', qualifier: '<input>', old: ':is(:where(.group\\/input-group):has(> input) *)', declaration: 'padding-top:calc(var(--spacing) * 2.5)' },
  { file: 'input-group.tsx', name: 'input-group-addon-input-bottom', group: 'input-group', qualifier: '<input>', old: ':is(:where(.group\\/input-group):has(> input) *)', declaration: 'padding-bottom:calc(var(--spacing) * 2.5)' },
  { file: 'item.tsx', name: 'item-media-description-offset', group: 'item', qualifier: '<i data-slot="item-description"></i>', old: ':is(:where(.group\\/item):has([data-slot="item-description"]) *)', declaration: '--tw-translate-y:calc(var(--spacing) * .5);translate:var(--tw-translate-x) var(--tw-translate-y)' },
  { file: 'item.tsx', name: 'item-media-description-align', group: 'item', qualifier: '<i data-slot="item-description"></i>', old: ':is(:where(.group\\/item):has([data-slot="item-description"]) *)', declaration: 'align-self:flex-start' },
  { file: 'sidebar.tsx', name: 'sidebar-menu-button-action-space', group: 'menu-item', qualifier: '<i data-sidebar="menu-action"></i>', old: ':is(:where(.group\\/menu-item):has([data-sidebar="menu-action"]) *)', declaration: 'padding-right:calc(var(--spacing) * 8)' },
];
for (const file of new Set(rules.map(rule => rule.file))) {
  const source = await readFile(new URL(`../src/components/ui/${file}`, import.meta.url), 'utf8');
  assert.match(source, /import ['"]\.\/relational-state\.css['"]/);
  assert.doesNotMatch(source, /group-has-/);
  for (const rule of rules.filter(rule => rule.file === file)) assert.ok(source.includes(rule.name));
}
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const originalCss = rules.map((rule, i) => `.original-${i}${rule.old}{${rule.declaration}}`).join('\n');
  await page.setContent(`<style>@layer utilities; @layer utilities {
    .target { --tw-translate-x:11px; --tw-translate-y:0px; translate:var(--tw-translate-x) var(--tw-translate-y); padding:12px; text-wrap:wrap; align-self:auto; }
    ${originalCss}
  } ${css}
  @layer utilities {
    .override-low { padding:37px; text-wrap:nowrap; align-self:flex-end; translate:13px 17px; }
    .target.override-equal { padding:37px; text-wrap:nowrap; align-self:flex-end; translate:13px 17px; }
  }</style><main id="fixtures"></main>`);
  const result = await page.evaluate(rules => {
    const properties = ['padding-top', 'padding-bottom', 'padding-right', 'text-wrap', 'align-self', 'translate'];
    const candidateRules = [];
    const visit = sheet => { for (const rule of sheet.cssRules) { if (rule.selectorText) candidateRules.push(rule); else if (rule.cssRules) visit(rule); } };
    for (const sheet of document.styleSheets) visit(sheet);
    const scenarios = [
      'none', 'empty-group', 'direct-qualifier', 'nested-qualifier', 'outside-qualifier',
      'wrong-group', 'nested-target', 'qualifier-in-target', 'same-element-group', 'nested-groups',
    ];
    const failures = [];
    let comparisons = 0;
    for (const [i, rule] of rules.entries()) {
      const candidate = candidateRules.find(item => item.selectorText.endsWith(` .${rule.name}`));
      if (!candidate) throw new Error(`Missing actual candidate rule for ${rule.name}`);
      for (const spacing of [4, 7]) for (const scenario of scenarios) for (const override of ['', 'override-low', 'override-equal']) {
        const markup = targetClass => {
          const target = `<span data-target class="target ${override} ${targetClass}">Text</span>`;
          const group = content => `<div class="group/${rule.group}">${content}</div>`;
          switch (scenario) {
            case 'none': return target;
            case 'empty-group': return group(target);
            case 'direct-qualifier': return group(rule.qualifier + target);
            case 'nested-qualifier': return group(`<section>${rule.qualifier}</section>${target}`);
            case 'outside-qualifier': return rule.qualifier + group(target);
            case 'wrong-group': return `<div class="group/unrelated">${rule.qualifier}${target}</div>`;
            case 'nested-target': return group(rule.qualifier + `<section>${target}</section>`);
            case 'qualifier-in-target': return group(`<span data-target class="target ${override} ${targetClass}">${rule.qualifier}Text</span>`);
            case 'same-element-group': return `<span data-target class="target ${override} ${targetClass} group/${rule.group}">${rule.qualifier}Text</span>`;
            case 'nested-groups': return group(rule.qualifier + group(target));
          }
        };
        const fixture = document.createElement('div');
        fixture.style.setProperty('--spacing', `${spacing}px`);
        fixture.innerHTML = `<div data-before>${markup(`original-${i}`)}</div><div data-after>${markup(rule.name)}</div>`;
        document.querySelector('#fixtures').append(fixture);
        const before = fixture.querySelector('[data-before] [data-target]');
        const after = fixture.querySelector('[data-after] [data-target]');
        const beforeView = Object.fromEntries(properties.map(property => [property, getComputedStyle(before).getPropertyValue(property)]));
        const afterView = Object.fromEntries(properties.map(property => [property, getComputedStyle(after).getPropertyValue(property)]));
        const beforeMatches = before.matches(`.original-${i}${rule.old}`);
        const afterMatches = after.matches(candidate.selectorText);
        comparisons++;
        if (JSON.stringify(beforeView) !== JSON.stringify(afterView) || beforeMatches !== afterMatches) {
          failures.push({ name: rule.name, spacing, scenario, override, beforeView, afterView, beforeMatches, afterMatches });
        }
        fixture.remove();
      }
    }
    return { comparisons, failures };
  }, rules);
  assert.deepEqual(result.failures, [], 'original emitted utilities and ancestor-first selectors retain presentation and matching');
  console.log(JSON.stringify({ result: 'PASS', rules: rules.length, ...result }, null, 2));
} finally { await browser.close(); }
