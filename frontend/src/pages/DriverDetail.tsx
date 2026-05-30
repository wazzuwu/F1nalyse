import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getDriverCareer } from "../api/client";
import type { DriverCareerPerSeason } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";

export default function DriverDetail() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<{
    full_name: string;
    career: { seasons: number; wins: number; points: number; best_championship: number | null };
    per_season: DriverCareerPerSeason[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError("");
    getDriverCareer(code)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) return <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto min-h-screen"><LoadingSpinner text="Loading driver..." /></div>;
  if (error) return <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto min-h-screen"><ErrorBanner message={error} onDismiss={() => setError("")} /></div>;
  if (!data) return <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto min-h-screen" />;

  const perSeason = Array.isArray(data.per_season) ? data.per_season : [];
  const c = data.career || { seasons: 0, wins: 0, points: 0, best_championship: null };
  const bestResult = perSeason.length > 0 ? perSeason.reduce((a, b) => a.position < b.position ? a : b) : null;

  return (
    <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto">
      <Link to="/analysis" className="text-xs text-white/30 hover:text-f1-red transition font-heading tracking-wider uppercase mb-6 inline-block">
        &larr; Back to Analysis
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-full bg-f1-red/20 flex items-center justify-center">
            <span className="font-heading text-2xl font-800 text-f1-red">{code?.charAt(0)}</span>
          </div>
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-800 tracking-tight">{data.full_name}</h1>
            <span className="font-heading text-sm tracking-widest text-f1-red uppercase">{code}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-f1-carbon border border-white/5 rounded-xl p-4 text-center">
            <p className="text-2xl font-heading font-800 text-white">{c.seasons}</p>
            <p className="text-xs text-white/40 font-heading tracking-wider uppercase mt-1">Seasons</p>
          </div>
          <div className="bg-f1-carbon border border-white/5 rounded-xl p-4 text-center">
            <p className="text-2xl font-heading font-800 text-f1-red">{c.wins}</p>
            <p className="text-xs text-white/40 font-heading tracking-wider uppercase mt-1">Wins</p>
          </div>
          <div className="bg-f1-carbon border border-white/5 rounded-xl p-4 text-center">
            <p className="text-2xl font-heading font-800 text-white">{c.points}</p>
            <p className="text-xs text-white/40 font-heading tracking-wider uppercase mt-1">Points</p>
          </div>
          <div className="bg-f1-carbon border border-white/5 rounded-xl p-4 text-center">
            <p className="text-2xl font-heading font-800 text-white">
              {c.best_championship ? `P${c.best_championship}` : "—"}
            </p>
            <p className="text-xs text-white/40 font-heading tracking-wider uppercase mt-1">Best Champ</p>
          </div>
        </div>

        {perSeason.length > 0 && (
          <div className="bg-f1-carbon border border-white/5 rounded-2xl overflow-hidden">
            <h2 className="font-heading text-sm tracking-widest text-f1-red uppercase px-6 pt-5 pb-3">Season History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-white/30 font-heading text-xs tracking-wider uppercase">
                    <th className="text-left px-6 py-3">Year</th>
                    <th className="text-left px-6 py-3">Team</th>
                    <th className="text-center px-6 py-3">Champ</th>
                    <th className="text-center px-6 py-3">Wins</th>
                    <th className="text-center px-6 py-3">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {perSeason.map((s) => (
                    <tr key={s.year} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="px-6 py-3 font-heading font-600">{s.year}</td>
                      <td className="px-6 py-3 text-white/60">{s.team}</td>
                      <td className="px-6 py-3 text-center font-heading">{s.position ? `P${s.position}` : "—"}</td>
                      <td className="px-6 py-3 text-center font-heading text-f1-red font-600">{s.wins}</td>
                      <td className="px-6 py-3 text-center font-heading">{s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
