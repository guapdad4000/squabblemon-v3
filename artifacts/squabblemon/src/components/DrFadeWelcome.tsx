import { CardView } from './CardView';
import { cards } from '../data';
import './dr-fade-card.css';
import { motion, useReducedMotion } from 'framer-motion';
import { getAssetUrl } from '../lib/assets';
import { tutorialScript } from '../lib/tutorialVoice';
import { useTutorialVoice } from '../lib/useTutorialVoice';

export function DrFadeWelcome({ onContinue }: { onContinue: () => void }) {
  useTutorialVoice(tutorialScript('legendary-catchphrase', 'legendary-explanation', 'legendary-squabble'));
  const reduced = useReducedMotion() || (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true');
  return <section className="dr-fade-welcome" data-testid="dr-fade-welcome" aria-labelledby="dr-fade-welcome-title">
    <div className="dr-fade-welcome__rays" aria-hidden="true" />
    <img className="dr-fade-welcome__signature" src={getAssetUrl('assets/cosmetics/dr-fade/sticker-emblem-v3.webp')} alt="" />
    <motion.div className="dr-fade-welcome__card" initial={reduced ? false : { opacity: 0, y: 60, rotateY: -80, scale: .7 }} animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 65, damping: 16 }}><CardView card={cards.drfade} isInspector fillContainer presentationOnly /></motion.div>
    <motion.div className="dr-fade-welcome__copy" initial={reduced ? false : { opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduced ? 0 : .6, duration: .5 }}>
      <span className="dr-fade-welcome__eyebrow">YOUR FIRST LEGENDARY · FREE & YOURS TO KEEP</span>
      <h1 id="dr-fade-welcome-title">Your coach.<br />Now in your corner.</h1>
      <p>“Watch close. You’re next.”</p>
      <h2>Dr. Fade joins your gang.</h2>
      <p>Play him for <b>4 Motion</b>. He brings <b>6 Hands</b>, hits the strongest enemy in his district for <b>−2 Hands</b>, and gives your weakest ally in another district <b>+2 Hands</b>.</p>
      <p className="dr-fade-welcome__lesson">We’ll save him for your first SQUABBLE: <b>12 base Hands</b> in one play. Follow the highlights and see it happen.</p>
      <button className="venue-button venue-button--gold" onClick={onContinue}>Build with Dr. Fade</button>
      <span className="dr-fade-welcome__note">Already added to your first gang. Chapter rewards help train him.</span>
    </motion.div>
  </section>;
}
