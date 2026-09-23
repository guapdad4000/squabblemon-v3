import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TICKETS_PER_MAJOR_STORY_NODE, getStoryChapter } from '@workspace/squabblemon-engine/story';
import { ChapterTicketProgress } from '../../components/story/ChapterTicketProgress';
import { summarizeChapterTickets } from './ticketLedger';

const emptyProgress = {};

test('chapter ticket totals include direct finale and optional-node rewards', () => {
  const chapterOne = getStoryChapter('block-party');
  const chapterTwo = getStoryChapter('red-side-tapes');
  assert(chapterOne);
  assert(chapterTwo);

  const first = summarizeChapterTickets(chapterOne, emptyProgress);
  assert.equal(first.perfectTicketsAvailable, 7);
  assert.equal(first.directTicketsAvailable, TICKETS_PER_MAJOR_STORY_NODE);
  assert.equal(first.ticketsAvailable, 7 + TICKETS_PER_MAJOR_STORY_NODE);

  const second = summarizeChapterTickets(chapterTwo, emptyProgress);
  assert.equal(second.perfectTicketsAvailable, 6);
  assert.equal(second.directTicketsAvailable, TICKETS_PER_MAJOR_STORY_NODE + 1);
  assert.equal(second.ticketsAvailable, 6 + TICKETS_PER_MAJOR_STORY_NODE + 1);
});

test('direct ticket rewards become earned when their reward nodes clear', () => {
  const chapterTwo = getStoryChapter('red-side-tapes');
  assert(chapterTwo);
  const progress = {
    'red-tapes-courier-table': { stars: 0, cleared: true },
    'red-tapes-let-her-grieve': { stars: 0, cleared: true },
  };

  const summary = summarizeChapterTickets(chapterTwo, progress);
  assert.equal(summary.directTicketsEarned, TICKETS_PER_MAJOR_STORY_NODE + 1);
  assert.equal(summary.ticketsEarned, TICKETS_PER_MAJOR_STORY_NODE + 1);
  assert.equal(summary.ticketsRemaining, 6);
});

test('chapter ticket UI separates perfect-clear and direct reward totals', () => {
  const chapterTwo = getStoryChapter('red-side-tapes');
  assert(chapterTwo);
  const html = renderToStaticMarkup(
    <ChapterTicketProgress chapter={chapterTwo} nodeProgressById={emptyProgress} />,
  );

  assert.match(html, new RegExp(`0 / ${6 + TICKETS_PER_MAJOR_STORY_NODE + 1}`));
  assert.match(html, /Perfect clears/);
  assert.match(html, /0 \/ 6/);
  assert.match(html, /Direct rewards/);
  assert.match(html, new RegExp(`0 / ${TICKETS_PER_MAJOR_STORY_NODE + 1}`));
});
