import React from "react";
import { Task } from "../types";
import { ListTodo, CheckCircle, AlertTriangle, Calendar, Award, AlertOctagon } from "lucide-react";
import { motion } from "motion/react";

interface DashboardViewProps {
  tasks: Task[];
  productivityScore: number;
  onNavigate: (tab: string) => void;
  onSelectTaskRisk: (taskId: string) => void;
}

export default function DashboardView({ tasks, productivityScore, onNavigate, onSelectTaskRisk }: DashboardViewProps) {
  const activeTasks = tasks.filter((t) => t.statusKey !== "completed");
  const completedTasks = tasks.filter((t) => t.statusKey === "completed");
  const highRiskTasks = activeTasks.filter((t) => t.riskScore >= 70);

  // Sorting active with soonest deadlines
  const upcomingDeadlines = [...activeTasks]
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 4);

  // Date parsing helper
  const formatDate = (dStr: string) => {
    try {
      const parts = dStr.split("-");
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
      return dStr;
    } catch (_) {
      return dStr;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const cardVariants = {
    hidden: { y: 15, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Welcome & Overview Header */}
      <div>
        <h1 className="font-display font-extrabold text-2xl text-slate-900 tracking-tight">System Core Hub</h1>
        <p className="text-sm text-slate-500 mt-1">Real-time indicators, predictive warnings, and dynamic workload statistics.</p>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Core Task Count */}
        <motion.div
          variants={cardVariants}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Under Care Process</span>
            <h3 className="text-3xl font-extrabold text-slate-900 font-display">{tasks.length}</h3>
            <p className="text-[10px] text-slate-400 font-mono">Total tracked deadlines</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/50">
            <ListTodo className="h-6 w-6" />
          </div>
        </motion.div>

        {/* Finished Tasks */}
        <motion.div
          variants={cardVariants}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Accomplished</span>
            <h3 className="text-3xl font-extrabold text-emerald-600 font-display">{completedTasks.length}</h3>
            <p className="text-[10px] text-emerald-600/80 font-mono">Successful completions</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/50">
            <CheckCircle className="h-6 w-6" />
          </div>
        </motion.div>

        {/* High Risk Task Counts */}
        <motion.div
          variants={cardVariants}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Compromised / At risk</span>
            <h3 className="text-3xl font-extrabold text-amber-600 font-display">{highRiskTasks.length}</h3>
            <p className="text-[10px] text-amber-600/80 font-mono">Needs immediate priority rescue</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100/50">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </motion.div>

        {/* Dynamic Productivity Index */}
        <motion.div
          variants={cardVariants}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Productivity Score</span>
            <h3 className="text-3xl font-extrabold text-emerald-600 font-display">{productivityScore}%</h3>
            <p className="text-[10px] text-slate-400 font-mono">Real-time adaptive index</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center relative border border-emerald-100/50">
            <Award className="h-6 w-6" />
            <div className="absolute inset-0 rounded-xl border border-emerald-500/20 pulse-primary" />
          </div>
        </motion.div>
      </div>

      {/* Main split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Urgent Alerts Container */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
              <AlertOctagon className="h-5 w-5 text-amber-500" />
              <span>Predictive Guardian Insights</span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">Critical scheduling bottle-necks highlighted by Gemini's risks-evaluator.</p>

            <div className="mt-5 space-y-3">
              {highRiskTasks.length === 0 ? (
                <div id="no_compromised_alerts" className="text-center py-10 bg-slate-50/50 rounded-xl border border-slate-100 p-4">
                  <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-700 font-semibold">All tasks are currently categorized as secure/low-risk.</p>
                  <p className="text-xs text-slate-400 mt-1">Workloads remain well-distributed within available capacity.</p>
                </div>
              ) : (
                highRiskTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-rose-50/80 border border-rose-100 text-slate-900 transition-all hover:bg-rose-50"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold text-red-650 uppercase tracking-wider font-mono">CRITICAL RISK {t.riskScore}%</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        <span className="text-xs font-semibold text-slate-500">Due {formatDate(t.deadline)}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{t.title}</h4>
                      <p className="text-xs text-slate-600 line-clamp-2 italic">"{t.riskReason}"</p>
                    </div>
                    
                    <button
                      onClick={() => onSelectTaskRisk(t.id)}
                      className="shrink-0 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all self-start md:self-auto cursor-pointer"
                    >
                      Mitigate Risk
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Working hour guidance widget */}
          <div className="bg-gradient-to-r from-indigo-50/40 via-white to-emerald-50/30 border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 max-w-md">
              <h4 className="text-sm font-bold text-slate-900">Execution Overload Shield Active</h4>
              <p className="text-xs text-slate-600">Let Deadline Guardian organize your hour-by-hour milestones to avoid crunch states and ensure safe margins.</p>
            </div>
            <button
              onClick={() => onNavigate("planner")}
              className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white shadow-sm text-xs font-semibold rounded-lg transition-colors shrink-0 cursor-pointer border-0"
            >
              Configure AI Planner
            </button>
          </div>
        </div>

        {/* Sidebar deadlines */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h2 className="font-display font-bold text-base text-slate-900 flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-indigo-500" />
              <span>Overlooming Deadlines</span>
            </h2>

            {upcomingDeadlines.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No pending active tasks found.</p>
            ) : (
              <div className="space-y-3">
                {upcomingDeadlines.map((t) => {
                  const rScore = t.riskScore || 0;
                  const rColor = rScore >= 70 ? "text-red-600" : rScore >= 40 ? "text-amber-600" : "text-emerald-600";
                  return (
                    <div
                      key={t.id}
                      className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => onNavigate("tasks")}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-mono text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 tracking-wider">
                          {t.priority}
                        </span>
                        <span className={`text-[10px] font-mono font-bold ${rColor}`}>Risk: {rScore}%</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 mt-2 line-clamp-1">{t.title}</h4>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500 font-mono">
                        <span>Due: {formatDate(t.deadline)}</span>
                        <span>•</span>
                        <span>Effort: {t.effort}h</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <button
              onClick={() => onNavigate("tasks")}
              className="w-full text-center text-xs text-indigo-600 hover:text-indigo-800 font-semibold mt-4 cursor-pointer block"
            >
              View All Tasks &rarr;
            </button>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
