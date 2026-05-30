import { useRef, useState, useEffect, useCallback } from "react";

interface CurvedLoopProps {
  marqueeText?: string;
  speed?: number;
  curveAmount?: number;
  direction?: "left" | "right";
  interactive?: boolean;
  className?: string;
}

export default function CurvedLoop({
  marqueeText = "Race Strategy \u2726",
  speed = 2,
  curveAmount = 200,
  direction = "right",
  interactive = false,
  className = "",
}: CurvedLoopProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [offset, setOffset] = useState(0);
  const textRef = useRef<SVGTextElement>(null);
  const [textLen, setTextLen] = useState(1);

  const vw = 1440;
  const vh = 260;
  const pathY = vh / 2;
  const cpY = pathY - curveAmount;
  const pathD = `M -40,${pathY} Q ${vw / 2},${cpY} ${vw + 40},${pathY}`;

  useEffect(() => {
    if (textRef.current) {
      const len = textRef.current.getComputedTextLength();
      if (len > 0) setTextLen(len);
    }
  }, [marqueeText]);

  const dir = direction === "right" ? -1 : 1;

  const animate = useCallback(() => {
    setOffset((prev) => {
      const next = prev + speed * dir;
      const total = textLen;
      return ((next % total) + total) % total;
    });
  }, [speed, dir, textLen]);

  useEffect(() => {
    const id = setInterval(animate, 1000 / 60);
    return () => clearInterval(id);
  }, [animate]);

  const [mouseX, setMouseX] = useState(0.5);
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!interactive || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      setMouseX((e.clientX - rect.left) / rect.width);
    },
    [interactive],
  );
  const handleMouseLeave = useCallback(() => setMouseX(0.5), []);

  const interactiveOffset = interactive ? (mouseX - 0.5) * textLen * 0.4 : 0;

  return (
    <div
      className={`overflow-hidden ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${vw} ${vh}`}
        className="w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <path id="curve-path" d={pathD} />
        </defs>
        <text
          ref={textRef}
          className="fill-white/10 text-[32px] md:text-[40px] font-heading font-800 uppercase tracking-widest select-none"
        >
          <textPath
            href="#curve-path"
            startOffset={`${-(offset + interactiveOffset)}`}
          >
            {` ${marqueeText}  \u2022  `.repeat(10)}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
