import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { getAssetUrl, getCardImage } from '../lib/assets';
import { useAppAuth } from '../lib/auth';
import { MotionSticker } from '../components/MotionSticker';
import { InstallGame } from '../components/InstallGame';

export function PublicEntry() {
  const { isSignedIn } = useAppAuth();

  return (
    <div className="min-h-[100dvh] bg-[#070707] flex flex-col relative overflow-hidden text-white font-sans">
      <div className="noise-overlay" />
      <div
        className="absolute inset-0 opacity-30 bg-cover bg-center mix-blend-luminosity"
        style={{ backgroundImage: `url("${getAssetUrl('assets/e71f5189-861e-418d-8237-fa20713b9122.webp')}")` }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,7,.98)_0%,rgba(7,7,7,.88)_45%,rgba(7,7,7,.25)_100%),radial-gradient(circle_at_70%_40%,rgba(250,204,21,.2),transparent_50%)]" />
      <motion.img
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 0.94, x: 0 }}
        transition={{ duration: 0.7 }}
        src={getCardImage('rastamon')}
        alt=""
        aria-hidden="true"
        className="absolute right-[-18%] md:right-[1%] bottom-[-7%] h-[69%] md:h-[94%] w-[78%] md:w-[55%] object-contain object-right-bottom drop-shadow-[0_30px_30px_rgba(0,0,0,.9)] pointer-events-none"
      />
      <img
        src={getCardImage('officer-oink')}
        alt=""
        aria-hidden="true"
        className="hidden md:block absolute right-[31%] bottom-[-14%] h-[65%] w-[33%] object-contain object-bottom opacity-45 grayscale drop-shadow-[0_25px_25px_rgba(0,0,0,.9)] pointer-events-none"
      />
      
      <div className="relative z-10 flex-1 flex flex-col items-start justify-center p-6 md:p-12 lg:p-20 text-left max-w-2xl">
        <MotionSticker variant="entry" className="public-entry-motion" label="Squabblemon" eager />
        
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <div className="font-mono text-[9px] md:text-[11px] text-primary uppercase tracking-[.28em] mb-3">The city is watching</div>
          <p className="font-sans text-sm md:text-base text-white/70 max-w-sm mb-8 leading-relaxed">
            Build your gang, read the room, and take two of three districts in a six-round clash.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="w-full max-w-xs flex flex-col gap-3">
          {isSignedIn ? (
            <Link href="/game" className="w-full min-h-14 bg-primary text-black font-display font-black text-xl italic uppercase flex items-center justify-center shadow-[0_4px_0_#854d0e] active:translate-y-1 active:shadow-none transition-all hover:bg-yellow-400" style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))' }}>
              Enter Hub
            </Link>
          ) : (
            <>
              <Link href="/sign-up" className="w-full min-h-14 bg-primary text-black font-display font-black text-xl italic uppercase flex items-center justify-center shadow-[0_4px_0_#854d0e] active:translate-y-1 active:shadow-none transition-all hover:bg-yellow-400" style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))' }}>
                Sign Up
              </Link>
              <Link href="/sign-in" className="w-full min-h-14 bg-white/5 border border-white/20 text-white font-display font-black text-xl italic uppercase flex items-center justify-center active:scale-95 transition-all hover:bg-white/10" style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))' }}>
                Sign In
              </Link>
            </>
          )}

          <div className="flex items-center gap-4 my-2">
            <div className="h-px bg-white/10 flex-1" />
            <span className="font-mono text-[9px] text-white/30 uppercase tracking-widest">Or</span>
            <div className="h-px bg-white/10 flex-1" />
          </div>

          <Link href="/play/guest" className="w-full min-h-12 border border-white/10 text-white/60 font-mono text-[10px] uppercase tracking-widest flex items-center justify-center hover:text-white hover:border-white/30 transition-all active:scale-95">
            Play Practice Fade
          </Link>
          <Link href="/how-to-play" className="py-3 text-primary text-center font-mono text-[10px] uppercase tracking-widest hover:text-yellow-200">
            How to play · The field guide →
          </Link>
          <InstallGame className="w-full" />
        </motion.div>
      </div>
    </div>
  );
}
