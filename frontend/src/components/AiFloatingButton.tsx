import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { postQuery } from "../api/client";
import FormattedText from "./FormattedText";
import StreamingText from "./StreamingText";
import type { QueryResponse } from "../types";
import LoadingSpinner from "./LoadingSpinner";

interface Message {
  id: number;
  role: "user" | "ai";
  text: string;
  engine?: string;
  streamed?: boolean;
}

const FLOAT_STORAGE_KEY = "f1nalyse_float_messages";

function loadFloatMessages(): Message[] {
  try {
    const saved = localStorage.getItem(FLOAT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((m: Message) => ({ ...m, streamed: true }));
      }
    }
  } catch {}
  return [];
}

function saveFloatMessages(messages: Message[]) {
  try {
    localStorage.setItem(FLOAT_STORAGE_KEY, JSON.stringify(messages));
  } catch {}
}

let floatNextId = 1;

export default function AiFloatingButton() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => loadFloatMessages());
  const [loading, setLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveFloatMessages(messages.map(m => ({ ...m, streamed: true })));
  }, [messages]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, streamingId]);

  const send = async () => {
    const q = query.trim();
    if (!q || loading) return;
    setQuery("");
    const userMsg: Message = { id: floatNextId++, role: "user", text: q, streamed: true };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    try {
      const res: QueryResponse = await postQuery(q);
      const aiId = floatNextId++;
      const aiMsg: Message = { id: aiId, role: "ai", text: res.answer, engine: res.engine, streamed: false };
      setMessages((m) => [...m, aiMsg]);
      setStreamingId(aiId);
    } catch (err: unknown) {
      setMessages((m) => [...m, { id: floatNextId++, role: "ai", text: `Error: ${err instanceof Error ? err.message : "Unknown"}`, streamed: true }]);
    }
    setLoading(false);
  };

  const onStreamComplete = useCallback((id: number) => {
    setStreamingId((curr) => curr === id ? null : curr);
    setMessages((m) => m.map(msg => msg.id === id ? { ...msg, streamed: true } : msg));
  }, []);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-14 right-6 z-50 w-14 h-14 bg-f1-red text-white font-heading text-xs font-700 tracking-wider uppercase flex items-center justify-center"
        style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
      >
        <motion.span animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
          AI
        </motion.span>
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-14 right-24 z-50 w-[380px] h-[500px] bg-f1-carbon border border-f1-red/20 rounded-lg flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="font-heading text-sm tracking-wider uppercase text-f1-red">AI Query</span>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white text-lg">&times;</button>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-white/30 text-sm text-center mt-8">Ask anything about F1</p>
              )}
              {messages.map((m) => {
                const isStreaming = streamingId === m.id;
                return (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-f1-red/20 text-white"
                          : "bg-white/5 border-l-2 border-f1-red text-white/80"
                      }`}
                    >
                      {isStreaming ? (
                        <StreamingText text={m.text} speed={6} onComplete={() => onStreamComplete(m.id)} />
                      ) : (
                        <FormattedText text={m.text} />
                      )}
                      {m.engine && (
                        <span className="block text-[10px] text-f1-red font-heading uppercase tracking-wider mt-1">
                          engine: {m.engine}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border-l-2 border-f1-red rounded-lg px-3 py-2">
                    <LoadingSpinner text="Thinking..." />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/10 flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask F1..."
                className="flex-1 bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-f1-red/50 transition"
              />
              <button
                onClick={send}
                disabled={loading}
                className="bg-f1-red text-white px-4 py-2 text-sm font-heading tracking-wider uppercase rounded disabled:opacity-50 hover:bg-f1-red/80 transition"
              >
                Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
