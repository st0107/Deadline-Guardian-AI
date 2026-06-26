import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckSquare, Compass, Sparkles, Bot, Radio, X, ChevronRight } from "lucide-react";

interface WalkthroughProps {
  onComplete: () => void;
}

export default function Walkthrough({ onComplete }: WalkthroughProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to Deadline Guardian AI",
      description: "Your intelligent scheduling and risk management assistant. Let's take a quick tour of what you can do.",
      icon: <Bot className="h-12 w-12 text-indigo-500" />,
      color: "bg-indigo-50"
    },
    {
      title: "Manage Tasks Smartly",
      description: "Create tasks using natural language. The AI will automatically extract deadlines, effort hours, and priority for you.",
      icon: <CheckSquare className="h-12 w-12 text-emerald-500" />,
      color: "bg-emerald-50"
    },
    {
      title: "Predict & Mitigate Risks",
      description: "Our Risk Center analyzes your overlapping deadlines using Deep Thinking models to predict failure risks and suggest mitigations.",
      icon: <Sparkles className="h-12 w-12 text-amber-500" />,
      color: "bg-amber-50"
    },
    {
      title: "AI Planner & Replanner",
      description: "Generate optimal daily schedules based on your available hours. If you fall behind, the Replanner instantly rescues your schedule.",
      icon: <Compass className="h-12 w-12 text-blue-500" />,
      color: "bg-blue-50"
    },
    {
      title: "Real-Time Voice Agent",
      description: "Talk directly to your assistant. Create, update, or delete tasks just by speaking in the AI Strategist sidebar.",
      icon: <Radio className="h-12 w-12 text-rose-500" />,
      color: "bg-rose-50"
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const currentStep = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative"
      >
        <button 
          onClick={onComplete}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors z-10 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className={`p-8 pb-10 flex flex-col items-center text-center transition-colors duration-500 ${currentStep.color}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
              transition={{ duration: 0.3 }}
              className="mb-6 p-4 bg-white rounded-2xl shadow-sm"
            >
              {currentStep.icon}
            </motion.div>
          </AnimatePresence>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-3">{currentStep.title}</h2>
              <p className="text-slate-600 leading-relaxed text-sm">{currentStep.description}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-8 py-6 bg-white border-t border-slate-100 flex items-center justify-between">
          <div className="flex gap-2">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`h-2 rounded-full transition-all duration-300 ${i === step ? "w-6 bg-indigo-600" : "w-2 bg-slate-200"}`}
              />
            ))}
          </div>
          
          <button 
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
          >
            {step === steps.length - 1 ? "Get Started" : "Next"}
            {step < steps.length - 1 && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
