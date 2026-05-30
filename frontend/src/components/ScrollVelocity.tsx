import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";

interface ScrollVelocityProps {
  texts: string[];
  velocity?: number;
  className?: string;
  numCopies?: number;
  damping?: number;
  stiffness?: number;
}

export default function ScrollVelocity({
  texts,
  velocity = 100,
  className = "",
  numCopies = 6,
  damping = 50,
  stiffness = 400,
}: ScrollVelocityProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
  }, []);

  const springConfig = { damping, stiffness };
  const smoothProgress = useSpring(scrollYProgress, springConfig);

  const x = useTransform(smoothProgress, [0, 1], [0, -velocity]);

  const line = texts.join(" \u00A0\u2022\u00A0 ");

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap ${className}`}
    >
      <motion.div
        className="inline-flex"
        style={{ x }}
      >
        {Array.from({ length: numCopies }).map((_, i) => (
          <span key={i} className="px-4 text-white/10 text-7xl md:text-8xl font-heading font-800 uppercase tracking-tight select-none">
            {line}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
