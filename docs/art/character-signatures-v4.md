# Character signatures v4

69 characters gain dedicated landscape banners and portrait deck covers: 138 generated images. All 128 eligible character cards now have both formats. Existing finished artwork is preserved.

Eligibility follows the existing signature rollout: Mythicals, Legendaries, Super Rares, characters already offered in The Extras, and Kumite reward fighters. Supports and blockbusters are excluded.

Banners use a 3:1 composition and export at 1600×533. Deck covers use a 2:3 composition and export at 768×1152. Aspect ratios are preserved during export, with a minimal dark inset where generation differs slightly. Each image uses its existing character portrait as the identity reference. New emblems use fists. The basketball parody is titled “Regular Guy” in its art; its catalog name is unchanged.

The Extras and deck boxes consume the new `characterSignatureArtwork.ts` registry. Card ownership still gates banners. Base banners and deck covers are included with the character. Existing sticker IDs, purchases, scenes, and Silver Lining finish IDs remain valid. Collections with no sticker artwork do not offer a sticker pack. Support cards are no longer listed as upcoming character collections.

Generation used built-in image_gen. Prompts, identities, output dimensions, byte sizes, and SHA-256 hashes are recorded in `artifacts/squabblemon/reference/cosmetics/generated-signatures-v4.json`. Full PNG masters and the searchable review gallery are delivered separately.

Validation: all 138 new assets visually reviewed; eligible-art coverage and existing sticker compatibility checks; all 69 new collections at 320px and representative cases at 390, 768, and 1440px; local equip, ownership lock, legacy sticker, and three Kumite deck-box checks; frontend typecheck, production build, and bundle budgets. Browser proof uses exported production components with isolated fixture accounts, not authenticated live player accounts.
