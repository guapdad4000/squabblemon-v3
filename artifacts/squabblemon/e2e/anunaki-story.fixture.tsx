import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {storyContent} from '@workspace/squabblemon-engine/story';
import {ANUNAKI_STORY_CHAPTERS} from '@workspace/squabblemon-engine/anunakiEvent';
import {StoryStage} from '../src/components/story/StoryStage';
import '../src/index.css';
const chapterIndex=Math.max(0,Math.min(7,Number(new URLSearchParams(location.search).get('chapter')??1)-1));
const chapter=storyContent.chapters.find(c=>c.id===ANUNAKI_STORY_CHAPTERS[chapterIndex])!;
const chosen=new URLSearchParams(location.search).get('node')??'arrival';
const node=chapter.nodes.find(n=>n.id===`${chapter.id}-${chosen}`)!;
const section=node.kind==='battle'?'pre':'main';
const lines=node.kind==='battle'?node.preDialogue:node.scenes;
function Fixture(){const[position,setPosition]=useState(1);return <main style={{height:'100dvh',overflow:'hidden'}}><StoryStage nodeId={node.id} node={node} section={section} line={lines[position-1]} position={position} total={lines.length} onNext={()=>setPosition(n=>Math.min(lines.length,n+1))} onSkip={()=>setPosition(lines.length)} onClose={()=>location.assign('/e2e/season-theater.fixture.html?season=special-anunaki-arrival')}/></main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
