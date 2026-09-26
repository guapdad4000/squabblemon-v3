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
  player: { name: string; hero: string; avatarKey?: string; level?: number; rp?: number };
  rival: { name: string; hero: string; avatarKey?: string; level?: number; rp?: number };
  label?: string; onContinue: () => void;
}) {
  const reduced = useReducedMotion() || (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true');
  const [preferences] = useFeedbackPreferences();
  useEffect(() => {
    const found = playSoundEffect('match-found', preferences.audioEnabled, 0.7);
    let impact: HTMLAudioElement | null = null;
    const timer = window.setTimeout(() => {
      impact = playSoundEffect('pvp-bass-drop', preferences.audioEnabled, 0.88);
    }, reduced ? 0 : 460);
    return () => {
      clearTimeout(timer);
      stopSoundEffect(found);
      stopSoundEffect(impact);
    };
  }, [preferences.audioEnabled, reduced]);
  const enterBattle = () => onContinue();
  return <motion.section className="match-poster match-poster--park" data-testid="match-arrival"
    role="button" tabIndex={0} aria-label="Match found. Versus introduction. Enter battle"
    onClick={enterBattle} onKeyDown={event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      enterBattle();
    }}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .2 }}>
    <div className="versus-park" aria-hidden="true">
      <img className="versus-stage" src={getAssetUrl('assets/pvp/versus-v2/fade-park-day.webp')} alt="" />
      <div className="versus-stage-wash" />
      <img className="versus-street-sign" src={getAssetUrl('assets/pvp/versus-v2/catch-hands-sign.webp')} alt="" />
      <div className="versus-birds">{[1,2,3,4].map(i => <i key={i} />)}</div>
      {['left', 'right'].map((side, i) => <motion.img key={side} className={'versus-arm ' + side}
        src={getAssetUrl('assets/pvp/versus/arm-' + side + '.webp')} alt=""
        initial={reduced ? false : { x: i ? '105%' : '-105%', rotate: i ? 6 : -6 }}
        animate={{ x: 0, rotate: i ? -1 : 1 }} transition={{ duration: .34, delay: .16, ease: [0.16, 1, 0.3, 1] }} />)}
      <div className="versus-impact-anchor"><motion.img className="versus-impact-frame"
        src={getAssetUrl('assets/pvp/versus-v2/fist-impact-black-v2.webp')} alt=""
        initial={reduced ? false : { opacity: 0, scale: .16, rotate: -9 }}
        animate={{ opacity: [0, 1, 1, .84], scale: [.16, 1.08, .9, .95], rotate: [-9, 2, 0, 0] }}
        transition={{ delay: .43, duration: .58, times: [0, .28, .64, 1], ease: 'easeOut' }} /></div>
      <div className="versus-logo-anchor"><motion.div className="versus-logo-motion"
        initial={reduced ? false : { opacity: 0, scale: 2.2 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: .52, duration: .3, ease: [0.2, 1.35, .3, 1] }}>
        <KeyedVideo className="versus-logo-v2" src={getAssetUrl('assets/pvp/versus/versus-logo.webm')} mode="green" loop maxWidth={544} />
      </motion.div></div>
    </div>
    <div className="match-poster__billing"><span>SQUABBLEMON PRESENTS</span><strong>{label}</strong><span>THE MAIN EVENT</span></div>
    <div className="match-poster__fighters">
      {[player, rival].map((fighter, i) => <motion.div className={'match-poster__fighter side-' + i} key={i}
        initial={reduced ? false : { x: i ? 90 : -90, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: .45 }}>
        <FighterPortrait cardId={fighter.hero} avatarKey={fighter.avatarKey} name={fighter.name} />
        <div className="fighter-card__copy">
          <span className="fighter-card__corner"><b>0{i + 1}</b>{i ? 'CHALLENGER' : 'YOUR CORNER'}</span>
          <h2>{fighter.name}</h2>
          <div className="fighter-card__meta"><span>{fighter.hero.replaceAll('-', ' ')} fighter</span><span className="fighter-card__level"><small>LVL</small><b>{fighter.level ?? '—'}</b></span><em>RP {fighter.rp?.toLocaleString() ?? '—'}</em></div>
        </div>
        <strong className="fighter-card__player">P{i + 1}</strong>
      </motion.div>)}
    </div>
    <footer><p>3 DISTRICTS <i /> 6 ROUNDS <i /> ONE FADE</p><small>Tap anywhere to enter the fight</small></footer>
  </motion.section>;
}
