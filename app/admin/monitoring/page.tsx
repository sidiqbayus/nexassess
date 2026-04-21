'use client';

import { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Activity, Search, Users, AlertTriangle, MonitorPlay, 
  Camera, CheckCircle2, ShieldAlert, LoaderCircle, PowerOff, X, KeyRound, ShieldCheck,
  Clock, Server, ChevronDown, RefreshCw, Laptop, Globe, XCircle, History, Map as MapIcon, UserCircle2, Edit3, MessageSquare, Unlock, Send, Smartphone, Radio, Settings2, Maximize, MapPin, ExternalLink, HelpCircle, Copy, Layers
} from 'lucide-react';

interface Exam { id: string; title: string; subject: string; grade_level: string; duration_minutes: number; max_tab_switches?: number; passing_score?: number; subject_id?: string; }
interface Student { id: string; full_name: string; student_number: string; class_group: string; avatar_url?: string; room_id?: string; }
interface ExamSession { id: string; student_id: string; exam_id: string; status: string; current_question_index: number; current_violation_count?: number; device_info: string; created_at: string; start_time?: string; percentage_score: number; locked_device_id?: string; security_overrides?: any; resume_token?: string; attempt_number?: number; }
interface ProctoringLog { id: string; student_id: string; session_id: string; snapshot_url: string; created_at: string; log_type: string; }
interface Room { id: string; room_name: string; subject: string; }

// ============================================================================
// HELPER: Cek Kekosongan Jawaban
// ============================================================================
const isAnswerFilled = (text: string | null | undefined) => {
  if (!text) return false;
  if (text === '{}' || text === '[]') return false; 
  if (text.includes('<img') || text.includes('<iframe') || text.includes('<audio') || text.includes('<video')) return true;
  const plainText = text.replace(/<[^>]*>?/gm, '').replace(/ /g, '').replace(/\s/g, '').trim();
  return plainText.length > 0;
};

// ============================================================================
// KOMPONEN KARTU SISWA (MEMOIZED)
// ============================================================================
const StudentMonitorCard = memo(({ 
  session, student, exam, totalQuestions, answeredCount, snapshot, onForceSubmit, onClickCard
}: { 
  session: ExamSession, student: Student, exam: Exam, totalQuestions: number, answeredCount: number, snapshot: string, onForceSubmit: (id: string, name: string) => void, onClickCard: (sessionId: string, studentId: string) => void 
}) => {
  
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (session.status === 'finished') return;
    const startTimeStr = session.start_time || session.created_at;
    let safeTimeStr = startTimeStr.replace(' ', 'T');
    if (!safeTimeStr.endsWith('Z') && !safeTimeStr.match(/[+-]\d{2}:?\d{2}$/)) safeTimeStr += 'Z';
    const startTimeMs = new Date(safeTimeStr).getTime();
    const durationMs = (exam?.duration_minutes || 0) * 60 * 1000;
    const endTimeMs = startTimeMs + durationMs;

    const updateTimer = () => {
      const remaining = endTimeMs - Date.now();
      setTimeLeft(remaining > 0 ? remaining : 0);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session, exam]);

  const formatTime = (ms: number) => {
    if (ms <= 0) return "Waktu Habis";
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  const startTimeObj = new Date(session.start_time || session.created_at);
  const startTimeFormatted = startTimeObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  let ipAddr = "Mendeteksi...";
  let os = "OS Unknown";
  let browser = "Browser Unknown";

  if (session.device_info) {
      const parts = session.device_info.split('| IP:');
      if (parts.length === 2) ipAddr = parts[1].trim();
      const ua = parts[0].toLowerCase();
      if (ua.includes('windows')) os = "Windows";
      else if (ua.includes('mac os') || ua.includes('macos')) os = "Mac OS";
      else if (ua.includes('android')) os = "Android";
      else if (ua.includes('iphone') || ua.includes('ipad')) os = "iOS";
      
      if (ua.includes('edg/')) browser = "Edge";
      else if (ua.includes('opr/') || ua.includes('opera')) browser = "Opera";
      else if (ua.includes('chrome')) browser = "Chrome";
      else if (ua.includes('safari') && !ua.includes('chrome')) browser = "Safari";
      else if (ua.includes('firefox')) browser = "Firefox";
  }

  const isFinished = session.status === 'finished';
  const violations = session.current_violation_count || 0;
  const progressPct = totalQuestions > 0 ? Math.min(100, Math.round((answeredCount / totalQuestions) * 100)) : 0;
  const isDeviceLocked = !!session.locked_device_id;
  
  const maxTabsAllowed = exam?.max_tab_switches ?? 3;
  const isBlockedBySystem = isFinished && violations >= maxTabsAllowed && maxTabsAllowed > 0;

  // LOGIKA KARTU BERKEDIP MERAH JIKA ADA PELANGGARAN
  const isBlinking = violations > 0 && !isFinished;

  return (
    <div 
       onClick={() => onClickCard(session.id, student.id)} 
       className={`bg-white rounded-2xl md:rounded-[2rem] border overflow-hidden transition-all duration-300 cursor-pointer group flex flex-col relative 
          ${isBlinking ? 'border-rose-500 ring-2 md:ring-4 ring-rose-200 shadow-[0_0_20px_rgba(225,29,72,0.4)] animate-pulse' : 
            isFinished ? 'border-slate-200 opacity-80 shadow-sm' : 'border-blue-200 hover:border-blue-400 shadow-sm hover:shadow-xl'}`}
    >
       
       {violations > 0 && !isFinished && (
          <div className="absolute top-0 left-0 w-full bg-rose-600 text-white text-[9px] md:text-[10px] font-black py-1 md:py-1.5 text-center uppercase tracking-widest z-10 flex items-center justify-center gap-1.5 md:gap-2 shadow-sm">
             <AlertTriangle className="w-3 h-3"/> {violations} Peringatan
          </div>
       )}

       <div className={`p-4 md:p-5 flex items-start gap-3 md:gap-4 border-b border-slate-100 ${violations > 0 && !isFinished ? 'mt-5 md:mt-6' : ''}`}>
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 relative shadow-inner">
             {snapshot ? <img src={snapshot} alt="Live Cam" className="w-full h-full object-cover" /> : student.avatar_url ? <img src={student.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Camera className="w-5 h-5 md:w-6 md:h-6 text-slate-300" /></div>}
             {isBlockedBySystem ? (
                <div className="absolute -bottom-1 -right-1 bg-rose-500 rounded-full p-0.5 md:p-1 border-2 border-white shadow-sm" title="Terkunci Sistem (Pelanggaran)"><ShieldAlert className="w-2.5 h-2.5 text-white"/></div>
             ) : (
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 md:w-4 md:h-4 rounded-full border-2 border-white ${isFinished ? 'bg-slate-400' : 'bg-emerald-500'}`}></div>
             )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5 md:pt-1">
             <h3 className="font-black text-slate-800 text-sm md:text-base leading-tight truncate">{student.full_name}</h3>
             <div className="flex flex-wrap items-center gap-1 md:gap-1.5 mt-1 md:mt-1.5">
                <span className="bg-slate-50 text-slate-600 px-1.5 md:px-2 py-0.5 rounded border border-slate-200 text-[8px] md:text-[9px] font-black uppercase tracking-widest truncate max-w-[80px] md:max-w-full">{student.student_number}</span>
                <span className="bg-indigo-50 text-indigo-700 px-1.5 md:px-2 py-0.5 rounded border border-indigo-100 text-[8px] md:text-[9px] font-black uppercase tracking-widest">{student.class_group}</span>
                {session.attempt_number && session.attempt_number > 1 && (
                   <span className="bg-amber-100 text-amber-800 px-1.5 md:px-2 py-0.5 rounded border border-amber-200 text-[8px] md:text-[9px] font-black uppercase tracking-widest">Sesi {session.attempt_number}</span>
                )}
             </div>
          </div>
       </div>

       <div className="p-4 md:p-5 flex-1 bg-slate-50/50">
          <div className="grid grid-cols-2 gap-y-3 md:gap-y-4 gap-x-2 md:gap-x-3 mb-3 md:mb-4">
             <div>
                <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Clock className="w-3 h-3"/> Mulai Ujian</p>
                <p className="text-xs md:text-sm font-black text-slate-700 mt-0.5 md:mt-1">{startTimeFormatted} WIB</p>
             </div>
             <div>
                <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Activity className="w-3 h-3"/> Sisa Waktu</p>
                <p className={`text-xs md:text-sm font-black mt-0.5 md:mt-1 ${isBlockedBySystem ? 'text-rose-600' : isFinished ? 'text-emerald-600' : timeLeft < 300000 ? 'text-rose-600 animate-pulse' : 'text-blue-600'}`}>{isBlockedBySystem ? 'TERKUNCI' : isFinished ? 'Selesai' : formatTime(timeLeft)}</p>
             </div>
             <div>
                <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Search className="w-3 h-3"/> Posisi Soal</p>
                <p className="text-xs md:text-sm font-black text-slate-700 mt-0.5 md:mt-1">No. {(session.current_question_index || 0) + 1} <span className="text-[9px] md:text-[10px] text-slate-400 font-bold">/ {totalQuestions}</span></p>
             </div>
             <div>
                <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Edit3 className="w-3 h-3"/> Terjawab</p>
                <p className="text-xs md:text-sm font-black text-emerald-600 mt-0.5 md:mt-1">{answeredCount} <span className="text-[9px] md:text-[10px] text-slate-400 font-bold">/ {totalQuestions}</span></p>
             </div>
          </div>
          <div className="w-full bg-slate-200 h-1.5 md:h-2 rounded-full overflow-hidden mt-1 md:mt-2 shadow-inner">
             <div className={`h-full rounded-full transition-all duration-1000 ${isBlockedBySystem ? 'bg-rose-500' : isFinished ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progressPct}%` }}></div>
          </div>
       </div>

       <div className="p-3 md:p-4 border-t border-slate-100 bg-white flex flex-col gap-2">
          <div className={`flex items-center justify-between text-[8px] md:text-[9px] font-bold uppercase tracking-widest p-1.5 md:p-2 rounded-lg border ${isDeviceLocked ? 'bg-blue-50/50 border-blue-100 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
             <span className="flex items-center gap-1 truncate max-w-[90px] md:max-w-full" title={ipAddr}><Globe className="w-3 h-3 shrink-0"/> {ipAddr}</span>
             <span className="flex items-center gap-1 truncate max-w-[90px] md:max-w-[120px]" title={`${os} - ${browser}`}><Laptop className="w-3 h-3 shrink-0"/> {browser}</span>
          </div>
          {!isFinished && (
             <div className="mt-1">
                <button onClick={(e) => { e.stopPropagation(); onForceSubmit(session.id, student.full_name); }} className="w-full bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 font-bold py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                   <PowerOff className="w-3 md:w-3.5 h-3 md:h-3.5"/> Tarik Paksa Ujian
                </button>
             </div>
          )}
       </div>
    </div>
  );
});

StudentMonitorCard.displayName = 'StudentMonitorCard';

// ============================================================================
// HALAMAN UTAMA MONITORING
// ============================================================================
export default function MonitoringPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [rooms, setRooms] = useState<Room[]>([]);
  
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [students, setStudents] = useState<Record<string, Student>>({});
  const [snapshots, setSnapshots] = useState<Record<string, string>>({});
  const [answeredCounts, setAnsweredCounts] = useState<Record<string, number>>({});
  const [totalQuestions, setTotalQuestions] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [filterType, setFilterType] = useState<'all' | 'class' | 'room'>('all');
  const [filterValue, setFilterValue] = useState<string>('');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const [selectedSessionDetail, setSelectedSessionDetail] = useState<{ sessionId: string, studentId: string } | null>(null);
  const selectedSessionDetailRef = useRef<{ sessionId: string, studentId: string } | null>(null);
  
  const [detailLogs, setDetailLogs] = useState<ProctoringLog[]>([]);
  const [dmText, setDmText] = useState('');
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState('all'); 
  const [broadcastTargetId, setBroadcastTargetId] = useState('');
  const [broadcastText, setBroadcastText] = useState('');

  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean; type: 'alert' | 'confirm' | 'success'; title: string; message: string;
    onConfirm?: () => void; onCancel?: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  const showDialog = useCallback((type: 'alert'|'confirm'|'success', title: string, message: string, onConfirm?: () => void, onCancel?: () => void) => {
    setDialogConfig({ isOpen: true, type, title, message, onConfirm, onCancel });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogConfig(prev => ({ ...prev, isOpen: false }));
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const fetchExamsAndRooms = async () => {
      try {
        const { data: exData, error } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        
        if (exData && exData.length > 0) {
          setExams(exData as Exam[]);
          setSelectedExamId(exData[0].id);
        }
        
        const { data: rmData } = await supabase.from('rooms').select('id, room_name, subject').order('room_name');
        if (rmData) setRooms(rmData);
      } catch (e) {
        console.error(e);
      } finally { setLoading(false); }
    };
    fetchExamsAndRooms();
  }, []);

  const fetchMonitoringData = useCallback(async (examId: string, isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      
      const { data: examData } = await supabase.from('exams').select('id, subject, subject_id').eq('id', examId).single();
      
      let finalTargetSubjectId = examData?.subject_id;
      if (!finalTargetSubjectId && examData?.subject) {
          const { data: subjData } = await supabase.from('subjects').select('id').eq('name', examData.subject).maybeSingle();
          if (subjData) finalTargetSubjectId = subjData.id;
      }
      
      let qQuery = supabase.from('questions').select('id, package_name, is_active');
      if (finalTargetSubjectId) qQuery = qQuery.eq('subject_id', finalTargetSubjectId);
      else if (examData?.subject) qQuery = qQuery.eq('subject', examData.subject);
      else qQuery = qQuery.eq('exam_id', examId);

      const { data: qData } = await qQuery;
      let tq = 0;
      if (qData && qData.length > 0) {
          const activeQ = qData.filter(q => q.is_active !== false); 
          const pkgCounts: Record<string, number> = {};
          activeQ.forEach(q => {
              const pkg = q.package_name || 'Paket 1';
              pkgCounts[pkg] = (pkgCounts[pkg] || 0) + 1;
          });
          const counts = Object.values(pkgCounts);
          if (counts.length > 0) tq = Math.max(...counts); 
      }
      setTotalQuestions(tq);

      const { data: allSessionsRaw } = await supabase.from('exam_sessions').select('*').eq('exam_id', examId).order('start_time', { ascending: true });
      if (!allSessionsRaw) return;

      const latestSessionsMap: Record<string, ExamSession> = {};
      const sessionAttemptCounter: Record<string, number> = {};

      (allSessionsRaw as any[]).forEach((s: any) => {
         const currentCount = (sessionAttemptCounter[s.student_id] || 0) + 1;
         sessionAttemptCounter[s.student_id] = currentCount;
         
         // Ini menjamin KARTU LUAR HANYA MENAMPILKAN 1 SESI TERBARU per siswa
         latestSessionsMap[s.student_id] = { ...s, attempt_number: currentCount }; 
      });

      const sessionData = Object.values(latestSessionsMap);
      setSessions(sessionData);

      const studentIds = Array.from(new Set(sessionData.map(s => s.student_id)));
      if (studentIds.length > 0) {
         const { data: studentData } = await supabase.from('users').select('id, full_name, student_number, class_group, avatar_url, room_id').in('id', studentIds);
         const studentMap: Record<string, Student> = {};
         studentData?.forEach(s => { studentMap[s.id] = s; });
         setStudents(studentMap);
      }

      const activeSessionIds = sessionData.map(s => s.id);
      
      let responsesData: any[] = [];
      if (activeSessionIds.length > 0) {
         const { data: rData } = await supabase.from('student_responses').select('session_id, answer_text').in('session_id', activeSessionIds);
         if (rData) responsesData = rData;
      }

      const counts: Record<string, number> = {};
      responsesData.forEach(res => { 
          if (isAnswerFilled(res.answer_text)) counts[res.session_id] = (counts[res.session_id] || 0) + 1; 
      });
      setAnsweredCounts(counts);

      if (activeSessionIds.length > 0) {
        const { data: logsData } = await supabase.from('exam_proctoring_logs')
            .select('id, session_id, student_id, snapshot_url, created_at, log_type')
            .in('session_id', activeSessionIds)
            .order('created_at', { ascending: false });
        
        if (logsData) {
           const snapMap: Record<string, string> = {};
           logsData.forEach(log => {
              if (log.log_type === 'snapshot' && !snapMap[log.session_id]) snapMap[log.session_id] = log.snapshot_url;
           });
           setSnapshots(snapMap);
           
           const currDetail = selectedSessionDetailRef.current;
           if (currDetail) {
               setDetailLogs(logsData.filter(l => l.session_id === currDetail.sessionId) as ProctoringLog[]);
           }
        }
      }
    } catch (e) {
      showToast("Gagal menyegarkan data pemantauan", "error");
    } finally {
      if (!isSilent) setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedExamId) {
      fetchMonitoringData(selectedExamId);
      const channelSessions = supabase.channel(`sessions_${selectedExamId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'exam_sessions', filter: `exam_id=eq.${selectedExamId}` }, () => fetchMonitoringData(selectedExamId, true)).subscribe();
      const channelLogs = supabase.channel(`logs_${selectedExamId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'exam_proctoring_logs' }, (payload) => {
            const newLog = payload.new as ProctoringLog;
            if (newLog.log_type === 'snapshot') setSnapshots(prev => ({ ...prev, [newLog.session_id || newLog.student_id]: newLog.snapshot_url }));
            
            const currDetail = selectedSessionDetailRef.current;
            if (currDetail && (currDetail.sessionId === newLog.session_id || (!newLog.session_id && currDetail.studentId === newLog.student_id))) {
                setDetailLogs(prev => [newLog, ...prev]);
            }
      }).subscribe();
      const channelAnswers = supabase.channel(`answers_${selectedExamId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'student_responses' }, () => fetchMonitoringData(selectedExamId, true)).subscribe();

      return () => { supabase.removeChannel(channelSessions); supabase.removeChannel(channelLogs); supabase.removeChannel(channelAnswers); };
    }
  }, [selectedExamId, fetchMonitoringData]);

  // ============================================================================
  // KLIK KARTU -> BUKA DETAIL LOG
  // ============================================================================
  const openStudentDetail = async (sessionId: string, studentId: string) => {
      setDetailLogs([]);
      const detail = { sessionId, studentId };
      setSelectedSessionDetail(detail);
      selectedSessionDetailRef.current = detail;
      
      const { data: logsData, error } = await supabase.from('exam_proctoring_logs')
        .select('id, student_id, session_id, snapshot_url, created_at, log_type')
        .eq('student_id', studentId)
        .eq('exam_id', selectedExamId)
        .order('created_at', { ascending: false });
      
      if (error) {
          showToast(`Gagal memuat log: ${error.message}`, 'error');
          return;
      }

      if (logsData) {
          const sessionLogs = logsData.filter(l => l.session_id === sessionId || !l.session_id);
          
          const snapshots = sessionLogs.filter(l => l.log_type === 'snapshot');
          if (snapshots.length > 8) {
              const idsToDelete = snapshots.slice(8).map(s => s.id);
              supabase.from('exam_proctoring_logs').delete().in('id', idsToDelete).then();
              const keptIds = new Set(snapshots.slice(0, 8).map(s => s.id));
              const filteredLogs = sessionLogs.filter(l => l.log_type !== 'snapshot' || keptIds.has(l.id));
              setDetailLogs(filteredLogs as ProctoringLog[]);
          } else {
              setDetailLogs(sessionLogs as ProctoringLog[]);
          }
      }
  };

  const handleCloseDetail = () => {
      setSelectedSessionDetail(null);
      selectedSessionDetailRef.current = null;
  };

  const triggerForceSubmit = (sessionId: string, studentName: string) => {
    showDialog('confirm', 'TARIK PAKSA UJIAN', `Apakah Anda yakin ingin menutup akses dan memaksa kumpul ujian milik ${studentName}?\n\nTindakan ini tidak bisa dibatalkan.`, () => executeForceSubmit(sessionId, studentName));
  };
  
  const executeForceSubmit = async (sessionId: string, studentName: string) => {
    try {
      const session = sessions.find(s => s.id === sessionId);
      const exam = exams.find(e => e.id === selectedExamId);
      if (!session || !exam) return;

      let targetSubjectId = exam.subject_id;
      if (!targetSubjectId && exam.subject) {
          const { data: subjData } = await supabase.from('subjects').select('id').eq('name', exam.subject).maybeSingle();
          if (subjData) targetSubjectId = subjData.id;
      }
      
      let questionsQuery = supabase.from('questions').select('*');
      if (targetSubjectId) questionsQuery = questionsQuery.eq('subject_id', targetSubjectId);
      else if (exam.subject) questionsQuery = questionsQuery.eq('subject', exam.subject);
      else questionsQuery = questionsQuery.eq('exam_id', exam.id);

      const { data: questionsData } = await questionsQuery;
      const { data: responsesData } = await supabase.from('student_responses').select('*').eq('session_id', sessionId);

      let score = 0;
      let maxScore = 0;
      const updatePromises: any[] = []; 

      const cleanStr = (s: any) => {
         if (!s) return '';
         return String(s).replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim().toLowerCase();
      };

      if (questionsData && responsesData) {
          questionsData.forEach(q => {
              if (q.question_type === 'essay') return; 
              
              const questionPoints = Number(q.points) || 0;
              maxScore += questionPoints;
              
              const ansRecord = responsesData.find(r => r.question_id === q.id);
              const ans = ansRecord?.answer_text;
              if (!ans) return;

              let earnedPoints = 0;

              if (q.question_type === 'multiple_choice' || q.question_type === 'true_false' || q.question_type === 'short_answer') {
                  if (cleanStr(ans) === cleanStr(q.correct_answer)) earnedPoints = questionPoints;
              } else if (q.question_type === 'complex_multiple_choice') {
                  const correctArr = String(q.correct_answer || '').split(',').map(s=>s.trim().toUpperCase()).sort();
                  const ansArr = String(ans).split(',').map(s=>s.trim().toUpperCase()).sort();
                  const correctCount = ansArr.filter(a => correctArr.includes(a)).length;
                  const wrongCount = ansArr.filter(a => !correctArr.includes(a)).length;
                  if (q.scoring_type === 'partial') {
                      let partialScore = (correctCount / correctArr.length) * questionPoints;
                      if (wrongCount > 0) partialScore -= (wrongCount * (questionPoints / correctArr.length));
                      if (partialScore > 0) earnedPoints = partialScore;
                  } else {
                      if (correctCount === correctArr.length && wrongCount === 0) earnedPoints = questionPoints;
                  }
              } else if (q.question_type === 'matching') {
                  try {
                      const ansMap = JSON.parse(ans);
                      const correctMapArr = typeof q.correct_answer === 'string' ? JSON.parse(q.correct_answer) : (q.correct_answer || []);
                      let totalPairs = correctMapArr.length;
                      let correctPairs = 0;
                      correctMapArr.forEach((pair:any) => {
                           const premis = pair.left || pair.key;
                           const respons = pair.right || pair.text;
                           if (cleanStr(ansMap[premis]) === cleanStr(respons)) correctPairs++;
                      });
                      if (totalPairs > 0) {
                          if (q.scoring_type === 'partial') earnedPoints = (correctPairs / totalPairs) * questionPoints;
                          else if (correctPairs === totalPairs) earnedPoints = questionPoints;
                      }
                  } catch(e) {}
              }

              score += earnedPoints;

              if (ansRecord.id) {
                  updatePromises.push(
                      supabase.from('student_responses').update({
                          points_given: earnedPoints,
                          is_correct: earnedPoints > 0
                      }).eq('id', ansRecord.id)
                  );
              }
          });
      }

      const finalScore100 = maxScore > 0 ? (score / maxScore) * 100 : 0;
      const kkm = exam.passing_score || 0; 

      await Promise.all(updatePromises);

      const { error } = await supabase.from('exam_sessions').update({ 
          status: 'finished', 
          submitted_at: new Date().toISOString(),
          total_score: score,
          percentage_score: finalScore100,
          is_passed: finalScore100 >= kkm
      }).eq('id', sessionId);

      if (error) {
         alert(`Error Supabase: ${error.message}\nDetail: ${error.details}\nHint: ${error.hint}`);
         throw error;
      }

      showToast(`Ujian milik ${studentName} berhasil ditarik paksa dan dinilai!`, 'success');
      fetchMonitoringData(selectedExamId, true);
    } catch (e: any) { 
      console.error("Supabase Error detail:", e);
      showToast('Gagal menarik paksa ujian (Lihat alert layar)', 'error'); 
    }
  };

  const triggerResetDevice = (sessionId: string, studentName: string) => {
    showDialog('confirm', 'RESET PERANGKAT', `Sistem akan menghapus rekaman Device Fingerprint siswa ini. Mereka akan diizinkan login dari HP/Laptop lain.\n\nLanjutkan?`, () => executeResetDevice(sessionId, studentName));
  };
  
  const executeResetDevice = async (sessionId: string, studentName: string) => {
    try {
      const { error } = await supabase.from('exam_sessions').update({ locked_device_id: null }).eq('id', sessionId);
      if (error) {
         alert(`Error Supabase: ${error.message}\nDetail: ${error.details}`);
         throw error;
      }
      
      showToast(`Kunci Perangkat milik ${studentName} berhasil di-reset!`, 'success');
      fetchMonitoringData(selectedExamId, true);
    } catch (e) { showToast('Gagal reset perangkat', 'error'); }
  };

  // ============================================================================
  // FUNGSI BUKA SESI KEMBALI
  // ============================================================================
  const triggerUnsubmitResume = (sessionId: string, studentName: string) => {
    showDialog('confirm', 'BUKA SESI KEMBALI', `Sistem akan mereset hitungan peringatan (menjadi 0) dan membuat TOKEN LANJUTAN khusus agar siswa ini bisa masuk kembali ke Sesi yang terputus.\n\nLanjutkan?`, () => executeUnsubmitResume(sessionId, studentName));
  };
  
  const executeUnsubmitResume = async (sessionId: string, studentName: string) => {
    const newToken = Math.floor(100000 + Math.random() * 900000).toString(); 
    try {
      // PERBAIKAN: Menggunakan current_violation_count secara eksplisit
      const { error } = await supabase.from('exam_sessions').update({ 
         status: 'ongoing', 
         current_violation_count: 0,
         resume_token: newToken,
         submitted_at: null,
         total_score: 0,
         percentage_score: 0,
         is_passed: false
      }).eq('id', sessionId);

      if (error) {
         alert(`Error Supabase Saat Buka Sesi:\nPesan: ${error.message}\nDetail: ${error.details}\nHint: ${error.hint}\n\nPastikan RLS dan Tipe Data sesuai.`);
         throw error;
      }
      
      showToast(`Akses ujian ${studentName} berhasil dibuka kembali!`, 'success');
      showDialog('success', 'BERHASIL DIBUKA!', `Sesi berhasil dibuka kembali.\nBerikan Token ini kepada siswa untuk melanjutkan ujiannya:\n\nTOKEN LANJUTAN: ${newToken}`);
      fetchMonitoringData(selectedExamId, true);
    } catch (e: any) { 
      console.error("Full Supabase Error:", e);
      showToast(`Gagal membuka sesi: ${e.message || 'Terjadi kesalahan DB'}`, 'error'); 
    }
  };

  const handleToggleSecurity = async (sessionId: string, currentOverrides: any, key: string, label: string, studentName: string) => {
    const newOverrides = { ...(currentOverrides || {}) };
    const willBeDisabled = !newOverrides[key];
    newOverrides[key] = willBeDisabled; 
    
    try {
      const { error } = await supabase.from('exam_sessions').update({ security_overrides: newOverrides }).eq('id', sessionId);
      if (error) { alert(`Error: ${error.message}`); throw error; }
      
      const statusAction = willBeDisabled ? "dimatikan" : "dihidupkan";
      showToast(`${label} pada ${studentName} berhasil ${statusAction}.`, 'success');
      fetchMonitoringData(selectedExamId, true);
    } catch (e) { showToast('Gagal merubah pengaturan', 'error'); }
  };

  const sendDirectMessage = async (studentId: string, studentName: string) => {
     if (!dmText.trim()) return;
     try {
         await supabase.from('exam_announcements').insert({
             exam_id: selectedExamId, target_type: 'student', target_id: studentId, message: dmText
         });
         setDmText('');
         showToast(`Pesan personal terkirim ke layar ${studentName}!`, 'success');
     } catch (e) { showToast('Gagal mengirim pesan', 'error'); }
  };

  const executeBroadcast = async () => {
     if (!broadcastText.trim()) return;
     try {
         await supabase.from('exam_announcements').insert({
             exam_id: selectedExamId, 
             target_type: broadcastTarget === 'all' ? 'all' : 'room', 
             target_id: broadcastTarget === 'all' ? null : broadcastTargetId, 
             message: broadcastText
         });
         setIsBroadcastOpen(false); setBroadcastText('');
         showToast('Pengumuman massal berhasil disiarkan ke siswa!', 'success');
     } catch (e) { showToast('Gagal mengirim broadcast', 'error'); }
  };

  // ================= PERHITUNGAN & FILTERING =================
  const activeExamObj = exams.find(e => e.id === selectedExamId);

  const uniqueClasses = useMemo(() => {
    const clsSet = new Set<string>();
    Object.values(students).forEach(s => { if (s.class_group) clsSet.add(s.class_group) });
    return Array.from(clsSet).sort();
  }, [students]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const student = students[s.student_id];
      if (!student) return false;

      if (filterType === 'class' && student.class_group !== filterValue) return false;
      if (filterType === 'room' && student.room_id !== filterValue) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!student.full_name.toLowerCase().includes(q) && 
            !student.student_number.toLowerCase().includes(q) && 
            !student.class_group.toLowerCase().includes(q)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const aVio = a.current_violation_count || 0;
      const bVio = b.current_violation_count || 0;
      if (bVio !== aVio) return bVio - aVio;
      if (a.status === 'ongoing' && b.status === 'finished') return -1;
      if (a.status === 'finished' && b.status === 'ongoing') return 1;
      return 0;
    });
  }, [sessions, students, filterType, filterValue, searchQuery]);

  const totalPeserta = filteredSessions.length;
  const pesertaAktif = filteredSessions.filter(s => s.status === 'ongoing').length;
  const pesertaSelesai = filteredSessions.filter(s => s.status === 'finished').length;
  const totalPelanggaran = filteredSessions.reduce((acc, curr) => acc + (curr.current_violation_count || 0), 0);
  
  const detailStudentObj = selectedSessionDetail ? students[selectedSessionDetail.studentId] : null;
  const detailSessionObj = selectedSessionDetail ? sessions.find(s => s.id === selectedSessionDetail.sessionId) : null;
  const violationsLog = detailLogs.filter(l => l.log_type === 'violation');
  const snapshotsLog = detailLogs.filter(l => l.log_type === 'snapshot');
  const locationLog = detailLogs.find(l => l.log_type === 'location'); 

  let modalIp = "Unknown";
  let modalOs = "Unknown";
  let modalBrowser = "Unknown";
  let rawUa = detailSessionObj?.device_info || "-";

  if (detailSessionObj?.device_info) {
      const parts = detailSessionObj.device_info.split('| IP:');
      if (parts.length === 2) modalIp = parts[1].trim();
      const ua = parts[0].toLowerCase();
      rawUa = parts[0].trim();
      
      if (ua.includes('windows')) modalOs = "Windows";
      else if (ua.includes('mac os') || ua.includes('macos')) modalOs = "Mac OS";
      else if (ua.includes('android')) modalOs = "Android";
      else if (ua.includes('iphone') || ua.includes('ipad')) modalOs = "iOS";
      
      if (ua.includes('edg/')) modalBrowser = "Edge";
      else if (ua.includes('opr/') || ua.includes('opera')) modalBrowser = "Opera";
      else if (ua.includes('chrome')) modalBrowser = "Chrome";
      else if (ua.includes('safari') && !ua.includes('chrome')) modalBrowser = "Safari";
      else if (ua.includes('firefox')) modalBrowser = "Firefox";
  }

  const detailMaxTabsAllowed = activeExamObj?.max_tab_switches ?? 3;
  const detailIsBlockedBySystem = detailSessionObj?.status === 'finished' && (detailSessionObj?.current_violation_count || 0) >= detailMaxTabsAllowed && detailMaxTabsAllowed > 0;

  if (loading) {
    return <div className="py-20 flex justify-center"><LoaderCircle className="w-10 h-10 md:w-12 md:h-12 text-blue-500 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 max-w-7xl mx-auto text-slate-900 relative pb-24 md:pb-20">
      
      {/* CUSTOM DIALOG MODAL (POPUP ELEGANT) */}
      {dialogConfig.isOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm md:max-w-md rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
            <div className="p-6 md:p-8 flex flex-col items-center text-center">
               <div className={`w-16 h-16 md:w-20 md:h-20 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center mb-4 md:mb-6 shadow-inner border 
                  ${dialogConfig.type === 'confirm' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                    dialogConfig.type === 'success' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 
                    'bg-rose-50 text-rose-600 border-rose-100'}`}>
                  {dialogConfig.type === 'confirm' ? <HelpCircle className="w-8 h-8 md:w-10 md:h-10" /> : 
                   dialogConfig.type === 'success' ? <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10" /> :
                   <AlertTriangle className="w-8 h-8 md:w-10 md:h-10" />}
               </div>
               <h3 className="text-xl md:text-2xl font-black text-slate-800 mb-2 md:mb-3">{dialogConfig.title}</h3>
               <p className="text-slate-500 font-medium text-xs md:text-sm leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">{dialogConfig.message}</p>
            </div>
            <div className="p-3 md:p-4 bg-slate-50/80 border-t border-slate-100 flex gap-2 md:gap-3 justify-center">
               {dialogConfig.type === 'confirm' && (
                 <button onClick={() => { closeDialog(); if(dialogConfig.onCancel) dialogConfig.onCancel(); }} className="px-4 md:px-6 py-3 md:py-3.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors w-full shadow-sm text-sm">Batal</button>
               )}
               <button onClick={() => { closeDialog(); if(dialogConfig.onConfirm) dialogConfig.onConfirm(); }} className={`px-4 md:px-6 py-3 md:py-3.5 rounded-xl font-bold text-white transition-all shadow-md active:scale-95 w-full text-sm ${dialogConfig.type === 'alert' || dialogConfig.title.includes('TARIK PAKSA') ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : dialogConfig.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}>Mengerti</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION ELEGAN */}
      {toast && (
        <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[150] w-[90%] sm:w-auto animate-in slide-in-from-top-10">
          <div className={`px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] shadow-2xl flex items-center gap-2 md:gap-3 border ${
             toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
             toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className={`w-4 h-4 md:w-5 md:h-5 shrink-0 text-emerald-500`} /> : <AlertTriangle className={`w-4 h-4 md:w-5 md:h-5 shrink-0 ${toast.type === 'warning' ? 'text-amber-500' : 'text-rose-500'}`} />}
            <p className="font-bold text-xs md:text-sm tracking-wide leading-snug">{toast.message}</p>
          </div>
        </div>
      )}

      {/* ================= LIGHTBOX FOTO KAMERA ================= */}
      {enlargedImage && (
         <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in zoom-in-95" onClick={() => setEnlargedImage(null)}>
            <button className="absolute top-4 right-4 md:top-6 md:right-6 text-white hover:text-rose-500 transition-colors drop-shadow-md"><XCircle className="w-10 h-10 md:w-12 md:h-12"/></button>
            <img src={enlargedImage} alt="Enlarged Snap" className="max-w-full max-h-[90vh] rounded-xl md:rounded-2xl border-2 md:border-4 border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] object-contain" />
         </div>
      )}

      {/* ================= MODAL BROADCAST (PENGUMUMAN MASSAL) ================= */}
      {isBroadcastOpen && (
         <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-2xl md:rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="p-4 md:p-6 lg:p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h2 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2 md:gap-3"><Radio className="w-5 h-5 md:w-6 md:h-6 text-blue-600"/> Siarkan Pengumuman</h2>
                  <button onClick={() => setIsBroadcastOpen(false)} className="text-slate-400 hover:text-rose-500 bg-white border border-slate-200 p-1.5 md:p-2 rounded-full shadow-sm"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
               </div>
               <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
                  <div>
                     <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest mb-2 md:mb-3 block flex items-center gap-1.5 md:gap-2"><Users className="w-3.5 h-3.5 md:w-4 md:h-4"/> Pilih Target Penerima</label>
                     <div className="relative">
                       <select value={broadcastTarget} onChange={(e) => setBroadcastTarget(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 md:px-4 py-3 md:py-3.5 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer shadow-sm">
                          <option value="all">Semua Peserta di Ujian Ini</option>
                          <option value="room">Pilih Berdasarkan Ruangan</option>
                       </select>
                       <ChevronDown className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                     </div>
                  </div>
                  {broadcastTarget === 'room' && (
                     <div className="animate-in fade-in slide-in-from-top-2 relative">
                        <select value={broadcastTargetId} onChange={(e) => setBroadcastTargetId(e.target.value)} className="w-full bg-blue-50/50 border border-blue-200 rounded-xl px-3 md:px-4 py-3 md:py-3.5 text-xs md:text-sm font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer">
                           <option value="">-- Pilih Ruangan Spesifik --</option>
                           {rooms.map(rm => <option key={rm.id} value={rm.id}>{rm.room_name} ({rm.subject})</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 pointer-events-none" />
                     </div>
                  )}
                  <div>
                     <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest mb-2 md:mb-3 block flex items-center gap-1.5 md:gap-2"><MessageSquare className="w-3.5 h-3.5 md:w-4 md:h-4"/> Isi Pengumuman</label>
                     <textarea value={broadcastText} onChange={(e) => setBroadcastText(e.target.value)} rows={4} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 md:px-4 py-3 md:py-3.5 text-xs md:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none resize-none placeholder:text-slate-400 shadow-inner" placeholder="Ketik pesan yang akan dimunculkan secara paksa di layar siswa..."></textarea>
                  </div>
               </div>
               <div className="p-4 md:p-6 lg:p-8 border-t border-slate-100 bg-slate-50 flex gap-2 md:gap-3">
                  <button onClick={() => setIsBroadcastOpen(false)} className="flex-1 py-3 md:py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-sm text-xs md:text-sm">Batal</button>
                  <button onClick={executeBroadcast} disabled={!broadcastText || (broadcastTarget === 'room' && !broadcastTargetId)} className="flex-1 py-3 md:py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md shadow-blue-200 disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center gap-1.5 md:gap-2 active:scale-95 transition-all text-xs md:text-sm"><Send className="w-3.5 h-3.5 md:w-4 md:h-4"/> Siarkan</button>
               </div>
            </div>
         </div>
      )}

      {/* ================= MODAL COMMAND CENTER DETAIL SISWA ================= */}
      {selectedSessionDetail && detailStudentObj && detailSessionObj && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in zoom-in-95 duration-200">
           <div className="bg-white w-full max-w-7xl rounded-2xl md:rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[95vh] text-slate-800">
             
             {/* Header Modal Light */}
             <div className="p-4 md:p-5 lg:p-8 border-b border-slate-100 bg-slate-50/80 flex justify-between items-start sm:items-center shrink-0">
                <div className="flex items-center gap-3 sm:gap-4 md:gap-5 min-w-0">
                   {detailStudentObj.avatar_url ? (
                      <img src={detailStudentObj.avatar_url} alt="Avatar" className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0" />
                   ) : (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 border border-blue-200 shadow-sm shrink-0"><UserCircle2 className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7"/></div>
                   )}
                   <div className="min-w-0 flex-1">
                      <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-black text-slate-800 flex flex-wrap items-center gap-2 md:gap-3 leading-tight">
                         <span className="truncate">{detailStudentObj.full_name}</span> 
                         
                         {/* Lencana Status Dinamis */}
                         {detailIsBlockedBySystem ? (
                            <span className="text-[8px] md:text-[10px] bg-rose-100 text-rose-700 px-1.5 md:px-2.5 py-0.5 md:py-1 rounded md:rounded-md border border-rose-200 font-black tracking-widest uppercase whitespace-nowrap">TERKUNCI PELANGGARAN</span>
                         ) : detailSessionObj.status === 'finished' ? (
                            <span className="text-[8px] md:text-[10px] bg-emerald-100 text-emerald-700 px-1.5 md:px-2.5 py-0.5 md:py-1 rounded md:rounded-md border border-emerald-200 font-black tracking-widest uppercase whitespace-nowrap">SELESAI UJIAN</span>
                         ) : (
                            <span className="text-[8px] md:text-[10px] bg-blue-100 text-blue-700 px-1.5 md:px-2.5 py-0.5 md:py-1 rounded md:rounded-md border border-blue-200 font-black animate-pulse tracking-widest uppercase whitespace-nowrap">AKTIF</span>
                         )}
                         
                         {detailSessionObj.attempt_number && detailSessionObj.attempt_number > 1 && (
                            <span className="text-[8px] md:text-[10px] bg-amber-100 text-amber-700 px-1.5 md:px-2.5 py-0.5 md:py-1 rounded md:rounded-md border border-amber-200 font-black tracking-widest uppercase whitespace-nowrap">Sesi {detailSessionObj.attempt_number}</span>
                         )}
                      </h2>
                      <p className="text-xs md:text-sm text-slate-500 mt-0.5 md:mt-1 font-bold truncate">{detailStudentObj.student_number} • Kelas {detailStudentObj.class_group}</p>
                   </div>
                </div>
                <button onClick={handleCloseDetail} className="p-2 md:p-3 text-slate-400 hover:text-rose-500 hover:border-rose-200 bg-white border border-slate-200 rounded-full transition-all shadow-sm shrink-0 ml-2"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
             </div>

             {/* Body Modal Layout - Single Scrollable Area */}
             <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 bg-slate-50/50 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                 
                 {/* KIRI: KONTROL, INFO, DAN PESAN */}
                 <div className="space-y-4 sm:space-y-6">
                   
                    {/* Panel Informasi Perangkat Canggih */}
                    <div className="bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] p-4 md:p-6 shadow-sm">
                       <h3 className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest mb-3 md:mb-5 flex items-center gap-1.5 md:gap-2"><Server className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-500"/> Identitas Perangkat</h3>
                       <div className="space-y-3 md:space-y-4 text-xs md:text-sm">
                          <div className="flex flex-col border-b border-slate-100 pb-2 md:pb-3">
                             <span className="text-slate-400 font-bold mb-0.5 md:mb-1 text-[9px] md:text-xs uppercase tracking-widest">IP Address Publik</span>
                             <span className="font-mono font-black text-blue-700 text-sm md:text-base">{modalIp}</span>
                          </div>
                          <div className="flex flex-col border-b border-slate-100 pb-2 md:pb-3">
                             <span className="text-slate-400 font-bold mb-0.5 md:mb-1 text-[9px] md:text-xs uppercase tracking-widest">OS & Browser Utama</span>
                             <span className="font-bold text-slate-800">{modalOs} - {modalBrowser}</span>
                          </div>
                          <div className="flex flex-col border-b border-slate-100 pb-2 md:pb-3">
                             <span className="text-slate-400 font-bold mb-1 md:mb-2 text-[9px] md:text-xs uppercase tracking-widest">Data User Agent Asli</span>
                             <span className="font-mono text-[9px] md:text-[10px] text-slate-500 leading-tight break-all bg-slate-50 p-2 md:p-3 rounded-lg md:rounded-xl border border-slate-200 shadow-inner">{rawUa}</span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-1 gap-1 sm:gap-0">
                             <span className="text-slate-500 font-bold">Status Deteksi</span>
                             <span className="font-black text-emerald-600 bg-emerald-50 px-2 md:px-3 py-1 rounded-md md:rounded-lg border border-emerald-200 text-[10px] md:text-xs uppercase tracking-widest w-fit">Aktif Merespon</span>
                          </div>
                       </div>
                    </div>

                    {/* PANEL KONTROL KEAMANAN KHUSUS (OVERRIDES) */}
                    <div className="bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] p-4 md:p-6 shadow-sm">
                       <h3 className="text-[10px] md:text-xs font-black text-amber-600 uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-1.5 md:gap-2"><Settings2 className="w-3.5 h-3.5 md:w-4 md:h-4"/> Bypass Keamanan Khusus</h3>
                       <p className="text-[9px] md:text-[10px] font-bold text-slate-500 mb-4 md:mb-5 leading-relaxed bg-amber-50 p-2.5 md:p-3 rounded-lg md:rounded-xl border border-amber-100 shadow-sm">Matikan fitur di bawah ini jika siswa mengalami kendala perangkat (HP rusak/tidak support). Tombol Biru = Keamanan Aktif.</p>
                       
                       <div className="space-y-2.5 md:space-y-3">
                          {[
                             { key: 'disable_camera', label: 'Wajib Kamera Aktif (Webcam)', icon: Camera },
                             { key: 'disable_gps', label: 'Lacak Lokasi (Sistem GPS)', icon: MapPin },
                             { key: 'disable_fullscreen', label: 'Wajib Mode Layar Penuh', icon: Maximize },
                             { key: 'disable_tab_lock', label: 'Kunci Blokir Pindah Tab', icon: ShieldAlert }
                          ].map(opt => {
                             const isBypassed = detailSessionObj.security_overrides?.[opt.key] === true; 
                             const Icon = opt.icon;
                             return (
                                <div key={opt.key} className="flex items-center justify-between p-2.5 md:p-3.5 rounded-lg md:rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                                   <div className="flex items-center gap-2 md:gap-3">
                                      <Icon className={`w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 ${!isBypassed ? 'text-blue-600' : 'text-slate-400'}`}/>
                                      <span className={`text-[10px] md:text-xs font-bold leading-tight ${!isBypassed ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{opt.label}</span>
                                   </div>
                                   <button 
                                      onClick={() => handleToggleSecurity(detailSessionObj.id, detailSessionObj.security_overrides, opt.key, opt.label, detailStudentObj.full_name)}
                                      className={`relative inline-flex h-5 w-9 md:h-6 md:w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${!isBypassed ? 'bg-blue-600 shadow-inner' : 'bg-slate-300'}`}
                                   >
                                      <span className={`inline-block h-3.5 w-3.5 md:h-4 md:w-4 transform rounded-full bg-white shadow-sm transition-transform ${!isBypassed ? 'translate-x-5 md:translate-x-6' : 'translate-x-1'}`}/>
                                   </button>
                                </div>
                             )
                          })}
                       </div>
                    </div>

                    {/* PANEL AKSI DARURAT (RESET DEVICE & UNSUBMIT) */}
                    <div className="bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] p-4 md:p-6 shadow-sm">
                       <h3 className="text-[10px] md:text-xs font-black text-rose-600 uppercase tracking-widest mb-3 md:mb-5 flex items-center gap-1.5 md:gap-2"><Unlock className="w-3.5 h-3.5 md:w-4 md:h-4"/> Tindakan Darurat (Bantuan)</h3>
                       <div className="space-y-3 md:space-y-4">
                          <button onClick={() => triggerResetDevice(detailSessionObj.id, detailStudentObj.full_name)} className="w-full flex items-center justify-between p-3 md:p-4 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg md:rounded-xl transition-all shadow-sm group">
                             <div className="flex items-center gap-2 md:gap-3 text-left">
                                <div className="p-1.5 md:p-2 bg-blue-100 text-blue-600 rounded-md md:rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors"><Smartphone className="w-3.5 h-3.5 md:w-4 md:h-4"/></div>
                                <div>
                                   <p className="text-xs md:text-sm font-black text-slate-800 group-hover:text-blue-700 transition-colors">Reset Kunci Perangkat</p>
                                   <p className="text-[9px] md:text-[10px] font-bold text-slate-500 mt-0.5 md:mt-1 uppercase tracking-widest">Izinkan login di HP lain</p>
                                </div>
                             </div>
                             {detailSessionObj.locked_device_id ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-500 shrink-0"/> : <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-slate-300 shrink-0"></div>}
                          </button>

                          {detailSessionObj.status === 'finished' && (
                             <button onClick={() => triggerUnsubmitResume(detailSessionObj.id, detailStudentObj.full_name)} className="w-full flex items-center justify-between p-3 md:p-4 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-lg md:rounded-xl transition-all shadow-sm group">
                                <div className="flex items-center gap-2 md:gap-3 text-left">
                                   <div className="p-1.5 md:p-2 bg-rose-100 text-rose-600 rounded-md md:rounded-lg group-hover:bg-rose-600 group-hover:text-white transition-colors"><RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4"/></div>
                                   <div>
                                      <p className="text-xs md:text-sm font-black text-slate-800 group-hover:text-rose-700 transition-colors">Buka Sesi Kembali</p>
                                      <p className="text-[9px] md:text-[10px] font-bold text-rose-500 mt-0.5 md:mt-1 uppercase tracking-widest">Buat Token Lanjutan Ujian</p>
                                   </div>
                                </div>
                             </button>
                          )}

                          {/* TAMPILAN TOKEN LANJUTAN */}
                          {detailSessionObj.resume_token && detailSessionObj.status === 'ongoing' && (
                             <div className="p-4 md:p-5 bg-emerald-50 border border-emerald-200 rounded-lg md:rounded-xl text-center shadow-sm relative overflow-hidden animate-in fade-in zoom-in duration-300 mt-3 md:mt-4">
                                <p className="text-[10px] md:text-xs text-emerald-700 font-black uppercase tracking-widest mb-2 md:mb-3 flex items-center justify-center gap-1"><KeyRound className="w-3 h-3 md:w-4 md:h-4"/> Token Lanjutan</p>
                                <div className="flex items-center justify-center gap-2 md:gap-3">
                                   <p className="text-xl sm:text-2xl md:text-3xl font-black text-emerald-800 tracking-[0.3em] md:tracking-[0.4em] font-mono bg-white px-4 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl border border-emerald-200 shadow-inner">
                                      {detailSessionObj.resume_token}
                                   </p>
                                   <button 
                                      onClick={() => {
                                         navigator.clipboard.writeText(detailSessionObj.resume_token || '');
                                         showToast('Token Lanjutan berhasil disalin!');
                                      }}
                                      className="p-2.5 md:p-3.5 bg-white hover:bg-emerald-600 text-emerald-600 hover:text-white rounded-lg md:rounded-xl transition-all border border-emerald-200 hover:border-emerald-600 shadow-sm"
                                      title="Salin Token"
                                   >
                                      <Copy className="w-5 h-5 md:w-6 md:h-6" />
                                   </button>
                                </div>
                                <p className="text-[9px] md:text-[10px] text-emerald-600/80 mt-2 md:mt-3 font-bold uppercase tracking-widest">Berikan kode ini ke siswa.</p>
                             </div>
                          )}
                       </div>
                    </div>

                    {/* PANEL KIRIM PESAN DM */}
                    <div className="bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] p-4 md:p-6 shadow-sm">
                       <h3 className="text-[10px] md:text-xs font-black text-blue-600 uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-1.5 md:gap-2"><MessageSquare className="w-3.5 h-3.5 md:w-4 md:h-4"/> Pesan Personal Screen</h3>
                       <div className="flex flex-col gap-2.5 md:gap-3">
                          <textarea value={dmText} onChange={e => setDmText(e.target.value)} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-bold text-slate-800 focus:border-blue-500 focus:ring-2 focus:bg-white outline-none resize-none placeholder-slate-400 shadow-inner" placeholder={`Ketik pesan untuk ${detailStudentObj.full_name}...`}></textarea>
                          <button onClick={() => sendDirectMessage(detailStudentObj.id, detailStudentObj.full_name)} disabled={!dmText.trim()} className="w-full py-2.5 md:py-3.5 bg-blue-600 text-white font-bold text-xs md:text-sm rounded-lg md:rounded-xl hover:bg-blue-700 transition-all disabled:bg-slate-300 disabled:shadow-none shadow-md shadow-blue-200 flex justify-center items-center gap-1.5 md:gap-2 active:scale-95"><Send className="w-3.5 h-3.5 md:w-4 md:h-4"/> Kirim Pesan</button>
                       </div>
                    </div>

                 </div>

                 {/* TENGAH & KANAN: PETA, GALERI KAMERA, & RIWAYAT */}
                 <div className="lg:col-span-2 space-y-4 sm:space-y-6 md:space-y-8">
                    
                    {/* PETA LOKASI */}
                    <div className="bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] p-4 md:p-6 lg:p-8 shadow-sm">
                       <div className="flex justify-between items-center mb-3 md:mb-5 pb-3 md:pb-5 border-b border-slate-100">
                          <h3 className="text-xs md:text-sm font-black text-slate-800 flex items-center gap-1.5 md:gap-2"><MapIcon className="w-4 h-4 md:w-5 md:h-5 text-emerald-500"/> Titik Lokasi Terakhir</h3>
                          {locationLog && (
                             <a href={`http://googleusercontent.com/maps.google.com/maps?q=${locationLog.snapshot_url.split(',')[0]},${locationLog.snapshot_url.split(',')[1]}`} target="_blank" rel="noreferrer" className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg flex items-center gap-1 md:gap-1.5 transition-colors shadow-sm whitespace-nowrap">
                                <ExternalLink className="w-3 h-3"/> <span className="hidden sm:inline">Buka Maps</span>
                             </a>
                          )}
                       </div>
                       {locationLog ? (
                          <div className="w-full h-64 md:h-80 rounded-xl md:rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 relative shadow-inner">
                             <iframe 
                                width="100%" 
                                height="100%" 
                                frameBorder="0" 
                                src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(locationLog.snapshot_url.split(',')[1]) - 0.003}%2C${parseFloat(locationLog.snapshot_url.split(',')[0]) - 0.003}%2C${parseFloat(locationLog.snapshot_url.split(',')[1]) + 0.003}%2C${parseFloat(locationLog.snapshot_url.split(',')[0]) + 0.003}&layer=mapnik&marker=${locationLog.snapshot_url.split(',')[0]}%2C${locationLog.snapshot_url.split(',')[1]}`}
                                className="absolute inset-0"
                             ></iframe>
                             <div className="absolute bottom-2 right-2 md:bottom-3 md:right-3 bg-white/90 backdrop-blur-md text-slate-800 text-[10px] md:text-xs font-black px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-slate-200 shadow-lg font-mono">
                                Lat: {locationLog.snapshot_url.split(',')[0]} | Lng: {locationLog.snapshot_url.split(',')[1]}
                             </div>
                          </div>
                       ) : (
                          <div className="w-full h-48 sm:h-64 md:h-80 rounded-xl md:rounded-2xl border-2 border-slate-200 border-dashed flex flex-col items-center justify-center text-slate-400 bg-slate-50 p-4 text-center">
                             <div className="p-3 md:p-4 bg-white rounded-full shadow-sm mb-3 md:mb-4"><MapIcon className="w-8 h-8 md:w-10 md:h-10 text-slate-300"/></div>
                             <p className="text-base md:text-lg font-black text-slate-600">Data GPS Belum Tersedia</p>
                             <p className="text-xs md:text-sm font-medium text-slate-500 mt-1 max-w-md">Menunggu siswa mengizinkan akses lokasi pada browsernya, atau fitur lacak lokasi sedang dimatikan.</p>
                          </div>
                       )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
                       {/* GALERI KAMERA */}
                       <div className="bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] p-4 md:p-6 shadow-sm">
                          <div className="flex items-center justify-between mb-4 md:mb-5 pb-3 md:pb-5 border-b border-slate-100">
                            <h3 className="text-xs md:text-sm font-black text-slate-800 flex items-center gap-1.5 md:gap-2"><Camera className="w-4 h-4 md:w-5 md:h-5 text-blue-500"/> Snap Kamera</h3>
                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">{snapshotsLog.length}/8 Foto</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-3 md:gap-4 content-start">
                             {snapshotsLog.length === 0 ? (
                                <div className="col-span-full text-center text-xs md:text-sm text-slate-400 py-12 md:py-16 font-bold border-2 border-dashed border-slate-200 bg-slate-50 rounded-xl md:rounded-2xl flex flex-col items-center justify-center px-4">
                                  <Camera className="w-6 h-6 md:w-8 md:h-8 mb-2 md:mb-3 opacity-30"/>
                                  Belum ada foto tangkapan layar.
                                </div>
                             ) : (
                                snapshotsLog.map((log, i) => (
                                   <div 
                                      key={i} 
                                      className="relative rounded-xl md:rounded-2xl overflow-hidden border border-slate-200 group bg-slate-100 aspect-[4/3] shadow-sm cursor-pointer"
                                      onClick={() => setEnlargedImage(log.snapshot_url)}
                                   >
                                      <img src={log.snapshot_url} alt="Snap" className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500" />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center backdrop-blur-[1px] opacity-0 group-hover:opacity-100">
                                         <Maximize className="w-6 h-6 md:w-8 md:h-8 text-white drop-shadow-md" />
                                      </div>
                                      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-900/90 to-transparent p-2 md:p-3 pt-6 md:pt-8 pointer-events-none">
                                         <p className="text-[8px] md:text-[10px] font-mono text-white font-black tracking-widest">{new Date(log.created_at).toLocaleTimeString('id-ID')} WIB</p>
                                      </div>
                                   </div>
                                ))
                             )}
                          </div>
                       </div>

                       {/* RIWAYAT PELANGGARAN */}
                       <div className="bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] p-4 md:p-6 shadow-sm">
                          <div className="flex items-center justify-between mb-4 md:mb-5 pb-3 md:pb-5 border-b border-slate-100">
                            <h3 className="text-xs md:text-sm font-black text-rose-600 flex items-center gap-1.5 md:gap-2"><History className="w-4 h-4 md:w-5 md:h-5"/> Riwayat Pindah Tab</h3>
                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-200 whitespace-nowrap">{violationsLog.length} Catatan</span>
                          </div>
                          <div className="space-y-2.5 md:space-y-3 max-h-64 md:max-h-none overflow-y-auto custom-scrollbar pr-1 md:pr-0">
                             {violationsLog.length === 0 ? (
                                <div className="text-center text-xs md:text-sm text-slate-400 py-12 md:py-16 font-bold border-2 border-dashed border-slate-200 bg-slate-50 rounded-xl md:rounded-2xl flex flex-col items-center justify-center px-4">
                                  <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 mb-2 md:mb-3 text-emerald-400 opacity-50"/>
                                  Tidak ada catatan pelanggaran. Bersih.
                                </div>
                             ) : (
                                violationsLog.map((log, i) => {
                                   const time = new Date(log.created_at).toLocaleTimeString('id-ID');
                                   return (
                                      <div key={i} className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start p-3 md:p-4 bg-rose-50/50 border border-rose-100 rounded-xl md:rounded-2xl hover:bg-rose-50 transition-colors">
                                         <span className="text-[10px] md:text-xs font-black font-mono text-rose-600 bg-white px-2 py-1 rounded-md md:rounded-lg border border-rose-200 shadow-sm shrink-0">{time}</span>
                                         <p className="text-xs md:text-sm font-bold text-slate-800 leading-relaxed mt-0.5">{log.snapshot_url}</p>
                                      </div>
                                   )
                                })
                             )}
                          </div>
                       </div>
                    </div>

                 </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* HEADER & SELECTOR UJIAN */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6 bg-white p-5 md:p-6 lg:p-8 rounded-2xl md:rounded-[2.5rem] border border-blue-100 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 md:h-2.5 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
        <div className="absolute -right-4 -bottom-4 md:-right-10 md:-bottom-10 opacity-5"><MonitorPlay className="w-32 h-32 md:w-48 md:h-48"/></div>
        
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 flex items-center gap-3 md:gap-4 tracking-tight">
            <div className="p-2 md:p-3 bg-blue-50 text-blue-600 rounded-xl md:rounded-2xl border border-blue-100 shadow-inner"><MonitorPlay className="w-6 h-6 md:w-8 md:h-8" /></div>
            Live Proctoring Admin
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-2 md:mt-3 font-bold max-w-xl leading-relaxed">Pantau aktivitas layar, waktu, kamera, dan progres siswa secara <i>Real-Time</i> selama ujian berlangsung di seluruh ruangan.</p>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-2 md:gap-3 w-full lg:w-auto relative z-10 mt-2 lg:mt-0">
          <button onClick={() => setIsBroadcastOpen(true)} className="w-full sm:w-auto px-4 py-3 md:px-6 md:py-4 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white font-black rounded-xl md:rounded-2xl border border-blue-200 hover:border-blue-600 transition-all shadow-sm flex items-center justify-center gap-1.5 md:gap-2 active:scale-95 text-xs md:text-sm whitespace-nowrap">
             <Radio className="w-4 h-4 md:w-5 md:h-5"/> Kirim Pengumuman
          </button>
          <div className="flex items-center gap-2 w-full sm:w-auto">
             <div className="relative flex-1 sm:w-64 md:w-80">
                <select 
                   value={selectedExamId} 
                   onChange={(e) => setSelectedExamId(e.target.value)}
                   className="w-full bg-white border border-slate-200 rounded-xl md:rounded-2xl px-3 md:px-5 py-3 md:py-4 text-xs md:text-sm font-black text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer shadow-sm transition-all hover:border-blue-300 truncate pr-8"
                >
                   {exams.length === 0 ? <option>Belum ada jadwal ujian</option> : null}
                   {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.subject} - {ex.grade_level || 'Umum'}</option>)}
                </select>
                <ChevronDown className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-blue-500 pointer-events-none font-bold" />
             </div>
             <button onClick={() => fetchMonitoringData(selectedExamId)} disabled={refreshing || !selectedExamId} className="p-3 md:p-4 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl md:rounded-2xl border border-blue-200 hover:border-blue-600 transition-all shadow-sm shrink-0 active:scale-95 disabled:opacity-50" title="Segarkan Data Manual">
                <RefreshCw className={`w-4 h-4 md:w-5 md:h-5 ${refreshing ? 'animate-spin' : ''}`} />
             </button>
          </div>
        </div>
      </div>

      {/* FILTERING LANJUTAN ELEGANT */}
      <div className="bg-white p-2.5 md:p-3 rounded-xl md:rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3 w-full">
         <div className="relative w-full md:flex-1">
            <Search className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
            <input 
              type="text" placeholder="Cari nama, NIS, kelas..." 
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full bg-slate-50 border-none rounded-lg md:rounded-xl pl-10 md:pl-11 pr-3 md:pr-4 py-2.5 md:py-3 text-xs md:text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-400" 
            />
         </div>
         <div className="w-px h-8 bg-slate-200 hidden md:block mx-1"></div>
         <div className="flex flex-col sm:flex-row w-full md:w-auto gap-2">
            <select value={filterType} onChange={(e) => { setFilterType(e.target.value as any); setFilterValue(''); }} className="flex-1 md:w-40 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none transition-all hover:bg-white">
              <option value="all">Semua Peserta</option>
              <option value="class">Filter Kelas</option>
              <option value="room">Filter Ruangan</option>
            </select>
            {filterType === 'class' && (
               <select value={filterValue} onChange={(e) => setFilterValue(e.target.value)} className="flex-1 md:w-48 bg-white border border-blue-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none shadow-sm animate-in fade-in">
                 <option value="">- Pilih Kelas -</option>
                 {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
            )}
            {filterType === 'room' && (
               <select value={filterValue} onChange={(e) => setFilterValue(e.target.value)} className="flex-1 md:w-48 bg-white border border-blue-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none shadow-sm animate-in fade-in">
                 <option value="">- Pilih Ruangan -</option>
                 {rooms.map(r => <option key={r.id} value={r.id}>{r.room_name}</option>)}
               </select>
            )}
         </div>
      </div>

      {/* STATISTIK CEPAT */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
         <div className="bg-white p-4 md:p-8 rounded-xl md:rounded-[2rem] border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-3 md:gap-5 hover:shadow-md transition-shadow text-center sm:text-left">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center border border-slate-100 shrink-0 shadow-inner"><Users className="w-5 h-5 md:w-7 md:h-7 text-slate-500"/></div>
            <div><p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Total Peserta Ujian</p><p className="text-xl md:text-3xl font-black text-slate-800">{totalPeserta}</p></div>
         </div>
         <div className="bg-white p-4 md:p-8 rounded-xl md:rounded-[2rem] border border-blue-200 shadow-[0_0_20px_rgba(59,130,246,0.15)] flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-3 md:gap-5 transform hover:-translate-y-1 transition-all duration-300 text-center sm:text-left">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-blue-500 rounded-xl md:rounded-2xl flex items-center justify-center border border-blue-400 shrink-0 relative shadow-inner">
               <span className="absolute -top-1 -right-1 flex h-3 w-3 md:h-4 md:w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 md:h-4 md:w-4 bg-blue-400 border border-white"></span></span>
               <Activity className="w-5 h-5 md:w-7 md:h-7 text-white"/>
            </div>
            <div><p className="text-[9px] md:text-[10px] font-black text-blue-500 uppercase tracking-widest mb-0.5 md:mb-1">Sedang Mengerjakan</p><p className="text-xl md:text-3xl font-black text-blue-700">{pesertaAktif}</p></div>
         </div>
         <div className="bg-white p-4 md:p-8 rounded-xl md:rounded-[2rem] border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-3 md:gap-5 hover:shadow-md transition-shadow text-center sm:text-left">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-emerald-50 rounded-xl md:rounded-2xl flex items-center justify-center border border-emerald-100 shrink-0 shadow-inner"><CheckCircle2 className="w-5 h-5 md:w-7 md:h-7 text-emerald-500"/></div>
            <div><p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Selesai / Terkirim</p><p className="text-xl md:text-3xl font-black text-slate-800">{pesertaSelesai}</p></div>
         </div>
         <div className={`bg-white p-4 md:p-8 rounded-xl md:rounded-[2rem] border shadow-sm flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-3 md:gap-5 transition-all text-center sm:text-left ${totalPelanggaran > 0 ? 'border-rose-300 bg-rose-50/50 shadow-[0_0_20px_rgba(225,29,72,0.15)] hover:bg-rose-100/50' : 'border-slate-200 hover:shadow-md'}`}>
            <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center border shrink-0 shadow-inner ${totalPelanggaran > 0 ? 'bg-rose-500 border-rose-400 animate-pulse text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}><ShieldAlert className="w-5 h-5 md:w-7 md:h-7"/></div>
            <div><p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-0.5 md:mb-1 ${totalPelanggaran > 0 ? 'text-rose-500' : 'text-slate-400'}`}>Total Pelanggaran</p><p className={`text-xl md:text-3xl font-black ${totalPelanggaran > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{totalPelanggaran}</p></div>
         </div>
      </div>

      {/* GRID MONITORING SISWA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6 mt-4 md:mt-0">
         {filteredSessions.length === 0 ? (
            <div className="col-span-full py-16 md:py-24 text-center bg-white border border-slate-200 border-dashed rounded-[2rem] md:rounded-[2.5rem] shadow-sm px-4">
               <div className="w-16 h-16 md:w-24 md:h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-5 border border-slate-100"><MonitorPlay className="w-8 h-8 md:w-12 md:h-12 text-slate-300" /></div>
               <h3 className="text-xl md:text-2xl font-black text-slate-700 mb-1.5 md:mb-2">Tidak Ada Data Sesuai Filter</h3>
               <p className="text-slate-500 font-medium text-xs md:text-sm">Peserta belum ada yang masuk atau coba ubah kata kunci filter Anda.</p>
            </div>
         ) : (
            filteredSessions.map(session => {
               const student = students[session.student_id];
               if (!student || !activeExamObj) return null;
               
               return (
                  <StudentMonitorCard 
                     key={session.id} 
                     session={session} 
                     student={student} 
                     exam={activeExamObj} 
                     totalQuestions={totalQuestions} 
                     answeredCount={answeredCounts[session.id] || 0} 
                     snapshot={snapshots[session.id]} 
                     onForceSubmit={triggerForceSubmit} 
                     onClickCard={openStudentDetail}
                  />
               );
            })
         )}
      </div>

    </div>
  );
}