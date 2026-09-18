import React from 'react';
import { catalogCardByEngineId, catalogCardById } from '../engine/data';

export type EquippedVariantMap = Record<string, string>;

export function getCatalogCardId(cardId: string): string {
  return catalogCardById[cardId]?.catalogId
    ?? catalogCardByEngineId[cardId]?.catalogId
    ?? cardId;
}

export function getEquippedVariant(
  equippedVariants: EquippedVariantMap | undefined,
  cardId: string,
): string | undefined {
  return equippedVariants?.[getCatalogCardId(cardId)];
}

export function getVariantKind(variantId?: string | null): 'tagged' | 'chrome' | null {
  if (variantId?.endsWith(':tagged')) return 'tagged';
  if (variantId?.endsWith(':chrome')) return 'chrome';
  return null;
}

export function CardVariantTreatment({ variantId }: { variantId?: string | null }) {
  const kind = getVariantKind(variantId);
  if (!kind) return null;
  return (
    <span className="card-variant-sheen" aria-hidden="true" />
  );
}