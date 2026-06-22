import fs from "fs";
import path from "path";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  productivityScore: number;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  deadline: string; // ISO date string or YYYY-MM-DD
  effort: number;  // estimated effort in hours
  priority: "high" | "medium" | "low";
  statusKey: "pending" | "started" | "completed";
  riskScore: number; // 0-100
  riskReason: string;
  recommendations: string[];
  createdAt: string;
}

export interface DailyPlanItem {
  time: string; // e.g. "06:00 PM"
  taskTitle: string;
  durationMin: number;
  priority: "high" | "medium" | "low";
}

export interface DailyPlan {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  items: DailyPlanItem[];
  recommendations: string[];
  replannedAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string; // e.g., "created_task", "completed_task", "re-priority", "replanned"
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

interface DatabaseSchema {
  users: User[];
  tasks: Task[];
  dailyPlans: DailyPlan[];
  activityLogs: ActivityLog[];
  chatMessages: ChatMessage[];
}

const DB_FILE = path.join(process.cwd(), "data", "database.json");

class LocalDatabase {
  private data: DatabaseSchema = {
    users: [],
    tasks: [],
    dailyPlans: [],
    activityLogs: [],
    chatMessages: [],
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, "utf-8");
        this.data = JSON.parse(fileContent);
      } else {
        this.save();
      }
    } catch (e) {
      console.error("Error initializing local database:", e);
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (e) {
      console.error("Error writing to local database:", e);
    }
  }

  // --- USER CONTROLS ---
  getUsers(): User[] {
    return this.data.users || [];
  }

  getUserById(id: string): User | undefined {
    return this.getUsers().find((u) => u.id === id);
  }

  getUserByEmail(email: string): User | undefined {
    return this.getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  createUser(user: Omit<User, "id" | "createdAt" | "productivityScore">): User {
    const newUser: User = {
      ...user,
      id: Math.random().toString(36).substring(2, 11),
      createdAt: new Date().toISOString(),
      productivityScore: 75, // initial default productivity score
    };
    this.data.users = this.data.users || [];
    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  updateUserProductivity(userId: string, newScore: number): void {
    const user = this.getUserById(userId);
    if (user) {
      user.productivityScore = Math.min(100, Math.max(0, Math.round(newScore)));
      this.save();
    }
  }

  // --- TASK CONTROLS ---
  getTasks(userId: string): Task[] {
    return (this.data.tasks || []).filter((t) => t.userId === userId);
  }

  getTask(id: string): Task | undefined {
    return (this.data.tasks || []).find((t) => t.id === id);
  }

  createTask(userId: string, task: Omit<Task, "id" | "userId" | "createdAt">): Task {
    const newTask: Task = {
      ...task,
      id: "raw_" + Math.random().toString(36).substring(2, 11),
      userId,
      createdAt: new Date().toISOString(),
    };
    this.data.tasks = this.data.tasks || [];
    this.data.tasks.push(newTask);
    this.save();
    return newTask;
  }

  updateTask(id: string, taskData: Partial<Task>): Task | undefined {
    this.data.tasks = this.data.tasks || [];
    const index = this.data.tasks.findIndex((t) => t.id === id);
    if (index === -1) return undefined;

    const updatedTask = {
      ...this.data.tasks[index],
      ...taskData,
    };
    this.data.tasks[index] = updatedTask;
    this.save();
    return updatedTask;
  }

  deleteTask(id: string): boolean {
    this.data.tasks = this.data.tasks || [];
    const initialLen = this.data.tasks.length;
    this.data.tasks = this.data.tasks.filter((t) => t.id !== id);
    const deleted = this.data.tasks.length < initialLen;
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  // --- DAILY PLANS ---
  getDailyPlans(userId: string): DailyPlan[] {
    return (this.data.dailyPlans || []).filter((dp) => dp.userId === userId);
  }

  getDailyPlanForDate(userId: string, date: string): DailyPlan | undefined {
    return this.getDailyPlans(userId).find((dp) => dp.date === date);
  }

  saveDailyPlan(userId: string, date: string, items: DailyPlanItem[], recommendations: string[]): DailyPlan {
    this.data.dailyPlans = this.data.dailyPlans || [];
    const existingIndex = this.data.dailyPlans.findIndex(
      (dp) => dp.userId === userId && dp.date === date
    );

    const plan: DailyPlan = {
      id: "plan_" + Math.random().toString(36).substring(2, 11),
      userId,
      date,
      items,
      recommendations,
      replannedAt: new Date().toISOString(),
    };

    if (existingIndex !== -1) {
      this.data.dailyPlans[existingIndex] = plan;
    } else {
      this.data.dailyPlans.push(plan);
    }
    this.save();
    return plan;
  }

  // --- ACTIVITY LOGS ---
  getActivityLogs(userId: string): ActivityLog[] {
    return (this.data.activityLogs || [])
      .filter((log) => log.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  createActivityLog(userId: string, action: string, taskTitle: string, details: string): ActivityLog {
    const newLog: ActivityLog = {
      id: "log_" + Math.random().toString(36).substring(2, 11),
      userId,
      action,
      timestamp: new Date().toISOString(),
      taskTitle,
      details,
    };
    this.data.activityLogs = this.data.activityLogs || [];
    this.data.activityLogs.push(newLog);
    this.save();
    return newLog;
  }

  // --- CHAT MESSAGES ---
  getChatMessages(userId: string): ChatMessage[] {
    return (this.data.chatMessages || [])
      .filter((msg) => msg.userId === userId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  addChatMessage(userId: string, role: "user" | "model", content: string): ChatMessage {
    const newMsg: ChatMessage = {
      id: "chat_" + Math.random().toString(36).substring(2, 11),
      userId,
      role,
      content,
      timestamp: new Date().toISOString(),
    };
    this.data.chatMessages = this.data.chatMessages || [];
    this.data.chatMessages.push(newMsg);
    this.save();
    return newMsg;
  }

  clearChatHistory(userId: string): void {
    this.data.chatMessages = (this.data.chatMessages || []).filter((msg) => msg.userId !== userId);
    this.save();
  }
}

export const db = new LocalDatabase();
