import React, { useState, useEffect } from "react";
import { api } from "../api";
import { DailyPlan, Task } from "../types";
import { Calendar, Brain, Clock, ShieldCheck, ZapOff, Sparkles, RefreshCcw } from "lucide-react";
import { motion } from "motion/react";

interface PlannerViewProps {
  tasks: Task[];
  onTasksUpdated: () => void;
}

export default function PlannerView({ tasks, onTasksUpdated }: PlannerViewProps) {
  const [targetDate, setTargetDate] = useState(() => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  });

  const [availableHours, setAvailableHours] = useState("4");
  const [currentPlan, setCurrentPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMessage, setErrMessage] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const fetchPlan = async (dateStr: string) => {
    try {
      setErrMessage("");
      const plan = await api.getDailyPlan(dateStr);
      setCurrentPlan(plan);
    } catch (_) {
      // It's expected to have no plan generated yet, we keep state as null
      setCurrentPlan(null);
    }
  };

  useEffect(() => {
    fetchPlan(targetDate);
  }, [targetDate]);

  const handleGeneratePlan = async () => {
    setLoading(true);
    setErrMessage("");
    setActionSuccess("");
    try {
      const plan = await api.generateDailyPlan(targetDate, Number(availableHours));
      setCurrentPlan(plan);
      setActionSuccess("AI Planner successfully synthesized today's timeline blocks!");
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err: any) {
      setErrMessage(err.message || "Failed planning sequence.");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerReplan = async () => {
    setLoading(true);
    setErrMessage("");
    setActionSuccess("");
    try {
      const plan = await api.triggerReplan(targetDate, Number(availableHours));
      setCurrentPlan(plan);
      onTasksUpdated();
      setActionSuccess("Smart Replanner active! Incomplete items relocated & priorities balanced.");
      setTimeout(() => setActionSuccess(""), 4500);
    } catch (err: any) {
      setErrMessage(err.message || "Smart replanning failed.");
    } finally {
      setLoading(false);
    }
  };

  const formatDateLabel = (dStr: string) => {
    try {
      const parts = dStr.split("-");
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      }
      return dStr;
    } catch (_) {
      return dStr;
    }
  };

  // Check if we have active pending tasks to display helper warnings
  const activeTasksCount = tasks.filter((t) => t.statusKey !== "completed").length;

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div>
        <h1 className="font-display font-extrabold text-2xl text-slate-900 tracking-tight">AI Planner</h1>
        <p className="text-sm text-slate-500 mt-1 font-medium">Generate dense hour-by-hour schedules mapped by critical priority rules.</p>
      </div>

      {/* Control Banner Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 items-end shadow-sm">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span>Target Workday</span>
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full bg-slate-55 border border-slate-200 rounded-lg py-2.5 px-3.5 text-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-colors bg-slate-50"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>Productivity Cap</span>
          </label>
          <select
            value={availableHours}
            onChange={(e) => setAvailableHours(e.target.value)}
            className="w-full bg-slate-55 border border-slate-200 rounded-lg py-2.5 px-3.5 text-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-colors bg-slate-50"
          >
            <option value="1">1 working hour</option>
            <option value="2">2 working hours</option>
            <option value="3">3 working hours</option>
            <option value="4">4 working hours (Recommended)</option>
            <option value="6">6 working hours (Dense)</option>
            <option value="8">8 working hours (Full Core)</option>
          </select>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleGeneratePlan}
            disabled={loading || activeTasksCount === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 shadow-sm"
          >
            {loading ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Optimize Calendar</span>
              </>
            )}
          </button>

          <button
            onClick={handleTriggerReplan}
            disabled={loading || activeTasksCount === 0}
            className="w-full bg-slate-50 hover:bg-slate-100 text-indigo-600 border border-slate-200 text-xs font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 shadow-2xs hover:border-indigo-200"
            title="Automatically pull legacy overdue tasks into today's timeline"
          >
            <RefreshCcw className="h-4 w-4" />
            <span>Smart Replan Rescue</span>
          </button>
        </div>
      </div>

      {errMessage && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl p-4 font-medium">
          {errMessage}
        </div>
      )}

      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl p-4 font-medium">
          {actionSuccess}
        </div>
      )}

      {/* Main planner display area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Hour block timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
              <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
                <Brain className="h-5 w-5 text-indigo-600" />
                <span>Hour-By-Hour Allocation list</span>
              </h3>
              <span className="text-2xs font-mono font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                Ref: {formatDateLabel(targetDate)}
              </span>
            </div>

            {!currentPlan ? (
              <div className="text-center py-20 bg-slate-50/50 rounded-xl border border-slate-100 p-6">
                <ZapOff className="h-10 w-10 text-slate-350 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">No schedule built for this workday.</p>
                <p className="text-xs text-slate-400 mt-1">Config allocation hours and click Optimize to begin execution mapping.</p>
              </div>
            ) : (
              <div className="relative border-l border-slate-250 pl-6 ml-3 space-y-6">
                {currentPlan.items.map((item, idx) => {
                  const pBadge = item.priority === "high" ? "bg-rose-50 text-rose-700 border border-rose-100" : item.priority === "medium" ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "bg-slate-100 text-slate-600 border border-slate-200";
                  return (
                    <div key={idx} className="relative group">
                      {/* Timeline dot accent */}
                      <span className="absolute -left-[32px] top-1 h-4 w-4 rounded-full bg-white border-4 border-indigo-600 z-10 shadow-sm" />
                       
                      <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-100 group-hover:border-slate-200 group-hover:bg-slate-50 transition-all shadow-3xs">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-bold text-slate-600 font-mono flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span>{item.time}</span>
                          </span>
                          
                          <div className="flex items-center gap-1.5">
                            <span className="text-2xs text-slate-400 font-mono font-medium">{item.durationMin} mins</span>
                            <span className={`text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-sm uppercase tracking-wide border ${pBadge}`}>
                              {item.priority}
                            </span>
                          </div>
                        </div>

                        <h4 className="text-sm font-bold text-slate-800">{item.taskTitle}</h4>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* AI Recommendations Column */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2 mb-4">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <span>Priority Guard Guidance</span>
            </h3>

            {!currentPlan || currentPlan.recommendations.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Optimize your workday details to load task strategy tips.</p>
            ) : (
              <div className="space-y-3">
                {currentPlan.recommendations.map((rec, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed font-semibold shadow-3xs">
                    <p>{rec}</p>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-5 border-t border-slate-100 pt-4 text-center">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest font-mono">Dynamic execution engine: active</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
