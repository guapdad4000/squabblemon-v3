import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFriendMatch } from "../src/lib/multiplayer";

function Fixture() {
  const { connected, query, mutation } = useFriendMatch("polling-test", "ABCDEF123456");
  return <>
    <output data-testid="connected">{String(connected)}</output>
    <output data-testid="revision">{query.data?.revision ?? "loading"}</output>
    <output data-testid="status">{query.data?.status ?? "loading"}</output>
    <output data-testid="mutation">{mutation.status}</output>
    <button disabled={!connected || mutation.isPending} onClick={() => mutation.mutate({
      requestId: "stable-polling-test-id", expectedRevision: query.data!.revision,
      command: { type: "end-turn" },
    })}>End turn</button>
  </>;
}
const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
createRoot(document.getElementById("root")!).render(
  <StrictMode><QueryClientProvider client={client}><Fixture /></QueryClientProvider></StrictMode>,
);
