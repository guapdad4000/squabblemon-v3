import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardCatalog, LATER_DROP_STARTER_IDS } from '../src/data';
import { moveAssignments, moveClips } from '../src/specialMoves';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(app,'../deliverables/openart-specials');mkdirSync(out,{recursive:true});
const priority=['dr-fade','concrete','buddy','folks','counter','undercova-brotha','sugarfoot','juneteenth-chair-guy','homeless-wiseman','bonnet-girl','tattoo-artist','the-mailman'];
const rows=cardCatalog.map(card=>{
 const clipId=moveAssignments[card.engineId]??null;const clip=clipId?moveClips[clipId]:null;
 const status=!clip?'unassigned':!clip.enabled?'disabled':!existsSync(path.join(app,'public/assets/special-moves',clip.file))?'missing-file':'assigned-file-present';
 return {name:card.name,catalogId:card.catalogId,engineId:card.engineId,kind:card.kind,rarity:card.rarity,move:card.ability,effect:card.effect,
  batch:(LATER_DROP_STARTER_IDS as readonly string[]).includes(card.catalogId)?'later-drop':card.kind!=='character'?card.kind:priority.includes(card.catalogId)?'pilot-and-priority':'character-batch',
  reference:path.join(app,'public/assets/characters',card.artworkId+'.webp'),referenceExists:existsSync(path.join(app,'public/assets/characters',card.artworkId+'.webp')),
  status,clipId,file:clip?.file??'',proposedClipId:`oa-${card.catalogId}-v1`,qa:'Not visually reviewed in this inventory'};
});
writeFileSync(path.join(out,'coverage.json'),JSON.stringify(rows,null,2)+'\n');
const missing=rows.filter(r=>r.status!=='assigned-file-present');const keys=Object.keys(missing[0]);
writeFileSync(path.join(out,'missing-specials.csv'),[keys.join(','),...missing.map(r=>keys.map(k=>'"'+String(r[k as keyof typeof r]??'').replaceAll('"','""')+'"').join(','))].join('\n')+'\n');
const groups=['pilot-and-priority','character-batch','later-drop','support','blockbuster'];
writeFileSync(path.join(out,'MISSING-LIST.md'),'# Missing special videos\n\nInventory of the current runtime catalog, including procedural fallbacks. A present file is not a visual-quality approval. No accounts or local override settings were inspected.\n\n'+groups.map(g=>{
 const items=missing.filter(r=>r.batch===g);return `## ${g} (${items.length})\n\n| Character/card | Special | Engine ID |\n|---|---|---|\n`+items.map(r=>`| ${r.name} | ${r.move} | \`${r.engineId}\` |`).join('\n');
}).join('\n\n')+'\n');
console.log(JSON.stringify({catalog:rows.length,assigned:rows.length-missing.length,missing:missing.length,missingCharacters:missing.filter(r=>r.kind==='character').length,missingReferences:missing.filter(r=>!r.referenceExists).length}));
