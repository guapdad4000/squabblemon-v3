from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

root=Path(__file__).resolve().parents[1]
assets=root/'artifacts/squabblemon/public/assets'
out=root/'artifacts/video-handoff-audit'
out.mkdir(exist_ok=True)
groups={
 'cast':[assets/'characters'/f'{n}.webp' for n in ['ganger-blue','ganger-red','cracked-head','snitch','cornball','wifey','baby-momma','og-uncle']],
 'story-backgrounds':list((assets/'story/chapter-one/environments').glob('*.webp')),
 'landscape-backgrounds':[assets/'layered'/f'{n}.webp' for n in ['corner-store','moon-rooftop','red-court','civic-summit','crown-court','gold-alley','red-alley','sunset-block','festival-street']],
 'props':list((assets/'props').glob('*.webp')),
}
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',17)
metadata=[]
for name,paths in groups.items():
    width,height=(320,360) if name=='cast' else (360,245)
    cols=4 if name=='cast' else 3
    sheet=Image.new('RGB',(cols*width,((len(paths)+cols-1)//cols)*height),'#22252b')
    d=ImageDraw.Draw(sheet)
    for i,p in enumerate(paths):
        im=Image.open(p)
        alpha=im.getchannel('A').getextrema() if 'A' in im.getbands() else None
        metadata.append({'path':str(p.relative_to(root)),'width':im.width,'height':im.height,'mode':im.mode,'alphaExtrema':alpha})
        thumb=im.convert('RGBA');thumb.thumbnail((width-16,height-50))
        x=(i%cols)*width+(width-thumb.width)//2;y=(i//cols)*height+8
        sheet.paste(thumb,(x,y),thumb)
        d.text(((i%cols)*width+8,(i//cols)*height+height-38),p.stem,fill='white',font=font)
        d.text(((i%cols)*width+8,(i//cols)*height+height-19),f'{im.width} x {im.height} | {im.mode}',fill='#aab3c4',font=font)
    sheet.save(out/f'{name}.jpg',quality=90)
(out/'metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
print(out)
