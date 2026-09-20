import { CardView } from './CardView';
import { cards } from '../data';
import './dr-fade-card.css';

export function DrFadeWelcome({ onContinue }: { onContinue: () => void }) {
  return <section className="dr-fade-welcome" data-testid="dr-fade-welcome" aria-labelledby="dr-fade-welcome-title">
    <div className="dr-fade-welcome__card"><CardView card={cards.drfade} isInspector fillContainer presentationOnly /></div>
    <div className="dr-fade-welcome__copy">
      <span className="dr-fade-welcome__eyebrow">YOUR FIRST LEGENDARY · FREE & YOURS TO KEEP</span>
      <h1 id="dr-fade-welcome-title">Your coach.<br />Now in your corner.</h1>
      <p>“Watch close. You’re next.”</p>
      <h2>Dr. Fade joins your gang.</h2>
      <p>Play him for <b>4 Motion</b>. He brings <b>6 Hands</b>, hits the strongest enemy in his district for <b>−2 Hands</b>, and gives your weakest ally in another district <b>+2 Hands</b>.</p>
      <p className="dr-fade-welcome__lesson">We’ll save him for your first SQUABBLE: <b>12 base Hands</b> in one play. Follow the highlights and see it happen.</p>
      <button className="venue-button venue-button--gold" onClick={onContinue}>Build with Dr. Fade</button>
      <span className="dr-fade-welcome__note">Already added to your first gang. Chapter rewards help train him.</span>
    </div>
  </section>;
}
