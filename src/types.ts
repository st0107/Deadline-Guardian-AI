export interface User {
  id: string;
  name: string;
  email: string;
  productivityScore: number;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  deadline: string;
  effort: number;
  priority: "high" | "medium" | "low";
  statusKey: "pending" | "started" | "completed";
  riskScore: number;
  riskReason: string;
  recommendations: string[];
  createdAt: string;
  time?: string;
  reminder?: string;
}

export interface DailyPlanItem {
  time: string;
  taskTitle: string;
  durationMin: number;
  priority: "high" | "medium" | "low";
}

export interface DailyPlan {
  id: string;
  userId: string;
  date: string;
  items: DailyPlanItem[];
  recommendations: string[];
  replannedAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
  taskTitle: string;
  details: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
}

export interface AnalyticsStats {
  productivityScore: number;
  stats: {
    total: number;
    completed: number;
    pending: number;
    started: number;
    highRisk: number;
    completionPercentage: number;
    categoryCounts: {
      high: number;
      medium: number;
      low: number;
    };
  };
}
