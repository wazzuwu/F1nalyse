import { useState } from "react";
import { motion } from "framer-motion";
import { postQuery } from "../api/client";
import type { QueryResponse } from "../types";
import LoadingSpinner from "./LoadingSpinner";
import ErrorBanner from "./ErrorBanner";
import { SkeletonChart } from "./Skeleton";

const examples = [
  "kimi raikkonen gearbox change italian gp",
  "max verstappen track limits austria lap 42",
  "hamilton penalty for causing collision silverstone",
  "albon albon overtaking outside track limits",
];

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="font-heading text-xs text-white/50 w-10 text-right">{pct}%</span>
    </div>
  );
}

export default function PenaltyTab() {
  const [incident, setIncident] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [fetchError, setFetchError] = useState("");

  const predict = async () => {
    if (!incident.trim()) return;
    setLoading(true);
    setResult(null);
    setFetchError("");
    try {
      const res = await postQuery(incident);
      setResult(res);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to analyze incident");
      setResult(null);
    }
    setLoading(false);
  };

  return (
    <div>
      {/* Input Card */}
      <div className="bg-gradient-to-br from-f1-carbon to-black border border-white/5 rounded-2xl p-6 mb-8 shadow-lg">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          <label className="text-xs text-white/40 font-heading tracking-wider uppercase">Incident Description</label>
        </div>
        <p className="text-[11px] text-white/20 mb-4 font-body">
          Describe the incident naturally — the steward analyses it against FIA precedent.
        </p>
        <textarea
          value={incident}
          onChange={(e) => setIncident(e.target.value)}
          placeholder='e.g. "kimi raikkonen gearbox change italian gp"'
          rows={4}
          className="w-full bg-f1-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-f1-red/50 focus:ring-1 focus:ring-f1-red/20 transition-all resize-none placeholder:text-white/15"
        />
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4">
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => setIncident(ex)}
                className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white hover:border-f1-red/40 transition-all"
              >
                {ex.length > 30 ? ex.slice(0, 30) + "…" : ex}
              </button>
            ))}
          </div>
          <button
            onClick={predict}
            disabled={loading || !incident.trim()}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-f1-red to-red-700 text-white font-heading text-sm tracking-wider uppercase rounded-xl disabled:opacity-30 hover:scale-[1.02] hover:shadow-lg hover:shadow-f1-red/20 transition-all"
          >
            {loading ? "Analyzing..." : "Predict"}
          </button>
        </div>
      </div>

      {fetchError && <div className="mb-6"><ErrorBanner message={fetchError} onDismiss={() => setFetchError("")} /></div>}

      {loading && (
        <div className="mb-8">
          <SkeletonChart />
        </div>
      )}

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 22 }}
          className="bg-gradient-to-br from-f1-carbon to-black border border-white/5 border-t-2 border-t-f1-red rounded-2xl p-6 shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-f1-red/20 flex items-center justify-center">
                <span className="text-f1-red text-sm font-heading font-800">S</span>
              </div>
              <h3 className="font-heading text-sm tracking-wider uppercase text-white/80">Steward Decision</h3>
            </div>
            {result.engine && (
              <span className="text-[9px] text-f1-red/60 font-heading tracking-wider uppercase border border-f1-red/20 rounded-full px-2.5 py-0.5">
                {result.engine}
              </span>
            )}
          </div>

          {/* Confidence Bar */}
          {result.confidence !== undefined && result.confidence !== null && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-white/30 font-heading tracking-wider uppercase">Confidence</span>
              </div>
              <ConfidenceBar value={result.confidence} />
            </div>
          )}

          {/* Answer: prediction title + reasoning body */}
          <div className="bg-f1-black/40 border border-white/5 rounded-xl p-5">
            {result.answer.startsWith("**Prediction:**") ? (
              <>
                <h4 className="font-heading text-sm tracking-wider text-f1-red mb-3">
                  {result.answer.split("\n\n")[0].replace("**Prediction:** ", "").replace(/\*\*/g, "")}
                </h4>
                <p className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap">
                  {result.answer.split("\n\n").slice(1).join("\n\n")}
                </p>
              </>
            ) : (
              <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{result.answer}</p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
