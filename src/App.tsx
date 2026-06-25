import React, { useState, useEffect } from "react";
import { api } from "./api";
import { User, Task } from "./types";
import AuthView from "./components/AuthView";
import DashboardView from "./components/DashboardView";
import TaskView from "./components/TaskView";
import PlannerView from "./components/PlannerView";
import RiskCenterView from "./components/RiskCenterView";
import AnalyticsView from "./components/AnalyticsView";
import ChatAdvisor from "./components/ChatAdvisor";
import LiveVoiceWidget from "./components/LiveVoiceWidget";
import {
  Shield,
  LayoutDashboard,
  CheckSquare,
  Sparkles,
  BarChart3,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Bot,
  Compass,
  Radio,
  User as UserIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("dg_jwt_token"));
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [selectedTaskForRisk, setSelectedTaskForRisk] = useState<string | null>(null);

  // Layout Controls
  const [showRightDrawer, setShowRightDrawer] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const fetchUserProfileAndTasks = async () => {
    if (!token) return;
    try {
      const [profile, taskList] = await Promise.all([api.getMe(), api.getTasks()]);
      setUser(profile);
      setTasks(taskList);
    } catch (_) {
      // Token expired or invalid, drop
      handleLogout();
    }
  };

  useEffect(() => {
    fetchUserProfileAndTasks();
  }, [token]);

  const handleAuthSuccess = (u: User, t: string) => {
    localStorage.setItem("dg_jwt_token", t);
    setToken(t);
    setUser(u);
    setActiveTab("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("dg_jwt_token");
    setToken(null);
    setUser(null);
    setTasks([]);
  };

  const refetchTasksOnly = async () => {
    if (!token) return;
    try {
      const [taskList, profile] = await Promise.all([api.getTasks(), api.getMe()]);
      setTasks(taskList);
      setUser(profile); // Refreshes productivity Score
    } catch (e) {
      console.error("Refetch tasks failed:", e);
    }
  };

  const handleSelectTaskRiskRedirect = (taskId: string) => {
    setSelectedTaskForRisk(taskId);
    setActiveTab("risk");
  };

  if (!token || !user) {
    return <AuthView onAuthSuccess={handleAuthSuccess} />;
  }

  // Formatting local date
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Top Navigation Header */}
      <header className="h-16 bg-white border-b border-slate-200 shrink-0 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Logo element */}
          <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Shield className="h-5 w-5" />
          </div>
          <span className="font-display font-bold tracking-tight text-slate-900 text-lg">
            Deadline Guardian AI
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-slate-400 hidden md:inline-block">
            {todayLabel}
          </span>
          
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <UserIcon className="h-4 w-4 text-indigo-500" />
            <span className="text-slate-700 font-semibold">{user.name}</span>
          </div>

          <button
            onClick={() => setShowRightDrawer(!showRightDrawer)}
            className={`p-2 rounded-lg border transition-all cursor-pointer ${
              showRightDrawer 
                ? "bg-indigo-50 border-indigo-200 text-indigo-600" 
                : "border-slate-250 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
            title="Toggle AI Assistive Tray"
          >
            <Bot className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {/* Main Container Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side Navigation Sidebar */}
        <nav className={`bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-all duration-300 relative shrink-0 z-10 ${
          sidebarExpanded ? "w-64" : "w-16"
        }`}>
          <div className="py-6 space-y-6 flex-1 flex flex-col">
            
            {/* Sidebar toggle buttons */}
            <button
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className="absolute top-5 -right-3 h-6 w-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer z-20"
            >
              {sidebarExpanded ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            <div className="px-4 space-y-1">
              {[
                { id: "dashboard", label: "Overview", icon: LayoutDashboard },
                { id: "tasks", label: "Task Matrix", icon: CheckSquare },
                { id: "planner", label: "AI Planner", icon: Compass },
                { id: "risk", label: "Risk Predictor", icon: Sparkles },
                { id: "analytics", label: "Analytics", icon: BarChart3 },
              ].map((tab) => {
                const IconComp = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id !== "risk") setSelectedTaskForRisk(null);
                    }}
                    className={`w-full flex items-center gap-3 py-3 px-4 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <IconComp className="h-5 w-5 shrink-0" />
                    {sidebarExpanded && <span>{tab.label}</span>}
                  </button>
                );
              })}
            </div>

            {/* Premium Status Widget */}
            {sidebarExpanded && (
              <div className="mt-auto px-4 py-2">
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Gemini Live Status</p>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs text-slate-250 font-medium">Predicting Risks...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-800/60">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 py-2.5 px-4 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer"
            >
              <LogOut className="h-4.5 w-4.5 shrink-0" />
              {sidebarExpanded && <span>Sign Out</span>}
            </button>
          </div>
        </nav>

        {/* Dynamic Center Work Pane */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 lg:p-10 scrollbar-thin">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === "dashboard" && (
                <DashboardView
                  tasks={tasks}
                  productivityScore={user.productivityScore}
                  onNavigate={setActiveTab}
                  onSelectTaskRisk={handleSelectTaskRiskRedirect}
                />
              )}

              {activeTab === "tasks" && (
                <TaskView
                  tasks={tasks}
                  onTasksUpdated={refetchTasksOnly}
                  onSelectTaskRisk={handleSelectTaskRiskRedirect}
                />
              )}

              {activeTab === "planner" && (
                <PlannerView
                  tasks={tasks}
                  onTasksUpdated={refetchTasksOnly}
                />
              )}

              {activeTab === "risk" && (
                <RiskCenterView
                  tasks={tasks}
                  initialSelectedTaskId={selectedTaskForRisk}
                  onTasksUpdated={refetchTasksOnly}
                />
              )}

              {activeTab === "analytics" && (
                <AnalyticsView
                  tasksCount={tasks.length}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Right Adaptive AI Strategist Side panel */}
        <AnimatePresence>
          {showRightDrawer && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 350, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 26 }}
              className="bg-white border-l border-slate-200 shrink-0 overflow-hidden flex flex-col h-full relative"
            >
              <div className="p-5 flex-1 overflow-y-auto space-y-6 scrollbar-thin">
                
                {/* 1. Stack chatbot memory logs widget */}
                <ChatAdvisor tasksCount={tasks.length} />

                {/* 2. Stack voice conversation widget */}
                <LiveVoiceWidget />

              </div>
            </motion.aside>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
