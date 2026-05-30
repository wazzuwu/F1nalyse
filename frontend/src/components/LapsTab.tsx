import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getDrivers, getCircuits, getSeasons, postLaps } from "../api/client";
import type { LapEntry } from "../types";
import LoadingSpinner from "./LoadingSpinner";
import ErrorBanner from "./ErrorBanner";
import { SkeletonTable } from "./Skeleton";

const compoundColors: Record<string, string> = {
  SOFT: "bg-red-900/30 text-red-300 border-red-800/30",
  MEDIUM: "bg-yellow-900/30 text-yellow-300 border-yellow-800/30",
  HARD: "bg-blue-900/30 text-blue-300 border-blue-800/30",
  INTERMEDIATE: "bg-green-900/30 text-green-300 border-green-800/30",
  WET: "bg-purple-900/30 text-purple-300 border-purple-800/30",
};

function formatTime(t: string) {
  return t.replace("0 days 00:0", "").replace("0 days 00:", "");
}

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

export default function LapsTab() {
  const [driver, setDriver] = useState("");
  const [circuit, setCircuit] = useState("");
  const [year, setYear] = useState(2024);
  const [maxLaps, setMaxLaps] = useState(20);
  const [loading, setLoading] = useState(false);
  const [laps, setLaps] = useState<LapEntry[]>([]);
  const [driverOptions, setDriverOptions] = useState<{ code: string; full_name: string }[]>([]);
  const [circuitOptions, setCircuitOptions] = useState<{ key: string; full_name: string }[]>([]);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [initError, setInitError] = useState("");
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    Promise.all([
      getDrivers().then(setDriverOptions),
      getCircuits().then(setCircuitOptions),
      getSeasons().then(setSeasons),
    ]).catch(() => setInitError("Failed to load data. Is the backend running?"));
  }, []);

  const load = async () => {
    if (!driver || !circuit) return;
    setLoading(true);
    setFetchError("");
    try {
      const res = await postLaps({ driver, circuit, year, max_laps: maxLaps || undefined });
      setLaps(res);
    } catch (err) {
      setLaps([]);
      setFetchError(err instanceof Error ? err.message : "Failed to load lap data");
    }
    setLoading(false);
  };

  return (
    <div>
      {initError && <ErrorBanner message={initError} onDismiss={() => setInitError("")} />}

      {/* Filters */}
      <div className="bg-gradient-to-br from-f1-carbon to-black border border-white/5 rounded-2xl p-4 md:p-6 mb-8 shadow-lg">
        <div className="flex flex-wrap gap-3 md:gap-4 items-end">
          <div className="w-full sm:w-auto sm:min-w-[180px]">
            <SelectField label="Driver" value={driver} onChange={setDriver} options={driverOptions.map((d) => ({ value: d.code, label: `${d.code} — ${d.full_name}` }))} placeholder="Select driver" />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[180px]">
            <SelectField label="Circuit" value={circuit} onChange={setCircuit} options={circuitOptions.map((c) => ({ value: c.key, label: c.full_name }))} placeholder="Select circuit" />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[100px]">
            <SelectField label="Year" value={String(year)} onChange={(v) => setYear(Number(v))} options={seasons.map((s) => ({ value: String(s), label: String(s) }))} />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[100px]">
            <label className="block text-[10px] text-white/40 font-heading tracking-wider mb-1.5 uppercase">Max Laps</label>
            <input type="number" value={maxLaps} onChange={(e) => setMaxLaps(Number(e.target.value))} className="w-full bg-f1-black/80 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-f1-red/50 focus:ring-1 focus:ring-f1-red/20 transition-all" />
          </div>
          <div className="w-full sm:w-auto">
            <button
              onClick={load}
              disabled={loading || !driver || !circuit}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-f1-red to-red-700 text-white font-heading text-sm tracking-wider uppercase rounded-xl disabled:opacity-30 hover:scale-[1.02] hover:shadow-lg hover:shadow-f1-red/20 transition-all"
            >
              {loading ? "..." : "Load"}
            </button>
          </div>
        </div>
      </div>

      {fetchError && <div className="mb-6"><ErrorBanner message={fetchError} onDismiss={() => setFetchError("")} /></div>}

      {loading && <SkeletonTable rows={10} />}

      {/* Lap Table */}
      {laps.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-x-auto rounded-2xl border border-white/5 shadow-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-f1-carbon/80 text-white/30 font-heading text-[10px] tracking-wider uppercase">
                <th className="text-left py-3.5 px-3">Lap</th>
                <th className="text-left py-3.5 px-3">Time</th>
                <th className="text-left py-3.5 px-3">S1</th>
                <th className="text-left py-3.5 px-3">S2</th>
                <th className="text-left py-3.5 px-3">S3</th>
                <th className="text-left py-3.5 px-3">Compound</th>
                <th className="text-right py-3.5 px-3">Tyre Age</th>
                <th className="text-right py-3.5 px-3">Avg km/h</th>
                <th className="text-right py-3.5 px-3">Top km/h</th>
              </tr>
            </thead>
            <tbody>
              {laps.map((lap, i) => (
                <motion.tr
                  key={lap.lap_number}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.025 }}
                  className={`border-t border-white/5 hover:bg-white/5 transition text-xs ${
                    lap.is_fastest ? "bg-gradient-to-r from-f1-red/5 to-transparent" : ""
                  }`}
                >
                  <td className="py-2.5 px-3">
                    <span className={`font-heading ${lap.is_fastest ? "text-f1-red" : "text-white/60"}`}>
                      {lap.lap_number}
                      {lap.is_fastest && <span className="ml-1.5 text-[8px] text-f1-red tracking-wider">FL</span>}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-white/80">{formatTime(lap.lap_time)}</td>
                  <td className="py-2.5 px-3 font-mono text-white/40">{lap.sector_1_time ? formatTime(lap.sector_1_time) : "—"}</td>
                  <td className="py-2.5 px-3 font-mono text-white/40">{lap.sector_2_time ? formatTime(lap.sector_2_time) : "—"}</td>
                  <td className="py-2.5 px-3 font-mono text-white/40">{lap.sector_3_time ? formatTime(lap.sector_3_time) : "—"}</td>
                  <td className="py-2.5 px-3">
                    {lap.compound ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-heading tracking-wider border ${compoundColors[lap.compound] || "bg-white/5 text-white/40 border-white/10"}`}>
                        {lap.compound}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right text-white/50">{lap.tyre_life ?? "—"}</td>
                  <td className="py-2.5 px-3 text-right text-white/50">{lap.avg_speed ?? "—"}</td>
                  <td className="py-2.5 px-3 text-right text-white/50">{lap.top_speed ?? "—"}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}
