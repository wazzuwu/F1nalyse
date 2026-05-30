import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { getDrivers, getCircuits, getSeasons, postCompare } from "../api/client";
import type { SessionCompareStats, CareerCompareStats, AggregateCompareStats } from "../types";
import LoadingSpinner from "./LoadingSpinner";
import ErrorBanner from "./ErrorBanner";
import { SkeletonCard } from "./Skeleton";

function StatRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/40 font-heading tracking-wider uppercase">{label}</span>
      <span className={`text-sm font-600 ${mono ? "font-mono" : "font-heading"}`}>{value}</span>
    </div>
  );
}

export default function CompareTab() {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [circuit, setCircuit] = useState("");
  const [year, setYear] = useState("");
  const [career, setCareer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    scope: { mode?: string; circuit: string | null; year: number | null; session: string | null };
    stats: Record<string, SessionCompareStats | CareerCompareStats | AggregateCompareStats | null>;
  } | null>(null);
  const [driverOptions, setDriverOptions] = useState<{ code: string; full_name: string }[]>([]);
  const [circuitOptions, setCircuitOptions] = useState<{ key: string; full_name: string }[]>([]);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [initError, setInitError] = useState("");
  const [compareError, setCompareError] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [driverSearch, setDriverSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const yearNum = year ? Number(year) : undefined;
    setSelectedDrivers([]);
    Promise.all([
      getDrivers(yearNum).then(setDriverOptions),
      getCircuits().then(setCircuitOptions),
      getSeasons().then(setSeasons),
    ]).catch(() => setInitError("Failed to load data."));
  }, [year]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setDriverSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredDrivers = useMemo(
    () => driverOptions.filter(
      (d) =>
        d.code.toLowerCase().includes(driverSearch.toLowerCase()) ||
        d.full_name.toLowerCase().includes(driverSearch.toLowerCase())
    ),
    [driverOptions, driverSearch]
  );

  const toggleDriver = (code: string) => {
    setSelectedDrivers((d) =>
      d.includes(code) ? d.filter((x) => x !== code) : d.length < 3 ? [...d, code] : d
    );
  };

  const selectedLabels = selectedDrivers.map((code) => {
    const d = driverOptions.find((x) => x.code === code);
    return d ? `${d.code} — ${d.full_name}` : code;
  });

  const canCompare = selectedDrivers.length > 0 && (career || circuit || year);

  const compare = async () => {
    if (!canCompare) return;
    setLoading(true);
    setResult(null);
    setCompareError("");
    try {
      const res = await postCompare({
        drivers: selectedDrivers,
        circuit: career ? undefined : (circuit || undefined),
        year: career ? undefined : (year ? Number(year) : undefined),
        session: "R",
      });
      setResult({ scope: res.scope, stats: res.stats });
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : "Comparison failed. Check backend connection.");
      setResult(null);
    }
    setLoading(false);
  };

  return (
    <div>
      {initError && <ErrorBanner message={initError} onDismiss={() => setInitError("")} />}

      <div className="bg-gradient-to-br from-f1-carbon to-black border border-white/5 rounded-2xl p-6 mb-8 shadow-lg">
        {/* Drivers */}
        <div className="mb-5">
          <label className="block text-xs text-white/40 font-heading tracking-wider mb-3 uppercase">
            Drivers (up to 3)
          </label>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full bg-f1-black/80 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-left text-white outline-none focus:border-f1-red/50 transition-all"
            >
              {selectedDrivers.length === 0
                ? <span className="text-white/30">Select drivers…</span>
                : <span className="truncate block">{selectedLabels.join(", ")}</span>}
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">
                {dropdownOpen ? "▲" : "▼"}
              </span>
            </button>

            {dropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-f1-black border border-white/10 rounded-xl shadow-2xl">
                <div className="sticky top-0 bg-f1-black border-b border-white/10 p-2">
                  <input
                    autoFocus
                    value={driverSearch}
                    onChange={(e) => setDriverSearch(e.target.value)}
                    placeholder="Search drivers..."
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/20 focus:border-f1-red/50"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {filteredDrivers.length === 0 ? (
                    <div className="px-3 py-6 text-center text-white/20 text-sm">No drivers match</div>
                  ) : (
                    filteredDrivers.map((d) => {
                      const active = selectedDrivers.includes(d.code);
                      return (
                        <div
                          key={d.code}
                          onClick={() => toggleDriver(d.code)}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                            active
                              ? "bg-f1-red/10 text-white"
                              : "text-white/50 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            active ? "bg-f1-red border-f1-red" : "border-white/20"
                          }`}>
                            {active && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className="font-heading font-700 text-xs tracking-wider w-10">{d.code}</span>
                          <span className="text-white/60 text-xs truncate">{d.full_name}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap gap-3 md:gap-4 items-end">
          {/* Circuit */}
          <div className="w-full sm:w-auto sm:min-w-[180px]">
            <label className="block text-[10px] text-white/40 font-heading tracking-wider mb-1.5 uppercase">Circuit</label>
            <select
              value={circuit}
              onChange={(e) => setCircuit(e.target.value)}
              disabled={career}
              className="w-full bg-f1-black/80 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-f1-red/50 transition-all appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <option value="">Select circuit</option>
              {circuitOptions.map((c) => <option key={c.key} value={c.key} className="bg-f1-carbon text-white">{c.full_name}</option>)}
            </select>
          </div>

          {/* Year */}
          <div className="w-full sm:w-auto sm:min-w-[120px]">
            <label className="block text-[10px] text-white/40 font-heading tracking-wider mb-1.5 uppercase">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              disabled={career}
              className="w-full bg-f1-black/80 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-f1-red/50 transition-all appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <option value="">Select year</option>
              {seasons.map((s) => <option key={s} value={s} className="bg-f1-carbon text-white">{s}</option>)}
            </select>
          </div>

          {/* Career checkbox */}
          <label className="flex items-center gap-2.5 text-sm text-white/50 cursor-pointer py-2">
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${career ? "bg-f1-red border-f1-red" : "border-white/20"}`}>
              {career && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
            <input type="checkbox" checked={career} onChange={(e) => setCareer(e.target.checked)} className="hidden" />
            All Time Career
          </label>

          {/* Compare button */}
          <button
            onClick={compare}
            disabled={loading || !canCompare}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-f1-red to-red-700 text-white font-heading text-sm tracking-wider uppercase rounded-xl disabled:opacity-30 hover:scale-[1.02] hover:shadow-lg hover:shadow-f1-red/20 transition-all"
          >
            {loading ? "Loading..." : "Compare"}
          </button>
        </div>
      </div>

      {compareError && <div className="mb-6"><ErrorBanner message={compareError} onDismiss={() => setCompareError("")} /></div>}

      {loading && (
        <div className="grid md:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Mode indicator */}
      {result && !result.stats && (
        <p className="text-white/40 text-sm">No data for this selection.</p>
      )}

      {result?.stats && (
        <div className="grid md:grid-cols-3 gap-5">
          {Object.entries(result.stats).map(([code, stats], i) => {
            const mode = result.scope?.mode || "race";
            return (
              <motion.div
                key={code}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, type: "spring", damping: 20 }}
                className="bg-gradient-to-br from-f1-carbon to-black border border-white/5 border-t-2 border-t-f1-red rounded-2xl p-6 shadow-lg hover:shadow-xl hover:border-t-f1-red/80 transition-all"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-full bg-f1-red/20 flex items-center justify-center">
                    <span className="font-heading font-800 text-sm text-f1-red">{code.charAt(0)}</span>
                  </div>
                  <h3 className="font-heading text-xl font-800 tracking-tight">{code}</h3>
                </div>

                {!stats ? (
                  <p className="text-white/30 text-sm">No data for this selection.</p>
                ) : mode === "career" ? (
                  <CareerCard s={stats as CareerCompareStats} />
                ) : mode === "season" || mode === "circuit" ? (
                  <AggregateCard s={stats as AggregateCompareStats} />
                ) : (
                  <RaceCard s={stats as SessionCompareStats} />
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CareerCard({ s }: { s: CareerCompareStats }) {
  return (
    <div className="space-y-1">
      <StatRow label="Seasons" value={String(s.seasons)} />
      <StatRow label="Total Wins" value={String(s.total_wins)} />
      <StatRow label="Total Points" value={String(s.total_points)} />
      <StatRow label="Best Champ" value={s.best_championship < 99 ? `P${s.best_championship}` : "—"} />
      <StatRow label="Avg Pts/Season" value={String(s.avg_points_per_season)} />
    </div>
  );
}

function AggregateCard({ s }: { s: AggregateCompareStats }) {
  return (
    <div className="space-y-1">
      <StatRow label="Races" value={String(s.races)} />
      <StatRow label="Wins" value={String(s.wins)} />
      <StatRow label="Podiums" value={String(s.podiums)} />
      <StatRow label="Poles" value={s.poles != null ? String(s.poles) : "—"} />
      {s.championship_position != null && (
        <StatRow label="Champ Position" value={`P${s.championship_position}`} />
      )}
      {s.fastest_laps != null && (
        <StatRow label="Fastest Laps" value={String(s.fastest_laps)} />
      )}
      {s.best_fastest_lap != null && (
        <StatRow label="Best FL" value={s.best_fastest_lap} mono />
      )}
      <StatRow label="Best Position" value={s.best_position ? `P${s.best_position}` : "—"} />
      <StatRow label="DNFs" value={String(s.dnfs)} />
    </div>
  );
}

function RaceCard({ s }: { s: SessionCompareStats }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between py-2.5 border-b border-white/5">
        <span className="text-xs text-white/40 font-heading tracking-wider uppercase">Position</span>
        <span className="font-heading text-lg font-800">{s.position ? `P${s.position}` : "—"}</span>
      </div>
      <StatRow label="Fastest Lap" value={s.fastest_lap ?? "—"} mono />
      <StatRow label="Avg Lap" value={s.avg_lap_time ?? "—"} mono />
      <StatRow label="Pit Stops" value={String(s.pit_stops)} />
      <StatRow label="Laps Led" value={String(s.laps_led)} />
    </div>
  );
}
