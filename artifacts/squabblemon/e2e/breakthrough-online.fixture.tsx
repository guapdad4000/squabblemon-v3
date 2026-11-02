import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import BreakthroughOnline from '../src/components/breakthrough/BreakthroughOnline';
if(!import.meta.env.DEV)throw Error('Owned integration fixture only');
const cards=['nabu','enki','utu','ninhursag','inanna','yakub','enlil','ereshkigal','caucus-mountaineer','anu'];
const profile={id:new URLSearchParams(location.search).get('account')??'browser-a',displayName:'Local player',avatarKey:'nabu',level:1,
  ownedCardIds:cards,savedDecks:[{id:'owned',name:'Anunaki',cardIds:cards,heroCardId:'anu'}],equippedVariants:{},settings:{reducedMotion:true}};
const root=createRoot(document.getElementById('root')!);import.meta.hot?.dispose(()=>root.unmount());
root.render(<QueryClientProvider client={new QueryClient()}><BreakthroughOnline bootstrap={{profile} as PlayerBootstrap}/></QueryClientProvider>);
