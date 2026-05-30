import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDrivers, getCircuits, getSeasons, postPositionChanges, postTeamPace, postTyreStrategies, postQualifying } from "../api/client";
import type { PositionChangesResponse, TeamPaceResponse, TyreStrategiesResponse, QualifyingResponse } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import PlotlyChart from "../components/PlotlyChart";
import MagicBento, { BentoCard } from "../components/MagicBento";
import CurvedLoop from "../components/CurvedLoop";
import raceImg from "../assets/race.jpg";

const sessionOptions = [
  { value: "R", label: "Race" },
  { value: "Q", label: "Qualifying" },
  { value: "S", label: "Sprint" },
  { value: "SQ", label: "Sprint Qualifying" },
  { value: "SS", label: "Sprint Shootout" },
  { value: "FP1", label: "Free Practice 1" },
  { value: "FP2", label: "Free Practice 2" },
  { value: "FP3", label: "Free Practice 3" },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

function SelectField({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <div className="min-w-[140px]">
      <label className="block text-[10px] text-white/40 font-heading tracking-wider mb-1.5 uppercase">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-f1-black/80 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-f1-red/50 focus:ring-1 focus:ring-f1-red/20 transition-all appearance-none cursor-pointer"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export default function RaceStrategy() {
  const [year, setYear] = useState(2025);
  const [circuit, setCircuit] = useState("");
  const [session, setSession] = useState("R");
  const [driver, setDriver] = useState("");
  const [seasons, setSeasons] = useState<number[]>([]);
  const [circuitOptions, setCircuitOptions] = useState<{ key: string; full_name: string }[]>([]);
  const [driverOptions, setDriverOptions] = useState<{ code: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [positionData, setPositionData] = useState<PositionChangesResponse | null>(null);
  const [teamPaceData, setTeamPaceData] = useState<TeamPaceResponse | null>(null);
  const [tyreData, setTyreData] = useState<TyreStrategiesResponse | null>(null);
  const [qualifyingData, setQualifyingData] = useState<QualifyingResponse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"position" | "pace" | "tyre" | "qualifying" | null>(null);

  useEffect(() => {
    Promise.all([
      getSeasons().then(setSeasons),
      getCircuits().then(setCircuitOptions),
    ]);
  }, []);

  useEffect(() => {
    getDrivers(year).then(setDriverOptions);
  }, [year]);

  const load = async () => {
    if (!circuit) return;
    setLoading(true);
    setLoaded(false);
    setPositionData(null);
    setTeamPaceData(null);
    setTyreData(null);
    setQualifyingData(null);
    const opts = { circuit, year, session, driver: driver || undefined };
    await Promise.allSettled([
      postPositionChanges(opts).then(setPositionData),
      postTeamPace(opts).then(setTeamPaceData),
      postTyreStrategies(opts).then(setTyreData),
      postQualifying(opts).then(setQualifyingData),
    ]);
    setLoading(false);
    setLoaded(true);
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-28 pb-12 px-4 overflow-hidden min-h-[420px]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${raceImg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-f1-black/70 via-f1-black/50 to-f1-black z-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-f1-red/5 via-transparent to-transparent pointer-events-none z-20" />
        <div className="max-w-6xl mx-auto text-center relative z-30">
          <motion.h1 variants={item} className="text-4xl md:text-5xl font-heading font-800 tracking-tight mb-3">
            Race <span className="text-f1-red">Strategy</span>
          </motion.h1>
          <motion.p variants={item} className="text-white/40 text-base max-w-xl mx-auto">
            Pit windows, tyre degradation, undercuts, and optimal race plans.
          </motion.p>
          <motion.div variants={item} className="mt-10">
            <CurvedLoop
              marqueeText="Race Strategy | Pit Windows | Tyre Degradation | Undercuts"
              speed={6}
              curveAmount={120}
              direction="right"
              interactive={false}
            />
          </motion.div>
        </div>
      </section>

      {/* Filters */}
      <section className="max-w-6xl mx-auto px-4 mb-8">
        <motion.div variants={item} className="bg-gradient-to-br from-f1-carbon to-black border border-white/5 rounded-2xl p-6 shadow-lg">
          <div className="flex flex-wrap gap-4">
            <SelectField label="Year" value={String(year)} onChange={(v) => setYear(Number(v))} options={seasons.map((s) => ({ value: String(s), label: String(s) }))} />
            <SelectField label="Circuit" value={circuit} onChange={setCircuit} options={circuitOptions.map((c) => ({ value: c.key, label: c.full_name }))} placeholder="Select circuit" />
            <SelectField label="Session" value={session} onChange={setSession} options={sessionOptions} />
            <SelectField label="Driver" value={driver} onChange={setDriver} options={driverOptions.map((d) => ({ value: d.code, label: `${d.code} \u2014 ${d.full_name}` }))} placeholder="All drivers" />
            <div className="flex items-end">
              <button
                onClick={load}
                disabled={loading || !circuit}
                className="px-6 py-2.5 bg-gradient-to-r from-f1-red to-red-700 text-white font-heading text-sm tracking-wider uppercase rounded-xl disabled:opacity-30 hover:scale-[1.02] hover:shadow-lg hover:shadow-f1-red/20 transition-all"
              >
                {loading ? "Loading..." : "Analyse"}
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {loading && (
        <section className="max-w-6xl mx-auto px-4">
          <LoadingSpinner />
        </section>
      )}

      {/* Bento grid */}
      {loaded && !loading && (
        <section className="max-w-6xl mx-auto px-4 pb-32">
          <MagicBento
            enableStars
            enableSpotlight
            enableBorderGlow={true}
            enableTilt={false}
            enableMagnetism={false}
            clickEffect={false}
            spotlightRadius={240}
            particleCount={12}
            glowColor="225, 6, 0"
            disableAnimations={false}
          >
            <div className="grid md:grid-cols-2 gap-6">
              <BentoCard
                title="Position Changes"
                desc="Lap-by-lap position gains and losses across the field."
                onClick={() => { if (positionData?.chart) { setModalType("position"); setModalOpen(true); } }}
                className={positionData?.chart ? "cursor-pointer" : ""}
              />
              <BentoCard
                title="Team Pace Comparison"
                desc="Head-to-head pace, median lap times, and consistency scores."
                onClick={() => { if (teamPaceData?.chart) { setModalType("pace"); setModalOpen(true); } }}
                className={teamPaceData?.chart ? "cursor-pointer" : ""}
              />
              <BentoCard
                title="Tyre Strategies"
                desc="Stint lengths, compound deltas, degradation curves, and pit windows."
                onClick={() => { if (tyreData?.chart) { setModalType("tyre"); setModalOpen(true); } }}
                className={tyreData?.chart ? "cursor-pointer" : ""}
              />
              <BentoCard
                title="Post Qualifying"
                desc="Qualifying gaps, sector analysis, and grid predictions."
                onClick={() => { if (qualifyingData?.chart) { setModalType("qualifying"); setModalOpen(true); } }}
                className={qualifyingData?.chart ? "cursor-pointer" : ""}
              />
            </div>
          </MagicBento>
        </section>
      )}

      {/* Initial state hint */}
      {!loaded && !loading && (
        <section className="max-w-6xl mx-auto px-4 pb-32">
          <motion.div variants={item} className="text-center py-20">
            <p className="text-white/20 text-sm font-heading tracking-widest uppercase">Select a circuit and press Analyse</p>
          </motion.div>
        </section>
      )}

      {/* Floating modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-5xl bg-f1-carbon border border-white/10 rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <h2 className="text-lg font-heading font-700 text-white">
                  {modalType === "position" ? "Position Changes" : modalType === "pace" ? "Team Pace Comparison" : modalType === "tyre" ? "Tyre Strategies" : "Post Qualifying"}
                </h2>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-white/30 hover:text-white/70 transition-colors text-xl leading-none"
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>
              <div className="p-4" style={{ height: "500px" }}>
                {modalType === "position" && positionData?.chart && <PlotlyChart chart={positionData.chart} />}
                {modalType === "pace" && teamPaceData?.chart && <PlotlyChart chart={teamPaceData.chart} />}
                {modalType === "tyre" && tyreData?.chart && <PlotlyChart chart={tyreData.chart} />}
                {modalType === "qualifying" && qualifyingData?.chart && <PlotlyChart chart={qualifyingData.chart} />}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
