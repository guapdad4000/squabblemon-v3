import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {Missions} from '../src/pages/game/Missions';
import {cardCatalog} from '../src/data';
import '../src/index.css';
const bootstrap:any={profile:{id:'hall-preview',settings:{reducedMotion:true},streetRep:50,ownedCardIds:cardCatalog.slice(0,35).map(c=>c.catalogId),collectionProgress:40,unlockedCosmeticIds:['badge:street-draft'],storyProgress:{gameplay:{cleansed:true,wins:Object.fromEntries(cardCatalog.slice(0,14).map((c,i)=>[c.catalogId,i%6+1]))}}},missions:[],collectionRoad:[]};
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><main style={{height:'100svh'}}><Missions bootstrap={bootstrap}/></main></QueryClientProvider>);
