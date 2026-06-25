import { User, Task, DailyPlan, ActivityLog, ChatMessage, AnalyticsStats } from "./types";

const getHeaders = () => {
  const token = localStorage.getItem("dg_jwt_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Login validation failed.");
    }
    return res.json();
  },

  async register(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Registration validation failed.");
    }
    return res.json();
  },

  async getMe(): Promise<User> {
    const res = await fetch("/api/auth/me", {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error("Expired session.");
    }
    return res.json();
  },

  // Tasks
  async getTasks(): Promise<Task[]> {
    const res = await fetch("/api/tasks", { headers: getHeaders() });
    return res.json();
  },

  async createTask(taskData: { title?: string; deadline?: string; effort?: number; priority?: string; textPrompt?: string }): Promise<Task> {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(taskData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to process task entry.");
    }
    return res.json();
  },

  async updateTask(id: string, updates: Partial<Task> & { forceRiskRefresh?: boolean }): Promise<Task> {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update task.");
    }
    return res.json();
  },

  async deleteTask(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return res.json();
  },

  // AI Planner
  async generateDailyPlan(targetDate: string, availableHours: number): Promise<DailyPlan> {
    const res = await fetch("/api/ai/daily-plan", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ targetDate, availableHours }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed planning sequence.");
    }
    return res.json();
  },

  async getDailyPlan(date: string): Promise<DailyPlan> {
    const res = await fetch(`/api/ai/daily-plan/${date}`, { headers: getHeaders() });
    if (!res.ok) {
      throw new Error("No plan configured for date.");
    }
    return res.json();
  },

  async triggerReplan(targetDate: string, availableHours: number): Promise<DailyPlan> {
    const res = await fetch("/api/ai/replan", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ targetDate, availableHours }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "AI automatic rescue replanning block failed.");
    }
    return res.json();
  },

  // AI Assistive endpoints
  async triggerRiskAnalysis(taskId: string): Promise<Task> {
    const res = await fetch("/api/ai/risk-analysis", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ taskId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Predictor analysis error.");
    }
    return res.json();
  },

  async transcribeAudio(audioBase64: string, mimeType: string): Promise<{ transcription: string }> {
    const res = await fetch("/api/ai/transcribe", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ audioData: audioBase64, mimeType }),
    });
    if (!res.ok) {
      throw new Error("Transcriber processing malfunction.");
    }
    return res.json();
  },

  // Advisor Chat
  async getChatHistory(): Promise<ChatMessage[]> {
    const res = await fetch("/api/ai/chat", { headers: getHeaders() });
    return res.json();
  },

  async sendChatMessage(prompt: string): Promise<ChatMessage> {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Writers block error.");
    }
    return res.json();
  },

  async clearChatHistory(): Promise<void> {
    await fetch("/api/ai/chat", {
      method: "DELETE",
      headers: getHeaders(),
    });
  },

  // Logs & Analytics
  async getLogs(): Promise<ActivityLog[]> {
    const res = await fetch("/api/logs", { headers: getHeaders() });
    return res.json();
  },

  async getAnalytics(): Promise<AnalyticsStats> {
    const res = await fetch("/api/analytics", { headers: getHeaders() });
    if (!res.ok) {
      throw new Error("Failed to fetch analytics aggregates.");
    }
    return res.json();
  },
};
