import React, { useEffect } from "react";
import { CheckCircle2, AlertTriangle, Info, AlertOctagon, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

const DISMISS_AFTER_MS = 4500;

function ToastEntry({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const config: Record<ToastType, { bar: string; border: string; icon: React.ReactNode; text: string }> = {
    success: {
      bar: "bg-emerald-500",
      border: "border-emerald-500/20",
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
      text: "text-emerald-300",
    },
    error: {
      bar: "bg-rose-500",
      border: "border-rose-500/20",
      icon: <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />,
      text: "text-rose-300",
    },
    warning: {
      bar: "bg-amber-500",
      border: "border-amber-500/20",
      icon: <AlertOctagon className="w-4 h-4 text-amber-400 shrink-0" />,
      text: "text-amber-300",
    },
    info: {
      bar: "bg-indigo-500",
      border: "border-indigo-500/20",
      icon: <Info className="w-4 h-4 text-indigo-400 shrink-0" />,
      text: "text-white/70",
    },
  };

  const c = config[toast.type];

  return (
    <div
      className={`flex items-stretch w-80 bg-[#0d0d14]/95 backdrop-blur-xl rounded-xl border ${c.border} shadow-2xl overflow-hidden`}
      role="alert"
    >
      <div className={`w-1 shrink-0 ${c.bar}`} />
      <div className="flex items-start gap-2.5 px-3.5 py-3 flex-1 min-w-0">
        {c.icon}
        <span className={`text-xs font-medium leading-relaxed flex-1 ${c.text}`}>
          {toast.message}
        </span>
        <button
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 text-white/20 hover:text-white/50 transition-colors mt-0.5 cursor-pointer"
          aria-label="Zamknij powiadomienie"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastEntry toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
