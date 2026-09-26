import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { storyContent, storySeasons } from '@workspace/squabblemon-engine/story';
import { StoryStage } from '../src/components/story/StoryStage';
import '../src/index.css';

const ids = storySeasons.find(season => season.id === 'season-1')!.chapterIds;
const entries = storyContent.chapters.filter(chapter => ids.includes(chapter.id)).flatMap(chapter => chapter.nodes.flatMap(node => {
  const sections = node.kind === 'battle' ? [{ section: 'pre' as const, lines: node.preDialogue }, { section: 'post' as const, lines: node.postDialogue }] : [{ section: 'main' as const, lines: node.scenes }];
  return sections.flatMap(({ section, lines }) => lines.map((line, index) => ({ nodeId: node.id, section, line, position: index + 1, total: lines.length, label: `${chapter.title} / ${node.title} / ${section}` })));
}));
declare global { interface Window { __reviewSelect: (index: number) => void; __reviewEntries: typeof entries } }
function Review() {
  const [index, setIndex] = useState(0);
  const select = (value: number) => setIndex(Math.max(0, Math.min(entries.length - 1, value)));
  window.__reviewSelect = select;
  window.__reviewEntries = entries;
  const entry = entries[index];
  return <main style={{ height: '100dvh', background: '#151b23', color: 'white' }}>
    <nav aria-label="Screenplay review" style={{ height: 64, display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}>
      <button onClick={() => select(index - 1)} disabled={!index}>←</button>
      <select aria-label="Choose scene" value={entries.findIndex(item => item.label === entry.label)} onChange={event => select(Number(event.target.value))} style={{ minWidth: 0, flex: 1, color: 'white', background: '#26333c', padding: 8 }}>
        {entries.map((item, i) => item.position === 1 && <option key={i} value={i}>{item.label}</option>)}
      </select>
      <span style={{ fontSize: 12 }}>{index + 1}/{entries.length}</span>
      <button onClick={() => select(index + 1)} disabled={index === entries.length - 1}>→</button>
    </nav>
    <div style={{ height: 'calc(100dvh - 64px)' }}><StoryStage key={index} {...entry} onNext={() => select(index + 1)} onSkip={() => select(index + entry.total - entry.position + 1)} onClose={() => select(0)} /></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Review />);
