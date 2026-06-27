# Deadline Guardian AI — Production Architecture & Implementation Guide

Deadline Guardian AI is a production-level, AI-guided full-stack productivity companion designed to solve a critical human failure: **the disregard of simple reminder notifications**. Rather than simply alerting users as a chronological alarm, Deadline Guardian AI predicts project/task timeline risks *before* they manifest, designs hour-by-hour daily execution plans, automatically balances overdue workload schedules, and provides a multi-turn strategic advisor and real-time voice chat support system.

---

## 1. Project Architecture & Design Philosophy
Traditional todo systems suffer from *reminder ignoring syndrome*. Deadline Guardian AI shifts productivity into an **AI-Guided Execution Management** paradigm.

### System Flow Diagram
```
+-----------------------------------------------------------------------------------+
|                                 CLIENT VIEW (Vite + React)                       |
|   +-------------------+  +------------------+  +------------------+  +--------+   |
|   | Dashboard Hub     |  | Task Workspace   |  | AI Daily Planner |  | Speech |   |
|   +-------------------+  +------------------+  +------------------+  +--------+   |
+-------------------------------------|---------------------------------------------+
                                      | HTTP Requests / REST
                                      | WebSocket Voice stream on port 3000
+-------------------------------------v---------------------------------------------+
|                               EXPRESS BACKEND GATEWAY                             |
|  +-----------------------------------------------------------------------------+  |
|  | JWT Guard Router Middleware (Enforces session security isolation)           |  |
|  +-----------------------------------------------------------------------------+  |
|  +-----------------------------------------------------------------------------+  |
|  | WebSockets Handler (Real-Time Gemini Live Session with Tool Calling)        |  |
|  +-----------------------------------------------------------------------------+  |
|  +--------------------+   +---------------------+   +--------------------------+  |
|  | localDb Store Engine|  | Express Controllers |   | @google/genai Service    |  |
|  +--------------------+   +---------------------+   +--------------------------+  |
+---------------------------------------|---------------------------|---------------+
                                        | Write Buffer              | JSON Schema
+---------------------------------------v---------------------------v---------------+
|                              PERSISTENCE & SECURITY          GOOGLE GEMINI API    |
|   +----------------------------+                            +-----------------+   |
|   | /data/database.json        |                            | gemini-3.5-flash|   |
|   +----------------------------+                            | gemini-3.1-pro  |   |
|                                                             | gemini-3.1-flash-live-preview|
+-------------------------------------------------------------+-----------------+
```

### Core Architecture Choices & Trade-offs
1. **Full-Stack Proximity (Express + Vite Proxy)**: The code organizes critical API keys on the server-side, securing them from standard browser inspection.
2. **WebSocket Port Integration**: Running the WebSockets listener connected directly on the same Node `http` server on port `3000` bypasses standard sandboxed ingress port bans, guaranteeing safe, lag-free audio stream transport.
3. **Structured JSON Schemas with Deep-Reasoning**: General tasks are segmented to lightweight `gemini-3.5-flash` for rate limits protection. Complex calculations like *Predictive Deadline Threat Risk score (0-100)* are allocated to `gemini-3.1-pro-preview` with **High Thinking Mode** active to safely weigh overlapping study timelines and hours.
4. **Real-Time Voice with Function Calling**: Integrating the Gemini Live API allows users to converse fluidly with their assistant. The AI executes server-side functions (create, read, update, delete tasks) based on natural conversational cues, immediately syncing with the client UI.

---

## 2. Folder Structure

```
/
├── server.ts              # Primary Express Gateway, WS Bootstrapper & Vite Middleware
├── metadata.json          # App identifier and Microphone configuration profile
├── index.html             # HTML entry and page definitions
├── tsconfig.json          # System TS bindings
├── vite.config.ts         # Vite compiler rules
├── package.json           # Declarations of dependencies (recharts, google/genai, ws)
├── data/
│   └── database.json      # In-workspace JSON storage replica (Automatic persistence)
├── server/
│   ├── db.ts              # Typesafe file CRUD store engine mapping Tasks & Logs
│   ├── auth.ts            # JWT verification & password hashing models (bcryptjs)
│   └── ai.ts              # Server-side Google Gemini SDK pipeline & Prompt templates
└── src/
    ├── main.tsx           # Client injection bootstrapper
    ├── index.css          # Tailwind colors config & Space Grotesk fonts
    ├── types.ts           # Shared typings between layouts
    ├── api.ts             # Client HTTP Fetcher (with dynamic token integration)
    └── components/
        ├── AuthView.tsx       # Secure Login & Registration Panel
        ├── DashboardView.tsx  # Statistics Hub & Critical Risk indicators
        ├── TaskView.tsx       # Normal + Natural NLP + Voice Recorder task creator
        ├── PlannerView.tsx    # Hour-by-hour timeline calendars & AI Advice checklists
        ├── RiskCenterView.tsx # Real-time speedometer dial & AI explanations
        ├── AnalyticsView.tsx  # Pie priority counts, completion line charts (Recharts)
        ├── ChatAdvisor.tsx    # Scrollable sidebar panel strategic chat with Gemini Pro
        └── LiveVoiceWidget.tsx# Desktop voice widget connected to Gemini Live API with UI sync
```

---

## 3. Database Schema Design (JSON Store / Mongoose equivalent)

The typesafe local memory model replicates a secure relational Mongoose cluster, utilizing secondary indices on `userId` strings:

### User Document
```typescript
interface User {
  id: string;               // Unique primary identifier
  name: string;             // Display name
  email: string;            // Secondary query index, unique
  passwordHash: string;     // Salted bcrypt hash
  createdAt: string;        // ISO timestamp
  productivityScore: number;// Performance coefficient index (0-100)
}
```

### Task Document
```typescript
interface Task {
  id: string;               // Unique ID
  userId: string;           // Foreign index joining to User
  title: string;            // Name of task
  deadline: string;         // YYYY-MM-DD
  effort: number;           // Hours required for completion
  priority: "high" | "medium" | "low";
  statusKey: "pending" | "started" | "completed";
  riskScore: number;        // AI-calculated risk rating (0-100)
  riskReason: string;       // AI description explaining why risk is high
  recommendations: string[];// Steps to bring risk score down
  createdAt: string;
}
```

---

## 4. REST API & WebSocket Design Reference

| Method | Route | Authentication | Payload Schema / Output Summary |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/register` | Open | Input: `{ name, email, password }` -> Returns JWT Token + User object. |
| **POST** | `/api/auth/login` | Open | Input: `{ email, password }` -> Returns verified JWT Token. |
| **GET** | `/api/auth/me` | JWT Required | Returns current authenticated profile. |
| **GET** | `/api/tasks` | JWT Required | Returns list of tasks for the active account. |
| **POST** | `/api/tasks` | JWT Required | Input: `{ title, deadline, effort, priority }` OR `{ textPrompt }` for AI parsing. Returns created Task with automated prediction risk metrics already embedded. |
| **PUT** | `/api/tasks/:id` | JWT Required | Updates properties, regenerates risk scores on duration shift, logs completions. |
| **DELETE** | `/api/tasks/:id` | JWT Required | Deletes a specified task. |
| **POST** | `/api/ai/daily-plan` | JWT Required | Input: `{ targetDate, availableHours }` -> Configures hour blocks. |
| **POST** | `/api/ai/replan` | JWT Required | Automatically pulls unfinished overdue jobs into an auto-arranged rescue map. |
| **POST** | `/api/ai/transcribe` | JWT Required | Input: `{ audioData (base64 wav/ogg) }` -> Returns text transcription using Gemini Flash. |
| **POST** | `/api/ai/chat` | JWT Required | Input: `{ prompt }` -> Strategic advisor chat, preloaded with active user tasks context. |
| **WS** | `/?token=...` | JWT Required | Bidirectional audio streaming connection mapped to Gemini Live API with active Tool Execution. |

---

## 5. Gemini AI Prompt Engineering Patterns

### Feature 1: Structured Task parsing (Natural Language Processing)
* **Model**: `gemini-3.5-flash` (Optimized for speed and JSON structure serialization schemas).
* **Config**: `responseMimeType: "application/json"`.
* **Prompt Rule**:
  ```ts
  "Context: Today's date and time is: ${currentLocalTime}.
   Analyze this natural description and extract actionable title, YYYY-MM-DD deadline (calculate relative keywords such as Friday, tomorrow, in 3 weeks), effort hours, and priority enum."
  ```

### Feature 2: Deadline Risk Evaluation (Deep Strategic Reasoning)
* **Model**: `gemini-3.1-pro-preview` (Leverages **ThinkingLevel.HIGH** parameters to balance multiple timeline constraints).
* **Prompt Rule**:
  ```ts
  "Current datetime is ${currentLocalTime}. You are an expert project risk manager.
   Analyze the deadline risk of target task: ${task}.
   Compare it against competing study/work active priorities: ${otherActiveTasks}.
   Calculate a threat coefficient (0-100), define the exact scheduler bottleneck, and generate a step-by-step mitigation checklist."
  ```

### Feature 3: Real-Time Voice Assistant with Tool Execution
* **Model**: `gemini-3.1-flash-live-preview` (Ultra-low latency streaming voice API).
* **Config**: `Modality.AUDIO`, system instruction rules, tool function declarations (`getTasks`, `createTask`, `updateTask`, `deleteTask`).
* **Implementation Details**: Audio is captured via `LiveVoiceWidget` as 16kHz PCM, streamed across WebSockets to the Express server, and bridged directly into the Gemini Live Session. The model can choose to invoke server-side tools (like creating or modifying a task), which run securely in the backend, return results to the AI, and emit `refreshTasks` sync events to update the React UI seamlessly.

---

## 6. Hackathon Pitch & Showcase Presentation Outline

### **Slide 1: Title Slide & Problem Hook**
* **Title**: Deadline Guardian AI — From reminders to execution management.
* **Hook**: Traditional calendars and todos only send alarms. Users swipe them away, and project managers have lists but zero context. Deadline Guardian acts as a proactive predictive assistant that forecasts missed targets *before* they occur.

### **Slide 2: The Core Product Core pillars**
* **Predictive Risk Assessment**: Active deadlines are weighed against other tasks using Gemini 3.1 Pro to output an interactive Threat Dial.
* **Interactive Voice Management**: Users speak naturally into their mic to review, create, edit, or delete tasks. Gemini handles the audio and seamlessly executes background system tools that reflect instantly on the UI.
* **Google Calendar Sync**: Integrates with Google Calendar, automatically adding tasks to your calendar to keep your schedule fully aligned and prevent double booking.
* **Smart Rescue Replanning**: When tasks are left unfinished, a simple click redirects remaining work into an optimized rescue day plan.

### **Slide 3: Technical Showcase (Under the Hood)**
* **Google's Gemini SDKs**: Standardize pipeline tasks to `gemini-3.5-flash` JSON schemas, complex risk predictions to `gemini-3.1-pro-preview` with High Thinking mode, and live interactive vocal guidance to the ultra-low-latency `gemini-3.1-flash-live-preview` via WebSockets.
* **Architecture**: Complete Express Node endpoint server, JWT-protected accounts, typesafe database cache persisting to a lightweight storage array, and a gorgeous slate-dark responsive React front-end.

---

## 7. Deployment Instruction Guide

### Setup Variables
Configure secrets inside the app hosting platform (Render, Vercel, or GCP Cloud Run container env):
```env
GEMINI_API_KEY=your_gemini_token
JWT_SECRET=production_guardian_strength_secret
NODE_ENV=production
```
Make sure `firebase-applet-config.json` containing the Firebase credentials and Google OAuth client ID (for Calendar Sync) is present in the root directory.

### Build Commands
To compile static React assets, package typescript, bundle server, and run production Node server CJS:
```bash
# 1. Compile the applet
npm run build

# 2. Start the unified Full-Stack Gateway
npm run start
```
