import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

import { db, Task, User } from "./server/db";
import { requireAuth, generateToken, verifyPassword, hashPassword, AuthenticatedRequest } from "./server/auth";
import {
  analyzeNaturalLanguageTask,
  predictDeadlineRisk,
  generateDailyPlanner,
  generateReplanner,
  transcribeAudio,
  getGeneralChatResponse,
} from "./server/ai";
import { GoogleGenAI, Modality } from "@google/genai";

const app = express();
const PORT = 3000;

// Enable JSON bodies with higher limits for audio base64 uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// --- BASE API ROUTES ---

// Healthcheck
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Authentication: Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing required registration parameters." });
    }

    const existingUser = db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email is already registered." });
    }

    const passwordHash = await hashPassword(password);
    const user = db.createUser({ name, email, passwordHash });
    const token = generateToken(user.id);

    // Initial onboarding log
    db.createActivityLog(user.id, "register", "Account Created", `Welcome ${name}! Deadline Guardian AI is initialized.`);

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, productivityScore: user.productivityScore },
    });
  } catch (err: any) {
    console.error("Registration error:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred during registration." });
  }
});

// Authentication: Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required fields." });
    }

    const user = db.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password combination." });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid email or password combination." });
    }

    const token = generateToken(user.id);
    db.createActivityLog(user.id, "login", "User Login", `Authenticated successfully from client.`);

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, productivityScore: user.productivityScore },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred during login." });
  }
});

// Authentication: Current User info
app.get("/api/auth/me", requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    productivityScore: user.productivityScore,
  });
});

// --- OAUTH: GOOGLE ---
app.get("/api/auth/google/url", (req, res) => {
  const origin = req.query.origin as string || process.env.APP_URL || `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
  const redirectUri = `${origin}/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "email profile",
    access_type: "offline",
    prompt: "consent",
    state: redirectUri,
  });

  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

app.get(["/auth/google/callback", "/auth/google/callback/"], async (req, res) => {
  const { code, state } = req.query;
  const redirectUri = (state as string) || process.env.APP_URL + "/auth/google/callback" || `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}/auth/google/callback`;

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || "Failed to get token");
    }

    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userResponse.json();

    let user = db.getUserByEmail(userData.email);
    if (!user) {
      user = db.createUser({
        name: userData.name,
        email: userData.email,
        passwordHash: "google-oauth",
      });
      db.createActivityLog(user.id, "register", "Account Created via Google", `Welcome ${user.name}!`);
    } else {
      db.createActivityLog(user.id, "login", "User Login via Google", `Authenticated successfully.`);
    }

    const token = generateToken(user.id);
    const safeUser = { id: user.id, name: user.name, email: user.email, productivityScore: user.productivityScore };

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: '${token}', user: ${JSON.stringify(safeUser)} }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. You can close this window.</p>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("OAuth callback error:", error);
    res.send(`<p>Authentication failed: ${error.message}</p>`);
  }
});

// --- TASKS API WORKFLOWS ---

// GET: list developer tasks
app.get("/api/tasks", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const tasks = db.getTasks(req.user!.id);
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Parse via Natural Language and create, or create task manually
app.post("/api/tasks", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { title, deadline, effort, priority, textPrompt } = req.body;

    let finalTaskData = { title, deadline, effort: Number(effort || 2), priority: priority || "medium" };

    if (textPrompt) {
      // Feature 1: Natural Language Task Creation
      const aiResponse = await analyzeNaturalLanguageTask(textPrompt, new Date().toISOString());
      finalTaskData = {
        title: aiResponse.title,
        deadline: aiResponse.deadline,
        effort: Number(aiResponse.effort || 2),
        priority: aiResponse.priority || "medium",
      };
    }

    if (!finalTaskData.title || !finalTaskData.deadline) {
      return res.status(400).json({ error: "Task Title and Deadline date are required." });
    }

    // Feature 3: Automatically Predict Deadline Risk immediately during creation
    const otherTasks = db.getTasks(userId);
    const riskAnalysis = await predictDeadlineRisk(finalTaskData, otherTasks, new Date().toISOString());

    const createdTask = db.createTask(userId, {
      ...finalTaskData,
      statusKey: "pending",
      riskScore: riskAnalysis.riskScore,
      riskReason: riskAnalysis.explanation,
      recommendations: riskAnalysis.recommendations,
    });

    db.createActivityLog(
      userId,
      "create_task",
      createdTask.title,
      `Task created. Risk Score: ${createdTask.riskScore}%. Priority: ${createdTask.priority.toUpperCase()}`
    );

    // Recalculate general productivity scores based on risk distribution
    const activeTasks = otherTasks.concat(createdTask);
    const avgRisk = activeTasks.length > 0
      ? activeTasks.reduce((sum, t) => sum + (t.riskScore || 0), 0) / activeTasks.length
      : 0;
    // Score declines with more high-risk items
    const newProductivityScore = Math.max(10, 100 - avgRisk * 0.4);
    db.updateUserProductivity(userId, newProductivityScore);

    res.status(201).json(createdTask);
  } catch (err: any) {
    console.error("Create task failed:", err);
    res.status(500).json({ error: err.message || "Failed to finalize task creation." });
  }
});

// PUT: update task status / attributes and recalculate risk
app.put("/api/tasks/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const updates = req.body;

    const existingTask = db.getTask(id);
    if (!existingTask || existingTask.userId !== userId) {
      return res.status(404).json({ error: "Task not found." });
    }

    // Trigger log if task status flips
    const oldStatus = existingTask.statusKey;
    const newStatus = updates.statusKey;

    if (newStatus && oldStatus !== newStatus) {
      db.createActivityLog(
        userId,
        "status_change",
        existingTask.title,
        `Status updated from ${oldStatus.toUpperCase()} to ${newStatus.toUpperCase()}`
      );
    }

    // Perform complete reprediction if timeframe/effort shifts or they ask to force refresh risk
    let riskUpdates = {};
    if (updates.deadline || updates.effort || updates.priority || req.body.forceRiskRefresh) {
      const pendingTaskData = {
        title: updates.title || existingTask.title,
        deadline: updates.deadline || existingTask.deadline,
        effort: Number(updates.effort || existingTask.effort),
        priority: updates.priority || existingTask.priority,
      };
      const otherTasks = db.getTasks(userId).filter((t) => t.id !== id);
      const prediction = await predictDeadlineRisk(pendingTaskData, otherTasks, new Date().toISOString());
      riskUpdates = {
        riskScore: prediction.riskScore,
        riskReason: prediction.explanation,
        recommendations: prediction.recommendations,
      };
    } else if (newStatus === "completed") {
      // Completed, drop risk to 0
      riskUpdates = {
        riskScore: 0,
        riskReason: "Task completed successfully on schedule.",
        recommendations: ["Maintain this steady completion stride!"],
      };
    }

    const updated = db.updateTask(id, { ...updates, ...riskUpdates });

    // Reassess global productivity score
    const allTasks = db.getTasks(userId);
    const activeTasks = allTasks.filter((t) => t.statusKey !== "completed");
    const completedTasks = allTasks.filter((t) => t.statusKey === "completed");

    let coreProductivity = 75;
    if (activeTasks.length > 0) {
      const avgRisk = activeTasks.reduce((sum, t) => sum + (t.riskScore || 0), 0) / activeTasks.length;
      coreProductivity = Math.max(10, 100 - avgRisk * 0.5);
    } else if (completedTasks.length > 0) {
      coreProductivity = 100;
    }
    db.updateUserProductivity(userId, coreProductivity);

    res.json(updated);
  } catch (err: any) {
    console.error("Update task failed:", err);
    res.status(500).json({ error: err.message || "Failed to update task details." });
  }
});

// DELETE: remove a task
app.delete("/api/tasks/:id", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const task = db.getTask(id);
    if (!task || task.userId !== userId) {
      return res.status(404).json({ error: "Task not found." });
    }

    db.deleteTask(id);
    db.createActivityLog(userId, "delete_task", task.title, "Task purged from database.");
    res.json({ success: true, message: "Task successfully deleted." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADVANCED AI CONTROLLER APIS ---

// POST /api/ai/analyze-task: Natural Language parsing route
app.post("/api/ai/analyze-task", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { textPrompt } = req.body;
    if (!textPrompt) {
      return res.status(400).json({ error: "Natural language input payload textPrompt is required." });
    }

    const extracted = await analyzeNaturalLanguageTask(textPrompt, new Date().toISOString());
    res.json(extracted);
  } catch (err: any) {
    console.error("AI parse failed:", err);
    res.status(500).json({ error: err.message || "Failed to parse natural language input." });
  }
});

// POST /api/ai/risk-analysis: Recompute detailed AI risk score and suggestion list
app.post("/api/ai/risk-analysis", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.body;

    const task = db.getTask(taskId);
    if (!task || task.userId !== userId) {
      return res.status(404).json({ error: "Target task not found." });
    }

    const otherTasks = db.getTasks(userId).filter((t) => t.id !== taskId);
    const prediction = await predictDeadlineRisk(task, otherTasks, new Date().toISOString());

    // Update target task with new prediction results
    const updated = db.updateTask(taskId, {
      riskScore: prediction.riskScore,
      riskReason: prediction.explanation,
      recommendations: prediction.recommendations,
    });

    res.json(updated);
  } catch (err: any) {
    console.error("AI risk feedback failed:", err);
    res.status(500).json({ error: err.message || "Failed to query risk predictor." });
  }
});

// POST /api/ai/daily-plan: Generate optimized schedule blocks
app.post("/api/ai/daily-plan", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { targetDate, availableHours } = req.body;

    if (!targetDate || !availableHours) {
      return res.status(400).json({ error: "Target Date and Available Working Hours capacity must be configured." });
    }

    const hours = Number(availableHours);
    const tasks = db.getTasks(userId);

    const plannerResults = await generateDailyPlanner(userId, targetDate, hours, tasks, new Date().toISOString());

    // Save Daily Plan to database cache
    const savedPlan = db.saveDailyPlan(userId, targetDate, plannerResults.items, plannerResults.recommendations);

    db.createActivityLog(
      userId,
      "generate_planner",
      `Schedule: ${targetDate}`,
      `Generated AI Daily schedule with ${plannerResults.items.length} work blocks.`
    );

    res.json(savedPlan);
  } catch (err: any) {
    console.error("Daily planner generation failed:", err);
    res.status(500).json({ error: err.message || "Failed to synthesize day plan." });
  }
});

// GET: Fetch saved daily plan
app.get("/api/ai/daily-plan/:date", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { date } = req.params;
    const plan = db.getDailyPlanForDate(req.user!.id, date);
    if (!plan) return res.status(404).json({ error: "No plan generated yet for this date." });
    res.json(plan);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/replan: Smart Replanning Rescue Routine
app.post("/api/ai/replan", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { targetDate, availableHours } = req.body;

    if (!targetDate || !availableHours) {
      return res.status(400).json({ error: "A targetDate and availableHours calculation are required." });
    }

    const tasks = db.getTasks(userId);
    const activeTasks = tasks.filter((t) => t.statusKey !== "completed");
    const incompleteTasks = activeTasks.filter(
      (t) => t.statusKey === "started" || new Date(t.deadline).getTime() < new Date(targetDate).getTime()
    );
    const upcomingTasks = activeTasks.filter((t) => !incompleteTasks.some((it) => it.id === t.id));

    const hours = Number(availableHours);

    // Call AI rescue-planning algorithm
    const rescueResponse = await generateReplanner(
      null,
      incompleteTasks,
      upcomingTasks,
      hours,
      new Date().toISOString()
    );

    const savedPlan = db.saveDailyPlan(userId, targetDate, rescueResponse.items, rescueResponse.recommendations);

    // Dynamic logging
    db.createActivityLog(
      userId,
      "replan",
      `Rescue schedule: ${targetDate}`,
      `Smart replan triggered for ${incompleteTasks.length} legacy tasks.`
    );

    res.json(savedPlan);
  } catch (err: any) {
    console.error("Rescue plan generation failed:", err);
    res.status(500).json({ error: err.message || "Failed to replan daily timeline." });
  }
});

// POST /api/ai/transcribe: Audio Transcription endpoint
app.post("/api/ai/transcribe", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { audioData, mimeType } = req.body; // audioData is base64 string
    if (!audioData) {
      return res.status(400).json({ error: "Base64 string data of recorded audio is missing." });
    }

    const transcription = await transcribeAudio(audioData, mimeType || "audio/wav");
    res.json({ transcription });
  } catch (err: any) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: err.message || "Audio transcription failed." });
  }
});

// GET: Activity logs fetcher
app.get("/api/logs", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const logs = db.getActivityLogs(req.user!.id);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Fetch analytics package
app.get("/api/analytics", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const tasks = db.getTasks(userId);
    const logs = db.getActivityLogs(userId);

    const total = tasks.length;
    const completed = tasks.filter((t) => t.statusKey === "completed").length;
    const pending = tasks.filter((t) => t.statusKey === "pending").length;
    const started = tasks.filter((t) => t.statusKey === "started").length;
    const highRisk = tasks.filter((t) => t.statusKey !== "completed" && t.riskScore >= 70).length;

    // Build timeline counts for bento stats
    const categoryCounts = {
      high: tasks.filter((t) => t.priority === "high").length,
      medium: tasks.filter((t) => t.priority === "medium").length,
      low: tasks.filter((t) => t.priority === "low").length,
    };

    // Calculate Completion Rate Trend over last 7 logs
    const completedLogs = logs.filter((l) => l.action === "status_change" || l.action === "create_task").slice(0, 7);

    res.json({
      productivityScore: req.user!.productivityScore,
      stats: {
        total,
        completed,
        pending,
        started,
        highRisk,
        completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        categoryCounts,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- DYNAMIC MULTI-TURN CHAT BOT PORTS ---

// GET chat messages history
app.get("/api/ai/chat", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const history = db.getChatMessages(req.user!.id);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST chat prompt
app.post("/api/ai/chat", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt query payload." });
    }

    // Save user's question
    db.addChatMessage(userId, "user", prompt);

    // Fetch previous thread messages
    const pastChatHistory = db.getChatMessages(userId);

    // Compile active tasks to feed AI insights
    const currentTasks = db.getTasks(userId);

    // Call Multi-turn advisor with full memory context
    const textResult = await getGeneralChatResponse(
      pastChatHistory,
      prompt,
      currentTasks,
      new Date().toISOString()
    );

    // Save model's response
    const savedResponse = db.addChatMessage(userId, "model", textResult);

    res.status(201).json(savedResponse);
  } catch (err: any) {
    console.error("AI advisor failure:", err);
    res.status(500).json({ error: err.message || "Failed to parse advice stream." });
  }
});

// DELETE chat history
app.delete("/api/ai/chat", requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    db.clearChatHistory(req.user!.id);
    res.json({ message: "Conversational advisor logs wiped successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- VITE MIDDLEWARE BOOTSTRAPPER AND STATIC ROUTE ASSIGNER ---

async function startServer() {
  const server = http.createServer(app);

  // Initialize WebSockets on the server instance
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const { pathname } = new URL(request.url || "", `http://${request.headers.host}`);
    if (pathname === "/api/live-stream") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Handle Gemini Live Audio WebSockets using Zephyr speech
  wss.on("connection", async (clientWs: WebSocket) => {
    console.log("Real-time Gemini Voice socket successfully connected.");

    const genAi = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: { "User-Agent": "aistudio-build" },
      },
    });

    let liveSession: any = null;

    try {
      liveSession = await genAi.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction:
            "You are a welcoming real-time productivity assistant for Deadline Guardian AI. Keep your voice responses supportive, quick, and conversational. Give guidance on deadlines.",
        },
        callbacks: {
          onmessage: (message) => {
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              clientWs.send(JSON.stringify({ audio: audioData }));
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
        },
      });

      clientWs.on("message", (msgStr) => {
        try {
          const parsed = JSON.parse(msgStr.toString());
          if (parsed.audio && liveSession) {
            liveSession.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
        } catch (e) {
          console.error("Socket translation malfunction:", e);
        }
      });
    } catch (conErr) {
      console.error("Error setting up Gemini Live socket:", conErr);
      clientWs.send(JSON.stringify({ error: "Failed to establish AI Live network link." }));
    }

    clientWs.on("close", () => {
      console.log("Client dropped voice connection.");
      if (liveSession) {
        try {
          liveSession.close();
        } catch (_) {}
      }
    });
  });

  // Hot Reload and Asset compiling handling via Vite Middlewares
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind server listener
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Deadline Guardian API] Running full-stack on http://localhost:${PORT}`);
  });
}

startServer().catch((e) => {
  console.error("Full-stack boots failure:", e);
});
