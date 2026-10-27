export const KUMITE_FIGHTERS = [
  "leroy",
  "sho-nuff",
  "bushedo-brown",
  "franklin-duke",
  "dragonfly-jones",
  "undercova-brotha",
  "p-tang",
  "chonk-lee",
] as const;
export type KumiteFighter = (typeof KUMITE_FIGHTERS)[number];
export type KumiteStance = "base" | "squabble" | "awakened";
const aliases: Record<string, KumiteFighter> = {
  shonuff: "sho-nuff",
  dragonflyjones: "dragonfly-jones",
  undercova: "undercova-brotha",
  ptang: "p-tang",
};
export function kumiteFighter(id: string): KumiteFighter | null {
  return (
    aliases[id] ??
    (KUMITE_FIGHTERS.includes(id as KumiteFighter)
      ? (id as KumiteFighter)
      : null)
  );
}
/** Visual projection only. It never changes damage, eligibility, or authoritative Hands. */
export function kumiteStance(input: {
  hands: number;
  squabble?: boolean;
  signature?: boolean;
  goldenGlow?: boolean;
}): KumiteStance {
  return input.hands >= 10 || input.goldenGlow || input.signature
    ? "awakened"
    : input.squabble
      ? "squabble"
      : "base";
}
export const kumiteFormAsset = (fighter: KumiteFighter, stance: KumiteStance) =>
  `assets/characters/forms/${fighter}-${stance}.webp`;
export const kumiteAltId = (fighter: KumiteFighter) =>
  `${fighter}:kumite-alt-v1`;
export const KUMITE_ALT_TIERS: Record<KumiteFighter, number> = {
  "chonk-lee": 1,
  "dragonfly-jones": 2,
  "franklin-duke": 3,
  "bushedo-brown": 4,
  "sho-nuff": 5,
  leroy: 5,
  "undercova-brotha": 4,
  "p-tang": 3,
};
