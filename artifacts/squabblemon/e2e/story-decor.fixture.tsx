import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {getGetPlayerStoryQueryKey} from '@workspace/api-client-react';
import {Story} from '../src/pages/game/Story';
import '../src/index.css';
const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity}}});
client.setQueryData(getGetPlayerStoryQueryKey(),{chapters:[{id:'visual',title:'The Block',subtitle:'Chapter One',status:'available',mapAssetId:'brand/story-cinematic/curtain.jpg'}],nodes:[],recommendedNodeId:null});
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Story bootstrap={{profile:{}} as any}/></QueryClientProvider>);
