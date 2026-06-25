import React, { useState, useRef } from "react";
import { Task } from "../types";
import { api } from "../api";
import {
  ListTodo,
  Calendar,
  Hourglass,
  ArrowUpCircle,
  PlusCircle,
  Sparkles,
  Trash2,
  Mic,
  MicOff,
  CheckCircle,
  AlertTriangle,
  PlayCircle,
  HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TaskViewProps {
  tasks: Task[];
  onTasksUpdated: () => void;
  onSelectTaskRisk: (taskId: string) => void;
}

export default function TaskView({ tasks, onTasksUpdated, onSelectTaskRisk }: TaskViewProps) {
  // Navigation tabs for status filtering
  const [filter, setFilter] = useState<"all" | "pending" | "started" | "completed">("all");

  // Create task toggles
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [useNlp, setUseNlp] = useState(true);

  // Normal Manual Fields
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [effort, setEffort] = useState("2");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");

  // NLP extraction inputs
  const [nlpInput, setNlpInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Inline audio record States
  const [isRecording, setIsRecording] = useState(false);
  const [audioTranscriptionPending, setAudioTranscriptionPending] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Task processing messages
  const [errMessage, setErrMessage] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const startRecord = async () => {
    setErrMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: "audio/webm" };
      
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch (_) {
        mediaRecorder = new MediaRecorder(stream); // fallback mimeType if webm is unrecognized
      }

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        await processAudioPayload(audioBlob);
        
        // Disable mic track to release indicator
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error("Audio recording permission failed:", err);
      setErrMessage("Microphone permission denied or device not found. Open in a new tab if iframe block.");
    }
  };

  const stopRecord = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudioPayload = async (blob: Blob) => {
    setAudioTranscriptionPending(true);
    setErrMessage("");
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        // Strip data prefix: "data:audio/webm;base64,"
        const base64Raw = base64data.split(",")[1];

        const data = await api.transcribeAudio(base64Raw, blob.type);
        if (data.transcription) {
          setNlpInput((prev) => (prev ? prev + " " + data.transcription : data.transcription));
        } else {
          setErrMessage("Could not hear or resolve voice data. Speak louder.");
        }
      };
    } catch (e: any) {
      setErrMessage("Voice audio transcription crashed: " + e.message);
    } finally {
      setAudioTranscriptionPending(false);
    }
  };

  const handleNlpExtract = async () => {
    if (!nlpInput.trim()) return;
    setThinking(true);
    setErrMessage("");
    try {
      const parsed = await api.createTask({ textPrompt: nlpInput });
      setSuccessMsg(`Extracted! Created task: "${parsed.title}" due ${parsed.deadline}`);
      setNlpInput("");
      onTasksUpdated();
      setTimeout(() => setSuccessMsg(""), 4500);
    } catch (err: any) {
      setErrMessage(err.message || "Failed to parse task prompt.");
    } finally {
      setThinking(false);
    }
  };

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !deadline) {
      setErrMessage("Title and deadline are required.");
      return;
    }
    setSubmitting(true);
    setErrMessage("");
    try {
      await api.createTask({
        title,
        deadline,
        effort: Number(effort),
        priority,
      });
      setSuccessMsg("Task successfully established with dynamic risk predictions.");
      setTitle("");
      setDeadline("");
      setEffort("2");
      setPriority("medium");
      onTasksUpdated();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setErrMessage(err.message || "Manual creation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (task: Task) => {
    try {
      let nextStatus: "pending" | "started" | "completed";
      if (task.statusKey === "pending") nextStatus = "started";
      else if (task.statusKey === "started") nextStatus = "completed";
      else nextStatus = "pending";

      await api.updateTask(task.id, { statusKey: nextStatus });
      onTasksUpdated();
    } catch (err: any) {
      setErrMessage(err.message || "Status change failed.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you certain you want to purge this task?")) return;
    try {
      await api.deleteTask(id);
      onTasksUpdated();
    } catch (err: any) {
      setErrMessage(err.message || "Deletion failed.");
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === "all") return true;
    return t.statusKey === filter;
  });

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

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-slate-900 tracking-tight">Task Matrix</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Configure deadlines, evaluate priorities, and parse structured actions.</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-3 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-900/10"
        >
          <PlusCircle className="h-4 w-4" />
          <span>{showCreateForm ? "Close Action Panel" : "Register New Task"}</span>
        </button>
      </div>

      {/* Dynamic Creation Section */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 mb-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-sm font-bold text-slate-900">Create Workspace Entry</span>
                <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-150">
                  <button
                    onClick={() => setUseNlp(true)}
                    className={`px-3 py-1 text-xs rounded-md font-semibold transition-all cursor-pointer ${
                      useNlp ? "bg-white text-indigo-600 shadow-sm" : "text-slate-450 hover:text-slate-700"
                    }`}
                  >
                    Natural AI
                  </button>
                  <button
                    onClick={() => setUseNlp(false)}
                    className={`px-3 py-1 text-xs rounded-md font-semibold transition-all cursor-pointer ${
                      !useNlp ? "bg-white text-indigo-600 shadow-sm" : "text-slate-450 hover:text-slate-700"
                    }`}
                  >
                    Manual Mode
                  </button>
                </div>
              </div>

              {errMessage && (
                <div className="bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl p-4 font-medium">
                  {errMessage}
                </div>
              )}

              {successMsg && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl p-4 font-medium">
                  {successMsg}
                </div>
              )}

              {useNlp ? (
                /* NLP Parser Tab */
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                      Voice / Text Natural Input
                    </label>
                    <p className="text-xs text-slate-400">
                      Write or record anything naturally, e.g. "Prepare presentation slides for board meeting in 5 days, takes 6h high priority"
                    </p>
                  </div>

                  <div className="relative">
                    <textarea
                      disabled={thinking || audioTranscriptionPending}
                      placeholder="Type details naturally or click the record microphone button on the right..."
                      value={nlpInput}
                      onChange={(e) => setNlpInput(e.target.value)}
                      className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-4 pr-12 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 transition-colors placeholder:text-slate-400 resize-none font-sans"
                    />

                    {/* Microphone Transcription Access Button */}
                    <div className="absolute right-3.5 bottom-3.5 flex items-center gap-2">
                      {isRecording ? (
                        <button
                          onClick={stopRecord}
                          className="h-8 w-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white cursor-pointer relative shadow-md"
                          title="Click to stop audio recording"
                        >
                          <MicOff className="h-4 w-4" />
                          <span className="absolute inset-0 rounded-full border border-red-400 animate-ping opacity-75" />
                        </button>
                      ) : (
                        <button
                          onClick={startRecord}
                          disabled={audioTranscriptionPending}
                          className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 font-semibold flex items-center justify-center text-indigo-600 cursor-pointer disabled:opacity-50 border border-slate-200/50"
                          title="Record audio and transcribe"
                        >
                          {audioTranscriptionPending ? (
                            <div className="h-3 w-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Mic className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {isRecording ? (
                        <span className="text-red-500 flex items-center gap-1.5 animate-pulse font-bold">
                          ● Recording spoken audio... speak now
                        </span>
                      ) : audioTranscriptionPending ? (
                        "Gemini Flash translating voice stream..."
                      ) : (
                        "Model: gemini-2.4-flash Voice-to-Task interface"
                      )}
                    </span>
                    <button
                      onClick={handleNlpExtract}
                      disabled={thinking || !nlpInput.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {thinking ? (
                        <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>AI Extract Task</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Manual Custom Form */
                <form onSubmit={handleManualCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="md:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      Task Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Build dashboard"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>Deadline</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <Hourglass className="h-3.5 w-3.5 text-slate-400" />
                        <span>Effort (Hrs)</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        required
                        value={effort}
                        onChange={(e) => setEffort(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <ArrowUpCircle className="h-3.5 w-3.5 text-slate-400" />
                        <span>Priority</span>
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    {submitting ? (
                      <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span>Add Task</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Filters */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-200 pb-3">
        {(["all", "pending", "started", "completed"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-xs font-bold rounded-xl shrink-0 capitalize transition-all cursor-pointer ${
              filter === status
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Task Listing */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase font-mono">Working Grid</h3>
          <span className="text-2xs font-mono font-bold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded border border-indigo-100">
            {filteredTasks.length} Tracked Entries
          </span>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="text-center py-20 text-slate-400 bg-white">
            <ListTodo className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No tasks meet selected filter criteria.</p>
            <p className="text-xs text-slate-400 mt-1">Add tasks to initialize prediction indexes.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 bg-white">
            {filteredTasks.map((t) => {
              const rScore = t.riskScore || 0;
              const rColor = rScore >= 70 ? "text-red-700 bg-red-50 hover:bg-red-100/50 border border-red-100" : rScore >= 40 ? "text-amber-700 bg-amber-50 hover:bg-amber-100/5 border border-amber-100" : "text-emerald-700 bg-emerald-50 hover:bg-emerald-105 border border-emerald-100";
              const isComp = t.statusKey === "completed";

              return (
                <div
                  key={t.id}
                  className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-slate-50/30 ${
                    isComp ? "opacity-60 bg-slate-50/10" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Circle Checkbox Trigger status flip */}
                    <button
                      onClick={() => handleToggleStatus(t)}
                      className={`mt-1 shrink-0 h-5 w-5 rounded-md border flex items-center justify-center cursor-pointer transition-colors ${
                        isComp
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-slate-300 hover:border-indigo-600 text-transparent"
                      }`}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                    </button>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className={`text-sm font-bold text-slate-800 ${isComp ? "line-through text-slate-400 font-medium" : ""}`}>
                          {t.title}
                        </h4>
                        
                        {/* Priority Batch */}
                        <span className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded font-mono tracking-wide ${
                          t.priority === "high" 
                            ? "bg-rose-50 text-rose-700 border border-rose-100" 
                            : t.priority === "medium" 
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-100" 
                              : "bg-slate-100 text-slate-600 border border-slate-150"
                        }`}>
                          {t.priority}
                        </span>

                        {/* Status Marker */}
                        <span className="text-[9px] font-mono capitalize px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          {t.statusKey}
                        </span>
                      </div>

                      {/* Detail Metrics line */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>Due {formatDate(t.deadline)}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Hourglass className="h-3.5 w-3.5 text-slate-400" />
                          <span>{t.effort} estimated hours</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Risk gauges */}
                  <div className="flex items-center justify-between md:justify-end gap-x-4">
                    {!isComp && (
                      <button
                        onClick={() => onSelectTaskRisk(t.id)}
                        className={`text-2xs font-bold font-mono py-1 px-2.5 rounded-lg border cursor-pointer transition-all ${rColor}`}
                        title="Open risk mitigation center"
                      >
                        Risk Score: {rScore}%
                      </button>
                    )}

                    <div className="flex items-center gap-2 ml-auto md:ml-0">
                      <button
                        onClick={() => handleToggleStatus(t)}
                        className="text-xs font-bold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
                      >
                        {t.statusKey === "pending" ? "Start" : t.statusKey === "started" ? "Complete" : "Restart"}
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-100"
                        title="Purge Task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
