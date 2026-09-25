import { StreetSelect } from '../components/ui/street-select';
import { useState } from 'react';
import { Link } from 'wouter';
import { storyContent, type StoryNode, type StoryDialogueLine } from '@workspace/squabblemon-engine/story';
import { StoryStage } from '../components/story/StoryStage';
import '../styles/studio.css';

type PreviewScene = { node: StoryNode; section: 'pre' | 'post' | 'main'; lines: readonly StoryDialogueLine[] };
const scenesByChapter = Object.fromEntries(storyContent.chapters.map((chapter) => [chapter.id,
  chapter.nodes.flatMap<PreviewScene>((node) => node.kind === 'battle'
    ? [{ node, section: 'pre', lines: node.preDialogue }, { node, section: 'post', lines: node.postDialogue }]
    : [{ node, section: 'main', lines: node.scenes }]),
])) as Record<string, PreviewScene[]>;

export default function StoryStudio() {
  const [chapterId, setChapterId] = useState(storyContent.chapters[0].id);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);
  const [intermission, setIntermission] = useState(false);
  const [history, setHistory] = useState(false);
  const chapter = storyContent.chapters.find((item) => item.id === chapterId)!;
  const scenes = scenesByChapter[chapterId];
  const scene = scenes[sceneIndex];
  const select = (index: number) => { setSceneIndex(index); setLineIndex(0); setIntermission(false); setHistory(false); };
  const selectChapter = (id: string) => { setChapterId(id); select(0); };
  const finish = () => setIntermission(true);
  return <main className="story-studio-shell">
    <nav className="story-studio-controls" aria-label="Chapter preview controls">
      <Link className="story-studio-controls__campaign" href="/game/story">Play campaign ↗</Link><span className="story-studio-controls__note">Scene preview · no progress or rewards</span>
      <StreetSelect aria-label="Select chapter" value={chapterId} onValueChange={event => selectChapter(event)}>
        {storyContent.chapters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </StreetSelect>
      <StreetSelect aria-label="Select scene" value={sceneIndex} onValueChange={event => select(Number(event))}>
        {scenes.map((item, index) => <option key={`${item.node.id}:${item.section}`} value={index}>{item.node.title} · {item.section === 'pre' ? 'Before fight' : item.section === 'post' ? 'After victory' : 'Scene'}</option>)}
      </StreetSelect>
    </nav>
    <div className="story-studio-stage">
      <StoryStage key={`${scene.node.id}:${scene.section}`} nodeId={scene.node.id} section={scene.section} line={scene.lines[lineIndex]} position={lineIndex + 1} total={scene.lines.length}
        onNext={() => lineIndex + 1 < scene.lines.length ? setLineIndex(lineIndex + 1) : finish()}
        onSkip={finish} onClose={() => select(0)} onHistory={() => setHistory(true)} />
      {(intermission || history) && <div className="story-studio-dialog" role="dialog" aria-modal="true" aria-label={history ? 'Scene transcript' : 'Scene complete'} style={{ position: 'absolute', inset: 0, zIndex: 10, background: '#101218f5', display: 'grid', placeItems: 'center', padding: 28, overflow: 'auto' }}>
        <div style={{ maxWidth: 640, width: '100%' }}>
          {history ? <><h2>Scene transcript</h2>{scene.lines.slice(0, lineIndex + 1).map((line, index) => <p key={index} style={{ margin: '16px 0' }}><strong style={{ color: '#e8d0a2' }}>{line.speaker}</strong><br />{line.text}</p>)}<button onClick={() => setHistory(false)} style={button}>Close transcript</button></> : <>
            <p style={{ color: '#e8d0a2', letterSpacing: '.2em', fontSize: 11 }}>{chapter.title.toUpperCase()} / {scene.section === 'pre' ? 'FIGHT BREAK' : 'SCENE COMPLETE'}</p>
            <h1 style={{ font: 'italic 42px Georgia', margin: '20px 0' }}>{scene.section === 'pre' ? 'Enough talking. Decks out.' : sceneIndex === scenes.length - 1 ? chapter.order === storyContent.chapters.length ? 'Season One complete.' : 'To be continued…' : 'The block keeps talking.'}</h1>
            <p style={{ opacity: .7, lineHeight: 1.6, marginBottom: 20 }}>{scene.section === 'pre' ? 'The campaign launches the real card battle here. Win to unlock the aftermath. This preview lets you inspect the next scene.' : 'Replay the scene, or continue through the chapter.'}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><button style={button} onClick={() => select(sceneIndex)}>Replay scene</button><button style={button} onClick={() => select((sceneIndex + 1) % scenes.length)}>{sceneIndex === scenes.length - 1 ? 'Back to opening' : 'Preview next scene →'}</button><Link style={button} href="/game/story">Play campaign</Link></div>
          </>}
        </div>
      </div>}
    </div>
  </main>;
}
const button = { padding: '12px 18px', background: '#e8d0a2', color: '#201b17', border: 0, cursor: 'pointer', fontSize: 13 };
