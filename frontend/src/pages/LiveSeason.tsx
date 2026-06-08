import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getLiveSeason } from "../api/client";
import type { Standing, RaceResultsResponse, ScheduleRace, RaceResult, NextRaceResponse, SessionSchedule, LiveSeasonResponse } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";

const TEAM_COLORS: Record<string, string> = {
  red_bull:           "#1e41ff",
  ferrari:            "#dc0000",
  mercedes:           "#27f4d2",
  mclaren:            "#ff8700",
  aston_martin:       "#229971",
  alpine:             "#ff87bc",
  williams:           "#37beff",
  racing_bulls:       "#6692ff",
  haas_f1_team:       "#b6babd",
  kick_sauber:        "#52e252",
  rb:                 "#6692ff",
  alpine_f1_team:     "#ff87bc",
  mclaren_f1_team:    "#ff8700",
  red_bull_racing:    "#1e41ff",
  aston_martin_aramco:"#229971",
  haas:               "#b6babd",
  sauber:             "#52e252",
  mercedes_amg:       "#27f4d2",
  williams_racing:    "#37beff",
  rb_f1_team:         "#6692ff",
  vcarb:              "#6692ff",
};

const COLOR_PALETTE = [
  "#e8002d", "#1e41ff", "#27f4d2", "#ff8700",
  "#dc0000", "#52e252", "#37beff", "#ff87bc",
  "#229971", "#b6babd", "#6692ff", "#a38329",
];

function teamColor(team: string | undefined): string {
  if (!team) return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
  const key = team.toLowerCase().replace(/ /g, "_").replace(/-/g, "_");
  return TEAM_COLORS[key] || COLOR_PALETTE[Math.abs(key.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % COLOR_PALETTE.length];
}

function fmtTimedelta(raw: string | null | undefined): string {
  if (!raw) return "—";
  let s = raw.replace("0 days ", "");
  const dot = s.lastIndexOf(".");
  if (dot > 0) s = s.slice(0, dot + 4);
  if (s.startsWith("00:")) s = s.slice(3);
  return s;
}

interface PositionChangeProps { current: number; previous?: number }
function PosChange({ current, previous }: PositionChangeProps) {
  if (!previous || previous === current) return null;
  const diff = previous - current;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-heading font-600 ${diff > 0 ? "text-green-400" : "text-red-400"}`}>
      <span>{diff > 0 ? "▲" : "▼"}</span>
      <span>{Math.abs(diff)}</span>
    </span>
  );
}

function PointsBar({ points, maxPoints, color }: { points: number; maxPoints: number; color: string }) {
  const pct = maxPoints > 0 ? Math.max(3, (points / maxPoints) * 100) : 3;
  return (
    <div className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: `${pct}%` }}>
      <div className="h-full w-full rounded transition-all duration-700" style={{ background: `linear-gradient(90deg, ${color}22, ${color}08)` }} />
    </div>
  );
}

const STATUS_MAP: Record<string, string> = {
  Finished: "Finished",
  Collision: "DNF",
  DNF: "DNF",
  DNS: "DNS",
  DSQ: "DSQ",
  Retired: "DNF",
  Suspension: "DNF",
  Engine: "DNF",
  Gearbox: "DNF",
  Hydraulics: "DNF",
  Electrical: "DNF",
  Wheel: "DNF",
  Brakes: "DNF",
  "Power loss": "DNF",
  Overheating: "DNF",
  Spun: "DNF",
  Accident: "DNF",
  Tyre: "DNF",
  Damage: "DNF",
  "Fuel pressure": "DNF",
  "Water pressure": "DNF",
  "Oil pressure": "DNF",
  "Oil leak": "DNF",
  "Vibrations": "DNF",
  "Withdrew": "DNS",
  Excluded: "DSQ",
};

function resultStatus(r: RaceResult): string {
  if (r.status === "Finished") return "";
  return STATUS_MAP[r.status] || r.status || "";
}

/* ─── CountdownTimer ─── */
function formatDuration(totalSec: number): { d: number; h: number; m: number; s: number } {
  if (totalSec <= 0) return { d: 0, h: 0, m: 0, s: 0 };
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  return { d, h, m, s };
}

function CountdownTimer({ targetSeconds }: { targetSeconds: number }) {
  const [now, setNow] = useState(Date.now());
  const startRef = useRef(Date.now());
  const targetMs = startRef.current + targetSeconds * 1000;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, Math.floor((targetMs - now) / 1000));
  const { d, h, m, s } = formatDuration(remaining);

  if (remaining <= 0) {
    return <span className="font-heading text-f1-red text-sm">LIVE</span>;
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex items-center gap-2">
      {d > 0 && (
        <div className="flex items-baseline gap-0.5">
          <span className="font-heading text-2xl md:text-3xl font-800 text-white tabular-nums">{d}</span>
          <span className="text-[10px] text-white/40 uppercase font-heading tracking-wider">d</span>
        </div>
      )}
      <div className="flex items-baseline gap-0.5">
        <span className="font-heading text-2xl md:text-3xl font-800 text-white tabular-nums">{pad(h)}</span>
        <span className="text-[10px] text-white/40 uppercase font-heading tracking-wider">h</span>
      </div>
      <span className="text-white/20 text-xl">:</span>
      <div className="flex items-baseline gap-0.5">
        <span className="font-heading text-2xl md:text-3xl font-800 text-white tabular-nums">{pad(m)}</span>
        <span className="text-[10px] text-white/40 uppercase font-heading tracking-wider">m</span>
      </div>
      <span className="text-white/20 text-xl">:</span>
      <div className="flex items-baseline gap-0.5">
        <span className="font-heading text-2xl md:text-3xl font-800 text-f1-red tabular-nums">{pad(s)}</span>
        <span className="text-[10px] text-white/40 uppercase font-heading tracking-wider">s</span>
      </div>
    </div>
  );
}

/* ─── SessionTimeline ─── */
function SessionTimeline({ sessions, nextSessionName }: { sessions: NextRaceResponse["sessions"]; nextSessionName: string | null }) {
  return (
    <div className="space-y-1.5">
      {sessions.map((s, i) => {
        const dt = new Date(s.timestamp);
        const isNext = s.name === nextSessionName;
        const isPast = s.seconds_until <= 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-0.5">
              <div className={`w-2 h-2 rounded-full ${isNext ? "bg-f1-red shadow-[0_0_8px_rgba(232,0,45,0.6)]" : isPast ? "bg-green-400/50" : "bg-white/20"}`} />
              {i < sessions.length - 1 && <div className={`w-px h-4 ${isPast ? "bg-green-400/20" : "bg-white/[0.06]"}`} />}
            </div>
            <div className={`flex-1 flex items-center justify-between py-0.5 ${isNext ? "" : ""}`}>
              <div className="flex items-center gap-2">
                <span className={`font-heading text-xs font-600 ${isNext ? "text-white font-700" : isPast ? "text-white/40" : "text-white/50"}`}>
                  {s.name}
                </span>
                {isNext && (
                  <span className="text-[8px] font-heading tracking-[0.2em] uppercase text-f1-red bg-f1-red/10 px-2 py-0.5 rounded-full">Next</span>
                )}
                {isPast && (
                  <span className="text-[8px] font-heading tracking-[0.2em] uppercase text-green-400/50 bg-green-400/10 px-2 py-0.5 rounded-full">Done</span>
                )}
              </div>
              <span className={`font-heading text-[10px] font-mono ${isNext ? "text-white/60" : "text-white/20"}`}>
                {dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                {dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Session badge for calendar ─── */
const SESSION_SHORT: Record<string, string> = {
  "Practice 1": "FP1",
  "Practice 2": "FP2",
  "Practice 3": "FP3",
  "Qualifying": "Q",
  "Sprint Qualifying": "SQ",
  "Sprint": "Sprint",
  "Race": "Race",
};

/* ─── Main component ─── */
export default function LiveSeason() {
  const [dataYear, setDataYear] = useState(2026);
  const [driverStandings, setDriverStandings] = useState<Standing[]>([]);
  const [constructorStandings, setConstructorStandings] = useState<Standing[]>([]);
  const [allDriverStandings, setAllDriverStandings] = useState<Standing[]>([]);
  const [latestRace, setLatestRace] = useState<RaceResultsResponse | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRace[]>([]);
  const [nextRaceData, setNextRaceData] = useState<NextRaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const data = await getLiveSeason(isRefresh);
      setDataYear(data.year);
      setAllDriverStandings(data.driverStandings);
      setDriverStandings(data.driverStandings.slice(0, 10));
      setConstructorStandings(data.constructorStandings.slice(0, 5));
      setSchedule(data.schedule);
      setNextRaceData(data.nextRace);
      setLatestRace(data.latestRace);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const completed = schedule.filter(r => {
    const d = new Date(r.date);
    return d < new Date();
  });

  const nextRace = schedule.find(r => {
    const d = new Date(r.date);
    return d >= new Date();
  });

  const maxPoints = Math.max(...allDriverStandings.map(s => s.points), 1);

  return (
    <div className="pt-20">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-f1-red/5 via-transparent to-f1-black/80" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-f1-red/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-10">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-heading tracking-[0.25em] text-f1-red/70 uppercase">FIA Formula One World Championship</span>
                <h1 className="font-heading text-5xl md:text-7xl font-800 tracking-tighter text-white mt-1 leading-none">
                  {dataYear} Season
                </h1>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => load(true)}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 hover:text-white transition-all duration-200 disabled:opacity-50"
                >
                  <motion.span animate={refreshing ? { rotate: 360 } : {}} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    &#x21bb;
                  </motion.span>
                  Refresh
                </button>
              </div>
            </div>

            {/* Next Race Countdown */}
            {nextRaceData && !nextRaceData.season_over && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-3xl px-6 md:px-8 py-5 mb-6"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                  <div className="flex-shrink-0">
                    <p className="text-[9px] font-heading tracking-[0.2em] uppercase text-white/30 mb-1">
                      {nextRaceData.next_session
                        ? <span>{nextRaceData.next_session.name} <span className="text-white/20">·</span> R{nextRaceData.round}</span>
                        : <span>Next Race <span className="text-white/20">·</span> R{nextRaceData.round}</span>
                      }
                    </p>
                    <p className="font-heading text-lg md:text-xl font-700 text-white">{nextRaceData.event}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {new Date(nextRaceData.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex-1" />
                  <div className="flex-shrink-0">
                    <CountdownTimer targetSeconds={nextRaceData.next_session?.seconds_until ?? nextRaceData.countdown_seconds} />
                  </div>
                </div>

                {/* Mini session timeline */}
                <div className="mt-5 pt-4 border-t border-white/[0.06]">
                  <SessionTimeline sessions={nextRaceData.sessions} nextSessionName={nextRaceData.next_session?.name ?? null} />
                </div>
              </motion.div>
            )}

            {/* Season Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Races Completed", value: completed.length.toString(), total: schedule.length.toString() },
                { label: "Next Race", value: nextRace ? `R${nextRace.round}` : "Season Over", sub: nextRace?.event ?? "" },
                { label: "Last Winner", value: latestRace ? latestRace.results[0]?.code ?? "—" : "—", sub: latestRace ? latestRace.results[0]?.full_name ?? "" : "" },
                { label: "Championship Leader", value: driverStandings[0]?.code ?? "—", sub: driverStandings[0] ? `${driverStandings[0].points} pts` : "" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl px-5 py-4"
                >
                  <p className="text-[10px] font-heading tracking-[0.15em] text-white/30 uppercase mb-1">{stat.label}</p>
                  <p className="font-heading text-xl md:text-2xl font-700 text-white tracking-tight">
                    {stat.value}
                    {"total" in stat ? <span className="text-white/20 text-base font-400"> / {stat.total}</span> : null}
                  </p>
                  {stat.sub && <p className="text-[11px] text-white/40 mt-0.5 truncate">{stat.sub}</p>}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {error && <div className="max-w-7xl mx-auto px-6 mt-6"><ErrorBanner message={error} onDismiss={() => setError("")} /></div>}

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <LoadingSpinner text={`Loading ${dataYear} season data...`} />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-6 pb-24">
          <div className="grid xl:grid-cols-12 gap-6 mt-8">
            {/* ─── Left: Standings ─── */}
            <div className="xl:col-span-5 space-y-6">
              {/* Driver Standings */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-3xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-5 bg-f1-red rounded-full" />
                    <h2 className="font-heading text-sm tracking-[0.15em] uppercase text-white/70">Driver Standings</h2>
                  </div>
                  {allDriverStandings.length > 10 && (
                    <button onClick={() => setShowAll(!showAll)} className="text-[10px] font-heading tracking-wider uppercase text-f1-red/70 hover:text-f1-red transition">
                      {showAll ? "Show Top 10" : `Show All ${allDriverStandings.length}`}
                    </button>
                  )}
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {(showAll ? allDriverStandings : driverStandings).map((s, i, arr) => (
                    <motion.div
                      key={s.code}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.025 }}
                      className="relative flex items-center gap-3 px-6 py-3 hover:bg-white/[0.02] transition cursor-default group"
                    >
                      <PointsBar points={s.points} maxPoints={maxPoints} color={teamColor(s.team)} />
                      <span className={`relative z-10 font-heading text-sm w-6 text-center font-700 ${i === 0 ? "text-f1-red" : i < 3 ? "text-white/80" : "text-white/40"}`}>
                        {s.position}
                      </span>
                      <span className="relative z-10 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: teamColor(s.team) }} />
                      <div className="relative z-10 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-sm font-600 text-white truncate">{s.code}</span>
                          <span className="text-[11px] text-white/40 truncate hidden sm:inline">{s.full_name}</span>
                          <PosChange current={s.position} previous={i > 0 ? arr[i - 1]?.position : undefined} />
                        </div>
                      </div>
                      <div className="relative z-10 flex items-center gap-3 flex-shrink-0">
                        <span className="font-heading text-sm font-700 text-white/90">{s.points} <span className="text-[10px] font-400 text-white/30">pts</span></span>
                        <span className="text-[10px] font-heading text-white/30 w-6 text-right">{s.wins} {s.wins === 1 ? "win" : "wins"}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Constructor Standings */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-3xl overflow-hidden"
              >
                <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06]">
                  <div className="w-1 h-5 bg-[#27f4d2] rounded-full" />
                  <h2 className="font-heading text-sm tracking-[0.15em] uppercase text-white/70">Constructor Standings</h2>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {constructorStandings.map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="relative flex items-center gap-3 px-6 py-3.5 hover:bg-white/[0.02] transition cursor-default group"
                    >
                      <PointsBar points={s.points} maxPoints={maxPoints} color={teamColor(s.full_name)} />
                      <span className={`relative z-10 font-heading text-sm w-6 text-center font-700 ${i === 0 ? "text-f1-red" : "text-white/40"}`}>
                        {s.position}
                      </span>
                      <div className="relative z-10 flex items-center gap-3 flex-1 min-w-0">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: teamColor(s.full_name) }} />
                        <span className="font-heading text-sm font-600 text-white truncate">{s.full_name}</span>
                      </div>
                      <div className="relative z-10 flex items-center gap-3 flex-shrink-0">
                        <span className="font-heading text-sm font-700 text-white/90">{s.points} <span className="text-[10px] font-400 text-white/30">pts</span></span>
                        <span className="text-[10px] font-heading text-white/30 w-6 text-right">{s.wins} {s.wins === 1 ? "win" : "wins"}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* ─── Right: Latest Race + Calendar ─── */}
            <div className="xl:col-span-7 space-y-6">
              {/* Latest Race */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-3xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-5 bg-f1-red rounded-full" />
                    <h2 className="font-heading text-sm tracking-[0.15em] uppercase text-white/70">Latest Race</h2>
                  </div>
                  {latestRace && schedule.find(r => r.circuit_key === latestRace.circuit) && (
                    <span className="text-xs font-heading text-white/40">
                      {schedule.find(r => r.circuit_key === latestRace.circuit)?.event}
                    </span>
                  )}
                </div>

                <AnimatePresence mode="wait">
                  {latestRace ? (
                    <motion.div key="race" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
                      {/* Podium */}
                      <div className="flex items-end justify-center gap-4 mb-8 h-32">
                        {[1, 0, 2].map((idx) => {
                          const r = latestRace.results[idx];
                          if (!r) return null;
                          const heights = ["h-28", "h-20", "h-24"];
                          const medals = ["P1", "P2", "P3"];
                          return (
                            <motion.div
                              key={r.code}
                              initial={{ opacity: 0, y: 40 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.15 + idx * 0.1, type: "spring", stiffness: 120 }}
                              className="flex flex-col items-center gap-2"
                            >
                              <span className="font-heading text-xs font-700 text-white/50">{r.full_name?.split(" ").pop()}</span>
                              <div className={`${heights[idx]} w-20 md:w-24 flex flex-col items-center justify-end rounded-t-2xl border border-white/[0.06] ${idx === 0 ? "bg-f1-red/20 border-f1-red/30" : idx === 1 ? "bg-white/[0.04]" : "bg-white/[0.03]"}`}
                                style={{ background: idx === 0 ? "linear-gradient(180deg, rgba(232,0,45,0.3) 0%, rgba(232,0,45,0.05) 100%)" : undefined }}
                              >
                                <span className={`font-heading text-lg font-800 ${idx === 0 ? "text-f1-red" : "text-white/50"}`}>{r.code}</span>
                                <span className="text-[9px] font-heading tracking-wider text-white/30 uppercase mb-2">{medals[idx]}</span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* Full results table */}
                      <div className="space-y-0.5">
                        {latestRace.results.slice(0, 10).map((r, i) => {
                          const status = resultStatus(r);
                          return (
                            <motion.div
                              key={r.code}
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.3 + i * 0.03 }}
                              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.03] transition group"
                            >
                              <span className="font-heading text-sm w-6 text-center font-600 text-white/30">{r.position}</span>
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: teamColor(r.team) }} />
                              <span className="font-heading text-sm font-600 text-white/80 w-8">{r.code}</span>
                              <span className="text-xs text-white/40 flex-1 truncate hidden md:inline">{r.full_name}</span>
                              <span className="text-[10px] text-white/25 flex-1 truncate hidden sm:inline md:hidden">{r.team}</span>
                              <span className="text-[11px] text-white/25 w-16 text-right hidden sm:inline">{r.grid ? `P${r.grid}` : ""}</span>
                              {status ? (
                                <span className="text-[10px] font-heading font-700 text-red-400/80 uppercase tracking-wider w-10 text-right">{status}</span>
                              ) : (
                                <span className="text-[10px] font-heading text-white/30 w-10 text-right">{r.laps} L</span>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>

                      {latestRace.fastest_lap && (
                        <div className="mt-4 pt-4 border-t border-white/[0.04] flex items-center gap-2 text-xs text-white/40">
                          <span className="text-f1-red font-600">FL</span>
                          <span className="font-600 text-white/60">{latestRace.fastest_lap.code}</span>
                          <span>L{latestRace.fastest_lap.lap}</span>
                          <span className="font-mono text-white/30">{fmtTimedelta(latestRace.fastest_lap.time)}</span>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-white/30">
                      <p className="font-heading text-sm">No race results available yet</p>
                      <p className="text-xs mt-1">Data will appear once the first race completes</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Race Calendar */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-3xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-5 bg-f1-red rounded-full" />
                    <h2 className="font-heading text-sm tracking-[0.15em] uppercase text-white/70">Race Calendar</h2>
                  </div>
                  <span className="text-[10px] font-heading text-white/20 tracking-wider">
                    {completed.length} / {schedule.length} completed
                  </span>
                </div>
                <div className="divide-y divide-white/[0.04] max-h-[420px] overflow-y-auto">
                  {schedule.map((r) => {
                    const raceDate = new Date(r.date);
                    const isPast = raceDate < new Date();
                    const isNext = nextRace?.round === r.round;
                    const isSprint = r.sprint;
                    return (
                      <motion.div
                        key={r.round}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`flex items-center gap-4 px-6 py-3.5 transition ${isNext ? "bg-f1-red/5 border-l-2 border-f1-red" : "hover:bg-white/[0.02]"}`}
                      >
                        <span className={`font-heading text-sm w-8 font-700 ${isNext ? "text-f1-red" : isPast ? "text-white/60" : "text-white/20"}`}>
                          R{r.round}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-heading text-sm truncate ${isNext ? "text-white font-600" : isPast ? "text-white/60" : "text-white/40"}`}>
                            {r.event}
                          </p>
                          <p className="text-[10px] text-white/20 mt-0.5">{r.date}</p>
                          {/* Session badges for next race */}
                          {isNext && r.sessions && r.sessions.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {r.sessions.map((s, si) => {
                                const short = SESSION_SHORT[s.name] || s.name;
                                const sdt = s.date_utc ? new Date(s.date_utc) : null;
                                const isSessionPast = sdt ? sdt < new Date() : false;
                                return (
                                  <span
                                    key={si}
                                    className={`text-[8px] font-heading tracking-wider px-1.5 py-0.5 rounded-full ${
                                      isSessionPast
                                        ? "text-green-400/40 bg-green-400/8"
                                        : sdt && !isSessionPast && isNext
                                          ? "text-f1-red bg-f1-red/10"
                                          : "text-white/20 bg-white/5"
                                    }`}
                                  >
                                    {short}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isSprint && (
                            <span className="text-[8px] font-heading tracking-[0.2em] uppercase text-[#27f4d2]/60 bg-[#27f4d2]/10 px-2 py-0.5 rounded-full">Sprint</span>
                          )}
                          {isNext ? (
                            <span className="text-[9px] font-heading tracking-wider uppercase text-f1-red bg-f1-red/10 px-3 py-1 rounded-full">Next</span>
                          ) : isPast ? (
                            <span className="text-[9px] font-heading tracking-wider uppercase text-green-400/60 bg-green-400/10 px-3 py-1 rounded-full">Done</span>
                          ) : (
                            <span className="text-[9px] font-heading tracking-wider uppercase text-white/20 bg-white/5 px-3 py-1 rounded-full">Upcoming</span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
