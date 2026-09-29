import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { ProfileOverview } from '../../components/profile/ProfileOverview';
import { ProfileStyle } from '../../components/profile/ProfileStyle';
import { ProfileSettings } from '../../components/profile/ProfileSettings';
import { HomiesPanel } from '../../components/social/HomiesPanel';
import { useSocial } from '../../lib/social';
import '../../styles/fighter-id.css';
import '../../styles/homies.css';

const tabs = ['Overview', 'Style', 'Homies', 'Settings'] as const;
type Tab = typeof tabs[number];
function linkedTab(): Tab {
  if (['#settings', '#promo-code'].includes(window.location.hash)) return 'Settings';
  if (window.location.hash === '#homies') return 'Homies';
  return ['#style', '#reactions'].includes(window.location.hash) ? 'Style' : 'Overview';
}

export function Settings({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [activeTab, setActiveTab] = useState<Tab>(linkedTab);
  const [busy, setBusy] = useState(false);
  const { pendingCount } = useSocial();
  const [styleDirty, setStyleDirty] = useState(false);
  const leaveStyle = (tab: Tab) => tab === 'Style' || !styleDirty || window.confirm('Your PvP reaction tray has unsaved changes. Leave without saving?');
  const [fragment, setFragment] = useState(window.location.hash);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panel = useRef<HTMLDivElement>(null);
  const path = useRef(window.location.pathname);
  useEffect(() => {
    const change = () => {
      if (window.location.pathname !== path.current) return; // route guard owns page changes
      if (window.location.hash === fragment && linkedTab() === activeTab) return;
      if (linkedTab() === activeTab) { setFragment(window.location.hash); return; }
      if (busy || !leaveStyle(linkedTab())) {
        history.replaceState(history.state, '', `${location.pathname}${location.search}${fragment}`);
        return;
      }
      setFragment(window.location.hash);
      setActiveTab(linkedTab());
    };
    // Wouter navigates with pushState, which never emits hashchange.
    const events = ['hashchange', 'pushState', 'popstate'] as const;
    events.forEach(name => window.addEventListener(name, change));
    return () => events.forEach(name => window.removeEventListener(name, change));
  }, [busy, styleDirty, fragment, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
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
    if (busy || tab === activeTab || !leaveStyle(tab)) return false;
    const hash = `#${tab.toLowerCase()}`;
    history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
    setFragment(hash);
    setActiveTab(tab);
    return true;
  }
  function tabKey(event: KeyboardEvent, index: number) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (busy) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    const moved = select(tabs[next]);
    tabRefs.current[moved ? next : tabs.indexOf(activeTab)]?.focus();
  }
  return <main className="fighter-id-stage" aria-label="Fighter ID">
    <div className="fighter-id-container">
      <header className="profile-file-header"><div><span>THE BLOCK KNOWS</span><strong>Your reputation.</strong></div><span className="profile-file-header__note">Make it personal.</span></header>
      <div className="fighter-tabs" role="tablist" aria-label="Fighter ID sections">
        {tabs.map((tab, index) => <button key={tab} type="button" role="tab" className="fighter-tab"
          id={`fighter-tab-${tab}`} aria-controls={`fighter-panel-${tab}`} aria-selected={activeTab === tab}
          tabIndex={activeTab === tab ? 0 : -1} disabled={busy} ref={element => { tabRefs.current[index] = element; }}
          onKeyDown={event => tabKey(event, index)} onClick={() => select(tab)} data-testid={`tab-${tab.toLowerCase()}`}>{tab}{tab === 'Homies' && pendingCount > 0 && <span className="fighter-tab__badge" aria-label={`${pendingCount} pending`}>{pendingCount > 99 ? '99+' : pendingCount}</span>}</button>)}
      </div>
      <div ref={panel} className={`fighter-panel${activeTab === 'Homies' ? ' fighter-panel--fadebook' : ''}`} role="tabpanel" tabIndex={0} id={`fighter-panel-${activeTab}`} aria-labelledby={`fighter-tab-${activeTab}`}>
        {activeTab === 'Overview' && <ProfileOverview bootstrap={bootstrap} onBusyChange={setBusy} />}
        {activeTab === 'Style' && <ProfileStyle bootstrap={bootstrap} onBusyChange={setBusy} onDirtyChange={setStyleDirty} />}
        {activeTab === 'Homies' && <HomiesPanel onBusyChange={setBusy} />}
        {activeTab === 'Settings' && <ProfileSettings bootstrap={bootstrap} onBusyChange={setBusy} />}
      </div>
    </div>
  </main>;
}
