import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useId, type CSSProperties } from "react";
import { getAssetUrl } from "../lib/assets";
import "../styles/level-up.css";
import { useEventVoice } from "../lib/useEventVoice";

export function LevelUpMoment({
  level,
  reduced,
  onContinue,
}: {
  level: number;
  reduced: boolean;
  onContinue: () => void;
}) {
  useEventVoice("level-up", level);
  const x = useMotionValue(0),
    y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 80, damping: 24 }),
    sy = useSpring(y, { stiffness: 80, damping: 24 });
  const backX = useTransform(sx, (value) => value * -0.6),
    backY = useTransform(sy, (value) => value * -0.6);
  const id = useId().replaceAll(":", "");
  return (
    <section
      className="level-moment"
      data-reduced-motion={reduced}
      onPointerMove={(event) => {
        if (reduced || event.pointerType === "touch") return;
        const bounds = event.currentTarget.getBoundingClientRect();
        x.set(
          ((event.clientX - bounds.left - bounds.width / 2) / bounds.width) *
            22,
        );
        y.set(
          ((event.clientY - bounds.top - bounds.height / 2) / bounds.height) *
            14,
        );
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      <div className="level-moment__sun" aria-hidden="true" />
      <motion.div
        className="level-moment__rays"
        style={reduced ? undefined : { x: backX, y: backY }}
        aria-hidden="true"
      >
        <div className="level-moment__orbit level-moment__orbit--fists">
          {Array.from({ length: 10 }, (_, index) => (
            <img
              key={index}
              src={getAssetUrl("assets/progression/raised-fist.webp")}
              style={{ "--angle": `${index * 36}deg` } as CSSProperties}
              alt=""
            />
          ))}
        </div>
        <div className="level-moment__orbit level-moment__orbit--boots">
          {Array.from({ length: 8 }, (_, index) => (
            <img
              key={index}
              src={getAssetUrl("assets/progression/boot-ray-v2.webp")}
              style={{ "--angle": `${index * 45 + 22}deg` } as CSSProperties}
              alt=""
            />
          ))}
        </div>
      </motion.div>
      <div className="level-moment__grain" aria-hidden="true" />
      <motion.div
        className="level-moment__champion"
        initial={reduced ? false : { opacity: 0, scale: 1.14 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        style={reduced ? undefined : { x: sx, y: sy }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 1536 1024" role="presentation">
          <defs>
            <clipPath id={`${id}-body`}>
              <path
                d="M0 0H1536V1024H0Z M803 34V169H1114V34Z"
                clipRule="evenodd"
              />
            </clipPath>
            <clipPath id={`${id}-ties`}>
              <rect x="803" y="34" width="311" height="135" />
            </clipPath>
            <filter
              id={`${id}-wind`}
              x="-10%"
              y="-20%"
              width="120%"
              height="140%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency=".012 .03"
                numOctaves="1"
                seed="8"
                result="wind"
              >
                {!reduced && (
                  <animate
                    attributeName="baseFrequency"
                    values=".012 .03;.014 .055;.012 .03"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                )}
              </feTurbulence>
              <feDisplacementMap
                in="SourceGraphic"
                in2="wind"
                scale={reduced ? 0 : 8}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
          <image
            href={getAssetUrl("assets/progression/level-champion.webp")}
            width="1536"
            height="1024"
            clipPath={`url(#${id}-body)`}
          />
          <g filter={reduced ? undefined : `url(#${id}-wind)`}>
            <image
              href={getAssetUrl("assets/progression/level-champion.webp")}
              width="1536"
              height="1024"
              clipPath={`url(#${id}-ties)`}
            />
          </g>
        </svg>
      </motion.div>
      <div className="level-moment__type">
        <motion.span
          className="level-moment__eyebrow"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          THE BLOCK FELT THAT · LEVEL {String(level).padStart(2, "0")}
        </motion.span>
        <motion.h2
          id="reward-reveal-title"
          initial={reduced ? false : { scale: 2.2, rotate: -9, opacity: 0 }}
          animate={{ scale: 1, rotate: -4, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 240,
            damping: 18,
            delay: reduced ? 0 : 0.28,
          }}
        >
          GOOD
          <br />
          <span>MONEY</span>
          <i aria-hidden="true" />
        </motion.h2>
        <motion.p
          initial={reduced ? false : { x: -80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: reduced ? 0 : 0.7 }}
        >
          You just leveled up
          <br />
          them hands, mud!
        </motion.p>
      </div>
      <div className="level-moment__footer">
        <motion.strong
          initial={reduced ? false : { y: 30, opacity: 0, rotate: 4 }}
          animate={{ y: 0, opacity: 1, rotate: -2 }}
          transition={{ delay: reduced ? 0 : 1 }}
        >
          APPLYING PRESSURE!
        </motion.strong>
        <button autoFocus onClick={onContinue}>
          Keep applying pressure <span aria-hidden="true">↗</span>
        </button>
        <small>
          {level % 10 === 0
            ? "Milestone rewards are waiting at your Safehouse check-in."
            : `Next milestone reward: level ${Math.ceil(level / 10) * 10}`}
        </small>
      </div>
    </section>
  );
}
