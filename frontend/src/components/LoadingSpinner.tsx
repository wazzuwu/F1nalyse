import { motion } from "framer-motion";

export default function LoadingSpinner({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="w-8 h-8 border-2 border-f1-red border-t-transparent rounded-full animate-spin" />
      <p className="font-heading text-sm tracking-wider text-white/50 uppercase">{text}</p>
    </div>
  );
}
