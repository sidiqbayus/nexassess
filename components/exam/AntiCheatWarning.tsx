'use client';

import { AlertTriangle } from 'lucide-react';

interface AntiCheatWarningProps {
  message: string;
  violationCount: number;
  maxViolations: number;
  onDismiss: () => void;
}

export function AntiCheatWarning({
  message,
  violationCount,
  maxViolations,
  onDismiss,
}: AntiCheatWarningProps) {
  if (!message) return null;

  const severity = violationCount >= maxViolations - 1 ? 'critical' : 'warning';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`
        max-w-md w-full rounded-2xl border p-6 shadow-2xl
        ${severity === 'critical'
          ? 'bg-red-950 border-red-500/50 shadow-red-500/20'
          : 'bg-amber-950 border-amber-500/50 shadow-amber-500/20'
        }
      `}>
        <div className={`
          w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4
          ${severity === 'critical' ? 'bg-red-500/20' : 'bg-amber-500/20'}
        `}>
          <AlertTriangle className={`w-7 h-7 ${severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
        </div>

        <h2 className={`text-xl font-black text-center mb-3 ${severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>
          {severity === 'critical' ? '🚨 PERINGATAN TERAKHIR!' : '⚠️ PERINGATAN KECURANGAN'}
        </h2>

        <p className="text-white/80 text-center text-sm leading-relaxed mb-5">
          {message}
        </p>

        <div className="mb-5">
          <div className="flex justify-between text-xs text-white/50 mb-1.5">
            <span>Pelanggaran</span>
            <span className="font-bold text-white/80">{violationCount}/{maxViolations}</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${severity === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`}
              style={{ width: `${(violationCount / maxViolations) * 100}%` }}
            />
          </div>
        </div>

        <button
          onClick={onDismiss}
          className={`
            w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98]
            ${severity === 'critical' ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-amber-500 hover:bg-amber-400 text-black'}
          `}
        >
          Saya Mengerti — Kembali ke Ujian
        </button>
      </div>
    </div>
  );
}