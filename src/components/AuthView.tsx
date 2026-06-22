import React, { useState } from "react";
import { api } from "../api";
import { User } from "../types";
import { Shield, Sparkles, LogIn, UserPlus } from "lucide-react";
import { motion } from "motion/react";

interface AuthViewProps {
  onAuthSuccess: (user: User, token: string) => void;
}

export default function AuthView({ onAuthSuccess }: AuthViewProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        if (!email || !password) throw new Error("Please fill in all credentials.");
        const data = await api.login(email, password);
        onAuthSuccess(data.user, data.token);
      } else {
        if (!name || !email || !password) throw new Error("Please fill in all registration fields.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        const data = await api.register(name, email, password);
        onAuthSuccess(data.user, data.token);
      }
    } catch (err: any) {
      setError(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth_container" className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        
        {/* Left Pane: Brand & Product Value */}
        <div className="p-8 md:p-12 bg-gradient-to-br from-indigo-700 via-indigo-800 to-indigo-900 flex flex-col justify-between text-indigo-100">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-2xs">
                <Shield className="h-5 w-5" />
              </div>
              <span className="font-display font-extrabold tracking-tight text-xl text-white">Deadline Guardian AI</span>
            </div>
            
            <div className="mt-12 space-y-6">
              <h1 className="font-display text-3xl font-extrabold leading-tight text-white tracking-tight">
                Transform from reminders to <span className="text-emerald-300">AI-Guided execution.</span>
              </h1>
              <p className="text-sm text-indigo-100/90 leading-relaxed max-w-sm font-medium">
                Deadline Guardian predicts task risks, structures intelligent daily timelines, and automatically suggests recovery plans when tasks fall behind.
              </p>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-indigo-600/50 space-y-3">
            <div className="flex items-center gap-3 text-xs text-indigo-200 font-semibold">
              <Sparkles className="h-4 w-4 text-emerald-300" />
              <span>Deeply integrated with Google's Gemini Models</span>
            </div>
            <p className="text-[11px] text-indigo-200/80 font-mono font-medium">
              Empowering students, professionals, and side-hustlers to finish early.
            </p>
          </div>
        </div>
        
        {/* Right Pane: Login Form */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-white">
          <div className="mb-8">
            <h2 className="font-display font-extrabold text-2xl text-slate-900">
              {isLogin ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-sm font-medium text-slate-500 mt-1">
              {isLogin 
                ? "Enter your credentials to enter the AI productivity nexus." 
                : "Initialize your Deadline Guardian profile."}
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl p-3.5 mb-6 text-center font-semibold"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 placeholder:text-slate-400 font-medium transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="yourname@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 placeholder:text-slate-400 font-medium transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 placeholder:text-slate-400 font-medium transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-650 hover:bg-indigo-700 text-white text-sm font-bold py-3.5 px-4 rounded-xl mt-6 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-md"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isLogin ? (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>Access Platform</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Register Account</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-slate-100 pt-6">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
              }}
              className="text-xs text-slate-500 hover:text-indigo-600 font-semibold transition-colors cursor-pointer"
            >
              {isLogin ? (
                <span>Don't have an account? <strong className="text-indigo-650">Register</strong></span>
              ) : (
                <span>Already have an account? <strong className="text-indigo-650">Log In</strong></span>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
