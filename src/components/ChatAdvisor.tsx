import React, { useState, useEffect, useRef } from "react";
import { api } from "../api";
import { ChatMessage } from "../types";
import { Sparkles, Send, Trash2, ShieldAlert, Bot } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ChatAdvisorProps {
  tasksCount: number;
}

export default function ChatAdvisor({ tasksCount }: ChatAdvisorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [errMessage, setErrMessage] = useState("");
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const fetchHistory = async () => {
    try {
      const history = await api.getChatHistory();
      setMessages(history);
    } catch (e) {
      console.error("Failed fetching chat log:", e);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [tasksCount]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMsg.trim() || loading) return;

    setErrMessage("");
    const userPrompt = inputMsg;
    setInputMsg("");
    setLoading(true);

    // Optimistically update message history list
    const tempUserMessage: ChatMessage = {
      id: "temp_" + Math.random(),
      userId: "",
      role: "user",
      content: userPrompt,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const answer = await api.sendChatMessage(userPrompt);
      // Replace optimistic or simply load the complete thread saved response
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp_")).concat(answer));
    } catch (err: any) {
      setErrMessage(err.message || "Failed to query strategic advisor.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Wipe all previous strategic advisor memory logs?")) return;
    try {
      setErrMessage("");
      await api.clearChatHistory();
      setMessages([]);
    } catch (err: any) {
      setErrMessage(err.message || "Clear command rejected.");
    }
  };

  return (
    <div className="flex flex-col h-[520px] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Advisor Header */}
      <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-700 border border-indigo-100 shadow-3xs">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 font-display">Conversational Strategist</h3>
            <span className="text-[10px] text-slate-450 font-mono font-semibold">Powered by Gemini 1.5 Pro</span>
          </div>
        </div>
        
        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all cursor-pointer border border-transparent hover:border-red-100"
            title="Wipe Memory History"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Messages Stream Segment */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin bg-white">
        {errMessage && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{errMessage}</span>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="text-center py-20 px-4 text-slate-400 space-y-2">
            <Bot className="h-8 w-8 text-indigo-600/30 mx-auto mb-2 animate-bounce" />
            <p className="text-xs font-bold text-slate-700">I am your Deadline Guardian advisor.</p>
            <p className="text-[10px] text-slate-450 font-medium leading-relaxed max-w-xs mx-auto">
              Ask me about workload distributions, mitigating critical threat tasks, or organizing studies for Friday!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 max-w-[85%] ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                {/* Avatar Icon */}
                <span className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 font-mono text-[10px] font-bold ${
                  isUser ? "bg-slate-100 text-slate-600 border border-slate-200" : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                }`}>
                  {isUser ? "U" : "AI"}
                </span>

                <div className={`p-3 rounded-xl text-xs leading-relaxed font-semibold shadow-3xs ${
                  isUser
                    ? "bg-indigo-50 border border-indigo-100 text-slate-800 rounded-tr-none"
                    : "bg-slate-50/75 border border-slate-100 text-slate-850 rounded-tl-none font-sans text-slate-700"
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            );
          })
        )}

        {/* Advisor Loading Wave bubble */}
        {loading && (
          <div className="flex gap-2.5 mr-auto max-w-[85%]">
            <span className="h-6 w-6 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center font-mono animate-pulse">
              AI
            </span>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl rounded-tl-none flex items-center gap-1.5 py-4">
              <span className="h-1.5 w-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Message input footer */}
      <form onSubmit={handleSendMessage} className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
        <input
          disabled={loading}
          type="text"
          placeholder="Ask AI your strategical question..."
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          className="flex-1 bg-white border border-slate-200 rounded-xl py-2 px-3.5 text-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-400 font-semibold shadow-3xs"
        />
        <button
          disabled={loading || !inputMsg.trim()}
          type="submit"
          className="p-2 bg-indigo-650 hover:bg-indigo-700 disabled:opacity-30 text-white rounded-xl transition-colors cursor-pointer shrink-0 shadow-sm"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
