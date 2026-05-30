import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { postQuery } from "../api/client";
import FormattedText from "../components/FormattedText";
import StreamingText from "../components/StreamingText";
import landoImg from "../assets/lando.jpg";

interface Message {
  id: number;
  role: "user" | "ai";
  text: string;
  engine?: string;
  streamed?: boolean;
}

const STORAGE_KEY = "f1nalyse_steward_messages";

function loadMessages(): Message[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((m: Message) => ({ ...m, streamed: true }));
      }
    }
  } catch {}
  return [];
}

function saveMessages(messages: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {}
}

const CAPABILITIES = [
  {
    category: "Standings",
    chips: [
      "Who's leading the 2026 championship?",
      "Constructor standings after Canada",
      "How many wins does Norris have?",
    ],
  },
  {
    category: "Comparison",
    chips: [
      "Compare Verstappen and Norris at Monaco",
      "Telemetry comparison Leclerc vs Sainz",
      "Who won more races, Hamilton or Schumacher?",
    ],
  },
  {
    category: "Penalties",
    chips: [
      "What penalty for a late brake test?",
      "Is a first-lap collision a penalty?",
      "What's the penalty for a safety car infringement?",
    ],
  },
  {
    category: "Data",
    chips: [
      "Show me Hamilton's career stats",
      "Lap progression for Piastri in Baku",
      "Tyre strategy for Monaco 2025",
    ],
  },
];

let nextId = 1;

function TypingDots() {
  return (
    <div className="flex gap-1 px-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 bg-f1-red/60 rounded-full"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

function ChatMessage({ msg, isStreaming, onStreamComplete }: { msg: Message; isStreaming: boolean; onStreamComplete: () => void }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[88%] ${
          isUser
            ? "bg-f1-red text-white rounded-2xl rounded-br-md"
            : "bg-f1-carbon/80 backdrop-blur-xl border border-white/[0.06] text-white/80 rounded-2xl rounded-bl-md"
        }`}
      >
        <div className="px-4 py-3">
          {!isUser && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-f1-red" />
              <span className="text-[9px] font-heading tracking-[0.2em] uppercase text-f1-red/60">Steward</span>
              {isStreaming && (
                <span className="text-[8px] font-heading tracking-wider uppercase text-yellow-400/60 bg-yellow-400/10 px-2 py-0.5 rounded-full">Streaming</span>
              )}
            </div>
          )}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {isStreaming ? (
              <StreamingText text={msg.text} speed={6} onComplete={onStreamComplete} />
            ) : (
              <FormattedText text={msg.text} />
            )}
          </p>
        </div>
        {msg.engine && (
          <div className="flex items-center gap-2 px-4 py-2 border-t border-white/[0.04]">
            <span className="text-[9px] font-heading tracking-wider uppercase text-white/20">
              {msg.engine}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function AiSteward() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = loadMessages();
    if (saved.length > 0) return saved;
    nextId = saved.length + 1;
    return [
      { id: nextId++, role: "ai", text: "I'm the F1nalyse Steward. Ask me anything about Formula 1 — standings, driver comparisons, telemetry, lap analysis, penalties, or career data. All answers are generated live from FastF1 race data.", streamed: true },
    ];
  });
  const [loading, setLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveMessages(messages.map(m => ({ ...m, streamed: true })));
  }, [messages]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, streamingId]);

  const send = useCallback(async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text || loading) return;
    setQuery("");
    const userMsg: Message = { id: nextId++, role: "user", text, streamed: true };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    try {
      // Build conversation history from existing messages
      const history = messages.map((m) => ({ role: m.role, content: m.text }));
      const res = await postQuery(text, history);
      const aiId = nextId++;
      const aiMsg: Message = { id: aiId, role: "ai", text: res.answer, engine: res.engine, streamed: false };
      setMessages((m) => [...m, aiMsg]);
      setStreamingId(aiId);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { id: nextId++, role: "ai", text: `Sorry, I couldn't reach the data. ${err instanceof Error ? err.message : "Try again later."}`, streamed: true },
      ]);
    }
    setLoading(false);
    inputRef.current?.focus();
  }, [query, loading, messages]);

  const clear = useCallback(() => {
    nextId = 1;
    const welcome: Message = { id: nextId++, role: "ai", text: "Conversation cleared. Ask me anything about Formula 1.", streamed: true };
    setMessages([welcome]);
    setStreamingId(null);
    saveMessages([welcome]);
  }, []);

  const onStreamComplete = useCallback((id: number) => {
    setStreamingId((curr) => curr === id ? null : curr);
    setMessages((m) => m.map(msg => msg.id === id ? { ...msg, streamed: true } : msg));
  }, []);

  return (
    <div className="pt-20 h-screen relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-[center_30%]"
        style={{ backgroundImage: `url(${landoImg})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-f1-black/80 via-f1-black/50 to-f1-black/70" />
      <div className="absolute inset-0 bg-gradient-to-t from-f1-black/60 via-transparent to-f1-black/30" />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-f1-red/5 rounded-full blur-3xl" />

      {/* Layout */}
      <div className="relative z-10 h-full flex items-center justify-center px-4 py-24">
        <div className="flex gap-6 w-full max-w-6xl h-full max-h-[860px]">
          {/* Left panel — capabilities (hidden on mobile) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="hidden lg:flex flex-col w-72 shrink-0"
          >
            <div             className="flex-1 bg-f1-carbon/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-5 overflow-y-auto">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1 h-4 bg-f1-red rounded-full" />
                <h2 className="font-heading text-[10px] tracking-[0.2em] uppercase text-white/50">Capabilities</h2>
              </div>
              <div className="space-y-5">
                {CAPABILITIES.map((group) => (
                  <div key={group.category}>
                    <p className="text-[9px] font-heading tracking-wider uppercase text-white/20 mb-2">{group.category}</p>
                    <div className="space-y-1">
                      {group.chips.map((chip) => (
                        <button
                          key={chip}
                          onClick={() => send(chip)}
                          className="w-full text-left text-[11px] text-white/40 hover:text-white/80 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all leading-relaxed"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Chat panel */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col min-w-0 bg-f1-black/80 backdrop-blur-2xl border border-white/[0.06] rounded-3xl shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/20" />
                <span className="font-heading text-[10px] tracking-[0.2em] uppercase text-white/50">Steward</span>
                <span className="text-[8px] font-heading tracking-wider uppercase text-green-400/50 bg-green-400/8 px-2 py-0.5 rounded-full">Online</span>
              </div>
              <div className="flex items-center gap-3">
                {messages.length > 1 && (
                  <button
                    onClick={clear}
                    className="text-[9px] font-heading tracking-wider uppercase text-white/20 hover:text-white/60 transition-colors"
                  >
                    Clear
                  </button>
                )}
                <span className="text-[9px] text-white/20 font-heading tracking-wider">{messages.length} msg</span>
              </div>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto p-5 space-y-4 scroll-smooth">
              {messages.map((msg) => {
                const isStreaming = streamingId === msg.id;
                return (
                  <ChatMessage
                    key={msg.id}
                    msg={msg}
                    isStreaming={isStreaming}
                    onStreamComplete={() => onStreamComplete(msg.id)}
                  />
                );
              })}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-f1-carbon/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3">
                    <TypingDots />
                  </div>
                </div>
              )}

              {/* Welcome suggestions */}
              {messages.length === 1 && !loading && streamingId === null && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6 space-y-4"
                >
                  {CAPABILITIES.map((group) => (
                    <div key={group.category}>
                      <p className="text-[9px] font-heading tracking-[0.2em] uppercase text-white/15 mb-2.5 px-1">
                        {group.category}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.chips.map((chip) => (
                          <button
                            key={chip}
                            onClick={() => send(chip)}
                            className="text-[10px] px-3 py-1.5 rounded-full bg-f1-carbon/60 border border-white/[0.06] text-white/40 hover:text-white hover:border-f1-red/40 hover:bg-f1-red/10 transition-all"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="shrink-0 px-4 py-3 border-t border-white/[0.06] bg-black/20">
              <div className="flex gap-2.5">
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
                  placeholder="Ask the steward..."
                  className="flex-1 bg-f1-carbon/70 border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-f1-red/40 focus:ring-1 focus:ring-f1-red/20 transition-all placeholder:text-white/15"
                />
                <button
                  onClick={() => send()}
                  disabled={loading || !query.trim()}
                  className="px-5 py-2.5 bg-f1-red text-white font-heading text-[10px] tracking-[0.2em] uppercase rounded-xl disabled:opacity-25 hover:bg-f1-red/80 transition-all active:scale-95"
                >
                  Send
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
