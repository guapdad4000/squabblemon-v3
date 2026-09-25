import { Attention } from '../../components/Notifications';
import { Link } from 'wouter';
import { CharacterBanner } from '../../components/CharacterBanner';
import { styleSetFor } from '@workspace/squabblemon-engine/cosmetics';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { GameGlyph } from '../../components/venue/GameGlyph';
import { getAssetUrl } from '../../lib/assets';
import '../../styles/inventory.css';
export function Inventory({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { profile } = bootstrap;
  return <main className="inventory-room">

    <div className="inventory-room__layout">
      <div className="inventory-room__art"><img src={getAssetUrl('assets/rewards/clout-bag.webp')} alt="Your black and gold inventory bag" /></div>
      <section><span className="studio-eyebrow">YOUR STASH / READY WHEN YOU ARE</span><h1>In the bag.</h1>
        {profile.id === 'e2e-player' && <p>Local preview inventory</p>}
        <div className="inventory-room__wallet">
          {([{glyph:'cloutStack', label:'Clout', value:profile.softCurrency, href:'/game/shop?view=training'}, {glyph:'ticket',label:'Tickets',value:profile.packTickets,href:'/game/shop?view=packs'}, {glyph:'shards',label:'Style Shards',value:profile.styleShards,href:'/game/collection'}, {glyph:'rep',label:'Street Rep',value:profile.streetRep,href:'/game/settings'}] as const).map(item => <Link key={item.label} href={item.href}><GameGlyph name={item.glyph}/><strong>{item.value.toLocaleString()}</strong><span>{item.label}</span></Link>)}
        </div>
        <div className="inventory-room__links"><Link href="/game/collection">{profile.ownedCardIds.length} cards · Open collection →<Attention section="cards" micro /></Link><Link href="/game/settings">{profile.unlockedCosmeticIds.length} cosmetics · Profile →<Attention section="style" micro /></Link><Link href="/game/missions">Claim your bounties →<Attention section="missions" micro /></Link></div>
      </section>
    </div>
    <section className="inventory-style-entry"><span className="studio-eyebrow">SIGNATURE COLLECTIONS / MAKE IT YOURS</span><CharacterBanner cardId={styleSetFor(profile.settings.cosmetics?.bannerCardId)?.cardId ?? "kyle"} finish={profile.settings.cosmetics?.bannerFinish} stickers={profile.settings.cosmetics?.stickers} displayName={profile.settings.cosmetics?.bannerCardId ? profile.displayName : "KYLE / SIGNATURE SERIES 001"} compact/><Link href="/game/style">Browse all collections · Stickers, banners & card scenes →<Attention section="style" micro /></Link></section>
  </main>;
}
