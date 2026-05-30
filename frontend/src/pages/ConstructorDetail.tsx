import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getConstructorDetail } from "../api/client";
import type { ConstructorDetailPerSeason } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";

export default function ConstructorDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<{ full_name: string; drivers: string[]; per_season: ConstructorDetailPerSeason[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError("");
    getConstructorDetail(slug)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto"><LoadingSpinner text="Loading constructor..." /></div>;
  if (error) return <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto"><ErrorBanner message={error} onDismiss={() => setError("")} /></div>;
  if (!data) return null;

  const perSeason = data.per_season || [];
  const totalWins = perSeason.reduce((s, y) => s + y.wins, 0);
  const totalPoints = perSeason.reduce((s, y) => s + y.points, 0);
  const bestResult = perSeason.length > 0 ? perSeason.reduce((a, b) => a.position < b.position ? a : b) : null;

  return (
    <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto">
      <Link to="/live" className="text-xs text-white/30 hover:text-f1-red transition font-heading tracking-wider uppercase mb-6 inline-block">
        &larr; Back to Season
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-3xl md:text-4xl font-800 tracking-tight mb-8">{data.full_name}</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-f1-carbon border border-white/5 rounded-xl p-4 text-center">
            <p className="text-2xl font-heading font-800 text-white">{perSeason.length}</p>
            <p className="text-xs text-white/40 font-heading tracking-wider uppercase mt-1">Seasons</p>
          </div>
          <div className="bg-f1-carbon border border-white/5 rounded-xl p-4 text-center">
            <p className="text-2xl font-heading font-800 text-f1-red">{totalWins}</p>
            <p className="text-xs text-white/40 font-heading tracking-wider uppercase mt-1">Wins</p>
          </div>
          <div className="bg-f1-carbon border border-white/5 rounded-xl p-4 text-center">
            <p className="text-2xl font-heading font-800 text-white">{totalPoints}</p>
            <p className="text-xs text-white/40 font-heading tracking-wider uppercase mt-1">Points</p>
          </div>
          <div className="bg-f1-carbon border border-white/5 rounded-xl p-4 text-center">
            <p className="text-2xl font-heading font-800 text-white">
              {bestResult ? `P${bestResult.position}` : "—"}
            </p>
            <p className="text-xs text-white/40 font-heading tracking-wider uppercase mt-1">Best Champ</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-f1-carbon border border-white/5 rounded-2xl overflow-hidden">
            <h2 className="font-heading text-sm tracking-widest text-f1-red uppercase px-6 pt-5 pb-3">Season Standings</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-white/30 font-heading text-xs tracking-wider uppercase">
                    <th className="text-left px-6 py-3">Year</th>
                    <th className="text-center px-6 py-3">Champ</th>
                    <th className="text-center px-6 py-3">Wins</th>
                    <th className="text-center px-6 py-3">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {perSeason.map((s) => (
                    <tr key={s.year} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="px-6 py-3 font-heading font-600">{s.year}</td>
                      <td className="px-6 py-3 text-center font-heading">{s.position ? `P${s.position}` : "—"}</td>
                      <td className="px-6 py-3 text-center font-heading text-f1-red font-600">{s.wins}</td>
                      <td className="px-6 py-3 text-center font-heading">{s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-f1-carbon border border-white/5 rounded-2xl p-6">
            <h2 className="font-heading text-sm tracking-widest text-f1-red uppercase mb-4">Drivers</h2>
            {data.drivers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.drivers.map((d) => (
                  <Link
                    key={d}
                    to={`/driver/${d}`}
                    className="px-3 py-1.5 text-sm rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-f1-red/50 hover:bg-f1-red/10 transition-all font-heading"
                  >
                    {d}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-white/30 text-sm">No driver data available.</p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
