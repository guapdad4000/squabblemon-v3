import assert from "node:assert/strict";
import test from "node:test";
import { requestLogUrl } from "./requestLogUrl";

test("routine social and room URLs retain only static endpoint context", () => {
  for (const section of ["lookup", "match-opponent", "requests", "homies", "blocks", "invitations"]) {
    assert.equal(requestLogUrl(`/api/social/${section}/private-token`), `/api/social/${section}/:redacted`);
  }
  for (const suffix of ["respond", "remove"]) {
    assert.equal(requestLogUrl(`/api/social/requests/private-token/${suffix}`), `/api/social/requests/:redacted/${suffix}`);
  }
  for (const suffix of ["", "/join", "/actions", "/reactions"]) {
    assert.equal(requestLogUrl(`/api/multiplayer/private-token${suffix}`), `/api/multiplayer/:redacted${suffix}`);
  }
  assert.equal(requestLogUrl("/api/social/lookup/%2Fencoded%20token"), "/api/social/lookup/:redacted");
  assert.equal(requestLogUrl("/social/lookup/private-token"), "/social/lookup/:redacted");
  assert.equal(requestLogUrl("/api/social/unknown/private-token"), "/api/social/:redacted/:redacted");
});

test("static endpoints and unrelated paths remain useful without query strings", () => {
  for (const path of ["/api/social", "/api/social/search", "/api/social/username", "/api/multiplayer",
    "/api/multiplayer/ranked", "/api/multiplayer/ranked/search", "/api/multiplayer/ranked/cancel", "/api/healthz"]) {
    assert.equal(requestLogUrl(`${path}?query=private-token`), path);
  }
  assert.equal(requestLogUrl(undefined), undefined);
});