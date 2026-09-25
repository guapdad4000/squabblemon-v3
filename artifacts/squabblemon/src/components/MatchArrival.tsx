import { motion, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { getAssetUrl } from '../lib/assets';
import { FighterPortrait } from './profile/FighterPortrait';
import { playSoundEffect, stopSoundEffect } from '../lib/sfx';
import { useFeedbackPreferences } from '../hooks/useFeedbackPreferences';
import { KeyedVideo } from './KeyedVideo';
import '../styles/ui-polish.css';
import '../styles/pvp-art.css';

export function MatchArrival({ player, rival, label = 'Match found', onContinue }: {
  player: { name: string; hero: string; avatarKey?: string }; rival: { name: string; hero: string; avatarKey?: string };
  label?: string; onContinue: () => void;
}) {
  const reduced = useReducedMotion() || (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true');
  const [preferences] = useFeedbackPreferences();
  useEffect(() => {
    const found = playSoundEffect('match-found', preferences.audioEnabled, 0.7);
    let impact: HTMLAudioElement | null = null;
    const timer = window.setTimeout(() => {
      impact = playSoundEffect('vs-impact-a', preferences.audioEnabled, 0.9);
    }, reduced ? 0 : 500);
    return () => {
      clearTimeout(timer);
      stopSoundEffect(found);
      stopSoundEffect(impact);
    };
  }, [preferences.audioEnabled, reduced]);
  return <motion.section className="match-poster match-poster--park" data-testid="match-arrival" aria-label="Match found. Versus introduction"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .2 }}>
    <div className="versus-park" aria-hidden="true">
      {['left', 'right'].map(side => <img key={side} className={'versus-tree ' + side} src={getAssetUrl('assets/pvp/versus/tree-' + side + '.webp')} alt="" />)}
      <img className="versus-ground" src={getAssetUrl('assets/pvp/versus/ground.webp')} alt="" />
      <div className="versus-crowd">{[1,2,3,4,5,6].map(i => <img key={i} src={getAssetUrl('assets/pvp/versus/fighter-' + i + '.webp')} alt="" />)}</div>
      {['left', 'right'].map((side,i) => <motion.img key={side} className={'versus-arm ' + side} src={getAssetUrl('assets/pvp/versus/arm-' + side + '.webp')} alt="" initial={reduced ? false : { x: i ? '100%' : '-100%' }} animate={{ x: 0 }} transition={{ duration: .35, delay: .15, ease: 'easeIn' }} />)}
      <motion.img className="versus-crack" src={getAssetUrl('assets/pvp/versus/crack.webp')} alt="" initial={reduced ? false : { clipPath: 'inset(50% 0 50% 0)' }} animate={{ clipPath: 'inset(0% 0 0% 0)' }} transition={{ delay: .5, duration: .25 }} />
      <div className="versus-impact"><i /><i /><i /><i /><b /></div>
      <KeyedVideo className="versus-logo" src={getAssetUrl('assets/pvp/versus/versus-logo.webm')} mode="green" loop maxWidth={480} />
    </div>
    <div className="match-poster__billing"><span>SQUABBLEMON PRESENTS</span><strong>{label}</strong><span>THE MAIN EVENT</span></div>
    <div className="match-poster__fighters">
      {[player, rival].map((fighter, i) => <motion.div className={'match-poster__fighter side-' + i} key={i}
        initial={reduced ? false : { x: i ? 90 : -90, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: .45 }}>
        <FighterPortrait cardId={fighter.hero} avatarKey={fighter.avatarKey} name={fighter.name} /><span>{i ? 'CHALLENGER' : 'YOUR CORNER'}</span><h2>{fighter.name}</h2>
      </motion.div>)}
    </div>
    <footer><p>3 DISTRICTS <i /> 6 ROUNDS <i /> ONE FADE</p><button autoFocus onClick={onContinue}>Step into the field <span aria-hidden="true">↗</span></button><small>The match clock keeps running. Tap to enter.</small></footer>
  </motion.section>;
}
