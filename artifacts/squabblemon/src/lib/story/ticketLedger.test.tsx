import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getStoryChapter } from '@workspace/squabblemon-engine/story';
import { ChapterTicketProgress } from '../../components/story/ChapterTicketProgress';
import { summarizeChapterTickets } from './ticketLedger';

const emptyProgress = {};
const directTickets = (chapter: NonNullable<ReturnType<typeof getStoryChapter>>) =>
  chapter.nodes.flatMap(node => node.rewards).filter(reward => reward.kind === 'pack-ticket')
    .reduce((sum, reward) => sum + reward.amount, 0);

test('chapter ticket totals include direct finale and optional-node rewards', () => {
  const chapterOne = getStoryChapter('block-party');
  const chapterTwo = getStoryChapter('red-side-tapes');
  assert(chapterOne);
  assert(chapterTwo);

  const first = summarizeChapterTickets(chapterOne, emptyProgress);
  assert.equal(first.perfectTicketsAvailable, 7);
  assert.equal(first.directTicketsAvailable, directTickets(chapterOne));
  assert.equal(first.ticketsAvailable, 7 + directTickets(chapterOne));
  assert(chapterOne.nodes.every(node => node.rewards.some(reward => reward.kind === 'pack-ticket')));

  const second = summarizeChapterTickets(chapterTwo, emptyProgress);
  assert.equal(second.perfectTicketsAvailable, 6);
  assert.equal(second.directTicketsAvailable, directTickets(chapterTwo));
  assert.equal(second.ticketsAvailable, 6 + directTickets(chapterTwo));
  assert(chapterTwo.nodes.every(node => node.rewards.some(reward => reward.kind === 'pack-ticket')));
});

test('direct ticket rewards become earned when their reward nodes clear', () => {
  const chapterTwo = getStoryChapter('red-side-tapes');
  assert(chapterTwo);
  const progress = {
    'red-tapes-courier-table': { stars: 0, cleared: true },
    'red-tapes-let-her-grieve': { stars: 0, cleared: true },
  };

  const summary = summarizeChapterTickets(chapterTwo, progress);
  const earned = chapterTwo.nodes.filter(node => progress[node.id as keyof typeof progress])
    .flatMap(node => node.rewards).filter(reward => reward.kind === 'pack-ticket')
    .reduce((sum, reward) => sum + reward.amount, 0);
  assert.equal(summary.directTicketsEarned, earned);
  assert.equal(summary.ticketsEarned, earned);
  assert.equal(summary.ticketsRemaining, summary.ticketsAvailable - earned);
});

test('chapter ticket UI separates perfect-clear and direct reward totals', () => {
  const chapterTwo = getStoryChapter('red-side-tapes');
  assert(chapterTwo);
  const html = renderToStaticMarkup(
    <ChapterTicketProgress chapter={chapterTwo} nodeProgressById={emptyProgress} />,
  );

  assert.match(html, new RegExp(`0 / ${6 + directTickets(chapterTwo)}`));
  assert.match(html, /Perfect clears/);
  assert.match(html, /0 \/ 6/);
  assert.match(html, /Direct rewards/);
  assert.match(html, new RegExp(`0 / ${directTickets(chapterTwo)}`));
});
