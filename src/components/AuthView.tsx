import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith(".run.app") && !event.origin.includes("localhost")) {
        return;
      }
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        setLoading(false);
        onAuthSuccess(event.data.user, event.data.token);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onAuthSuccess]);

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/auth/google/url");
      if (!res.ok) throw new Error("Failed to get Google Auth URL");
      const { url } = await res.json();
      
      const authWindow = window.open(url, "oauth_popup", "width=600,height=700");
      if (!authWindow) {
        throw new Error("Popup blocked. Please allow popups for this site.");
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

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
        <div className="hidden md:flex p-8 md:p-12 bg-gradient-to-br from-indigo-700 via-indigo-800 to-indigo-900 flex-col justify-between text-indigo-100">
          <div>
            <div className="flex items-center gap-3">
              <img src="/icon.svg" alt="Deadline Guardian Logo" className="h-10 w-10 shrink-0 shadow-sm rounded-xl border border-white/20" />
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
        <div className="p-5 sm:p-8 md:p-12 flex flex-col justify-center bg-white">
          <div className="mb-5 md:mb-8">
            <div className="flex md:hidden items-center gap-2 mb-4">
               <img src="/icon.svg" alt="Deadline Guardian Logo" className="h-8 w-8 shrink-0 shadow-sm rounded-xl" />
               <span className="font-display font-extrabold tracking-tight text-lg text-slate-900">Deadline Guardian AI</span>
            </div>
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

          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
            {!isLogin && (
              <div>
                <label htmlFor="fullName" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 md:py-3 px-4 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400 font-medium transition-all"
                />
              </div>
            )}

            <div>
              <label htmlFor="emailAddress" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Email Address
              </label>
              <input
                id="emailAddress"
                type="email"
                required
                placeholder="yourname@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 md:py-3 px-4 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400 font-medium transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 md:py-3 px-4 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400 font-medium transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-base font-bold py-3 md:py-3.5 px-4 rounded-xl mt-4 md:mt-6 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-md"
              aria-label={isLogin ? "Login with email" : "Register with email"}
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isLogin ? (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>Login with Email</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Register Account</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-4 md:mt-6 flex items-center justify-between">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">OR</span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>

          <button
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 text-base font-bold py-3 md:py-3.5 px-4 rounded-xl mt-4 md:mt-6 flex items-center justify-center gap-3 transition-all disabled:opacity-50 cursor-pointer shadow-sm border border-slate-200"
            aria-label="Continue with Google"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="mt-5 md:mt-8 text-center border-t border-slate-100 pt-4 md:pt-6">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
              }}
              className="text-sm text-slate-500 hover:text-indigo-600 font-semibold transition-colors cursor-pointer"
              aria-label={isLogin ? "Switch to register" : "Switch to login"}
            >
              {isLogin ? (
                <span>Don't have an account? <strong className="text-indigo-600">Register</strong></span>
              ) : (
                <span>Already have an account? <strong className="text-indigo-600">Log In</strong></span>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
