import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Router } from 'wouter';
import NotFound from './not-found';

test('not-found page uses supplied artwork, readable error text, and a real return link', () => {
  const html = renderToStaticMarkup(<Router ssrPath="/missing"><NotFound /></Router>);
  assert.match(html, /brand\/not-found-sm-gold\.webp/);
  assert.match(html, /404 — /);
  assert.match(html, /Unknown Street/);
  assert.match(html, /aria-labelledby="not-found-title"/);
  assert.match(html, /href="\/"/);
  assert.match(html, /Back to Squabblemon/);
  assert.doesNotMatch(html, /Did you forget to add the page/);
});

test('not-found return link stays inside an artifact mounted at a nested base', () => {
  const html = renderToStaticMarkup(<Router base="/release-check/squabblemon" ssrPath="/release-check/squabblemon/missing"><NotFound /></Router>);
  assert.match(html, /href="\/release-check\/squabblemon\/"/);
});