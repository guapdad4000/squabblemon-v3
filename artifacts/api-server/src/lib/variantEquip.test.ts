import assert from "node:assert/strict";
import test from "node:test";
import { validateVariantEquip } from "./variantEquip";

test("accepts an owned variant for its owned gameplay card", () => {
  assert.equal(
    validateVariantEquip(
      "rastamon",
      "rastamon:tagged",
      ["rastamon"],
      ["rastamon:tagged"],
    ),
    null,
  );
});

test("rejects forged, mismatched, and unowned variants", () => {
  assert.equal(
    validateVariantEquip("rastamon", "rastamon:tagged", [], ["rastamon:tagged"]),
    "You do not own this gameplay card",
  );
  assert.equal(
    validateVariantEquip(
      "rastamon",
      "hooper:chrome",
      ["rastamon"],
      ["hooper:chrome"],
    ),
    "Variant does not belong to this gameplay card",
  );
  assert.equal(
    validateVariantEquip("rastamon", "rastamon:chrome", ["rastamon"], []),
    "You do not own this card variant",
  );
});

test("allows an owned card to return to its base treatment", () => {
  assert.equal(validateVariantEquip("rastamon", null, ["rastamon"], []), null);
});