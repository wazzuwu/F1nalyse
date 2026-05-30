import { motion } from "framer-motion";

interface SkeletonProps {
  className?: string;
  count?: number;
}

function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <motion.div
      className={`bg-white/5 rounded-xl animate-pulse ${className}`}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 0.2, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export function Skeleton({ className = "", count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBox key={i} className={className} />
      ))}
    </>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-gradient-to-br from-f1-carbon to-black border border-white/5 rounded-2xl p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-5">
        <Skeleton className="w-9 h-9 rounded-full" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-gradient-to-br from-f1-carbon to-black border border-white/5 rounded-2xl p-6 shadow-lg">
      <div className="space-y-4">
        <div className="flex gap-4 mb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: 6 }).map((_, j) => (
              <Skeleton key={j} className={`h-4 flex-1 ${j === 0 ? "w-8" : ""}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="bg-f1-carbon/80 backdrop-blur border border-white/5 rounded-2xl p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="w-1.5 h-1.5 rounded-full" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="h-[400px] w-full rounded-lg" />
    </div>
  );
}
