import { motion, useReducedMotion } from 'framer-motion';
import { getAssetUrl, getCardImage } from '../lib/assets';
import '../styles/ui-polish.css';

export function MatchArrival({ player, rival, label = 'Match found', onContinue }: {
  player: { name: string; hero: string }; rival: { name: string; hero: string };
  label?: string; onContinue: () => void;
}) {
  const reduced = useReducedMotion() || (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true');
  return <motion.section className="match-poster" data-testid="match-arrival" aria-label="Match found. Versus introduction"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .2 }}>
    <img className="match-poster__backdrop" src={getAssetUrl('assets/venues/red-fence-night-court.webp')} alt="" />
    <div className="match-poster__billing"><span>SQUABBLEMON PRESENTS</span><strong>{label}</strong><span>THE MAIN EVENT</span></div>
    <div className="match-poster__fighters">
      {[player, rival].map((fighter, i) => <motion.div className={'match-poster__fighter side-' + i} key={i}
        initial={reduced ? false : { x: i ? 90 : -90, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: .45 }}>
        <img src={getCardImage(fighter.hero)} alt="" /><span>{i ? 'CHALLENGER' : 'YOUR CORNER'}</span><h2>{fighter.name}</h2>
      </motion.div>)}
      <motion.b className="match-poster__vs" initial={reduced ? false : { scale: 2, rotate: -16 }} animate={{ scale: 1, rotate: -8 }} transition={{ type: 'spring', damping: 15 }}>VS</motion.b>
    </div>
    <footer><p>3 DISTRICTS <i /> 6 ROUNDS <i /> ONE FADE</p><button autoFocus onClick={onContinue}>Step into the field <span aria-hidden="true">↗</span></button><small>The match clock keeps running. Tap to enter.</small></footer>
  </motion.section>;
}
