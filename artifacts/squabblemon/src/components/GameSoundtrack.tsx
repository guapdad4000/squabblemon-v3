import { useEffect, useRef } from 'react';
import { useFeedbackPreferences } from '../hooks/useFeedbackPreferences';
import { MusicPlayer, soundtrack } from '../musicPlayer';
import { useLocation, useSearch } from 'wouter';
import { activeMusicMode, soundtrackForRoute } from '../musicModes';
import { attachMusicPlayer, publishMusic, useMusicBanks, getMusicBanks, saveMusicBank, useBattleMusicMode, type MusicBank } from '../musicStore';
import { getAssetUrl } from '../lib/assets';
import { getGameAudioContext } from '../gameAudioContext';

export default function GameSoundtrack() {
  const [preferences] = useFeedbackPreferences();
  const [location] = useLocation();
  const search = useSearch();
  const route = search ? `${location}?${search}` : location;
  const override = useBattleMusicMode();
  const mode = activeMusicMode(route, override);
  const playlist = soundtrackForRoute(route, mode);
  const banks = useMusicBanks();
  const activeBank = useRef<MusicBank>(mode === 'background' ? 'background' : 'mode');
  const previousMode = useRef(mode);
  const previousPlaylist = useRef(playlist);
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
      tracks: playlist,
      assetUrl: getAssetUrl,
      publish: publishMusic,
      save: value => saveMusicBank(activeBank.current, value),
      createContext: getGameAudioContext,
      sharedContext: true,
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
    if (previousMode.current === mode && previousPlaylist.current === playlist) return;
    previousMode.current = mode;
    previousPlaylist.current = playlist;
    activeBank.current = mode === 'background' ? 'background' : 'mode';
    player.current?.setPlaylist(playlist, getMusicBanks()[activeBank.current]);
  }, [mode, playlist]);
  useEffect(() => { player.current?.applyPreferences(banks[activeBank.current]); }, [banks, mode]);
  return null;
}
