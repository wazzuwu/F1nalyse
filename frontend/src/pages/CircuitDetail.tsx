import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getCircuitDetail } from "../api/client";
import type { CircuitDetailWinner } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";

export default function CircuitDetail() {
  const { key } = useParams<{ key: string }>();
  const [data, setData] = useState<{ full_name: string; winners_by_year: CircuitDetailWinner[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!key) return;
    setLoading(true);
    setError("");
    getCircuitDetail(key)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [key]);

  if (loading) return <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto"><LoadingSpinner text="Loading circuit..." /></div>;
  if (error) return <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto"><ErrorBanner message={error} onDismiss={() => setError("")} /></div>;
  if (!data) return null;

  const winners = data.winners_by_year || [];

  const winCounts: Record<string, number> = {};
  for (const w of winners) {
    winCounts[w.winner] = (winCounts[w.winner] || 0) + 1;
  }
  const mostWins = Object.entries(winCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto">
      <Link to="/live" className="text-xs text-white/30 hover:text-f1-red transition font-heading tracking-wider uppercase mb-6 inline-block">
        &larr; Back to Season
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-3xl md:text-4xl font-800 tracking-tight mb-2">{data.full_name}</h1>
        <p className="text-sm text-white/40 font-body mb-8">{winners.length} editions on record</p>

        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <div className="bg-f1-carbon border border-white/5 rounded-2xl overflow-hidden">
              <h2 className="font-heading text-sm tracking-widest text-f1-red uppercase px-6 pt-5 pb-3">Winners by Year</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-white/30 font-heading text-xs tracking-wider uppercase">
                      <th className="text-left px-6 py-3">Year</th>
                      <th className="text-left px-6 py-3">Winner</th>
                      <th className="text-left px-6 py-3">Team</th>
                    </tr>
                  </thead>
                  <tbody>
                    {winners.map((w) => (
                      <tr key={w.year} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="px-6 py-3 font-heading font-600">{w.year}</td>
                        <td className="px-6 py-3">
                          <Link to={`/driver/${w.winner}`} className="text-white hover:text-f1-red transition font-heading">
                            {w.winner}
                          </Link>
                        </td>
                        <td className="px-6 py-3 text-white/60">{w.team}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-f1-carbon border border-white/5 rounded-2xl p-6 sticky top-28">
              <h2 className="font-heading text-sm tracking-widest text-f1-red uppercase mb-5">Most Wins</h2>
              <div className="space-y-3">
                {mostWins.map(([driver, count], i) => (
                  <div key={driver} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/30 font-heading w-4">{i + 1}.</span>
                      <Link to={`/driver/${driver}`} className="text-sm text-white/80 hover:text-f1-red transition font-heading">
                        {driver}
                      </Link>
                    </div>
                    <span className="text-sm font-heading font-600 text-f1-red">{count}x</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
