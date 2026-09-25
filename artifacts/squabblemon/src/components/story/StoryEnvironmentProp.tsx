import { getAssetUrl } from '../../lib/assets';
import './story-environment-props.css';
const PROPS: Readonly<Record<string, string>> = {
  "01-after-hours-block-party": "folding-chair",
  "02-bootleg-film-archive": "projector",
  "03-promoters-back-office": "evidence-boxes",
  "04-impossible-midnight-station": "clock",
  "05-railway-loading-alley": "luggage",
  "06-lost-luggage-cage": "luggage",
  "07-community-radio-booth": "microphone",
  "08-transmitter-cupboard": "patch-cables",
  "09-radio-rooftop": "string-lights",
  "10-neighborhood-trophy-gallery": "trophy",
  "11-gallery-maintenance-corridor": "mirror",
  "12-yellow-line-bus-terminal": "payment-kiosk",
  "13-sponsored-toll-bridge": "payment-kiosk",
  "14-emerald-customer-service-hall": "payment-kiosk",
  "15-behind-ozs-curtain": "patch-cables",
  "16-rooftop-tram-departure": "luggage",
  "17-the-hour-lending-shop": "clock",
  "18-borrowed-hour-tea-garden": "teacup",
  "19-hallway-of-wrong-sized-doors": "teacup",
  "20-the-queens-petty-court": "clock",
  "21-the-missing-spring-clocktower": "clock",
  "22-festival-courtyard": "lantern",
  "23-vip-sword-lesson-pavilion": "lantern",
  "24-lantern-practice-ground": "lantern",
  "25-cellblock-library": "book-cart",
  "26-kingpins-reservation-desk": "noodle-stack",
  "27-library-hour-showdown": "book-cart",
  "28-rain-flooded-supply-route": "evidence-boxes",
  "29-community-kitchen-loading-bay": "folding-chair",
  "30-landlords-lobby": "mailboxes",
  "31-housing-appointment-office": "folding-chair",
  "32-leons-new-room": "folding-chair",
  "33-the-morning-after-rooftop": "string-lights",
  "34-rent-party-courtyard": "folding-chair",
  "35-community-space-under-repair": "patch-cables",
  "36-museum-of-the-block": "projector",
  "37-premiere-night-entrance": "projector",
  "38-the-saved-gathering-place": "string-lights"
};
export function StoryEnvironmentProp({ background }: { background: string }) {
  if (!background.startsWith('assets/story/environments/backgrounds/')) return null;
  const scene = background.split('/').at(-1)!.replace('.webp', '');
  const prop = PROPS[scene];
  if (!prop) return null;
  return <img className={`story-environment-prop ${prop === 'string-lights' ? 'story-environment-prop--overhead' : ''}`}
    src={getAssetUrl(`assets/story/environments/props/${prop}.webp`)} alt="" aria-hidden="true" draggable={false} />;
}
