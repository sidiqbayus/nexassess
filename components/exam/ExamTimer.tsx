'use client';

import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

interface ExamTimerProps {
  expiresAt: string;
  onTimeUp: () => void;
}

export default function ExamTimer({ expiresAt, onTimeUp }: ExamTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const calc = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) onTimeUp();
    };

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onTimeUp]);

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  const isWarning = secondsLeft < 300;  // < 5 menit
  const isCritical = secondsLeft < 60;  // < 1 menit

  return (
    <div className={`text-center p-3 rounded-xl border transition-colors ${
      isCritical ? 'bg-red-500/15 border-red-500/40' :
      isWarning ? 'bg-amber-500/15 border-amber-500/30' :
      'bg-white/5 border-white/10'
    }`}>
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <Timer className={`w-3.5 h-3.5 ${isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-slate-400'}`} />
        <span className="text-xs text-slate-400 font-medium">Sisa Waktu</span>
      </div>
      <p className={`text-2xl font-black tabular-nums tracking-tight ${
        isCritical ? 'text-red-400 animate-pulse' :
        isWarning ? 'text-amber-400' : 'text-white'
      }`}>
        {hours > 0 && `${String(hours).padStart(2,'0')}:`}
        {String(minutes).padStart(2,'0')}:{String(seconds).padStart(2,'0')}
      </p>
    </div>
  );
}