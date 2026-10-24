import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LOGIN_REWARDS } from '@workspace/squabblemon-engine/accountRewards';
import { storySeasons } from '@workspace/squabblemon-engine/story';
import { AccountCheckInCalendar } from './AccountCheckInCalendar';
import { SeasonPoster } from '../pages/game/story/components/SeasonPoster';

test('daily calendar exposes every authored reward type without hiding the week', () => {
  const before = JSON.stringify(LOGIN_REWARDS);
  const html = renderToStaticMarkup(<AccountCheckInCalendar streak={7} claimedToday={false}/>);
  assert.equal((html.match(/<li /g) ?? []).length, LOGIN_REWARDS.length);
  LOGIN_REWARDS.forEach((reward, index) => {
    const label = [`Day ${index + 1}: ${reward.softCurrency} Clout`, reward.packTickets ? `${reward.packTickets} Pack Tickets` : '', reward.styleShards ? `${reward.styleShards} Style Shards` : ''].filter(Boolean).join(', ');
    assert.ok(html.includes(label), label);
  });
  assert.match(html, /Day 7: 300 Clout, 2 Pack Tickets, 25 Style Shards, ready today/);
  assert.doesNotMatch(html, /<details|<summary/);
  assert.equal(JSON.stringify(LOGIN_REWARDS), before);
});

test('calendar follows server streak and claimed state through seven-day rollover', () => {
  const ready = renderToStaticMarkup(<AccountCheckInCalendar streak={8} claimedToday={false}/>);
  assert.match(ready, /Day 1: 50 Clout, ready today/);
  assert.equal((ready.match(/data-collected="true"/g) ?? []).length, 0);
  const claimed = renderToStaticMarkup(<AccountCheckInCalendar streak={8} claimedToday/>);
  assert.match(claimed, /Day 1: 50 Clout, collected/);
  assert.equal((claimed.match(/data-collected="true"/g) ?? []).length, 1);
  assert.equal((claimed.match(/aria-current="date"/g) ?? []).length, 1);
});

test('current, cleared and locked Story posters keep art while expressing distinct states', () => {
  const base = { ...storySeasons[0], chapterIds: [...storySeasons[0].chapterIds], recommendedNodeId: null, starsEarned: 3, starsAvailable: 18, clearedNodes: 1, totalNodes: 6 };
  for (const [status, isCurrent, label] of [['available', true, 'Continue here'], ['cleared', false, 'Completed · Replay'], ['locked', false, 'Locked']] as const) {
    const html = renderToStaticMarkup(<SeasonPoster season={{...base, status}} isSelected={isCurrent} isCurrent={isCurrent} onSelect={()=>{}} onFocus={()=>{}} onKeyDown={()=>{}}/>);
    assert.ok(html.includes(label));
    assert.match(html, /assets\/story\/posters\/block-crown.webp/);
    assert.match(html, new RegExp(`data-status="${status}"`));
    assert.match(html, new RegExp(`data-current="${isCurrent}"`));
    assert.match(html, /3 \/ 18/);
  }
});
