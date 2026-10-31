import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { FighterPortrait } from "./FighterPortrait";
import { getCardImage } from "../../lib/assets";
import { battlePortraitUrl } from "../../lib/battlePortrait";

test("profile portraits keep gallery artwork unless compact battle rendering is requested", () => {
  const original = getCardImage("cornball");
  const compact = battlePortraitUrl(original);
  assert.notEqual(compact, original);
  assert.ok(
    renderToStaticMarkup(
      <FighterPortrait cardId="cornball" name="Player" />,
    ).includes(`src="${original}"`),
  );
  assert.ok(
    renderToStaticMarkup(
      <FighterPortrait cardId="cornball" name="Player" battleArtwork />,
    ).includes(`src="${compact}"`),
  );
});

test("unknown battle portraits retain their original source rather than inventing a derivative", () => {
  const original = getCardImage("future-unregistered-fighter");
  assert.ok(
    renderToStaticMarkup(
      <FighterPortrait
        cardId="future-unregistered-fighter"
        name="Player"
        battleArtwork
      />,
    ).includes(`src="${original}"`),
  );
});

test("a failed compact portrait keeps the accessible fallback and recovers when its source changes", async () => {
  const previous = Object.getOwnPropertyDescriptor(
    globalThis,
    "IS_REACT_ACT_ENVIRONMENT",
  );
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });
  let view: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      view = create(
        <FighterPortrait cardId="cornball" name="Player" battleArtwork />,
      );
    });
    assert.ok(view);
    const rendered = view;
    await act(async () => rendered.root.findByType("img").props.onError());
    assert.equal(rendered.root.findAllByType("img").length, 0);
    assert.ok(
      JSON.stringify(rendered.toJSON()).includes("Portrait unavailable"),
    );
    await act(async () =>
      rendered.update(
        <FighterPortrait cardId="ganger-blue" name="Player" battleArtwork />,
      ),
    );
    assert.equal(
      rendered.root.findByType("img").props.src,
      battlePortraitUrl(getCardImage("ganger-blue")),
    );
    assert.equal(rendered.root.findByType("img").props.alt, "Player portrait");
  } finally {
    if (view) await act(async () => view?.unmount());
    if (previous)
      Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", previous);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
