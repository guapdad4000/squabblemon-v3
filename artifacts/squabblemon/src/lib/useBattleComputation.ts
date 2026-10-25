import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Match } from '../gameEngine';
import { computationMatch, type PreviewInput, type PreviewResults } from './battleComputation';
import { BattleWorkerClient } from './battleWorkerClient';
export function useBattleWorker(active = true) {
  const client = useRef<BattleWorkerClient | null>(null);
  useEffect(() => {
    if (!active) return;
    const worker = new BattleWorkerClient(); client.current = worker;
    return () => { worker.dispose(); if (client.current === worker) client.current = null; };
  }, [active]);
  return client;
}
export function useBattlePreviews(input: PreviewInput | null, active = true, shared?: RefObject<BattleWorkerClient | null>) {
  const owned = useBattleWorker(active && !shared);
  const worker = shared ?? owned;
  const [completed, setCompleted] = useState<{ input: PreviewInput; previews: PreviewResults } | null>(null);
  useEffect(() => {
    if (!input) return;
    let current = true;
    // Parent worker ownership initializes after child effects on first mount.
    void Promise.resolve().then(() => {
      if (!current || !worker.current) return;
      return worker.current.request({ kind: 'previews', input: { ...input, match: computationMatch(input.match, true) } }).then(result => {
        if (current) setCompleted({ input, previews: result as PreviewResults });
      });
    }).catch(() => { /* A superseded/unmounted job has no presentation. */ });
    return () => { current = false; };
  }, [input, worker]);
  return completed?.input === input ? completed.previews : [];
}
export async function computeRival(client: BattleWorkerClient, match: Match): Promise<Match> {
  const resolved = await client.request({ kind: 'rival', input: computationMatch(match) }) as Match;
  return { ...resolved, effectLog: [...match.effectLog, ...resolved.effectLog] };
}
