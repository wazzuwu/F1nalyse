import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface MagicBentoProps {
  children: ReactNode;
  className?: string;
  textAutoHide?: boolean;
  enableStars?: boolean;
  enableSpotlight?: boolean;
  enableBorderGlow?: boolean;
  enableTilt?: boolean;
  enableMagnetism?: boolean;
  clickEffect?: boolean;
  spotlightRadius?: number;
  particleCount?: number;
  glowColor?: string;
  disableAnimations?: boolean;
}

function starStyle(i: number) {
  const size = Math.random() * 2 + 1;
  return {
    width: size,
    height: size,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    opacity: Math.random() * 0.6 + 0.2,
    animationDelay: `${Math.random() * 4}s`,
    animationDuration: `${2 + Math.random() * 3}s`,
  };
}

function Sparkle({ i }: { i: number }) {
  return (
    <span
      className="absolute rounded-full bg-white animate-pulse"
      style={{ ...starStyle(i) } as React.CSSProperties}
    />
  );
}

interface BentoCardProps {
  title: string;
  desc: string;
  disableAnimations?: boolean;
  onClick?: () => void;
  className?: string;
}

export function BentoCard({
  title, desc,
  disableAnimations,
  onClick,
  className = "",
}: BentoCardProps) {
  return (
    <motion.div
      onClick={onClick}
      className={`relative bg-f1-carbon/70 backdrop-blur border border-white/5 rounded-2xl overflow-hidden group min-h-[260px] ${onClick ? "cursor-pointer" : "cursor-default"} ${className}`}
      style={disableAnimations ? {} : { transformStyle: "preserve-3d" }}
    >
      {!disableAnimations && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `radial-gradient(600px circle at var(--mx, 50%) var(--my, 50%), rgba(225,6,0,0.06), transparent 50%)`,
          }}
        />
      )}
      {/* Image / chart backdrop */}
      <div className="absolute inset-0 bg-f1-black/60">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] text-white/8 font-heading tracking-widest uppercase select-none">
            Chart / Image
          </span>
        </div>
      </div>
      {/* Gradient overlay so text is readable */}
      <div className="absolute inset-0 bg-gradient-to-t from-f1-carbon/95 via-f1-carbon/60 to-transparent" />
      {/* Text overlay */}
      <div className="relative z-10 p-8 flex flex-col justify-end min-h-[260px]">
        <div className="w-8 h-0.5 bg-f1-red/50 mb-5 group-hover:w-16 transition-all" />
        <h3 className="text-xl font-heading font-700 text-white mb-2">
          {title}
        </h3>
        <p className="text-sm text-white/40 leading-relaxed max-w-md">
          {desc}
        </p>
      </div>
    </motion.div>
  );
}

export default function MagicBento({
  children,
  className = "",
  textAutoHide = true,
  enableStars = false,
  enableSpotlight = false,
  enableBorderGlow = false,
  enableTilt = false,
  enableMagnetism = false,
  clickEffect = false,
  spotlightRadius = 240,
  particleCount = 12,
  glowColor = "225, 6, 0",
  disableAnimations = false,
}: MagicBentoProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [particles] = useState(() => Array.from({ length: particleCount }, (_, i) => i));

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 200, damping: 20 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (disableAnimations) return;
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      if (enableTilt) { x.set(px - 0.5); y.set(py - 0.5); }
      if (enableSpotlight) { setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top }); }
    },
    [disableAnimations, enableTilt, enableSpotlight, x, y],
  );

  const handleMouseLeave = useCallback(() => {
    if (enableTilt) { x.set(0); y.set(0); }
  }, [enableTilt, x, y]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!clickEffect || disableAnimations) return;
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const ripple = document.createElement("span");
      ripple.className = "absolute rounded-full pointer-events-none animate-ping";
      ripple.style.width = ripple.style.height = "8px";
      ripple.style.background = `rgba(${glowColor}, 0.4)`;
      ripple.style.left = `${e.clientX - rect.left - 4}px`;
      ripple.style.top = `${e.clientY - rect.top - 4}px`;
      ref.current?.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    },
    [clickEffect, disableAnimations, glowColor],
  );

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`relative rounded-2xl ${enableBorderGlow ? "overflow-hidden" : ""} ${className}`}
      style={
        enableTilt && !disableAnimations
          ? { perspective: 800, rotateX, rotateY, transformStyle: "preserve-3d" }
          : {}
      }
    >
      {/* Border glow */}
      {enableBorderGlow && !disableAnimations && (
        <div
          className="absolute -inset-[1px] rounded-2xl opacity-50 pointer-events-none"
          style={{
            background: `conic-gradient(from 0deg at 50% 50%, rgba(${glowColor}, 0.6), transparent 30deg, transparent 330deg, rgba(${glowColor}, 0.6))`,
            animation: "spin 4s linear infinite",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            padding: "1px",
          }}
        />
      )}

      {/* Spotlight */}
      {enableSpotlight && !disableAnimations && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: `radial-gradient(${spotlightRadius}px circle at ${mousePos.x}px ${mousePos.y}px, rgba(${glowColor}, 0.08), transparent 60%)`,
          }}
        />
      )}

      {/* Stars */}
      {enableStars && !disableAnimations && particles.map((i) => <Sparkle key={i} i={i} />)}

      {/* Content */}
      <div
        className="relative z-10"
        style={
          enableMagnetism && !disableAnimations
            ? { transformStyle: "preserve-3d" }
            : {}
        }
      >
        {children}
      </div>

      {enableBorderGlow && !disableAnimations && (
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      )}
    </motion.div>
  );
}
