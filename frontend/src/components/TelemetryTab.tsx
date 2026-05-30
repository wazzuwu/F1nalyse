import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { getDrivers, getCircuits, getSeasons, postTelemetry, postMultiTelemetry, postGearTrack } from "../api/client";
import type { TelemetryResponse, MultiTelemetryResponse, MultiTelemetryDriver, GearTrackResponse } from "../types";
import LoadingSpinner from "./LoadingSpinner";
import ErrorBanner from "./ErrorBanner";
import { SkeletonChart } from "./Skeleton";
import PlotlyChart from "./PlotlyChart";

const GEAR_COLORS: Record<number, string> = {
  1: "#7fc7ff", 2: "#1a6dd4", 3: "#6bdb5a", 4: "#1b8c1b",
  5: "#ff6b9d", 6: "#e02020", 7: "#ff9f33", 8: "#cc5500",
};

const metrics = ["speed", "throttle", "brake", "rpm", "drs"];

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-f1-carbon/80 backdrop-blur border border-white/5 rounded-xl p-4 text-center hover:border-f1-red/20 transition-all"
    >
      <p className="text-[10px] text-white/40 font-heading tracking-wider uppercase mb-1">{label}</p>
      <p className="text-lg font-heading font-800 text-white">{value}</p>
    </motion.div>
  );
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

function MultiSelectField({ label, value, onChange, options, placeholder }: {
  label: string; value: string[]; onChange: (v: string[]) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="min-w-[200px] relative" ref={ref}>
      <label className="block text-[10px] text-white/40 font-heading tracking-wider mb-1.5 uppercase">{label}</label>
      <div
        className="w-full bg-f1-black/80 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white cursor-pointer flex items-center justify-between"
        onClick={() => setOpen(!open)}
      >
        <span className="truncate">{value.length > 0 ? value.join(", ") : placeholder || "Select..."}</span>
        <span className="text-white/40 ml-1">{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-f1-black border border-white/10 rounded-xl shadow-xl max-h-60 overflow-y-auto">
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 text-sm text-white/80">
              <input
                type="checkbox"
                checked={value.includes(o.value)}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange([...value, o.value]);
                  } else {
                    onChange(value.filter((v) => v !== o.value));
                  }
                }}
                className="accent-f1-red"
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TelemetryTab() {
  const [mode, setMode] = useState<"single" | "compare" | "gear">("single");
  const [driver, setDriver] = useState("");
  const [circuit, setCircuit] = useState("");
  const [year, setYear] = useState(2024);
  const [metric, setMetric] = useState("speed");
  const [lapNumber, setLapNumber] = useState("");

  const [multiDrivers, setMultiDrivers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TelemetryResponse | MultiTelemetryResponse | GearTrackResponse | null>(null);
  const [driverOptions, setDriverOptions] = useState<{ code: string; full_name: string }[]>([]);
  const [circuitOptions, setCircuitOptions] = useState<{ key: string; full_name: string }[]>([]);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [initError, setInitError] = useState("");
  const [fetchError, setFetchError] = useState("");

  const [magnifier, setMagnifier] = useState<{
    show: boolean; cx: number; cy: number;
    px: number; py: number; gear: number;
  }>({ show: false, cx: 0, cy: 0, px: 0, py: 0, gear: 0 });
  const gearTelRef = useRef<GearTrackResponse["telemetry"]>(null);
  const magCanvasRef = useRef<HTMLCanvasElement>(null);

  const drawMagnifier = useCallback(() => {
    const tel = gearTelRef.current;
    const canvas = magCanvasRef.current;
    if (!tel || !canvas || !magnifier.show) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const SIZE = 170;
    const PAD = 12;
    const RANGE = 45;

    canvas.width = SIZE;
    canvas.height = SIZE;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#14141f";
    ctx.beginPath();
    ctx.roundRect(0, 0, SIZE, SIZE, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const ax = magnifier.px - RANGE;
    const bx = magnifier.px + RANGE;
    const ay = magnifier.py - RANGE;
    const by = magnifier.py + RANGE;

    const toX = (v: number) => PAD + ((v - ax) / (bx - ax)) * (SIZE - 2 * PAD);
    const toY = (v: number) => PAD + ((v - ay) / (by - ay)) * (SIZE - 2 * PAD);

    for (let i = 0; i < tel.x!.length; i++) {
      const sx = toX(tel.x![i]);
      const sy = toY(tel.y![i]);
      if (sx < -5 || sx > SIZE + 5 || sy < -5 || sy > SIZE + 5) continue;
      const gear = tel.gear![i];
      ctx.beginPath();
      ctx.arc(sx, sy, gear === magnifier.gear ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = GEAR_COLORS[gear] ?? "#888";
      ctx.fill();
    }

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "bold 52px Inter, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 8;
    ctx.fillText(String(magnifier.gear), SIZE / 2, SIZE / 2);
  }, [magnifier]);

  useEffect(() => {
    if (magnifier.show) drawMagnifier();
  }, [magnifier, drawMagnifier]);

  const gearHover = useCallback((data: any) => {
    const tel = gearTelRef.current;
    if (!tel?.x || !data?.points?.[0]) return;
    const hx = data.points[0].x;
    const hy = data.points[0].y;
    if (hx == null || hy == null) return;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < tel.x.length; i++) {
      const d = (tel.x[i] - hx) ** 2 + (tel.y[i] - hy) ** 2;
      if (d < bestDist) { bestDist = d; best = i; }
    }
    setMagnifier({
      show: true,
      cx: data.event.clientX,
      cy: data.event.clientY,
      px: tel.x[best],
      py: tel.y[best],
      gear: tel.gear![best],
    });
  }, []);

  const gearUnhover = useCallback(() => {
    setMagnifier((p) => ({ ...p, show: false }));
  }, []);

  useEffect(() => {
    Promise.all([
      getDrivers().then(setDriverOptions),
      getCircuits().then(setCircuitOptions),
      getSeasons().then(setSeasons),
    ]).catch(() => setInitError("Failed to load data. Is the backend running?"));
  }, []);

  const load = async () => {
    if (mode === "compare") {
      if (multiDrivers.length < 2 || !circuit) return;
      setLoading(true);
      setResult(null);
      setFetchError("");
      try {
        const res = await postMultiTelemetry({
          drivers: multiDrivers,
          circuit,
          year,
          metric,
          lap_number: lapNumber ? Number(lapNumber) : undefined,
        });
        setResult(res);
      } catch (err) {
        setResult(null);
        setFetchError(err instanceof Error ? err.message : "Failed to load telemetry data");
      }
    } else if (mode === "gear") {
      if (!driver || !circuit) return;
      setLoading(true);
      setResult(null);
      setFetchError("");
      try {
        const res = await postGearTrack({
          driver,
          circuit,
          year,
          lap_number: lapNumber ? Number(lapNumber) : undefined,
        });
        setResult(res);
      } catch (err) {
        setResult(null);
        setFetchError(err instanceof Error ? err.message : "Failed to load gear track data");
      }
    } else {
      if (!driver || !circuit) return;
      setLoading(true);
      setResult(null);
      setFetchError("");
      try {
        const res = await postTelemetry({
          driver,
          circuit,
          year,
          metric,
          lap_number: lapNumber ? Number(lapNumber) : undefined,
        });
        setResult(res);
      } catch (err) {
        setResult(null);
        setFetchError(err instanceof Error ? err.message : "Failed to load telemetry data");
      }
    }
    setLoading(false);
  };

  const isMultiResult = (r: typeof result): r is MultiTelemetryResponse =>
    r !== null && "drivers" in r && Array.isArray((r as MultiTelemetryResponse).drivers);

  const isGearResult = (r: typeof result): r is GearTrackResponse =>
    r !== null && !("stats" in r) && !("drivers" in r) && "chart" in r;

  return (
    <div>
      {/* Mode Toggle */}
      <div className="flex items-center gap-3 mb-6">
        {(["single", "compare", "gear"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 text-xs font-heading tracking-wider uppercase rounded-xl transition-all ${
              mode === m
                ? "bg-f1-red text-white shadow-lg shadow-f1-red/20"
                : "bg-f1-carbon/60 text-white/40 border border-white/10 hover:text-white/70"
            }`}
          >
            {m === "single" ? "Single Driver" : m === "compare" ? "Lap Comparison" : "Gear Track"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-gradient-to-br from-f1-carbon to-black border border-white/5 rounded-2xl p-4 md:p-6 mb-8 shadow-lg">
        <div className="flex flex-wrap gap-3 md:gap-4">
          {mode === "compare" ? (
            <div className="w-full sm:w-auto">
              <MultiSelectField
                label="Drivers"
                value={multiDrivers}
                onChange={setMultiDrivers}
                options={driverOptions.map((d) => ({ value: d.code, label: `${d.code} — ${d.full_name}` }))}
                placeholder="Select 2+ drivers"
              />
            </div>
          ) : (
            <div className="w-full sm:w-auto sm:min-w-[180px]">
              <SelectField label="Driver" value={driver} onChange={setDriver} options={driverOptions.map((d) => ({ value: d.code, label: `${d.code} — ${d.full_name}` }))} placeholder="Select driver" />
            </div>
          )}

          <div className="w-full sm:w-auto sm:min-w-[180px]">
            <SelectField label="Circuit" value={circuit} onChange={setCircuit} options={circuitOptions.map((c) => ({ value: c.key, label: c.full_name }))} placeholder="Select circuit" />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[100px]">
            <SelectField label="Year" value={String(year)} onChange={(v) => setYear(Number(v))} options={seasons.map((s) => ({ value: String(s), label: String(s) }))} />
          </div>
          {mode !== "gear" && (
            <div className="w-full sm:w-auto sm:min-w-[120px]">
              <SelectField label="Metric" value={metric} onChange={setMetric} options={metrics.map((m) => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) }))} />
            </div>
          )}
          <div className="w-full sm:w-auto sm:min-w-[100px]">
            <label className="block text-[10px] text-white/40 font-heading tracking-wider mb-1.5 uppercase">Lap</label>
            <input
              type="number"
              min={1}
              value={lapNumber}
              onChange={(e) => setLapNumber(e.target.value)}
              placeholder="Fastest"
              className="w-full bg-f1-black/80 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-f1-red/50 focus:ring-1 focus:ring-f1-red/20 transition-all placeholder:text-white/20"
            />
          </div>
          <div className="flex items-end w-full sm:w-auto">
            <button
              onClick={load}
              disabled={loading || ((mode !== "compare") && !driver) || (mode === "compare" && multiDrivers.length < 2) || !circuit}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-f1-red to-red-700 text-white font-heading text-sm tracking-wider uppercase rounded-xl disabled:opacity-30 hover:scale-[1.02] hover:shadow-lg hover:shadow-f1-red/20 transition-all"
            >
              {loading ? "..." : "Load"}
            </button>
          </div>
        </div>
      </div>

      {fetchError && <div className="mb-6"><ErrorBanner message={fetchError} onDismiss={() => setFetchError("")} /></div>}

      {initError && <ErrorBanner message={initError} onDismiss={() => setInitError("")} />}

      {loading && <SkeletonChart />}

      {result && !isMultiResult(result) && !isGearResult(result) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {result.lap && (
            <div className="flex items-center gap-3 mb-4">
              <span className="font-heading text-xs text-white/40 tracking-wider uppercase">
                Lap {result.lap.number}
              </span>
              <span className="font-mono text-xs text-white/60">{result.lap.time}</span>
              {result.lap.is_fastest && (
                <span className="text-[9px] text-f1-red font-heading tracking-wider uppercase border border-f1-red/30 rounded-full px-2 py-0.5">
                  Fastest
                </span>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            <MetricCard label="Avg Speed" value={`${result.stats.avg_speed ?? "—"} km/h`} />
            <MetricCard label="Top Speed" value={`${result.stats.top_speed ?? "—"} km/h`} />
            <MetricCard label="Min Speed" value={`${result.stats.min_speed ?? "—"} km/h`} />
            <MetricCard label="Avg Throttle" value={`${result.stats.avg_throttle ?? "—"}%`} />
            <MetricCard label="Avg Brake" value={`${result.stats.avg_brake ?? "—"}%`} />
          </div>
          {result.chart && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-f1-carbon/80 backdrop-blur border border-white/5 rounded-2xl p-5 shadow-lg"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-f1-red" />
                <span className="text-xs font-heading text-white/40 tracking-wider uppercase">{metric.toUpperCase()} Telemetry</span>
              </div>
              <PlotlyChart chart={result.chart} className="h-[400px]" />
            </motion.div>
          )}
          {result.track_chart && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-f1-carbon/80 backdrop-blur border border-white/5 rounded-2xl p-3 shadow-lg mt-4"
            >
              <PlotlyChart chart={result.track_chart} className="h-[500px]" />
            </motion.div>
          )}
        </motion.div>
      )}

      {result && isMultiResult(result) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
            {result.drivers.map((d: MultiTelemetryDriver) => (
              <motion.div
                key={d.code}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-f1-carbon/80 backdrop-blur border border-white/5 rounded-xl p-4"
                style={{ borderLeft: `3px solid ${d.color}` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-800 text-white text-lg">{d.code}</span>
                    <span className="text-[9px] text-white/40 font-heading tracking-wider">{d.team}</span>
                  </div>
                  <span className="text-xs font-mono text-white/60">{d.lap_time}</span>
                </div>
                {d.error ? (
                  <p className="text-xs text-f1-red">{d.error}</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <p className="text-[9px] text-white/40 uppercase tracking-wider">Avg</p>
                      <p className="text-sm font-heading font-700 text-white">{d.stats.avg_speed} km/h</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/40 uppercase tracking-wider">Top</p>
                      <p className="text-sm font-heading font-700 text-white">{d.stats.top_speed} km/h</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/40 uppercase tracking-wider">Min</p>
                      <p className="text-sm font-heading font-700 text-white">{d.stats.min_speed} km/h</p>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
          {result.chart && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-f1-carbon/80 backdrop-blur border border-white/5 rounded-2xl p-5 shadow-lg"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-f1-red" />
                <span className="text-xs font-heading text-white/40 tracking-wider uppercase">
                  {metric.toUpperCase()} — Lap Comparison
                </span>
              </div>
              <PlotlyChart chart={result.chart} className="h-[400px]" />
            </motion.div>
          )}
        </motion.div>
      )}

      {result && isGearResult(result) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {(() => { gearTelRef.current = result.telemetry; return null; })()}
          {result.lap && (
            <div className="flex items-center gap-3 mb-4">
              <span className="font-heading text-xs text-white/40 tracking-wider uppercase">
                Lap {result.lap.number}
              </span>
              <span className="font-mono text-xs text-white/60">{result.lap.time}</span>
              {result.lap.is_fastest && (
                <span className="text-[9px] text-f1-red font-heading tracking-wider uppercase border border-f1-red/30 rounded-full px-2 py-0.5">
                  Fastest
                </span>
              )}
            </div>
          )}
          {result.chart && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-f1-carbon/80 backdrop-blur border border-white/5 rounded-2xl p-3 shadow-lg relative"
            >
              <PlotlyChart
                chart={result.chart}
                className="h-[700px]"
                onHover={gearHover}
                onUnhover={gearUnhover}
              />
              {magnifier.show && (
                <div
                  className="fixed pointer-events-none z-50"
                  style={{
                    left: magnifier.cx - 85,
                    top: magnifier.cy - 85,
                  }}
                >
                  <canvas
                    ref={magCanvasRef}
                    width={170}
                    height={170}
                    className="rounded-xl shadow-2xl"
                    style={{
                      boxShadow: "0 0 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
                    }}
                  />
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: GEAR_COLORS[magnifier.gear] ?? "#888" }}
                  >
                    <span className="text-[9px] font-bold text-black">{magnifier.gear}</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
