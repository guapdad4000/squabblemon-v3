/** Semantic roles are independent. Body/rules, logos and card names are separate. */
export const UI_TYPE_ROLES = [
  { id: 'card', label: 'Card numbers', fontToken: '--font-card-number', weightToken: '--font-card-number-weight', defaultFont: 'hemi-italic', numeric: true, rule: 'Compact Motion/Hands; test 0, 1, 6, 8, 9, +3 and three-digit values in existing stat boxes.' },
  { id: 'lane', label: 'Location Hands', fontToken: '--font-lane-number', weightToken: '--font-lane-number-weight', defaultFont: 'hemi-italic', numeric: true, rule: 'Larger totals; The Opps/player columns stay separate and count changes retain their meaning.' },
  { id: 'deck', label: 'Deck names', fontToken: '--font-deck-title', weightToken: '--font-deck-title-weight', defaultFont: 'blzee', numeric: false, rule: 'Two-line names, including the picker and generic 3D box; supplied cover artwork stays intact.' },
  { id: 'location', label: 'Location titles', fontToken: '--font-location-title', weightToken: '--font-location-title-weight', defaultFont: 'blzee', numeric: false, rule: 'A consistent heading on the field and detail sheet; location rules retain the body font.' },
] as const;
export type UiTypeRole = typeof UI_TYPE_ROLES[number]['id'];
export type UiTypeSelection = Record<UiTypeRole, string>;
export const DEFAULT_UI_TYPE: UiTypeSelection = { card: 'hemi-italic', lane: 'hemi-italic', deck: 'blzee', location: 'blzee' };
