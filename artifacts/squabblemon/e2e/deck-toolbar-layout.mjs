import assert from 'node:assert/strict';

/** The editor toolbar shares the tab row, leaving the collection more vertical room. */
export async function assertDeckToolbarLayout(page, { name, width }) {
  if (width < 901) return;
  const deckName = page.getByRole('textbox', { name: 'Deck name' });
  const originalName = await deckName.inputValue();
  for (const value of [originalName, 'A very long deck name that uses all space']) {
    await deckName.fill(value);
    const layout = await page.locator('.deck-workbench').evaluate(stage => {
      const box = selector => {
        const { top, right, bottom, left, width, height } = stage.querySelector(selector).getBoundingClientRect();
        return { top, right, bottom, left, width, height };
      };
      return {
        name: box('.deck-workbench__name'),
        tools: box('.deck-workbench__header-tools'),
        tabs: box('.arsenal-paper-tabs'),
        firstTab: box('.arsenal-paper-tabs a:first-child'),
        lastTab: box('.arsenal-paper-tabs a:last-child'),
        roster: box('.deck-workbench__roster'),
        card: box('.deck-workbench__collection > button'),
      };
    });
    const context = `${name}: ${JSON.stringify(layout)}`;
    assert.ok(layout.name.top < layout.tabs.bottom && layout.name.bottom > layout.tabs.top,
      `Deck name shares the paper-tab row, not a separate row. ${context}`);
    assert.ok(layout.tools.top < layout.tabs.bottom && layout.tools.bottom > layout.tabs.top,
      `Deck count/delete shares the paper-tab row. ${context}`);
    assert.ok(layout.name.right <= layout.firstTab.left - 4,
      `Long names stay clear of Collection. ${context}`);
    assert.ok(layout.tools.left >= layout.lastTab.right + 4,
      `Count and delete stay clear of Decks. ${context}`);
    assert.ok(layout.roster.top <= layout.tabs.bottom + 24,
      `The lineup follows the tabs without a second header row. ${context}`);
    assert.ok(layout.card.width >= (width >= 1500 ? 145 : 115),
      `The collection gains room without shrinking its cards. ${context}`);
  }
  await deckName.fill(originalName);
  for (const control of [
    deckName,
    page.getByRole('button', { name: 'Delete deck' }),
    page.locator('.deck-workbench > .arsenal-paper-tabs a').first(),
    page.locator('.deck-workbench > .arsenal-paper-tabs a').last(),
  ]) {
    assert.ok(await control.evaluate(element => {
      const box = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    }), `${name}: all shared-row controls are clickable`);
  }
}