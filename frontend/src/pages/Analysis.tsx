import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CompareTab from "../components/CompareTab";
import TelemetryTab from "../components/TelemetryTab";
import LapsTab from "../components/LapsTab";
import PenaltyTab from "../components/PenaltyTab";

const tabs = [
  { key: "compare", label: "Compare" },
  { key: "telemetry", label: "Telemetry" },
  { key: "laps", label: "Laps" },
  { key: "penalty", label: "Penalty" },
];

export default function Analysis() {
  const [active, setActive] = useState("compare");

  return (
    <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto">
      <motion.h1
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="font-heading text-4xl tracking-tight mb-8"
      >
        Analysis
      </motion.h1>

      {/* Sticky tab bar */}
      <div className="sticky top-20 z-30 -mx-6 px-6 bg-f1-black/90 backdrop-blur-md border-b border-white/5">
        <div className="flex gap-1 py-3 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`shrink-0 px-4 md:px-5 py-2.5 font-heading text-xs md:text-sm tracking-wider uppercase transition-all rounded-xl ${
                active === t.key
                  ? "text-f1-red bg-f1-red/10 border border-f1-red/20"
                  : "text-white/40 hover:text-white hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {active === "compare" && <CompareTab />}
            {active === "telemetry" && <TelemetryTab />}
            {active === "laps" && <LapsTab />}
            {active === "penalty" && <PenaltyTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
