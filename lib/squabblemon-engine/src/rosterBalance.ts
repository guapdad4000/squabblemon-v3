import type { Card } from './data';
import type { CardInstance } from './gameEngine';

/** Version 11 printed-value changes; collection and upgrade identities stay stable. */
export const ROSTER_BALANCE_PATCH: Record<string, Partial<Pick<Card, 'cost' | 'power' | 'effect'>>> = {
  'atl-scammer': { cost: 2 }, failedathlete: { power: 3 }, lawyer: { power: 3 },
  'tattoo-artist': { power: 3 }, 'inmate-kingpin': { cost: 4, power: 4 },
  'juneteenth-chair-guy': { cost: 4, power: 4 }, livewire: { power: 3 },
  subwaymagician: { cost: 3 }, squabbleserver: { power: 2 }, stylist: { cost: 2, power: 2 },
  'the-concert': { cost: 2 },
  manman: { effect: 'On Reveal: If you have at least 2 other friendly characters here, gain +3 Hands.' },
  edgar: { effect: 'On Reveal: If another friendly character here costs 2 or less, gain +2 Hands.' },
  dogwalker: { effect: 'On Reveal: If at least 2 other friendly characters are here, gain +3 Hands.' },
  cognac: { effect: 'On Reveal: Give your weakest friendly character here +2 Hands, or +3 if it is Fire.' },
  charger: { effect: 'On Reveal: Restore 1 Motion per friendly character here, up to 3. With at least 3 characters here, also Protect your weakest local Electric character.' },
  cloudbreak: { effect: 'On Reveal: Move to your weakest other district. If you move, give your weakest ally left in the original district +2 Hands and Protection.' },
  teacher: { effect: 'On Reveal: Silence the highest-Hands enemy here with an active Ongoing ability. If none exists, Silence the strongest enemy here. Protection and district guards apply.' },
  nerd: { effect: "On Reveal: Silence the highest-Hands active Ongoing enemy here, otherwise the strongest enemy, bypassing Wifey's Side Eye. Protection still blocks this. Newly interrupting an active Ongoing ability grants +1 Hand and reveals one enemy hand card." },
  scammer: { effect: 'On Reveal: Copy the base Hands (up to 7) and printed ability of the strongest active Ongoing enemy here. If none exists, copy only the strongest enemy\'s base Hands (up to 7) and gain +1 Hand. Copied entrances never trigger.' },
  thefeds: { effect: 'On Reveal: Remove up to 4 bonus Hands from the enemy here with the most removable bonus and Lock it. If none has bonus Hands, Lock the strongest enemy. Cannot reduce below printed Hands.' },
  bouncer: { effect: 'On Reveal: Move the strongest active Ongoing enemy here to another open enemy district. If none exists, move the strongest enemy here. Protection, capacity and movement restrictions apply.' },
  godofhookah: { effect: 'Ongoing: At round end, the first enemy damaged by Burn in each district passes 1 Burn to the weakest unburned enemy in the next district. New Burn waits until next round. If that district has enemies but all were already burning, gain +1 Hand, at most once per round.' },
  'the-shootout': { effect: 'Deal 2 damage to every enemy character here, then 1 damage to your strongest friendly character here. Enemy Protection and defenses apply.' },
  'the-setup': { effect: 'Sacrifice your weakest character here. Your strongest remaining character here inherits its current Hands plus 2. Requires two friendly characters.' },
  'the-cookout': { effect: 'Deliver two Soul Food meals to occupied friendly districts, cleansing and granting +1 Hand to the weakest character in each chosen district. Leave a Burnt Plate: at this round end, give one local friendly character 1 Burn, then remove the plate.' },
};

export const ROSTER_REVISION_IDS = [
 'the-shootout','the-concert','the-cookout','the-setup','atl-scammer','ahki','bbldemon','chessregular','cornercoach','failedathlete','failedrapper','inmate-kingpin','juneteenth-chair-guy','lawyer','midnightmayor','nigerian-father','icecream','stud','tattoo-artist','dancecaptain','busker','livewire','cloudbreak','divorceddad','rent-a-cop','bouncer','stylist','cognac','charger','manman','dogwalker','edgar','subwaymagician','teacher','nerd','scammer','thefeds','squabbleserver','godofhookah','redneck-evil',
] as const;
export function applyRosterBalance(cards: Record<string, Card>): void {
  for (const [id, patch] of Object.entries(ROSTER_BALANCE_PATCH)) {
    if (!cards[id]) throw new Error('Missing roster revision card: ' + id);
    Object.assign(cards[id], patch);
  }
}
/** Shared targeting rule includes legacy ongoing kits without the printed prefix. */
export function isActiveOngoing(c: CardInstance): boolean {
  return !c.hazard && (c.kind ?? 'character') === 'character'
    && !c.statuses.silenced && !c.statuses.frozen && !c.statuses.weakened
    && (c.effect.includes('Ongoing:') || ['wifey','bossbabe','stockz'].includes(c.copiedAbilityCardId ?? c.cardId));
}
