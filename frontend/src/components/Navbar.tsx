import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import PillNav from "./PillNav";

const links = [
  { to: "/", label: "Home" },
  { to: "/live", label: "Live Season" },
  { to: "/analysis", label: "Analysis" },
  { to: "/strategy", label: "Race Strategy" },
  { to: "/steward", label: "AI Steward" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > 60);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-f1-black/80 backdrop-blur-lg border-b border-f1-red/20"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="font-heading text-3xl md:text-4xl font-800 tracking-widest text-white">
          F1<span className="text-f1-red">nalyse</span>
        </Link>

        {/* Desktop pill nav */}
        <div className="hidden md:block">
          <PillNav
            items={links.map((l) => ({ label: l.label, href: l.to }))}
          />
        </div>

        {/* Hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          <span
            className={`block h-0.5 w-7 bg-white transition-all ${mobileOpen ? "rotate-45 translate-y-2" : ""}`}
          />
          <span
            className={`block h-0.5 w-7 bg-white transition-all ${mobileOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`block h-0.5 w-7 bg-white transition-all ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden bg-f1-black/95 backdrop-blur-lg border-t border-f1-red/20 overflow-hidden"
          >
            {links.map((l, i) => (
              <motion.div
                key={l.to}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={l.to}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-6 py-4 font-heading text-lg tracking-wider uppercase border-b border-white/5 ${
                    location.pathname === l.to ? "text-f1-red" : "text-white/70"
                  }`}
                >
                  {l.label}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
