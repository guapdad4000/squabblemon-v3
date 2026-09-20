import { useEffect, useRef } from 'react';
import { useFeedbackPreferences } from '../hooks/useFeedbackPreferences';
import { MusicPlayer, soundtrack } from '../musicPlayer';
import { useLocation } from 'wouter';
import { modeSoundtracks, musicModeForRoute } from '../musicModes';
import { attachMusicPlayer, publishMusic, useMusicBanks, getMusicBanks, saveMusicBank, useBattleMusicMode, type MusicBank } from '../musicStore';
import { getAssetUrl } from '../lib/assets';

export default function GameSoundtrack() {
  const [preferences] = useFeedbackPreferences();
  const [location] = useLocation();
  const override = useBattleMusicMode();
  const mode = override ?? musicModeForRoute(location);
  const banks = useMusicBanks();
  const activeBank = useRef<MusicBank>(mode === 'background' ? 'background' : 'mode');
  const previousMode = useRef(mode);
  const player = useRef<MusicPlayer | null>(null);
  const master = useRef(preferences.audioEnabled);
  master.current = preferences.audioEnabled;
  useEffect(() => {
    const audio = document.createElement('audio');
    audio.hidden = true;
    audio.dataset.testid = 'background-music';
    document.body.appendChild(audio);
    const current = new MusicPlayer(audio, {
      preferences: getMusicBanks()[activeBank.current],
      tracks: mode === 'background' ? soundtrack : modeSoundtracks[mode],
      assetUrl: getAssetUrl,
      publish: publishMusic,
      save: value => saveMusicBank(activeBank.current, value),
      createContext: () => {
        const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        return Context ? new Context() : undefined;
      },
    });
    player.current = current;
    attachMusicPlayer(current);
    const visibility = () => current.setEnvironment(true, !document.hidden, master.current);
    const pageHide = () => current.setEnvironment(false, false, master.current);
    const gesture = (event: Event) => { if (event.isTrusted) current.unlock(); };
    visibility();
    document.addEventListener('pointerdown', gesture, true);
    document.addEventListener('pointerup', gesture, true);
    document.addEventListener('keydown', gesture, true);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pageHide);
    window.addEventListener('pageshow', visibility);
    return () => {
      document.removeEventListener('pointerdown', gesture, true);
      document.removeEventListener('pointerup', gesture, true);
      document.removeEventListener('keydown', gesture, true);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pageHide);
      window.removeEventListener('pageshow', visibility);
      attachMusicPlayer(null);
      player.current = null;
      current.dispose();
      audio.remove();
    };
  }, []);
  useEffect(() => {
    player.current?.setEnvironment(true, !document.hidden, preferences.audioEnabled);
  }, [preferences.audioEnabled]);
  useEffect(() => {
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    activeBank.current = mode === 'background' ? 'background' : 'mode';
    player.current?.setPlaylist(mode === 'background' ? soundtrack : modeSoundtracks[mode], getMusicBanks()[activeBank.current]);
  }, [mode]);
  useEffect(() => { player.current?.applyPreferences(banks[activeBank.current]); }, [banks, mode]);
  return null;
}
