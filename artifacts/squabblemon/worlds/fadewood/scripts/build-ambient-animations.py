#!/usr/bin/env python3
"""Extract authored actions without shipping another mesh, rig, or texture."""
import argparse, copy, hashlib, importlib.util, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('mobile_assets', ROOT/'scripts/build-mobile-characters.py')
mobile = importlib.util.module_from_spec(spec); spec.loader.exec_module(mobile)
SELECTED = {
 'og-blue': ('og-blue-compressed.glb', ['idle_to_push_up','push_up','push_up_to_idle']),
 'og-red': ('og-red-compreseed.glb', ['idle_to_push_up','push_up','push_up_to_idle']),
 'cornball': ('cornball-compressed.glb', ['Idle_02','All_Night_Dance']),
 'ganger-blue': ('ganger-blue-compressed.glb', ['Punch_Combo_3']),
 'ganger-red': ('ganger-red-compressed.glb', ['Punch_Combo']),
}
def digest(data): return hashlib.sha256(data).hexdigest()
def extract(source, runtime, output, names):
 raw, doc, binary = mobile.read_glb(source)
 runtime_raw, runtime_doc, _ = mobile.read_glb(runtime)
 assert doc['nodes'] == runtime_doc['nodes'], f'Rig rest transforms changed: {source.name}'
 selected = [next(a for a in doc['animations'] if a['name']==name) for name in names]
 pack = {key:copy.deepcopy(doc[key]) for key in ('asset','nodes','scenes','scene') if key in doc}
 for node in pack['nodes']:
  node.pop('mesh',None);node.pop('skin',None)
 pack.update(buffers=[{}],bufferViews=[],accessors=[],animations=copy.deepcopy(selected))
 used=sorted({index for a in selected for sampler in a['samplers'] for index in (sampler['input'],sampler['output'])})
 data=bytearray(); remap={}; sample_hashes={}
 for index in used:
  chunk=mobile.accessor_bytes(doc,binary,index); data.extend(b'\0'*(-len(data)%4))
  accessor=copy.deepcopy(doc['accessors'][index]);accessor.pop('byteOffset',None)
  accessor['bufferView']=len(pack['bufferViews']); remap[index]=len(pack['accessors'])
  pack['bufferViews'].append({'buffer':0,'byteOffset':len(data),'byteLength':len(chunk)})
  pack['accessors'].append(accessor);data.extend(chunk);sample_hashes[str(index)]=digest(chunk)
 for animation in pack['animations']:
  for sampler in animation['samplers']:
   sampler['input']=remap[sampler['input']];sampler['output']=remap[sampler['output']]
 encoded=mobile.write_glb(pack,bytes(data));output.write_bytes(encoded)
 return {'source':str(source),'sourceSha256':digest(raw),'runtimeModel':str(runtime),'runtimeModelSha256':digest(runtime_raw),'file':output.name,'bytes':len(encoded),'sha256':digest(encoded),'clips':names,'sourceAccessorSha256':sample_hashes,'meshCount':0,'textureCount':0,'restNodesMatch':True}
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=Path,required=True);args=parser.parse_args()
 target=ROOT/'public/assets/ambient';target.mkdir(parents=True,exist_ok=True)
 records=[extract(args.source_dir/file,ROOT/'public/assets/characters-mobile'/file,target/f'{actor}.glb',names) for actor,(file,names) in SELECTED.items()]
 audit={'method':'Original authored accessor bytes copied into animation-only GLBs; unchanged target rest nodes; no mesh, skin, image or material payload.','assets':records,'totalBytes':sum(x['bytes'] for x in records)}
 (target/'provenance.json').write_text(json.dumps(audit,indent=2)+'\n')
 print(json.dumps({'packs':len(records),'bytes':audit['totalBytes'],'clips':sum(len(x['clips']) for x in records)}))
