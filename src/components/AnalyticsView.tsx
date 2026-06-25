import React, { useState, useEffect } from "react";
import { api } from "../api";
import { ActivityLog, AnalyticsStats } from "../types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { TrendingUp, FileText, BarChart3, Database, History } from "lucide-react";
import { motion } from "motion/react";

interface AnalyticsViewProps {
  tasksCount: number;
}

export default function AnalyticsView({ tasksCount }: AnalyticsViewProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [logHistory, statsObj] = await Promise.all([api.getLogs(), api.getAnalytics()]);
      setLogs(logHistory);
      setAnalytics(statsObj);
    } catch (e) {
      console.error("Failed loading stats:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [tasksCount]);

  if (loading) {
    return (
      <div className="text-center py-24 text-slate-500 font-semibold">
        <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold">Consolidating statistical telemetry data...</p>
      </div>
    );
  }

  // Formatting Priority Data for Pie
  const priorityData = analytics
    ? [
        { name: "High", value: analytics.stats.categoryCounts.high, color: "#f43f5e" },
        { name: "Medium", value: analytics.stats.categoryCounts.medium, color: "#6366f1" },
        { name: "Low", value: analytics.stats.categoryCounts.low, color: "#64748b" },
      ].filter((item) => item.value > 0)
    : [];

  // Formatting Completion Status for Bar
  const statsData = analytics
    ? [
        { name: "Completed", count: analytics.stats.completed, fill: "#10b981" },
        { name: "In Progress", count: analytics.stats.started, fill: "#f59e0b" },
        { name: "Pending", count: analytics.stats.pending, fill: "#94a3b8" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div>
        <h1 className="font-display font-extrabold text-2xl text-slate-900 tracking-tight">Analytics Nexus</h1>
        <p className="text-sm text-slate-500 mt-1 font-medium font-sans">Audit trail activity history, execution efficiency indexes, and density graphs.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Visual Charts columns */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Task state distribution */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <h3 className="font-display font-bold text-xs text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <BarChart3 className="h-4.5 w-4.5 text-indigo-600" />
                <span>Completion Status</span>
              </h3>

              {priorityData.length === 0 && tasksCount === 0 ? (
                <p className="text-xs text-slate-400 py-12 text-center font-semibold">No cataloged items found.</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} />
                      <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "12px", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)" }}
                        labelStyle={{ color: "#475569", fontWeight: 700 }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {statsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Priority density pie chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <h3 className="font-display font-bold text-xs text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="h-4.5 w-4.5 text-indigo-600" />
                <span>Priority Allocation</span>
              </h3>

              {priorityData.length === 0 ? (
                <p className="text-xs text-slate-400 py-12 text-center font-semibold">Empty catalogs.</p>
              ) : (
                <div className="h-56 flex flex-col justify-between">
                  <div className="h-40 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={priorityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {priorityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "12px", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    
                    {/* Inner core title */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">Total</span>
                      <span className="text-xl font-extrabold text-slate-900 font-display mt-0.5">{tasksCount}</span>
                    </div>
                  </div>

                  {/* Pie Legend custom */}
                  <div className="flex justify-around text-[10px] font-mono font-bold text-slate-500 border-t border-slate-100 pt-3">
                    {priorityData.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span>{entry.name}: {entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Productivity Health Summary card */}
          <div className="bg-gradient-to-r from-indigo-50/60 via-slate-50 to-indigo-50/10 border border-slate-200 rounded-2xl p-5 md:p-6 shadow-3xs">
            <h4 className="text-sm font-bold text-slate-900 mb-2">Adaptive Workload Evaluation Index</h4>
            <div className="text-xs text-slate-600 space-y-2 leading-relaxed font-semibold">
              <p>Your current dynamic productivity performance score sits at <strong className="text-indigo-700 font-extrabold text-sm">{analytics?.productivityScore}%</strong>.</p>
              <p>This metric automatically shifts based on overdue tasks, high risk scores calculated by Gemini, and consistency of completion intervals. To improve your margin, clear moderate tasks early or utilize the <strong>AI Planner</strong> to partition your load.</p>
            </div>
          </div>
        </div>

        {/* Audit Activity Stream Column */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col h-[400px] lg:h-auto shadow-sm">
          <h3 className="font-display font-medium text-xs text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4 shrink-0 border-b border-slate-100 pb-3 font-semibold">
            <History className="h-4.5 w-4.5 text-indigo-600" />
            <span>Activity Trail Logs</span>
          </h3>

          <div className="overflow-y-auto flex-1 pr-1 space-y-3.5 scrollbar-thin">
            {logs.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium text-center py-20">Zero recorded events in stream.</p>
            ) : (
              logs.map((log) => {
                return (
                  <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 hover:border-slate-200 hover:bg-slate-50/60 transition-all shadow-3xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] uppercase font-bold text-indigo-600 font-mono tracking-wider">
                        {log.action.replace("_", " ")}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono font-semibold">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-slate-800 line-clamp-1">{log.taskTitle}</h4>
                    <p className="text-[10px] text-slate-500 font-semibold italic leading-normal">"{log.details}"</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
