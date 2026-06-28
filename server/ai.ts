import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import crypto from "crypto";

// Initialize Gemini SDK with custom user-agent header
const aiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Simple in-memory cache to save API costs and improve latency
const apiCache = new Map<string, { timestamp: number; data: string }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function getCacheKey(payload: any): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function cachedGenerateContent(options: any): Promise<{ text: string }> {
  const cacheKey = getCacheKey(options);
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[AI SDK] Cache hit for key: ${cacheKey}`);
    return { text: cached.data };
  }

  const response = await retryWithBackoff(() => aiClient.models.generateContent(options));
  const text = response.text || "";
  
  if (text) {
    // Basic limit to prevent boundless memory growth
    if (apiCache.size > 1000) {
      const firstKey = apiCache.keys().next().value;
      if (firstKey) apiCache.delete(firstKey);
    }
    apiCache.set(cacheKey, { timestamp: Date.now(), data: text });
  }
  
  return { text };
}

/**
 * Exponential backoff wrapper for transient/overloaded/quota API errors (e.g. 503, 429)
 */
async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 5, initialDelayMs = 1500): Promise<T> {
  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const errMsg = String(err?.message || err);
      // Transient / load errors that are retry-worthy
      const isTransient =
        errMsg.includes("503") ||
        errMsg.includes("UNAVAILABLE") ||
        errMsg.includes("429") ||
        errMsg.includes("rate limit") ||
        errMsg.includes("quota") ||
        errMsg.includes("Quota") ||
        errMsg.includes("exhausted") ||
        errMsg.includes("demand") ||
        errMsg.includes("409") ||
        errMsg.includes("Conflict");

      if (!isTransient || attempt === maxRetries) {
        throw err;
      }

      // Add small randomness (jitter) to avoid thundering herd
      const jitter = Math.floor(Math.random() * 500);
      const currentDelay = delay + jitter;
      
      console.warn(`[AI SDK] Transient error encountered on attempt ${attempt}: ${errMsg}. Retrying in ${currentDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      delay *= 2; // Scale delay exponentially
    }
  }
  throw new Error("Retry logic terminated unexpectedly.");
}

/**
 * Feature 1: Analyze natural language task and extract structured task attributes
 */
export async function analyzeNaturalLanguageTask(textInput: string, currentLocalTime: string) {
  const prompt = `
Context: Today's date and time is: ${currentLocalTime}.
Please analyze this natural language instruction for a task and extract:
1. Task Title (short, active, actionable)
2. Task Deadline in "YYYY-MM-DD" format. If a relative date is stated (e.g. "Friday", "next week", "in 3 weeks", "tomorrow"), calculate it relative to today: ${currentLocalTime}. If no date is given, default to 3 days from today.
3. Estimated effort in hours (integer). Understimate/overestimate based on task description. Default is 2 hours.
4. Priority ("high", "medium", or "low") based on deadline proximity, keyword urgency, or difficulty.
5. Task Scheduled Time: If a specific time is mentioned (e.g. "at 3:30 PM", "9am", "18:00"), convert it to 24-hour "HH:MM" format (e.g., "15:30", "09:00"). If no time is explicitly mentioned, return an empty string "".
6. Reminder Interval: If a reminder or alert is mentioned (e.g., "remind me 30 mins before", "alert me at that time", "reminder 1 hour prior"), map it to one of these values: "none", "0min", "15min", "30min", "1hour", "1day". If not specified, default to "none".

Input task description: "${textInput}"
`;

  try {
    const response = await cachedGenerateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Actionable title of the task",
            },
            deadline: {
              type: Type.STRING,
              description: "Calculated deadline string in YYYY-MM-DD format",
            },
            effort: {
              type: Type.INTEGER,
              description: "Estimated hours needed to complete",
            },
            priority: {
              type: Type.STRING,
              description: "Task priority level",
              enum: ["high", "medium", "low"],
            },
            time: {
              type: Type.STRING,
              description: "Extracted start time of the task in HH:MM 24h format, or empty string if not explicitly mentioned",
            },
            reminder: {
              type: Type.STRING,
              description: "Extracted reminder offset from: none, 0min, 15min, 30min, 1hour, 1day",
              enum: ["none", "0min", "15min", "30min", "1hour", "1day"],
            },
          },
          required: ["title", "deadline", "effort", "priority", "time", "reminder"],
        },
      },
    });

    return JSON.parse(response.text.trim());
  } catch (err: any) {
    console.warn("Gemini parsing failed (falling back to local heuristic parsing parser):", err);
    
    // Offline / quota fallback heuristics parser
    const cleanedText = (textInput || "").trim().replace(/^['"]|['"]$/g, "");
    
    let futureDays = 3; 
    const lowerInput = cleanedText.toLowerCase();
    if (lowerInput.includes("tomorrow")) {
      futureDays = 1;
    } else if (lowerInput.includes("today")) {
      futureDays = 0;
    } else {
      const matchDays = lowerInput.match(/in (\d+)\s*days?/);
      if (matchDays && matchDays[1]) {
        futureDays = parseInt(matchDays[1], 10);
      }
    }
    
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + futureDays);
    const deadlineStr = targetDate.toISOString().split("T")[0];

    let effortEst = 2;
    const matchEffort = lowerInput.match(/(\d+)\s*(h|hr|hour|hrs)/);
    if (matchEffort && matchEffort[1]) {
      effortEst = parseInt(matchEffort[1], 10);
    }

    let prio = "medium";
    if (lowerInput.includes("high") || lowerInput.includes("urgent") || lowerInput.includes("critical")) {
      prio = "high";
    } else if (lowerInput.includes("low") || lowerInput.includes("relaxed") || lowerInput.includes("easy")) {
      prio = "low";
    }

    const titleVal = cleanedText.length > 50 ? cleanedText.substring(0, 47) + "..." : cleanedText;

    return {
      title: titleVal || "Voice/Text Extracted Task",
      deadline: deadlineStr,
      effort: effortEst,
      priority: prio,
      time: "",
      reminder: "none"
    };
  }
}

/**
 * Feature 3: Deadline Risk Prediction (Complex Analysis - uses gemini-3.1-pro-preview + HIGH thinking)
 */
export async function predictDeadlineRisk(
  task: { title: string; deadline: string; effort: number; priority: string },
  otherTasks: { title: string; deadline: string; effort: number; priority: string; statusKey: string }[],
  currentLocalTime: string
) {
  const activeTasksSummary = otherTasks
    .filter((t) => t.statusKey !== "completed")
    .map((t) => `- "${t.title}" (deadline: ${t.deadline}, effort: ${t.effort}h, priority: ${t.priority})`)
    .join("\n");

  const prompt = `
Context: Current datetime is ${currentLocalTime}.
You are an expert project risk manager. Analyze the deadline risk for the following target task:
- Title: "${task.title}"
- Deadline: ${task.deadline}
- Effort Required: ${task.effort} hours
- Priority: ${task.priority}

Active companion tasks competing for the user's available time:
${activeTasksSummary || "No other competing active tasks."}

Calculate:
1. Risk Score (0 to 100). Higher means higher risk of missing the deadline. Consider:
   - Proximity of the deadline from today (${currentLocalTime}) vs. hours of effort required
   - Total workload competing for available working hours (assuming about 4 working hours available per day)
   - Task complexity and priority
2. High-fidelity reason explaining the exact bottleneck (e.g. overlapping deadlines, high workload day, high complexity)
3. Actionable, step-by-step recommended actions (at least 3 items) to mitigate risk (e.g., start today, block 2 hours daily, delegate/compress requirements).

Be hyper-realistic, objective, and structured. Do not larp or make up artificial telemetry lines.
`;

  try {
    // Use the highly capable gemini-3.5-flash model for risk evaluation
    const response = await cachedGenerateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: {
              type: Type.INTEGER,
              description: "Risk score from 0 to 100",
            },
            explanation: {
              type: Type.STRING,
              description: "A detailed but professional explanation of the calculated risk",
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Actionable checklist items to bring the risk score down",
            },
          },
          required: ["riskScore", "explanation", "recommendations"],
        },
      },
    });

    return JSON.parse(response.text.trim());
  } catch (err: any) {
    console.warn("predictDeadlineRisk error (falling back to baseline mathematical heuristics):", err);
    
    const errorStr = err?.message || String(err);
    const isQuota = errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("Quota") || errorStr.includes("exhausted");
    
    // Heuristic Offline Risk Calculation
    let baseScore = 20;
    if (task.priority === "high") baseScore = 55;
    else if (task.priority === "medium") baseScore = 35;
    
    // Check deadline proximity
    const targetDate = new Date(task.deadline);
    const today = new Date();
    const diffMs = targetDate.getTime() - today.getTime();
    const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    
    if (diffDays <= 1) {
      baseScore += 35;
    } else if (diffDays <= 3) {
      baseScore += 25;
    } else if (diffDays <= 7) {
      baseScore += 15;
    }
    
    // Active work overload factor
    const activeTasksCount = otherTasks.filter((t) => t.statusKey !== "completed").length;
    baseScore += Math.min(20, activeTasksCount * 4);
    
    const finalScore = Math.min(95, Math.max(5, baseScore));
    
    const statusText = isQuota 
      ? "(Offline Heuristic Active — Gemini daily quota limit reached)" 
      : "(Offline Heuristic Fallback Mode)";
      
    const explanation = `Heuristics algorithm evaluated this task to carry a ${finalScore}% deadline risk. ${statusText}. A total of ${activeTasksCount} concurrent active projects are currently contending for your allocated calendar schedule. The task requires ${task.effort}h of effort within a ${diffDays}-day window.`;
    
    return {
      riskScore: finalScore,
      explanation: explanation,
      recommendations: [
        `Divide this project into smaller, digestible micro-contributions immediately to avoid end-of-week cramming.`,
        `Pre-commit and time-block active slots of at least 45 minutes on your student/work calendar for "${task.title}".`,
        `Prioritize completion of concurrent high-priority blockers to clear cognitive bandwidth.`,
        `Update the status of this task to "started" as soon as you execute your first action step.`
      ]
    };
  }
}

/**
 * Feature 4: Daily Work Planner
 */
export async function generateDailyPlanner(
  userId: string,
  targetDate: string,
  availableHours: number,
  tasks: { title: string; deadline: string; effort: number; priority: string; statusKey: string }[],
  currentLocalTime: string
) {
  const tasksSummary = tasks
    .filter((t) => t.statusKey !== "completed")
    .map((t) => `- "${t.title}" (deadline: ${t.deadline}, effort remaining: ${t.effort}h, priority: ${t.priority}, status: ${t.statusKey})`)
    .join("\n");

  const prompt = `
Context: Current datetime is ${currentLocalTime}.
Target planning date: ${targetDate}.
Working hours user has allocated for productivity today: ${availableHours} hours.

Outstanding active tasks to plan:
${tasksSummary || "No active tasks."}

Generate a beautifully optimized hour-by-hour execution schedule (in blocks) matching today's available hours limit.
Do not exceed ${availableHours} hours total duration in the timeline.
Timeline blocks should begin around 9:00 AM (or early evening if appropriate, e.g. 6:00 PM onwards if tasks look like a study/learning/side-project list). Prefer starting the schedule blocks realistically.

Return a JSON object with:
1. items: an array of time blocks, each having 'time' (e.g., "09:00 AM", "11:00 AM", "02:00 PM"), 'taskTitle' (from the list, or special breaks/buffer periods if needed), 'durationMin' (integer duration in minutes), and 'priority' ("high"|"medium"|"low").
2. recommendations: array of productivity recommendations tailored for the schedule (e.g. "Do the complex code design block first when cognitive load is fresh", "Keep a 10 min break").
`;

  try {
    const response = await cachedGenerateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING, description: "Start time block title, e.g. 06:00 PM" },
                  taskTitle: { type: Type.STRING, description: "Title of the task or buffer block" },
                  durationMin: { type: Type.INTEGER, description: "Elapsed time block in minutes" },
                  priority: { type: Type.STRING, enum: ["high", "medium", "low"] },
                },
                required: ["time", "taskTitle", "durationMin", "priority"],
              },
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of personalized schedule rules or advice",
            },
          },
          required: ["items", "recommendations"],
        },
      },
    });

    return JSON.parse(response.text.trim());
  } catch (err: any) {
    console.warn("generateDailyPlanner failed (falling back to offline schedule synthesis):", err);
    
    // Heuristic Scheduler Fallback
    const activeTasks = tasks.filter((t) => t.statusKey !== "completed");
    const scheduleItems: any[] = [];
    let currentHour = 9;
    let totalMinutes = 0;
    const maxMinutes = availableHours * 60;

    activeTasks.forEach((task) => {
      if (totalMinutes >= maxMinutes) return;
      
      const duration = Math.min(120, maxMinutes - totalMinutes);
      if (duration < 30) return;

      const meridiem = currentHour >= 12 ? "PM" : "AM";
      const displayHour = currentHour > 12 ? currentHour - 12 : currentHour;
      const formattedTime = `${displayHour < 10 ? "0" + displayHour : displayHour}:00 ${meridiem}`;

      scheduleItems.push({
        time: formattedTime,
        taskTitle: task.title,
        durationMin: duration,
        priority: task.priority || "medium",
      });

      totalMinutes += duration;
      currentHour += Math.ceil(duration / 60);

      if (totalMinutes < maxMinutes && maxMinutes - totalMinutes >= 15) {
        const breakMeridiem = currentHour >= 12 ? "PM" : "AM";
        const breakDisplayHour = currentHour > 12 ? currentHour - 12 : currentHour;
        const breakTime = `${breakDisplayHour < 10 ? "0" + breakDisplayHour : breakDisplayHour}:00 ${breakMeridiem}`;
        
        scheduleItems.push({
          time: breakTime,
          taskTitle: "Refocus & Hydration Break",
          durationMin: 15,
          priority: "low",
        });
        totalMinutes += 15;
      }
    });

    if (scheduleItems.length === 0) {
      scheduleItems.push({
        time: "09:00 AM",
        taskTitle: "Initial Focus Setup & Strategic Strategy Layout",
        durationMin: 60,
        priority: "medium",
      });
    }

    return {
      items: scheduleItems,
      recommendations: [
        "Offline productivity scheduler is active (Gemini daily rate-limit / quota reached). Your plans loaded successfully!",
        "Take on high-priority blocks first during peak morning focus.",
        "Include light leg stretching or desk hydration elements during Refocus Breaks."
      ],
    };
  }
}

/**
 * Feature 5: Smart Replanning
 */
export async function generateReplanner(
  previousPlan: { items: any[]; date: string } | null,
  incompleteTasks: { title: string; deadline: string; effort: number; priority: string }[],
  upcomingTasks: { title: string; deadline: string; effort: number; priority: string }[],
  availableHours: number,
  currentLocalTime: string
) {
  const incompleteSummary = incompleteTasks
    .map((t) => `- "${t.title}" (deadline: ${t.deadline}, remaining: ${t.effort}h, priority: ${t.priority})`)
    .join("\n");

  const upcomingSummary = upcomingTasks
    .map((t) => `- "${t.title}" (deadline: ${t.deadline}, effort: ${t.effort}h, priority: ${t.priority})`)
    .join("\n");

  const prompt = `
Context: Current datetime is ${currentLocalTime}.
Yesterday some planned tasks were left INCOMPLETE. We must automatically re-calculate and re-plan.
Available working hours for new session: ${availableHours} hours.

Tasks left incomplete from prior session:
${incompleteSummary || "No incomplete tasks."}

Other upcoming tasks to integrate:
${upcomingSummary || "No other upcoming tasks."}

Re-schedule and re-calculate priorities immediately. Optimize the timeline to prioritize clearing overdue and high-urgency tasks first, then distributing upcoming work. All within the user's defined available hours (${availableHours} hours).

Return:
1. items: Hour-by-hour schedule array where each item has time (e.g. "06:00 PM"), taskTitle, durationMin, priority.
2. recommendations: Focus or rescue strategies for recovery (e.g., "Priority is on recovering the unfinished React code").
`;

  try {
    const response = await cachedGenerateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  taskTitle: { type: Type.STRING },
                  durationMin: { type: Type.INTEGER },
                  priority: { type: Type.STRING, enum: ["high", "medium", "low"] },
                },
                required: ["time", "taskTitle", "durationMin", "priority"],
              },
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["items", "recommendations"],
        },
      },
    });

    return JSON.parse(response.text.trim());
  } catch (err: any) {
    console.warn("generateReplanner failed (falling back to offline rescue scheduling):", err);
    
    // Heuristic Replanner Fallback
    const scheduleItems: any[] = [];
    let currentHour = 10; 
    let totalMinutes = 0;
    const maxMinutes = availableHours * 60;

    const eligibleTasks = [...incompleteTasks, ...upcomingTasks];

    eligibleTasks.forEach((task) => {
      if (totalMinutes >= maxMinutes) return;
      
      const duration = Math.min(90, maxMinutes - totalMinutes);
      if (duration < 30) return;

      const meridiem = currentHour >= 12 ? "PM" : "AM";
      const displayHour = currentHour > 12 ? currentHour - 12 : currentHour;
      const formattedTime = `${displayHour < 10 ? "0" + displayHour : displayHour}:00 ${meridiem}`;

      scheduleItems.push({
        time: formattedTime,
        taskTitle: `[REPLANNED] ${task.title}`,
        durationMin: duration,
        priority: task.priority || "high",
      });

      totalMinutes += duration;
      currentHour += Math.ceil(duration / 60);

      if (totalMinutes < maxMinutes && maxMinutes - totalMinutes >= 15) {
        const breakMeridiem = currentHour >= 12 ? "PM" : "AM";
        const breakDisplayHour = currentHour > 12 ? currentHour - 12 : currentHour;
        const breakTime = `${breakDisplayHour < 10 ? "0" + breakDisplayHour : breakDisplayHour}:00 ${breakMeridiem}`;
        
        scheduleItems.push({
          time: breakTime,
          taskTitle: "Brief Refocus Session",
          durationMin: 15,
          priority: "low",
        });
        totalMinutes += 15;
      }
    });

    if (scheduleItems.length === 0) {
      scheduleItems.push({
        time: "10:00 AM",
        taskTitle: "Task Clean-Up & Strategic Workspace Prep",
        durationMin: 60,
        priority: "high",
      });
    }

    return {
      items: scheduleItems,
      recommendations: [
        "Offline rescue plan activated due to Gemini quota limits.",
        "Your left-over incomplete tasks have been automatically frontloaded.",
        "Ensure to complete outstanding projects before adding new milestones."
      ],
    };
  }
}

/**
 * Feature: Audio Transcription (Using gemini-3.5-flash as specified in requirements)
 */
export async function transcribeAudio(audioBase64: string, mimeType: string = "audio/wav") {
  try {
    const response = await cachedGenerateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType,
            data: audioBase64,
          },
        },
        "You are a stellar transcriber. Transcribe the spoken audio into clear English text. If there is no talking or silence, output an empty response. Otherwise, output ONLY the transcription text. Do not add metadata, footnotes, or conversational padding.",
      ],
    });

    return response.text ? response.text.trim() : "";
  } catch (err: any) {
    console.error("Transcribe audio error:", err);
    const errorStr = err?.message || String(err);
    if (errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("Quota") || errorStr.includes("exhausted")) {
      throw new Error("Voice transcription is temporarily offline due to Gemini 20 requests/day quota limit. Please type your task description manually!");
    }
    throw new Error("Transcriber processing malfunction. Details: " + errorStr);
  }
}

/**
 * Feature: Multi-Turn AI Chat (Maintaining History + Proactive Assistance + High Thinking)
 */
export async function getGeneralChatResponse(
  history: { role: "user" | "model"; content: string }[],
  latestPrompt: string,
  currentTasks: any[],
  currentLocalTime: string
) {
  const chatContext = `
You are 'Deadline Guardian AI', a proactive, highly intelligent productivity strategist.
Your mission is to help students, entrepreneurs, and busy professionals manage their work, predict risk, and outline concrete milestones.

Today's current local time is: ${currentLocalTime}.

User's active (non-completed) tasks:
${currentTasks
  .filter((t) => t.statusKey !== "completed")
  .map((t) => `- "${t.title}" [ID: ${t.id}, Deadline: ${t.deadline}, Time: ${t.time || "none"}, Reminder: ${t.reminder || "none"}, Effort: ${t.effort}h, Priority: ${t.priority}, Risk: ${t.riskScore}%]`)
  .join("\n") || "No current active tasks. Ask the user what they have on their radar!"}

Instructions:
1. Maintain client context and refer to their active tasks naturally.
2. Be brief, actionable, and encouraging. Focus heavily on practical steps.
3. If they ask a complex strategy question (e.g., "How should I structure my work?", "I am feeling overwhelmed"), leverage deep reasoning and offer micro-steps.
4. Keep conversations human, encouraging, and free from tech jargon.

5. SPECIAL SCHEDULING ABILITY: If the user asks to create, update, or delete a task (including specifying a start time or reminder offset), write a natural, friendly response. At the VERY END of your message, append a structured command wrapped in [COMMAND] and [/COMMAND] tags. Do not output multiple command blocks.

Format for creating a task:
[COMMAND]
{
  "action": "create",
  "task": {
    "title": "Task title here",
    "deadline": "YYYY-MM-DD",
    "priority": "low" | "medium" | "high",
    "time": "HH:MM", // if specified (e.g., "15:30"), otherwise empty or omit
    "reminder": "none" | "0min" | "15min" | "30min" | "1hour" | "1day" // if specified, otherwise "none"
  }
}
[/COMMAND]

Format for updating a task:
[COMMAND]
{
  "action": "update",
  "taskId": "the-task-id-to-update",
  "task": {
    "title": "New title (optional)",
    "deadline": "New deadline YYYY-MM-DD (optional)",
    "priority": "low" | "medium" | "high" (optional),
    "time": "HH:MM" (optional),
    "reminder": "none" | "0min" | "15min" | "30min" | "1hour" | "1day" (optional),
    "statusKey": "pending" | "started" | "completed" (optional)
  }
}
[/COMMAND]

Format for deleting a task:
[COMMAND]
{
  "action": "delete",
  "taskId": "the-task-id-to-delete"
}
[/COMMAND]

Format for syncing a task to Google Calendar:
[COMMAND]
{
  "action": "sync-calendar",
  "taskId": "the-task-id-to-sync"
}
[/COMMAND]

Format for syncing ALL tasks to Google Calendar:
[COMMAND]
{
  "action": "sync-all-calendar"
}
[/COMMAND]

Always resolve relative dates (like "tomorrow", "next Friday", "today") to exact "YYYY-MM-DD" dates using the current local time before writing the command block!
`;

  try {
    // Start chat with history
    const chatConfig = {
      model: "gemini-3.5-flash", 
      config: {
        systemInstruction: chatContext,
      },
      // We pass previous history formatted properly
      history: history.map((h) => ({
        role: h.role,
        parts: [{ text: h.content }],
      })),
    };
    
    // Check Cache
    const cacheKey = getCacheKey({ ...chatConfig, message: latestPrompt });
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[AI SDK] Cache hit for chat: ${cacheKey}`);
      return cached.data;
    }

    const chat = aiClient.chats.create(chatConfig);
    const response = await retryWithBackoff(() => chat.sendMessage({ message: latestPrompt }));
    const text = response.text ? response.text.trim() : "";
    
    if (text) {
      if (apiCache.size > 1000) {
        const firstKey = apiCache.keys().next().value;
        if (firstKey) apiCache.delete(firstKey);
      }
      apiCache.set(cacheKey, { timestamp: Date.now(), data: text });
    }
    
    return text;
  } catch (err: any) {
    console.error("General Chat Error:", err);
    const errorStr = err?.message || String(err);
    if (errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("Quota") || errorStr.includes("exhausted")) {
      return "Hi, it looks like my AI conversation quota has been temporarily reached (Gemini free tier allows 20 free requests/day per workspace). While my brain is taking a quick rest, you can still view your tasks list, manage status transitions, and utilize the manual planner modules offline. I will be fully online again when my Google API quota resets! Let me know if you would like me to help with anything else.";
    }
    return `Greetings, I encountered a communication hiccup (Model Error). Details: ${errorStr.substring(0, 100)}`;
  }
}
