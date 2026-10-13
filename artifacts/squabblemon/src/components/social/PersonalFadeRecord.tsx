import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useSocial } from "../../lib/social";
import "../../styles/personal-fade-record.css";
type Record = { wins: number; losses: number; draws: number };
type Records = {
  self: Record;
  players: {
    friendCode: string;
    homie: boolean;
    overall: Record;
    personal: Record;
  }[];
  opponentCode: string | null;
};
export function useSocialRecords(room?: string) {
  const social = useSocial();
  const owner = social.query.data?.self.friendCode;
  return useQuery({
    queryKey: ["social-records", owner, room ?? "homies"],
    enabled: !!owner,
    queryFn: ({ signal }) =>
      customFetch<Records>(
        `/api/social/records${room ? `?room=${encodeURIComponent(room)}` : ""}`,
        { signal },
      ),
    staleTime: 15000,
  });
}
export function recordLabel(record: Record) {
  return `${record.wins}W · ${record.losses}L · ${record.draws}D`;
}
export function PersonalFadeRecord({
  room,
  rival,
}: {
  room: string;
  rival: string;
}) {
  const query = useSocialRecords(room);
  const player = query.data?.players.find(
    (p) => p.friendCode === query.data?.opponentCode,
  );
  if (!player)
    return query.isError ? (
      <button
        className="personal-fade-record"
        onClick={() => void query.refetch()}
      >
        Retry personal record
      </button>
    ) : null;
  return <PersonalFadeRecordDisplay player={player} rival={rival} />;
}
export function PersonalFadeRecordDisplay({
  player,
  rival,
}: {
  player: Records["players"][number];
  rival: string;
}) {
  return (
    <section
      className="personal-fade-record"
      data-homie={player.homie || undefined}
      aria-label={`Your personal record against ${rival}`}
    >
      {player.homie && (
        <strong className="personal-fade-record__homie">
          ✊ FADEBOOK HOMIES
        </strong>
      )}
      <span>YOU VS {rival.toUpperCase()}</span>
      <b>{recordLabel(player.personal)}</b>
      <small>
        {rival} overall · {recordLabel(player.overall)}
      </small>
    </section>
  );
}
