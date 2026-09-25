import { getAssetUrl } from "../lib/assets";
import "../styles/referee-clipboard.css";
export function DrFadeReferee() {
  return (
    <img
      className="dr-fade-referee"
      src={getAssetUrl("assets/progression/dr-fade-referee.webp")}
      alt="Dr. Fade, your referee"
      draggable={false}
    />
  );
}
