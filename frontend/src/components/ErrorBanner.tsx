import { motion } from "framer-motion";

interface Props {
  message: string;
  onDismiss?: () => void;
}

export default function ErrorBanner({ message, onDismiss }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-f1-red/20 border border-f1-red/40 rounded-lg px-4 py-3 flex items-center justify-between"
    >
      <p className="text-sm text-f1-red">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="text-white/50 hover:text-white ml-4 text-lg leading-none">
          &times;
        </button>
      )}
    </motion.div>
  );
}
