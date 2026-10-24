import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { accountRewardStatus, type AccountRewardGrant } from '@workspace/squabblemon-engine/accountRewards';
import { MonthlyLoginTrack } from './MonthlyLoginTrack';

const login = (date: string): AccountRewardGrant => ({ key: `login:${date}`, date, title: 'Saved check-in', softCurrency: 0, packTickets: 0, styleShards: 0 });

test('monthly roadmap renders all seven gameplay tiers and every day without hiding progression', () => {
  const monthly = accountRewardStatus(1, new Date('2025-01-01Z'), [], new Date('2026-10-24T12:00:00Z')).monthly;
  const html = renderToStaticMarkup(<MonthlyLoginTrack status={monthly}/>);
  assert.equal((html.match(/<li /g) ?? []).length, 7);
  assert.equal((html.match(/<i /g) ?? []).length, 30);
  for (const milestone of monthly.milestones) assert.ok(html.includes(`Check-in ${milestone.day}: one ${milestone.label} gameplay card`));
  assert.match(html, /0 \/ 30 check-ins/);assert.match(html, /Resets Nov 1 · UTC/);
  assert.match(html, /Super Rare/);assert.doesNotMatch(html, />Epic</);
  assert.doesNotMatch(html, /<details|<summary|<button/);
});

test('monthly roadmap uses server receipt states and exposes the saved duplicate currency', () => {
  const receipts = Array.from({ length: 5 }, (_, i) => login(`2026-10-0${i + 1}`));
  receipts.push({ key: 'monthly-login:2026-10:SuperCommon', title: 'Monthly card', cardId: 'cornball', cardName: 'Cornball', cardRarity: 'SuperCommon', isNewCard: false, shardRarity: 'Common', softCurrency: 0, packTickets: 0, styleShards: 5 });
  const monthly = accountRewardStatus(1, new Date('2025-01-01Z'), receipts, new Date('2026-10-05T23:59:59Z')).monthly;
  const html = renderToStaticMarkup(<MonthlyLoginTrack status={monthly}/>);
  assert.match(html, /5 \/ 30 check-ins/);assert.match(html, /Cornball converted to 5 Common Style Shards/);
  assert.match(html, /Check-in 5: one Common gameplay card, ready to collect/);
  assert.equal((html.match(/<li[^>]*data-collected="true"/g) ?? []).length, 1);
});

test('short month displays the reachable final milestone and its actual reset date', () => {
  const monthly = accountRewardStatus(1, new Date('2025-01-01Z'), [], new Date('2028-02-01T00:00:00Z')).monthly;
  const html = renderToStaticMarkup(<MonthlyLoginTrack status={monthly}/>);
  assert.equal((html.match(/<i /g) ?? []).length, 29);
  assert.match(html, /Check-in 29: one Mythical gameplay card/);assert.match(html, /Resets Mar 1 · UTC/);
  assert.match(html, /Short month: Mythical arrives on check-in 29/);
});
