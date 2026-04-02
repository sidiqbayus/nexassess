'use client';

import { Clock, BookOpen, Timer, AlertTriangle, Play, RefreshCw } from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  subject: string;
  exam_code: string;
  scheduled_start: string;
  scheduled_end: string;
  duration_minutes: number;
  status: string;
  session_status?: string;
  tab_switch_count?: number;
}

interface ExamCardProps {
  exam: Exam;
  canStart: boolean;
  timeUntilStart: string;
  onStart: () => void;
  currentTime: Date;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
}

function getTimeProgress(start: string, end: string, now: Date) {
  const startMs = new Date(start).getTime(), endMs = new Date(end).getTime(), nowMs = now.getTime();
  if (nowMs < startMs) return 0;
  if (nowMs > endMs) return 100;
  return Math.round(((nowMs - startMs) / (endMs - startMs)) * 100);
}

export default function ExamCard({ exam, canStart, timeUntilStart, onStart, currentTime }: ExamCardProps) {
  const isInProgress = exam.session_status === 'in_progress';
  const isSedangBerlangsung = timeUntilStart === 'Sedang Berlangsung';
  const progress = getTimeProgress(exam.scheduled_start, exam.scheduled_end, currentTime);
  const hasViolations = (exam.tab_switch_count ?? 0) > 0;
  const isAlmostForceSubmit = (exam.tab_switch_count ?? 0) >= 2;

  const cardState = { waiting: !canStart && !isInProgress, active: canStart || isInProgress };

  return (
    <div className={`relative rounded-3xl border overflow-hidden transition-all duration-500 ${
      cardState.active 
        ? 'bg-gradient-to-br from-amber-50 to-white border-amber-300 shadow-xl shadow-amber-100/50 scale-[1.02]' 
        : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:scale-[1.01]'
    }`}>
      <div className="absolute top-5 right-5">
        {isSedangBerlangsung ? (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full shadow-sm">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-emerald-600 tracking-wide">BERLANGSUNG</span>
          </span>
        ) : (
          <span className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold text-slate-500">{exam.exam_code}</span>
        )}
      </div>

      {hasViolations && (
        <div className={`px-5 py-2.5 flex items-center gap-2 text-xs font-semibold ${isAlmostForceSubmit ? 'bg-red-50 border-b border-red-100 text-red-600' : 'bg-amber-50 border-b border-amber-100 text-amber-600'}`}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{isAlmostForceSubmit ? `⚠️ PERINGATAN! ${exam.tab_switch_count}/3 pelanggaran — ujian akan dikumpulkan paksa!` : `Pelanggaran: ${exam.tab_switch_count}/3 pindah tab terdeteksi`}</span>
        </div>
      )}

      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-blue-500" />
          <span className="text-sm text-blue-600 font-bold tracking-wide uppercase">{exam.subject}</span>
        </div>
        <h3 className="text-xl font-black text-slate-800 leading-snug mb-5 pr-20 line-clamp-2">{exam.title}</h3>

        <div className="space-y-3 mb-6 bg-slate-50 rounded-2xl p-4 border border-slate-100">
          <div className="flex items-center gap-3 text-sm text-slate-600 font-medium">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>{formatTime(exam.scheduled_start)} – {formatTime(exam.scheduled_end)} WIB</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600 font-medium">
            <Timer className="w-4 h-4 text-slate-400" />
            <span>Durasi: <strong className="text-slate-800">{exam.duration_minutes} menit</strong></span>
          </div>
        </div>

        {isSedangBerlangsung && (
          <div className="mb-6">
            <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
              <span>Waktu Sesi Ujian</span><span className="text-amber-600">{progress}%</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden inset-shadow-sm">
              <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {!canStart && (
          <div className="mb-5 text-center py-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Dimulai Dalam</p>
            <p className="text-2xl font-black text-slate-800 tabular-nums tracking-tight">{timeUntilStart}</p>
          </div>
        )}

        <button
          onClick={onStart} disabled={!canStart}
          className={`w-full py-4 px-4 rounded-2xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
            canStart 
              ? isInProgress 
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 active:scale-[0.98]' 
                : 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white shadow-lg shadow-amber-200 active:scale-[0.98] animate-pulse'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
          }`}
        >
          {canStart ? (isInProgress ? <><RefreshCw className="w-5 h-5" />Lanjutkan Ujian</> : <><Play className="w-5 h-5 fill-current" />Mulai Ujian Sekarang</>) : <><Clock className="w-5 h-5" />Belum Waktunya</>}
        </button>
        <p className="text-xs text-center font-semibold text-slate-400 mt-4">{formatDate(exam.scheduled_start)}</p>
      </div>
    </div>
  );
}