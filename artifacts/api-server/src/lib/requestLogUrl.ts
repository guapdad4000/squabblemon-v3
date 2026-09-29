/** Keep static social/room endpoint context, never path identities or queries. */
export function requestLogUrl(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  const path = url.split(/[?#]/, 1)[0];
  const parts = path.split("/");
  const offset = parts[1]?.toLowerCase() === "api" ? 2 : 1;
  const namespace = parts[offset]?.toLowerCase();
  if (namespace !== "social" && namespace !== "multiplayer") return path;
  const section = parts[offset + 1];
  if (!section) return path;
  const socialSections = new Set(["search", "username", "lookup", "match-opponent", "requests", "homies", "blocks", "invitations"]);
  if (namespace === "social") {
    if (!socialSections.has(section)) parts[offset + 1] = ":redacted";
    for (let i = offset + 2; i < parts.length; i++) {
      if (!parts[i]) continue;
      parts[i] = i === offset + 3 && ["respond", "remove"].includes(parts[i]) ? parts[i] : ":redacted";
    }
  } else if (section === "ranked") {
    for (let i = offset + 2; i < parts.length; i++) {
      if (!parts[i]) continue;
      parts[i] = i === offset + 2 && ["search", "cancel"].includes(parts[i]) ? parts[i] : ":redacted";
    }
  } else {
    parts[offset + 1] = ":redacted";
    for (let i = offset + 2; i < parts.length; i++) {
      if (!parts[i]) continue;
      parts[i] = i === offset + 2 && ["join", "actions", "reactions"].includes(parts[i]) ? parts[i] : ":redacted";
    }
  }
  return parts.join("/");
}