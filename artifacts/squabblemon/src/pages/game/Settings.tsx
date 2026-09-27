import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { ProfileOverview } from '../../components/profile/ProfileOverview';
import { ProfileStyle } from '../../components/profile/ProfileStyle';
import { ProfileSettings } from '../../components/profile/ProfileSettings';
import '../../styles/fighter-id.css';

const tabs = ['Overview', 'Style', 'Settings'] as const;
type Tab = typeof tabs[number];
function linkedTab(): Tab {
  if (['#settings', '#promo-code'].includes(window.location.hash)) return 'Settings';
  return ['#style', '#reactions'].includes(window.location.hash) ? 'Style' : 'Overview';
}

export function Settings({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [activeTab, setActiveTab] = useState<Tab>(linkedTab);
  const [busy, setBusy] = useState(false);
  const [styleDirty, setStyleDirty] = useState(false);
  const leaveStyle = (tab: Tab) => tab === 'Style' || !styleDirty || window.confirm('Your PvP reaction tray has unsaved changes. Leave without saving?');
  const [fragment, setFragment] = useState(window.location.hash);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const change = () => {
      if (busy || !leaveStyle(linkedTab())) return;
      setFragment(window.location.hash);
      setActiveTab(linkedTab());
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, [busy, styleDirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!panel.current) return;
    panel.current.scrollTop = 0;
    if (activeTab === 'Settings' && fragment === '#promo-code') {
      const field = document.getElementById('promo-code');
      if (field) panel.current.scrollTop = field.getBoundingClientRect().top - panel.current.getBoundingClientRect().top;
    }
    if (activeTab === 'Style' && fragment === '#reactions') {
      const target = panel.current;
      requestAnimationFrame(() => {
        const editor = document.getElementById('pvp-reactions');
        if (editor) target.scrollTop += editor.getBoundingClientRect().top - target.getBoundingClientRect().top;
      });
    }
  }, [activeTab, fragment]);
  function select(tab: Tab) {
    if (busy || tab === activeTab || !leaveStyle(tab)) return;
    const hash = `#${tab.toLowerCase()}`;
    history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
    setFragment(hash);
    setActiveTab(tab);
  }
  function tabKey(event: KeyboardEvent, index: number) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (busy) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
    select(tabs[next]); tabRefs.current[next]?.focus();
  }
  return <main className="fighter-id-stage" aria-label="Fighter ID">
    <div className="fighter-id-container">
      <header className="profile-file-header"><div><span>THE BLOCK KNOWS</span><strong>Your reputation.</strong></div><span className="profile-file-header__note">Make it personal.</span></header>
      <div className="fighter-tabs" role="tablist" aria-label="Fighter ID sections">
        {tabs.map((tab, index) => <button key={tab} type="button" role="tab" className="fighter-tab"
          id={`fighter-tab-${tab}`} aria-controls={`fighter-panel-${tab}`} aria-selected={activeTab === tab}
          tabIndex={activeTab === tab ? 0 : -1} disabled={busy} ref={element => { tabRefs.current[index] = element; }}
          onKeyDown={event => tabKey(event, index)} onClick={() => select(tab)}>{tab}</button>)}
      </div>
      <div ref={panel} className="fighter-panel" role="tabpanel" tabIndex={0} id={`fighter-panel-${activeTab}`} aria-labelledby={`fighter-tab-${activeTab}`}>
        {activeTab === 'Overview' && <ProfileOverview bootstrap={bootstrap} onBusyChange={setBusy} />}
        {activeTab === 'Style' && <ProfileStyle bootstrap={bootstrap} onBusyChange={setBusy} onDirtyChange={setStyleDirty} />}
        {activeTab === 'Settings' && <ProfileSettings bootstrap={bootstrap} onBusyChange={setBusy} />}
      </div>
    </div>
  </main>;
}
