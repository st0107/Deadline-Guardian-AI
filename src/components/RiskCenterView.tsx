import React, { useState, useEffect } from "react";
import { api } from "../api";
import { Task } from "../types";
import { AlertOctagon, HelpCircle, CheckSquare, Sparkles, BookOpen, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";

interface RiskCenterViewProps {
  tasks: Task[];
  initialSelectedTaskId?: string | null;
  onTasksUpdated: () => void;
}

export default function RiskCenterView({ tasks, initialSelectedTaskId, onTasksUpdated }: RiskCenterViewProps) {
  const activeTasks = tasks.filter((t) => t.statusKey !== "completed");
  
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [targetTask, setTargetTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMessage, setErrMessage] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  useEffect(() => {
    if (initialSelectedTaskId) {
      setSelectedTaskId(initialSelectedTaskId);
    } else if (activeTasks.length > 0 && !selectedTaskId) {
      setSelectedTaskId(activeTasks[0].id);
    }
  }, [initialSelectedTaskId, tasks]);

  useEffect(() => {
    if (selectedTaskId) {
      const found = tasks.find((t) => t.id === selectedTaskId);
      setTargetTask(found || null);
    } else {
      setTargetTask(null);
    }
  }, [selectedTaskId, tasks]);

  const handleRecalculateRisk = async () => {
    if (!selectedTaskId) return;
    setLoading(true);
    setErrMessage("");
    setActionSuccess("");
    try {
      const updatedTask = await api.triggerRiskAnalysis(selectedTaskId);
      setTargetTask(updatedTask);
      setActionSuccess("Gemini successfully recalculate risk margins and updated parameters.");
      onTasksUpdated();
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err: any) {
      setErrMessage(err.message || "Failed to trigger AI predictor.");
    } finally {
      setLoading(false);
    }
  };

  const getRiskClassification = (score: number) => {
    if (score >= 70) return { label: "Critical Threat", color: "text-rose-700 border-rose-100 bg-rose-50 font-bold", desc: "Extreme likelihood of missing target completion due to conflicting tasks." };
    if (score >= 40) return { label: "Moderate Risk", color: "text-amber-700 border-amber-100 bg-amber-50 font-bold", desc: "Significant buffer erosion. Adjust allocation parameters." };
    return { label: "Secure Status", color: "text-emerald-700 border-emerald-100 bg-emerald-50 font-bold", desc: "Safe execution velocity. High confidence margin." };
  };

  // Build dial background dash segments
  const dialRotation = (score: number) => {
    // scale 0-100 to rotation degree range from -90deg to 90deg
    return (score / 100) * 180 - 90;
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div>
        <h1 className="font-display font-extrabold text-2xl text-slate-900 tracking-tight">Risk Predictor Center</h1>
        <p className="text-sm text-slate-500 mt-1 font-medium font-sans">Simulate bottleneck pressures, calculate threat scores, and review mitigation plans.</p>
      </div>

      {/* Task Selector Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="w-full sm:max-w-md space-y-1">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            Select Active Target Task
          </label>
          {activeTasks.length === 0 ? (
            <p className="text-xs text-slate-400">No active process available to predict risks.</p>
          ) : (
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full bg-slate-55 border border-slate-200 rounded-lg py-2.5 px-3.5 text-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-colors bg-slate-50"
            >
              {activeTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} (Risk Index: {t.riskScore}%)
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedTaskId && (
          <button
            onClick={handleRecalculateRisk}
            disabled={loading}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Simulate / Recalculate Risk</span>
              </>
            )}
          </button>
        )}
      </div>

      {errMessage && (
        <div className="bg-red-50 border border-red-100 text-red-750 text-xs rounded-xl p-4 font-medium">
          {errMessage}
        </div>
      )}

      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-750 text-xs rounded-xl p-4 font-medium">
          {actionSuccess}
        </div>
      )}

      {/* Main split dashboard pane */}
      {targetTask ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Risk Dial meter column */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 flex flex-col items-center justify-center text-center shadow-sm">
            <h3 className="font-display font-medium text-xs text-slate-500 uppercase tracking-widest mb-6">
              Predictive Threat Meter
            </h3>

            {/* Simulated Semicircle Speedometer */}
            <div className="relative h-32 w-52 overflow-hidden mb-4 mt-2">
              {/* Dial Arc Outline */}
              <div className="absolute top-0 left-0 right-0 bottom-0 rounded-t-full border-t-[10px] border-l-[10px] border-r-[10px] border-slate-100" />
              
              {/* Active Color fill zone based on risk category */}
              <div className={`absolute top-0 left-0 right-0 bottom-0 rounded-t-full border-t-[10px] border-l-[10px] border-r-[10px] transition-all duration-500 ${
                targetTask.riskScore >= 70 ? "border-t-rose-500 border-l-amber-500/40 border-r-rose-500" : targetTask.riskScore >= 40 ? "border-t-amber-500" : "border-t-emerald-500/40"
              }`} />

              {/* Hand Indicator pin */}
              <div
                className="absolute bottom-0 left-[93px] h-20 w-[14px] bg-gradient-to-t from-slate-450 to-slate-800 origin-bottom rounded-t-full transition-transform duration-700 ease-out"
                style={{
                  transform: `rotate(${dialRotation(targetTask.riskScore)}deg)`,
                  clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
                }}
              />
              
              <div className="absolute bottom-0 left-1/2 -ml-3 h-6 w-6 rounded-full bg-slate-200 border-2 border-slate-350 z-10" />
            </div>

            <div className="space-y-1">
              <span className="text-3xl font-display font-extrabold text-slate-900">{targetTask.riskScore}%</span>
              <div className="mt-2 text-xs font-semibold">
                <span className={`px-2.5 py-1 rounded-full border text-[10px] uppercase font-mono tracking-wider ${getRiskClassification(targetTask.riskScore).color}`}>
                  {getRiskClassification(targetTask.riskScore).label}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2 font-medium">
                {getRiskClassification(targetTask.riskScore).desc}
              </p>
            </div>
          </div>

          {/* AI Explanation Columns */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Explainer Block */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-3 shadow-sm">
              <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600" />
                <span>Gemini Analysis Narrative</span>
              </h3>
              
              <div className="text-xs md:text-sm text-slate-700 leading-relaxed space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100 font-semibold italic">
                <p>"{targetTask.riskReason || "No explanation recorded. Press recalculate to fetch detailed threat narrative."}"</p>
              </div>
            </div>

            {/* Smart Checklist recommendations */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm">
              <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-emerald-600 text-indigo-600" />
                <span>Recommended Mitigation Roadmap</span>
              </h3>

              {!targetTask.recommendations || targetTask.recommendations.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No specific recommendations recorded yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                  {targetTask.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-start gap-2.5"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-slate-350 text-indigo-600 focus:ring-indigo-150/20"
                      />
                      <span className="text-xs text-slate-600 leading-normal font-semibold">{rec}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      ) : (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl text-slate-400 shadow-sm">
          <AlertOctagon className="h-10 w-10 text-slate-305 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Select an active process or add active tasks to evaluate bottleneck risks.</p>
        </div>
      )}
    </div>
  );
}
