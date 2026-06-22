import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, PhoneCall, PhoneOff, Radio, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function LiveVoiceWidget() {
  const [active, setActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState("Offline");
  const [errorText, setErrorText] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Audio Playback Queue offsets
  const nextStartTimeRef = useRef<number>(0);

  const startVoiceSession = async () => {
    setErrorText("");
    setConnecting(true);
    setStatus("Activating device permissions...");

    try {
      // 1. Check & acquire mic stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 2. Open client-side WebSockets
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/live-stream`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnecting(false);
        setActive(true);
        setStatus("Verbal connection active. Talk naturally!");
        // Configure play queue timeline starting offset
        nextStartTimeRef.current = 0;
        initializeAudioNodeChannel();
      };

      ws.onmessage = async (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.audio) {
            playRawPCMChunk(payload.audio);
          }
          if (payload.interrupted) {
            // Drop current and next play buffers to clear overlap noise
            nextStartTimeRef.current = 0;
          }
          if (payload.error) {
            setErrorText(payload.error);
            stopVoiceSession();
          }
        } catch (e) {
          console.error("Audio buffer unpacking malfunction:", e);
        }
      };

      ws.onerror = () => {
        setErrorText("WebSocket node encountered connection failure.");
        stopVoiceSession();
      };

      ws.onclose = () => {
        stopVoiceSession();
      };

    } catch (err: any) {
      console.error("Audio session boots failed:", err);
      setErrorText("Microphone permission denied or WebSockets blocked by sandbox iframe. Launch in tab.");
      setConnecting(false);
      setStatus("Offline");
    }
  };

  const stopVoiceSession = () => {
    setStatus("Offline");
    setActive(false);
    setConnecting(false);

    // Stop WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    // Stop mic stream track indicators
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Terminate processor nodes
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    // Close Audio Contexts
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
  };

  const initializeAudioNodeChannel = () => {
    if (!streamRef.current || !wsRef.current) return;

    // Mic input at 16kHz Little-Endian PCM as required by standard Live API
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    inputAudioCtxRef.current = inputCtx;

    // High quality 24kHz Audio Context for play output from model
    const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    outputAudioCtxRef.current = outputCtx;

    const source = inputCtx.createMediaStreamSource(streamRef.current);
    const processor = inputCtx.createScriptProcessor(4096, 1, 1);
    scriptProcessorRef.current = processor;

    source.connect(processor);
    processor.connect(inputCtx.destination);

    processor.onaudioprocess = (e) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const inputFloats = e.inputBuffer.getChannelData(0);
      const int16Array = floatToInt16PCM(inputFloats);
      
      // Convert ArrayBuffer to short base64 string
      const base64 = pcmArrayBufferToBase64(int16Array.buffer);
      wsRef.current.send(JSON.stringify({ audio: base64 }));
    };
  };

  const floatToInt16PCM = (float32Array: Float32Array): Int16Array => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  };

  const pcmArrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const playRawPCMChunk = (base64Str: string) => {
    if (!outputAudioCtxRef.current) return;

    try {
      const binaryString = window.atob(base64Str);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert Int16 bytes block directly back to float32 samples
      const int16s = new Int16Array(bytes.buffer);
      const float35s = new Float32Array(int16s.length);
      for (let i = 0; i < int16s.length; i++) {
        float35s[i] = int16s[i] / 32768.0;
      }

      const audioBuffer = outputAudioCtxRef.current.createBuffer(1, float35s.length, 24000);
      audioBuffer.getChannelData(0).set(float35s);

      const sourceNode = outputAudioCtxRef.current.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(outputAudioCtxRef.current.destination);

      // Thread syncing timeline schedules to preserve gapless playback
      const now = outputAudioCtxRef.current.currentTime;
      let playTime = nextStartTimeRef.current;
      if (playTime < now) {
        playTime = now + 0.05; // gap cushion
      }
      sourceNode.start(playTime);
      nextStartTimeRef.current = playTime + audioBuffer.duration;

    } catch (decErr) {
      console.error("PCM Chunk Audio Playback error:", decErr);
    }
  };

  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, []);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 text-slate-800 flex flex-col items-center justify-between gap-4 shadow-sm">
      <div className="flex items-center justify-between w-full border-b border-slate-100 pb-3 shrink-0">
        <h3 className="font-display font-bold text-xs text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <Radio className="h-4 w-4 text-indigo-600" />
          <span>Real-time Gemini Support</span>
        </h3>
        {active && (
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 absolute relative">
            <span className="absolute -inset-1 rounded-full bg-emerald-400 animate-ping opacity-60" />
          </span>
        )}
      </div>

      <div className="text-center py-4 space-y-2">
        <p className="text-xs text-slate-500 font-semibold">{status}</p>
        {errorText && (
          <p className="text-xs text-red-750 bg-red-50 border border-red-100 p-2.5 rounded-xl max-w-sm font-semibold">
            {errorText}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4 py-2 shrink-0">
        {!active && !connecting ? (
          <button
            onClick={startVoiceSession}
            className="h-16 w-16 rounded-full bg-indigo-650 hover:bg-indigo-700 font-semibold cursor-pointer flex items-center justify-center text-white transition-all shadow-md active:scale-95"
            title="Start verbal conversation dialogue"
          >
            <PhoneCall className="h-6 w-6" />
          </button>
        ) : (
          <button
            onClick={stopVoiceSession}
            className="h-16 w-16 rounded-full bg-rose-500 hover:bg-rose-600 font-semibold cursor-pointer flex items-center justify-center text-white transition-all shadow-md active:scale-95 animate-pulse"
            title="End spoken audio link"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
        )}
      </div>

      <div className="text-[11px] text-slate-505 text-slate-500 font-medium leading-normal text-center max-w-xs pt-2">
        {active ? (
          <span className="text-indigo-600 flex items-center justify-center gap-1 font-bold">
            <Volume2 className="h-4.5 w-4.5 animate-pulse text-indigo-650" />
            <span>Spoken speech translation and logic stream are active...</span>
          </span>
        ) : (
          "Tap the dial trigger to start a spoken voice productivity diagnostic with Gemini."
        )}
      </div>
    </div>
  );
}
