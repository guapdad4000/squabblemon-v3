import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAssetUrl } from '../data';
import { Loader2 } from 'lucide-react';

export interface StoryCinematicProps {
  source: string;
  poster: string;
  title: string;
  eyebrow: string;
  onComplete?: () => void;
  onSkip?: () => void;
  duration?: number;
}

export function StoryCinematic({
  source,
  poster,
  title,
  eyebrow,
  onComplete,
  onSkip,
  duration,
}: StoryCinematicProps) {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || 
      document.documentElement.dataset.reduceMotion === 'true';
    setIsReducedMotion(isReduced);
  }, []);

  useEffect(() => {
    if (duration && duration > 0 && onComplete) {
      timerRef.current = window.setTimeout(onComplete, isReducedMotion ? 900 : duration);
    }

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [duration, isReducedMotion, onComplete]);

  const handleVideoCanPlay = () => {
    setIsVideoLoaded(true);
  };

  const handleVideoError = () => {
    setHasError(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col justify-end text-foreground overflow-hidden">
      <div className="absolute inset-0 z-0 bg-black">
        {(!isReducedMotion && !hasError) ? (
          <video
            ref={videoRef}
            src={getAssetUrl(source)}
            poster={getAssetUrl(poster)}
            autoPlay
            muted
            playsInline
            loop={!duration}
            onCanPlay={handleVideoCanPlay}
            onError={handleVideoError}
            className="w-full h-full object-cover opacity-75"
          />
        ) : (
          <img 
            src={getAssetUrl(poster)} 
            alt="" 
            className="w-full h-full object-cover opacity-75" 
          />
        )}
        
        {!isVideoLoaded && !hasError && !isReducedMotion && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/95 z-20 pointer-events-none" />
      </div>

      <div className="relative z-30 w-full p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-col gap-6 items-center text-center">
        
        <AnimatePresence mode="wait">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-2"
          >
            <div className="font-mono text-[10px] tracking-[0.25em] text-primary uppercase">
              {eyebrow}
            </div>
            <h1 className="cinematic-callout text-white">
              {title}
            </h1>
          </motion.div>
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="flex w-full max-w-sm flex-col gap-4 mt-8"
        >
          {duration ? (
            <button
              onClick={onSkip || onComplete}
              className="w-full py-4 px-6 border border-white/20 bg-black/40 backdrop-blur-md font-mono text-[11px] uppercase tracking-widest text-white/70 hover:text-white hover:bg-white/10 hover:border-white/40 transition-colors active:scale-95 flex items-center justify-center gap-2"
            >
              Skip
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="w-full py-4 px-6 bg-primary text-black font-display font-black italic uppercase text-lg hover:bg-yellow-400 active:scale-95 transition-all shadow-[0_0_20px_rgba(250,204,21,0.3)]"
            >
              Continue
            </button>
          )}
        </motion.div>
      </div>
      
      <div className="noise-overlay opacity-[0.03]" />
    </div>
  );
}
