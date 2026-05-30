import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

interface PillNavItem {
  label: string;
  href: string;
}

interface PillNavProps {
  logo?: string;
  logoAlt?: string;
  items: PillNavItem[];
  className?: string;
  baseColor?: string;
  pillColor?: string;
  hoveredPillTextColor?: string;
  pillTextColor?: string;
  theme?: "dark" | "light";
}

export default function PillNav({
  items,
  className = "",
  baseColor,
  pillColor,
  hoveredPillTextColor,
  pillTextColor,
  theme = "dark",
}: PillNavProps) {
  const location = useLocation();
  const activeIndex = items.findIndex((i) => location.pathname === i.href);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const targetIndex = hoveredIndex ?? (activeIndex >= 0 ? activeIndex : 0);

  useEffect(() => {
    const el = itemRefs.current[targetIndex];
    if (el && listRef.current) {
      const listRect = listRef.current.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      setPillStyle({ left: rect.left - listRect.left, width: rect.width });
    }
  }, [targetIndex, items]);

  const isDark = theme === "dark";

  return (
    <div
      ref={listRef}
      className={`relative flex items-center ${className}`}
      style={{
        backgroundColor: baseColor ?? (isDark ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.12)"),
        borderRadius: 9999,
        padding: "4px",
      }}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {/* Animated pill */}
      <div
        className="absolute top-1 bottom-1 transition-all duration-300 ease-out"
        style={{
          left: pillStyle.left,
          width: pillStyle.width,
          backgroundColor: pillColor ?? (isDark ? "#e10600" : "#ffffff"),
          borderRadius: 9999,
        }}
      />
      {items.map((item, i) => {
        const isActive = location.pathname === item.href;
        const isHovered = hoveredIndex === i;
        const textColor =
          isHovered || isActive
            ? hoveredPillTextColor ?? (isDark ? "#ffffff" : "#000000")
            : pillTextColor ?? (isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)");
        return (
          <Link
            key={item.href}
            ref={(el) => { itemRefs.current[i] = el; }}
            to={item.href}
            className="relative z-10 px-5 py-2 font-heading text-sm tracking-wider uppercase whitespace-nowrap transition-colors duration-200"
            style={{ color: textColor }}
            onMouseEnter={() => setHoveredIndex(i)}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
