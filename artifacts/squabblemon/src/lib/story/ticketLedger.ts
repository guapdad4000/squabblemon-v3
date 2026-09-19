/**
 * Story Mode ticket ledger — the player's view of the 3-stars-to-ticket loop.
 *
 * The API server is the source of truth for the actual `packTickets` balance,
 * but the chapter map UI needs to show *progress* within a chapter (how many
 * perfect clean sweeps the player has earned so far) and *forecast* the
 * maximum ticket yield for the chapter. These helpers compute both.
 */
import {
  COMPACT_TICKET_CHAPTER_BATTLES,
  TICKETS_PER_PERFECT_BATTLE,
  type StoryChapter,
  type StoryNode,
} from "@workspace/squabblemon-engine/story";

export type ChapterBattleSummary = {
  readonly nodeId: string;
  readonly title: string;
  readonly stars: number;
  readonly cleared: boolean;
  readonly ticketAwarded: boolean;
  readonly mapPosition: { readonly x: number; readonly y: number };
};

export type ChapterTicketProgress = {
  readonly chapterId: string;
  readonly isCompact: boolean;
  readonly battleCount: number;
  readonly perfectClears: number;
  readonly perfectTicketsEarned: number;
  readonly perfectTicketsAvailable: number;
  readonly directTicketsEarned: number;
  readonly directTicketsAvailable: number;
  readonly ticketsEarned: number;
  readonly ticketsAvailable: number;
  readonly ticketsRemaining: number;
  readonly progressFraction: number;
  readonly battles: readonly ChapterBattleSummary[];
};

/**
 * A chapter is "compact" when it has exactly 3 battle nodes — the 3-battle,
 * 1-ticket-per-clean-sweep format the user asked for. Long-form chapters
 * (5+ nodes) still surface the same progress widget. The chapter forecast
 * includes both perfect-clear tickets and configured pack-ticket rewards.
 */
export function isCompactTicketChapter(chapter: Pick<StoryChapter, "nodes">): boolean {
  const battleCount = chapter.nodes.filter((n) => n.kind === "battle").length;
  return battleCount === COMPACT_TICKET_CHAPTER_BATTLES;
}

export function summarizeChapterBattles(
  chapter: Pick<StoryChapter, "id" | "nodes">,
  nodeProgressById: Readonly<Record<string, { stars: number; cleared: boolean }>>,
): ChapterTicketProgress {
  const battles: ChapterBattleSummary[] = [];
  for (const node of chapter.nodes) {
    if (node.kind !== "battle") continue;
    const progress = nodeProgressById[node.id] ?? { stars: 0, cleared: false };
    battles.push({
      nodeId: node.id,
      title: node.title,
      stars: progress.stars,
      cleared: progress.cleared,
      ticketAwarded: progress.stars >= 3,
      mapPosition: node.mapPosition,
    });
  }
  const perfectClears = battles.filter((b) => b.ticketAwarded).length;
  const perfectTicketsEarned = perfectClears * TICKETS_PER_PERFECT_BATTLE;
  const perfectTicketsAvailable = battles.length * TICKETS_PER_PERFECT_BATTLE;
  let directTicketsEarned = 0;
  let directTicketsAvailable = 0;
  for (const node of chapter.nodes) {
    const nodeTickets = node.rewards
      .filter((reward) => reward.kind === "pack-ticket")
      .reduce((total, reward) => total + reward.amount, 0);
    directTicketsAvailable += nodeTickets;
    if (nodeProgressById[node.id]?.cleared) directTicketsEarned += nodeTickets;
  }
  const ticketsEarned = perfectTicketsEarned + directTicketsEarned;
  const ticketsAvailable = perfectTicketsAvailable + directTicketsAvailable;
  const ticketsRemaining = Math.max(0, ticketsAvailable - ticketsEarned);
  const progressFraction = ticketsAvailable > 0 ? ticketsEarned / ticketsAvailable : 0;
  return {
    chapterId: chapter.id,
    isCompact: isCompactTicketChapter(chapter),
    battleCount: battles.length,
    perfectClears,
    perfectTicketsEarned,
    perfectTicketsAvailable,
    directTicketsEarned,
    directTicketsAvailable,
    ticketsEarned,
    ticketsAvailable,
    ticketsRemaining,
    progressFraction,
    battles,
  };
}

// Aliased so the UI layer can import the more readable name; the actual
// implementation lives in `summarizeChapterBattles`.
export const summarizeChapterTickets = summarizeChapterBattles;

/**
 * Forecast for a fresh chapter — useful for the chapter-card tooltip on the
 * world map ("3 stars per battle, up to 3 tickets if you ace every fight").
 */
export function forecastChapterTickets(battleCount: number): number {
  return battleCount * TICKETS_PER_PERFECT_BATTLE;
}

/** Pure helper: did the player earn a ticket on this battle? */
export function battleEarnedTicket(stars: number): boolean {
  return stars >= 3;
}

/**
 * Convenience: re-exports so the React layer doesn't need to import the
 * engine directly for these constants.
 */
export const STORY_TICKET_CONSTANTS = {
  TICKETS_PER_PERFECT_BATTLE,
  COMPACT_TICKET_CHAPTER_BATTLES,
  MAX_STARS_PER_BATTLE: 3,
} as const;

export type StoryNodeLike = StoryNode;
