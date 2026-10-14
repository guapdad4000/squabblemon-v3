import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const sqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Hero and UI fluff text (Oakland tags, filler slogans, open-sign clutter) is removed across routes', () => {
  const market = readFileSync(path.join(sqRoot, 'src/pages/game/Market.tsx'), 'utf8');
  const fadePark = readFileSync(path.join(sqRoot, 'src/pages/game/FadePark.tsx'), 'utf8');
  const profileOverview = readFileSync(path.join(sqRoot, 'src/components/profile/ProfileOverview.tsx'), 'utf8');
  const cornerStore = readFileSync(path.join(sqRoot, 'src/pages/game/CornerStore.tsx'), 'utf8');
  const characterCollections = readFileSync(path.join(sqRoot, 'src/pages/game/CharacterCollections.tsx'), 'utf8');
  const characterStyles = readFileSync(path.join(sqRoot, 'src/pages/game/CharacterStyles.tsx'), 'utf8');
  const arsenalTabs = readFileSync(path.join(sqRoot, 'src/components/ArsenalTabs.tsx'), 'utf8');

  assert.doesNotMatch(market, /OAKLAND ATHLETIC CLUB|Get your reps\. Level up\./);
  assert.doesNotMatch(fadePark, /Oakland · Bay Area & beyond|Your gang\. An open challenge\.|Players first\. Park Bots fill quiet hours\./);
  assert.doesNotMatch(profileOverview, /Oakland \/ Player file|Certified original|Remember the name\.|Built different\.|Still climbing|Earned\. Never given/);
  assert.doesNotMatch(cornerStore, /OPEN LATE · GOOD COMPANY|Come on in\.|GOOD STUFF INSIDE|TAKE A LOOK AROUND/);
  assert.doesNotMatch(characterCollections, /Curated by|Good taste\. Bad intentions\.|A little extra never hurt\.|STICK IT\./);
  assert.doesNotMatch(characterStyles, /<i>Make it yours\.<\/i>|Cosmetic only · Permanent unlock · No random contents/);
  assert.doesNotMatch(arsenalTabs, /Every card\. Every discovery\.|Build your next ten\./);
});

test('StyleShardWallet is simplified into a compact single-row pill bar without billboard header or help paragraph', () => {
  const walletSource = readFileSync(path.join(sqRoot, 'src/components/StyleShardWallet.tsx'), 'utf8');
  const walletCss = readFileSync(path.join(sqRoot, 'src/styles/style-shards.css'), 'utf8');

  assert.doesNotMatch(walletSource, /THE STYLE STASH|Different rarity\. Same drip\.|Extra pack copies become matching shards/);
  assert.doesNotMatch(walletCss, /height:\s*64px/);
  assert.match(walletCss, /\.shard-wallet\s*\{[^}]*padding:\s*8px\s+14px/);
});

test('All 5 background wallpapers (Collection, Corner Store, Training Studio, Bounty Hunter, and The Extras) are fullscreen', () => {
  const collectionTsx = readFileSync(path.join(sqRoot, 'src/pages/game/Collection.tsx'), 'utf8');
  const collectionCss = readFileSync(path.join(sqRoot, 'src/styles/collection.css'), 'utf8');
  const marketShelvesCss = readFileSync(path.join(sqRoot, 'src/styles/market-shelves.css'), 'utf8');
  const trainingStudioCss = readFileSync(path.join(sqRoot, 'src/styles/training-studio.css'), 'utf8');
  const bountyHunterCss = readFileSync(path.join(sqRoot, 'src/styles/bounty-hunter.css'), 'utf8');
  const extrasStudioCss = readFileSync(path.join(sqRoot, 'src/styles/extras-studio.css'), 'utf8');

  assert.match(collectionTsx, /style=\{\{\s*['"]--collection-bg['"]:\s*`url\(\$\{sunsetBg\}\)`/);
  assert.doesNotMatch(collectionCss, /border-bottom:\s*1px\s+solid\s+#e47e3b/);
  assert.match(marketShelvesCss, /\.corner-store\s+\.layered-venue\s*\{[^}]*position:\s*fixed;\s*inset:\s*0;\s*max-height:\s*none;\s*height:\s*100dvh/);
  assert.match(trainingStudioCss, /\.training-studio__venue\s*\{[^}]*position:\s*fixed;\s*inset:\s*0/);
  assert.doesNotMatch(bountyHunterCss, /mask-image:\s*linear-gradient\(black\s+50%,\s*transparent\)/);
  assert.match(bountyHunterCss, /\.bounty-hunter__backdrop-container\s*\{[\s\S]*?position:\s*fixed;\s*\n?\s*inset:\s*0;\s*\n?\s*height:\s*100dvh/);
  assert.match(extrasStudioCss, /\.extras-hero__art\s*\{[^}]*position:\s*fixed;\s*inset:\s*0;\s*width:\s*100vw;\s*height:\s*100dvh/);
});
