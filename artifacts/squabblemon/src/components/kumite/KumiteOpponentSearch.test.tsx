import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  KumiteOpponentSearch,
  type KumiteSearchIdentity,
  type KumiteSearchState,
} from "./KumiteOpponentSearch";

const player: KumiteSearchIdentity = {
  name: "First fighter",
  art: "/review/player.webp",
  level: 18,
  crewName: "Locked player crew",
  rank: "Earned player rank",
};
const opponent: KumiteSearchIdentity = {
  name: "Assigned <rival>",
  art: "/review/assigned-rival.webp",
  level: 21,
  crewName: "Rival & crew",
};
type Options = Partial<
  Omit<Parameters<typeof KumiteOpponentSearch>[0], "player" | "state">
>;
function render(state: KumiteSearchState, options: Options = {}) {
  return renderToStaticMarkup(
    <KumiteOpponentSearch
      player={player}
      state={state}
      onCancel={() => {}}
      {...options}
    />,
  );
}
function button(html: string, className: string) {
  return (
    html.match(
      new RegExp(`<button[^>]*class="${className}"[^>]*>[\\s\\S]*?<\\/button>`),
    )?.[0] ?? ""
  );
}
function liveStatuses(html: string) {
  return html.match(/<div[^>]*role="status"[^>]*>[\s\S]*?<\/div>/g) ?? [];
}

test("search and reconnect preserve the locked player while keeping the opponent unknown", () => {
  for (const phase of ["searching", "reconnecting"] as const) {
    const html = render(
      { phase, elapsedSeconds: 125.9 },
      {
        onCancel: () => assert.fail("Rendering must not cancel a queue."),
        onRetry: () => assert.fail("Rendering must not start a queue."),
      },
    );
    assert.ok(html.includes("First fighter"));
    assert.ok(html.includes("Locked player crew"));
    assert.ok(html.includes("Earned player rank"));
    assert.ok(html.includes('aria-label="Opponent not yet revealed"'));
    assert.ok(html.includes("unknown-challenger-v1.webp"));
    assert.ok(!html.includes("white-crack-streak"));
    assert.ok(html.includes('data-color="false"'));
    assert.ok(!html.includes('class="km-match-slash"'));
    assert.ok(
      html.includes(
        'aria-label="125 seconds elapsed">02<span>:</span>05</time>',
      ),
    );
    assert.ok(!html.includes(opponent.art));
    assert.ok(!html.includes("Assigned &lt;rival&gt;"));
    assert.equal(button(html, "km-search-retry"), "");
    const statuses = liveStatuses(html);
    assert.equal(statuses.length, 1);
    const status = statuses[0];
    assert.ok(status);
    assert.ok(
      status.includes(
        phase === "reconnecting"
          ? "Reconnecting. Your search is being checked."
          : "Finding The Opps.",
      ),
    );
  }
  assert.ok(
    render({ phase: "searching", elapsedSeconds: Number.NaN }).includes(
      'aria-label="0 seconds elapsed"',
    ),
  );
  assert.ok(
    render({ phase: "searching", elapsedSeconds: -10 }).includes(
      'aria-label="0 seconds elapsed"',
    ),
  );
});

test("matched and connecting reveal only the supplied opponent and announce the actual transition", () => {
  for (const phase of ["matched", "connecting"] as const) {
    const html = render({ phase, elapsedSeconds: 12, opponent });
    assert.ok(html.includes('aria-label="Matched opponent"'));
    assert.ok(
      html.includes('data-color="true"'),
      "Color persists through the connecting phase.",
    );
    assert.equal(
      html.includes('class="km-match-slash"'),
      phase === "connecting",
      "The entry burst belongs to Enter arena, never opponent assignment.",
    );
    assert.ok(
      !html.includes("white-crack-streak"),
      "Kumite does not load the parked idle streak.",
    );
    assert.ok(html.includes(opponent.art));
    assert.ok(!html.includes("unknown-challenger-v1.webp"));
    assert.ok(html.includes("Assigned &lt;rival&gt;"));
    assert.ok(html.includes("Rival &amp; crew"));
    assert.ok(
      !html.includes("<rival>"),
      "Player-provided identity remains escaped text.",
    );
    assert.ok(html.includes("MATCH LOCKED"));
    assert.equal(button(html, "km-search-retry"), "");
    const statuses = liveStatuses(html);
    assert.equal(statuses.length, 1);
    const status = statuses[0];
    assert.ok(status);
    assert.ok(
      status.includes(
        phase === "matched"
          ? "Opponent found: Assigned &lt;rival&gt;."
          : "Entering the arena against Assigned &lt;rival&gt;.",
      ),
    );
  }
});

test("busy operations disable every action and retry is offered only for recoverable terminal screens", () => {
  const states: KumiteSearchState[] = [
    { phase: "searching", elapsedSeconds: 3 },
    { phase: "reconnecting", elapsedSeconds: 3 },
    { phase: "matched", elapsedSeconds: 3, opponent },
    { phase: "connecting", elapsedSeconds: 3, opponent },
    { phase: "cancelled" },
    { phase: "error", elapsedSeconds: 3, message: "Connection interrupted." },
  ];
  for (const state of states) {
    const idle = render(state, { onRetry: () => {} });
    const working = render(state, { onRetry: () => {}, busy: true });
    const retryExpected =
      state.phase === "error" || state.phase === "cancelled";
    assert.ok(!button(idle, "km-search-cancel").includes("disabled"));
    assert.ok(button(working, "km-search-cancel").includes("disabled"));
    assert.ok(button(working, "km-search-cancel").includes("BACKING OUT"));
    assert.equal(Boolean(button(idle, "km-search-retry")), retryExpected);
    if (retryExpected) {
      assert.ok(button(working, "km-search-retry").includes("disabled"));
      assert.equal(
        button(render(state), "km-search-retry"),
        "",
        "No retry action is invented without its owner.",
      );
    }
  }
});

test("cancellation and errors retain a safe return and one accessible state announcement", () => {
  const cancelled = render(
    { phase: "cancelled" },
    { reducedMotion: true, onRetry: () => {} },
  );
  assert.ok(cancelled.includes('data-reduced-motion="true"'));
  assert.ok(cancelled.includes('data-color="false"'));
  assert.ok(!cancelled.includes('class="km-match-slash"'));
  assert.ok(cancelled.includes('aria-label="Back to Kumite"'));
  assert.ok(button(cancelled, "km-search-cancel").includes("BACK TO KUMITE"));
  assert.ok(cancelled.includes("OFF THE LINE"));
  assert.ok(cancelled.includes('aria-label="0 seconds elapsed"'));
  const cancelledStatuses = liveStatuses(cancelled);
  assert.equal(cancelledStatuses.length, 1);
  const cancelledStatus = cancelledStatuses[0];
  assert.ok(cancelledStatus);
  assert.ok(cancelledStatus.includes("Search cancelled."));

  const message = "Connection interrupted. Check your search before retrying.";
  const failed = render(
    { phase: "error", elapsedSeconds: 8, message },
    { onRetry: () => {} },
  );
  const statuses = liveStatuses(failed);
  assert.equal(statuses.length, 1);
  const status = statuses[0];
  assert.ok(status);
  assert.ok(status.includes(message));
  assert.ok(
    failed.includes(`<p class="km-search-error">${message}</p>`),
    "The error is also readable onscreen.",
  );
  assert.ok(
    !failed.includes('role="alert"'),
    "The same error must not trigger a second live announcement.",
  );
  assert.ok(!button(failed, "km-search-cancel").includes("disabled"));
  assert.ok(!failed.includes(opponent.art));
});
