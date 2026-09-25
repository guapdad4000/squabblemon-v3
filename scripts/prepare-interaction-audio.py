import pathlib, subprocess,json
src=pathlib.Path('/home/falcon/Downloads')
out=pathlib.Path('artifacts/squabblemon/public/audio/sfx/interactions')
spec=[
('door-chime','Chime_of_a_ring_came_',1.4),('door-knock','knock_on_the_door_',1.3),('cards-spread','deck_of_cards_spread_',.9),('bag-hit','heavy_bag_hit_',.65),('phone-ring','MACHMisc-cell_phone_ringing-',1.5),('watering','watering_plants_',2.0),('bag-open','unzipping_a_bag_and__',1.1),('arcade-beep','arcade_machine_beep__',.65),('film','MACHMech-A_vintage_35_mm_film-',1.6),('ui-beep','MACHMisc-beep-',.35),('machine','MACHInd-Industrial_machine_p-',1.2),('crowd','HMNMisc-audience_ahh-',1.1),('prison','HMNMisc-Prison_noise,_man_hi-',1.3),('magic-swoosh','MAGMisc-magic_swoosh_with_ba-',.9),('magic-reveal','MAGShim-Create_a_polished_mo-',1.5),('water-splash','MAGElem-Magical_water_splash-',1.1),('magic-aura','MAGShim-Continuous_magical_a-',1.5),('magic-poof','MAGPoof-Prompt_Magic_poof_tr-',.75),('fireball','MAGElem-A_blazing_fireball_l-',1.0),('crystal','MAGShim-A_soft,_magical_crys-',1.2),('low-spell','MAGSpel-A_subtle,_low-freque-',1.2),('treasure','MAGPoof-Magical_treasure_che-',1.6),('intro','DSGNBram-Cinematic_intro_soun-',1.8)]
manifest=[]
for name,prefix,limit in spec:
 f=next(src.glob(prefix+'*.wav'))
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(f)]))
 length=min(duration,limit)
 filters=f'silenceremove=start_periods=1:start_duration=0.01:start_threshold=-45dB,atrim=duration={length},asetpts=PTS-STARTPTS,loudnorm=I=-24:TP=-6:LRA=7,afade=t=in:d=0.015,afade=t=out:st={max(0,length-.16)}:d=0.16'
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(f),'-af',filters,'-ac','1','-ar','44100','-codec:a','libmp3lame','-b:a','96k',str(out/(name+'.mp3'))],check=True)
 manifest.append(dict(id=name,source=f.name,sourceDuration=duration,maxDuration=length))
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Prepared',len(manifest),'quiet, faded clips')
