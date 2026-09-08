import { catalogCardById } from "@workspace/squabblemon-engine/data";

export function validateVariantEquip(
  cardId: string,
  variantId: string | null,
  ownedCardIds: string[],
  ownedVariants: string[],
): string | null {
  const card = catalogCardById[cardId];
  if (!card) return "Unknown gameplay card";
  if (!ownedCardIds.includes(card.catalogId)) {
    return "You do not own this gameplay card";
  }
  if (variantId === null) return null;
  if (!card.variantSlots.some((slot) => slot.id === variantId)) {
    return "Variant does not belong to this gameplay card";
  }
  if (!ownedVariants.includes(variantId)) {
    return "You do not own this card variant";
  }
  return null;
}