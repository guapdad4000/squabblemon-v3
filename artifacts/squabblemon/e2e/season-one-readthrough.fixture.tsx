import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { storyContent, storySeasons } from '@workspace/squabblemon-engine/story';
import { StoryStage } from '../src/components/story/StoryStage';
import '../src/index.css';

const ids = storySeasons.find(season => season.id === 'season-1')!.chapterIds;
const entries = storyContent.chapters.filter(chapter => ids.includes(chapter.id)).flatMap(chapter => chapter.nodes.flatMap(node => {
  const sections = node.kind === 'battle' ? [{ section: 'pre' as const, lines: node.preDialogue }, { section: 'post' as const, lines: node.postDialogue }] : [{ section: 'main' as const, lines: node.scenes }];
  return sections.flatMap(({ section, lines }) => lines.map((line, index) => ({ nodeId: node.id, section, line, position: index + 1, total: lines.length, label: `${chapter.title} / ${node.title} / ${section}`, sectionKey: `${node.id}/${section}` })));
}));
const sections = [...new Set(entries.map(entry => entry.sectionKey))];
declare global { interface Window {
  __reviewSelect: (index: number) => void;
  __reviewEntries: typeof entries;
  __reviewSections: typeof sections;
  __reviewIndex: number;
  __reviewActions: { next: number; skip: number; close: number; history: number };
  __reviewSetError: (error: string | null) => void;
} }
function Review() {
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const select = (value: number) => setIndex(Math.max(0, Math.min(entries.length - 1, value)));
  const actions = useState({ next: 0, skip: 0, close: 0, history: 0 })[0];
  window.__reviewSelect = select;
  window.__reviewEntries = entries;
  window.__reviewSections = sections;
  window.__reviewIndex = index;
  window.__reviewActions = actions;
  window.__reviewSetError = setError;
  const entry = entries[index];
  return <main style={{ height: '100dvh', background: '#151b23', color: 'white' }}>
    <nav aria-label="Screenplay review" style={{ height: 64, display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}>
      <button onClick={() => select(index - 1)} disabled={!index}>←</button>
      <select aria-label="Choose scene" value={entries.findIndex(item => item.sectionKey === entry.sectionKey)} onChange={event => select(Number(event.target.value))} style={{ minWidth: 0, flex: 1, color: 'white', background: '#26333c', padding: 8 }}>
        {entries.map((item, i) => item.position === 1 && <option key={i} value={i}>{item.label}</option>)}
      </select>
      <output data-testid="review-progress" style={{ fontSize: 12 }}>{index + 1}/{entries.length}</output>
      <button onClick={() => select(index + 1)} disabled={index === entries.length - 1}>→</button>
    </nav>
    <div style={{ height: 'calc(100dvh - 64px)' }}><StoryStage key={index} {...entry}
      onNext={() => { actions.next += 1; select(index + 1); }}
      onSkip={() => { actions.skip += 1; select(index + entry.total - entry.position + 1); }}
      onClose={() => { actions.close += 1; select(0); }}
      error={error}
      onHistory={() => { actions.history += 1; }}
      /></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Review />);
