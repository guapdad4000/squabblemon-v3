import { Link, useLocation } from "wouter";
import "../styles/arsenal-tabs.css";

export function ArsenalTabs() {
  const [path] = useLocation();
  return (
    <nav className="arsenal-paper-tabs" aria-label="Your cards and gangs">
      <Link
        href="/game/collection"
        aria-current={path.startsWith("/game/collection") ? "page" : undefined}
      >
        <strong>Collection</strong><span>Every card. Every discovery.</span>
      </Link>
      <Link
        href="/game/decks"
        aria-current={path.startsWith("/game/decks") ? "page" : undefined}
      >
        <strong>Decks</strong><span>Build your next ten.</span>
      </Link>
    </nav>
  );
}
