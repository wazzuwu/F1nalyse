import { useState, useRef, useEffect, useCallback } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { Link } from "react-router-dom";
import { getLiveSeason, getRaceResults, getCircuits, getSeasons } from "../api/client";
import type { RaceResult, RaceResultsResponse, LiveSeasonResponse } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import f1CarImg from "../assets/f1-car.jpg";



function fmtTimedelta(raw: string | number | null | undefined): string {
  if (!raw) return "—";
  let s = String(raw).replace("0 days ", "");
  const dot = s.lastIndexOf(".");
  if (dot > 0) s = s.slice(0, dot + 4);
  if (s.startsWith("00:")) s = s.slice(3);
  return s;
}

const TEAM_COLORS: Record<string, string> = {
  red_bull: "#0625a3", ferrari: "#dc0000", mercedes: "#27f4d2",
  mclaren: "#ff8700", aston_martin: "#229971", alpine: "#ff87bc",
  williams: "#37beff", rb: "#6692ff", haas_f1_team: "#b6babd",
  kick_sauber: "#52e252", haas: "#b6babd", sauber: "#52e252",
};

const COLOR_PALETTE = [
  "#0625a3", "#1e41ff", "#27f4d2", "#ff8700",
  "#dc0000", "#52e252", "#37beff", "#ff87bc",
  "#229971", "#b6babd", "#6692ff", "#a38329",
];

function teamColor(team: string | undefined): string {
  if (!team) return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
  const key = team.toLowerCase().replace(/ /g, "_").replace(/-/g, "_");
  return TEAM_COLORS[key] || COLOR_PALETTE[Math.abs(key.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % COLOR_PALETTE.length];
}

const CAPABILITIES = [
  {
    title: "Live Season",
    desc: "Real-time standings, race results, and championship battles. Every position, every point, every round.",
    link: "/live",
    gradient: "from-f1-red/20 to-f1-red/5",
    accent: "bg-f1-red",
  },
  {
    title: "Race Analysis",
    desc: "Compare drivers, explore telemetry, break down lap times, and visualize performance lap by lap.",
    link: "/analysis",
    gradient: "from-blue-500/20 to-blue-500/5",
    accent: "bg-blue-500",
  },
  {
    title: "AI Steward",
    desc: "Penalty prediction powered by real FIA precedent data. Ask what decision the stewards would make.",
    link: "/steward",
    gradient: "from-green-500/20 to-green-500/5",
    accent: "bg-green-500",
  },
  {
    title: "Race Strategy",
    desc: "Tyre degradation, pit window optimization, and undercut/overcut analysis for any Grand Prix.",
    link: "/strategy",
    gradient: "from-purple-500/20 to-purple-500/5",
    accent: "bg-purple-500",
  },
];

export default function Home() {
  const [year, setYear] = useState(2024);
  const [circuit, setCircuit] = useState("");
  const [circuits, setCircuits] = useState<{ key: string; full_name: string }[]>([]);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [results, setResults] = useState<RaceResult[] | null>(null);
  const [fastestLap, setFastestLap] = useState<RaceResultsResponse["fastest_lap"]>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [initError, setInitError] = useState("");
  const [liveData, setLiveData] = useState<LiveSeasonResponse | null>(null);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const bgY = useTransform(smoothProgress, [0, 1], ["0%", "30%"]);
  const fgY = useTransform(smoothProgress, [0, 1], ["0%", "60%"]);
  const titleY = useTransform(smoothProgress, [0, 1], ["0%", "40%"]);
  const overlayOpacity = useTransform(smoothProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    Promise.all([
      getCircuits().then(setCircuits),
      getSeasons().then(setSeasons),
    ]).catch(() => setInitError("Failed to load. Is the backend running?"));
    getLiveSeason().then(setLiveData).catch(() => {});
  }, []);

  const loadResults = useCallback(async () => {
    if (!circuit) return;
    setLoading(true);
    setError("");
    try {
      const data = await getRaceResults(circuit, year);
      setResults(data.results.slice(0, 10));
      setFastestLap(data.fastest_lap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setResults(null);
    }
    setLoading(false);
  }, [circuit, year]);

  return (
    <div>
      {/* ─── Hero ─── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden">
        {/* Parallax layers */}
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${f1CarImg})`, y: bgY }}
        />
        <motion.div
          className="absolute inset-0 bg-gradient-to-t from-f1-red/10 via-transparent to-transparent"
          style={{ y: fgY }}
        />
        <div className="absolute inset-0 hero-overlay-right z-10" />
        {/* Floating geometric accents with parallax */}
        <motion.div
          className="absolute top-1/4 right-[15%] w-64 h-64 border border-f1-red/10 rounded-full z-10"
          style={{ y: useTransform(smoothProgress, [0, 1], ["0%", "50%"]) }}
        />
        <motion.div
          className="absolute bottom-1/3 left-[10%] w-40 h-40 border border-white/[0.03] rounded-full z-10"
          style={{ y: useTransform(smoothProgress, [0, 1], ["0%", "-30%"]) }}
        />
        <motion.div
          className="absolute inset-x-0 bottom-0 h-48 hero-overlay-bottom z-10"
          style={{ opacity: overlayOpacity }}
        />

        <div className="relative z-20 w-full max-w-7xl mx-auto px-6">
          <motion.div className="max-w-2xl" style={{ y: titleY }}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="mb-4"
            >
              <span className="text-[10px] md:text-[11px] font-heading tracking-[0.25em] text-f1-red/60 uppercase">
                AI-Powered Formula 1 Intelligence
              </span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-5xl sm:text-7xl md:text-9xl font-heading font-800 tracking-tighter leading-none"
            >
              F1<span className="text-f1-red">nalyse</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 text-base md:text-xl text-white/50 font-body leading-relaxed max-w-lg"
            >
              Race analysis, driver comparisons, telemetry deep-dives, and penalty prediction — all powered by FastF1 and AI.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="mt-10 flex flex-wrap gap-4"
            >
              <Link
                to="/live"
                className="group relative px-6 md:px-8 py-3.5 bg-f1-red text-white font-heading text-xs md:text-sm tracking-widest uppercase overflow-hidden rounded-xl"
              >
                <span className="relative z-10">Live Season &rarr;</span>
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </Link>
              <Link
                to="/analysis"
                className="group relative px-6 md:px-8 py-3.5 border border-white/20 text-white font-heading text-xs md:text-sm tracking-widest uppercase overflow-hidden rounded-xl hover:border-f1-red/50 transition-colors"
              >
                <span className="relative z-10">Explore Analysis &rarr;</span>
                <div className="absolute inset-0 bg-white/[0.03] translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── Live Stats Bar ─── */}
      {liveData && (
        <section className="max-w-7xl mx-auto px-6 -mt-16 relative z-30 mb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Championship Leader", value: liveData.driverStandings[0]?.code ?? "—", sub: liveData.driverStandings[0] ? `${liveData.driverStandings[0].points} pts` : "" },
              { label: "Last Winner", value: liveData.latestRace?.results[0]?.code ?? "—", sub: liveData.latestRace?.results[0]?.full_name ?? "" },
              { label: "Next Race", value: liveData.nextRace ? `R${liveData.nextRace.round}` : "Season Over", sub: liveData.nextRace?.event ?? "" },
              { label: "Races Complete", value: `${liveData.schedule.filter(r => new Date(r.date) < new Date()).length}`, sub: `/ ${liveData.schedule.length}` },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl px-5 py-4"
              >
                <p className="text-[10px] font-heading tracking-[0.15em] text-white/30 uppercase mb-1">{stat.label}</p>
                <p className="font-heading text-xl md:text-2xl font-700 text-white tracking-tight">
                  {stat.value}
                </p>
                {stat.sub && <p className="text-[11px] text-white/40 mt-0.5 truncate">{stat.sub}</p>}
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Capabilities Grid ─── */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center gap-3 mb-10"
        >
          <div className="w-1 h-6 bg-f1-red rounded-full" />
          <h2 className="font-heading text-sm tracking-[0.15em] uppercase text-white/50">Capabilities</h2>
        </motion.div>
        <div className="grid md:grid-cols-2 gap-4">
          {CAPABILITIES.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Link
                to={c.link}
                className="group block bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 md:p-8 hover:bg-white/[0.05] transition-all duration-300 h-full"
              >
                <div className="flex items-start gap-5">
                  <div className={`w-10 h-10 rounded-xl ${c.accent} flex items-center justify-center flex-shrink-0 mt-1`}>
                    <div className="w-5 h-5 bg-white/20 rounded" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-heading text-lg font-700 text-white group-hover:text-f1-red transition-colors">
                        {c.title}
                      </h3>
                      <span className="text-white/20 group-hover:text-f1-red transition-colors text-lg">&rarr;</span>
                    </div>
                    <p className="text-sm text-white/40 leading-relaxed mt-2">{c.desc}</p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Race Explorer ─── */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center gap-3 mb-10"
        >
          <div className="w-1 h-6 bg-f1-red rounded-full" />
          <h2 className="font-heading text-sm tracking-[0.15em] uppercase text-white/50">Race Explorer</h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 md:p-8"
        >
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4 mb-8">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-8 text-sm text-white/80 font-heading outline-none focus:border-f1-red/50 transition cursor-pointer w-full sm:w-auto"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='white' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
            >
              {seasons.map((s) => <option key={s} value={s} className="bg-f1-carbon text-white">{s}</option>)}
            </select>
            <select
              value={circuit}
              onChange={(e) => setCircuit(e.target.value)}
              className="appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-8 text-sm text-white/80 font-heading outline-none focus:border-f1-red/50 transition cursor-pointer flex-1 min-w-0 w-full sm:w-auto"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='white' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
            >
              <option value="" className="bg-f1-carbon text-white">Select circuit</option>
              {circuits.map((c) => <option key={c.key} value={c.key} className="bg-f1-carbon text-white">{c.full_name}</option>)}
            </select>
            <button
              onClick={loadResults}
              className="w-full sm:w-auto px-6 py-2.5 bg-f1-red text-white font-heading text-sm tracking-wider uppercase rounded-xl hover:bg-f1-red/80 transition-all active:scale-95"
            >
              Load
            </button>
          </div>

          {initError && <p className="text-f1-red text-sm mb-4">{initError}</p>}
          {error && <p className="text-f1-red text-sm mb-4">{error}</p>}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner />
            </div>
          )}

          {results && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-white/30 font-heading text-[10px] tracking-wider uppercase">
                      <th className="text-left py-3.5 px-4 w-12">Pos</th>
                      <th className="text-left py-3.5 px-4">Driver</th>
                      <th className="text-left py-3.5 px-4 hidden sm:table-cell">Team</th>
                      <th className="text-center py-3.5 px-4 hidden md:table-cell">Grid</th>
                      <th className="text-center py-3.5 px-4 hidden md:table-cell">+/–</th>
                      <th className="text-right py-3.5 px-4">Time</th>
                      <th className="text-center py-3.5 px-4 w-20">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => {
                      const dnfd = r.status !== "Finished";
                      const gained = r.positions_gained ?? null;
                      const isFl = fastestLap?.code === r.code;
                      return (
                        <motion.tr
                          key={r.code}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className={`border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition ${dnfd ? "opacity-50" : ""}`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-1 h-6 rounded-full flex-shrink-0"
                                style={{ backgroundColor: i < 3 ? ["#e8002d", "#a0a0a0", "#8B6914"][i] : "transparent" }}
                              />
                              <span className="font-heading text-base font-800">
                                {r.position}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <Link to={`/driver/${r.code}`} className="flex items-center gap-2.5 group">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: teamColor(r.team) }} />
                              <span className={`font-heading font-700 text-sm ${dnfd ? "" : "group-hover:text-f1-red"} transition-colors`}>{r.code}</span>
                              <span className="text-white/40 text-xs hidden sm:inline">{r.full_name}</span>
                              {isFl && <span className="text-[9px] px-1.5 py-0.5 rounded bg-f1-red/15 text-f1-red font-heading font-700 tracking-wider">FL</span>}
                            </Link>
                          </td>
                          <td className="py-3.5 px-4 text-white/40 text-xs hidden sm:table-cell">{r.team}</td>
                          <td className="py-3.5 px-4 text-center text-white/40 text-xs hidden md:table-cell font-heading">
                            {r.grid ?? "—"}
                          </td>
                          <td className="py-3.5 px-4 text-center hidden md:table-cell">
                            {gained !== null && gained !== 0 && (
                              <span className={`text-xs font-heading font-600 ${gained > 0 ? "text-green-400" : "text-f1-red"}`}>
                                {gained > 0 ? "+" : ""}{gained}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-xs text-white/50">
                            {r.time ? fmtTimedelta(r.time) : "—"}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {dnfd ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-f1-red/10 text-f1-red font-heading font-700 uppercase tracking-wider">DNF</span>
                            ) : (
                              <span className="text-[10px] text-green-400/60 font-heading">Finished</span>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {fastestLap && (
                <div className="mt-5 pt-4 border-t border-white/[0.04] flex items-center gap-2 text-xs text-white/40">
                  <span className="text-f1-red font-600 text-[10px] bg-f1-red/10 px-1.5 py-0.5 rounded">FL</span>
                  <span className="font-600 text-white/60">{fastestLap.code}</span>
                  <span>L{fastestLap.lap}</span>
                  <span className="font-mono text-white/30">{fmtTimedelta(fastestLap.time)}</span>
                </div>
              )}
            </motion.div>
          )}

          {!results && !loading && !error && !initError && (
            <div className="flex flex-col items-center justify-center py-16 text-white/20">
              <p className="font-heading text-sm">Select a circuit and year, then click Load</p>
              <p className="text-xs mt-1">Race results will appear here</p>
            </div>
          )}
        </motion.div>
      </section>
    </div>
  );
}
