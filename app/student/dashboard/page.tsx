'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  GraduationCap, Clock, Calendar, KeyRound, PlayCircle, 
  CheckCircle2, LogOut, LoaderCircle, AlertCircle, ChevronRight,
  BookOpen, ShieldCheck, Activity, Award, Users, Timer, Info, Lock, Camera, RotateCcw, BellRing, Repeat
} from 'lucide-react';

interface Exam {
  id: string; title: string; subject: string; duration_minutes: number; exam_token: string;
  target_class?: string | string[]; grade_level?: string; start_time?: string; end_time?: string; max_attempts?: number;
}
interface StudentData { id: string; full_name: string; class_group: string; student_number: string; avatar_url?: string; }

const getDriveImageUrl = (url: string | undefined | null) => {
  if (!url) return '';
  const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)([a-zA-Z0-9_-]+)/);
  if (match) return `https://docs.google.com/uc?export=view&id=${match[1]}`;
  return url;
};

export default function StudentDashboard() {
  const router = useRouter();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [appSettings, setAppSettings] = useState({ appName: 'NexAssess CBT', appIcon: '', announcementText: '', timeZone: 'Asia/Jakarta' });
  
  const [completedExamsCounts, setCompletedExamsCounts] = useState<Record<string, number>>({});
  const [ongoingExams, setOngoingExams] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(new Date());
  const [inputTokens, setInputTokens] = useState<{ [key: string]: string }>({});
  const [tokenErrors, setTokenErrors] = useState<{ [key: string]: string }>({});
  const [isStarting, setIsStarting] = useState<{ [key: string]: boolean }>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3500); 
  };

  const fetchStudentDataAndExams = async (showLoadScreen = false) => {
    if (showLoadScreen) setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: settingData } = await supabase.from('pengaturan_aplikasi').select('*').eq('id', 1).single();
      let parsedTz = 'Asia/Jakarta';
      if (settingData?.zona_waktu) {
          if (settingData.zona_waktu.includes('WITA') || settingData.zona_waktu.includes('Makassar')) parsedTz = 'Asia/Makassar';
          else if (settingData.zona_waktu.includes('WIT') || settingData.zona_waktu.includes('Jayapura')) parsedTz = 'Asia/Jayapura';
      }
      if (settingData) {
         setAppSettings({ appName: settingData.nama_aplikasi || 'NexAssess CBT', appIcon: getDriveImageUrl(settingData.ikon_aplikasi) || '', announcementText: settingData.teks_pengumuman || '', timeZone: parsedTz });
      }

      const { data: profileData } = await supabase.from('users').select('*').eq('id', user.id).single();
      
      if (profileData) {
        setStudent(profileData);
        
        const { data: allExams } = await supabase.from('exams').select('id, title, subject, duration_minutes, exam_token, target_class, grade_level, start_time, end_time, max_attempts').order('created_at', { ascending: false });

        if (allExams) {
          const filteredExams = allExams.filter((exam) => {
            const target = exam.target_class; const studentClass = profileData.class_group;
            if (!target || target === '') return true; 
            if (Array.isArray(target)) return target.includes(studentClass);
            if (typeof target === 'string') return target === studentClass || target.includes(studentClass); 
            return false;
          });
          setExams(filteredExams);
        }

        // PERBAIKAN TypeScript Error: Memaksa ID menjadi string (as string)
        const { data: sessionsData } = await supabase.from('exam_sessions').select('exam_id, status').eq('student_id', user.id as string);
        
        if (sessionsData) {
          const counts: Record<string, number> = {};
          const ongoing: string[] = [];
          sessionsData.forEach(s => {
             if (s.status === 'finished') {
                counts[s.exam_id] = (counts[s.exam_id] || 0) + 1;
             } else if (s.status === 'ongoing') {
                ongoing.push(s.exam_id);
             }
          });
          setCompletedExamsCounts(counts);
          setOngoingExams(ongoing);
          
          setTokenErrors({});
          setIsStarting({});
        }
      }
    } catch (error) { showToast("Gagal memuat data dashboard.", "error"); } finally { if (showLoadScreen) setLoading(false); }
  };

  useEffect(() => {
    fetchStudentDataAndExams(true);
    const interval = setInterval(() => setNow(new Date()), 1000);
    
    const channel = supabase.channel('realtime_exams_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, () => fetchStudentDataAndExams(false))
      // PERBAIKAN TypeScript Error: Menambahkan tipe (payload: any) agar TS tidak bingung
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_sessions' }, (payload: any) => {
         if (student && payload.new && payload.new.student_id === student.id) {
             fetchStudentDataAndExams(false);
         }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload: any) => {
         if (student && payload.new.id === student.id && payload.new.avatar_url) {
             setStudent(prev => prev ? { ...prev, avatar_url: payload.new.avatar_url } : null);
         }
      })
      .subscribe();
      
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [student?.id]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0 || !student) return;
      const file = event.target.files[0];
      
      if (!file.type.startsWith('image/')) { showToast("File harus berupa gambar (JPG/PNG)", "warning"); return; }
      if (file.size > 2 * 1024 * 1024) { showToast("Ukuran gambar maksimal 2MB", "warning"); return; }

      setUploadingAvatar(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${student.id}-${Math.random()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', student.id);
      if (updateError) throw updateError;

      setStudent(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      showToast("Foto Profil berhasil diperbarui!", "success");

    } catch (error: any) { showToast("Gagal mengunggah foto profil.", "error"); } finally { setUploadingAvatar(false); }
  };

  const handleTokenChange = (examId: string, value: string) => {
    setInputTokens(prev => ({ ...prev, [examId]: value.toUpperCase() }));
    setTokenErrors(prev => ({ ...prev, [examId]: '' })); 
  };

  const handleStartExam = async (exam: Exam, statusJadwal: string, isOngoing: boolean) => {
    if (isStarting[exam.id] || !student) return;

    if (statusJadwal === 'waiting') { showToast("Jadwal ujian belum dimulai. Silakan tunggu.", "warning"); return; }
    if (statusJadwal === 'ended') { showToast("Waktu ujian telah berakhir.", "error"); return; }
    
    setIsStarting(prev => ({ ...prev, [exam.id]: true }));

    try {
      // PENGECEKAN KETAT MULTIPLE ATTEMPTS
      const { data: checkSessions } = await supabase.from('exam_sessions').select('id, status').eq('student_id', student.id).eq('exam_id', exam.id);

      let actualOngoing = false;
      let actualFinishedCount = 0;

      if (checkSessions && checkSessions.length > 0) {
          checkSessions.forEach(s => {
              if (s.status === 'ongoing') actualOngoing = true;
              if (s.status === 'finished') actualFinishedCount++;
          });
      }

      const maxAttempts = exam.max_attempts || 1;

      if (!actualOngoing) {
          if (actualFinishedCount >= maxAttempts) {
             showToast("Anda sudah mencapai batas maksimal mengerjakan ujian ini.", "error");
             setIsStarting(prev => ({ ...prev, [exam.id]: false }));
             setCompletedExamsCounts(prev => ({ ...prev, [exam.id]: actualFinishedCount }));
             return;
          }

          const enteredToken = inputTokens[exam.id];
          if (!enteredToken) { 
             setTokenErrors(prev => ({ ...prev, [exam.id]: 'Token wajib diisi!' })); 
             setIsStarting(prev => ({ ...prev, [exam.id]: false }));
             return; 
          }
          if (enteredToken !== exam.exam_token) { 
             setTokenErrors(prev => ({ ...prev, [exam.id]: 'Token salah/kadaluarsa!' })); 
             setIsStarting(prev => ({ ...prev, [exam.id]: false }));
             return; 
          }

          const { error: insertError } = await supabase.from('exam_sessions').insert([{ student_id: student.id, exam_id: exam.id, status: 'ongoing', current_question_index: 1 }]);
          if (insertError) throw insertError;

          showToast("Sesi baru dibuat. Memulai Ujian...", "success");
          router.push(`/student/exam/${exam.id}`);
          return;
      }

      showToast("Membuka kembali sesi ujian Anda yang terputus...", "success");
      router.push(`/student/exam/${exam.id}`);

    } catch (error: any) {
      showToast("Gagal memulai ujian: " + error.message, "error");
      setIsStarting(prev => ({ ...prev, [exam.id]: false }));
    }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };
  
  const getFormattedTime = () => {
    let tzLabel = 'WIB';
    if (appSettings.timeZone === 'Asia/Makassar') tzLabel = 'WITA';
    if (appSettings.timeZone === 'Asia/Jayapura') tzLabel = 'WIT';
    return `${now.toLocaleTimeString('id-ID', { timeZone: appSettings.timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit' })} ${tzLabel}`;
  };

  const getExamTimeStatus = (exam: Exam) => {
    if (!exam.start_time && !exam.end_time) return { status: 'active', text: 'Tanpa Batas Waktu', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
    const startTime = exam.start_time ? new Date(exam.start_time).getTime() : 0;
    const endTime = exam.end_time ? new Date(exam.end_time).getTime() : Infinity;
    const currentTime = now.getTime();
    const formatTimeDigital = (ms: number) => {
      const h = Math.floor(ms / (1000 * 60 * 60)); const m = Math.floor((ms / 1000 / 60) % 60); const s = Math.floor((ms / 1000) % 60);
      const pad = (num: number) => num.toString().padStart(2, '0'); return `${pad(h)}:${pad(m)}:${pad(s)}`;
    };
    if (startTime > 0 && currentTime < startTime) return { status: 'waiting', text: `Dimulai dlm ${formatTimeDigital(startTime - currentTime)}`, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
    else if (currentTime >= startTime && currentTime <= endTime) return { status: 'active', text: `Berakhir dlm ${formatTimeDigital(endTime - currentTime)}`, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' };
    else return { status: 'ended', text: 'Ditutup', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' };
  };

  const totalFinishedExams = Object.values(completedExamsCounts).reduce((a, b) => a + b, 0);

  if (loading) return (<div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center"><div className="w-16 h-16 bg-blue-100 rounded-[1.2rem] flex items-center justify-center mb-6 animate-bounce shadow-lg border border-blue-200"><GraduationCap className="w-8 h-8 text-blue-600" /></div><LoaderCircle className="w-8 h-8 text-blue-500 animate-spin mb-4" /><p className="text-slate-500 font-bold tracking-widest uppercase text-sm animate-pulse">Menyiapkan Ruang Ujian...</p></div>);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans selection:bg-blue-200 relative overflow-hidden">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-marquee { display: inline-block; white-space: nowrap; animation: marquee 25s linear infinite; }
        .animate-marquee:hover { animation-play-state: paused; }
      `}} />

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-10 fade-out duration-300">
          <div className={`px-6 py-3.5 rounded-[1.5rem] shadow-2xl flex items-center gap-3 backdrop-blur-md border ${
             toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
             toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' : 
             toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 
             'bg-blue-50 border-blue-200 text-blue-700'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className={`w-5 h-5 text-emerald-500`} /> : 
             toast.type === 'warning' ? <AlertCircle className={`w-5 h-5 text-amber-500`} /> : 
             toast.type === 'error' ? <AlertCircle className={`w-5 h-5 text-rose-500`} /> :
             <Info className={`w-5 h-5 text-blue-500`} />}
            <p className="font-bold text-sm tracking-wide">{toast.message}</p>
          </div>
        </div>
      )}

      <header className="bg-white/90 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-50 transition-all shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[84px] flex items-center justify-between">
          <div className="flex items-center gap-4">
            {appSettings.appIcon ? (
              <img src={appSettings.appIcon} alt="Logo" className="w-12 h-12 object-contain drop-shadow-sm" />
            ) : (
              <div className="w-12 h-12 bg-blue-600 rounded-[1.2rem] flex items-center justify-center shadow-md border border-blue-500">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">{appSettings.appName}</h1>
              <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mt-0.5"><ShieldCheck className="w-3 h-3 text-emerald-500"/> Portal Ujian Siswa</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-4 py-2.5 rounded-xl transition-all border border-transparent hover:border-rose-200 shadow-sm active:scale-95">
            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {appSettings.announcementText && (
         <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md border-b border-blue-800 overflow-hidden relative">
            <div className="max-w-7xl mx-auto flex items-center relative z-10">
               <div className="bg-white/20 backdrop-blur-md px-5 py-2.5 flex items-center gap-2 font-black text-xs uppercase tracking-widest z-20 shrink-0 border-r border-white/20 shadow-[15px_0_20px_-5px_rgba(0,0,0,0.2)]">
                  <BellRing className="w-4 h-4 text-amber-300 animate-pulse"/> 
                  <span className="text-amber-100">Info</span>
               </div>
               <div className="flex-1 overflow-hidden py-2.5 relative">
                  <div className="animate-marquee font-bold text-sm tracking-wide text-white flex items-center">
                     {appSettings.announcementText}
                  </div>
               </div>
            </div>
         </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl shadow-blue-900/10 mb-10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:bg-white/20 transition-all duration-1000"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              
              <div className="relative group/avatar cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                 {uploadingAvatar ? (
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-[1.5rem] bg-white/10 backdrop-blur-sm border-2 border-white/20 flex flex-col items-center justify-center shadow-lg">
                       <LoaderCircle className="w-6 h-6 animate-spin text-white mb-1" />
                       <span className="text-[9px] font-bold uppercase tracking-widest text-blue-200">Upload...</span>
                    </div>
                 ) : student?.avatar_url ? (
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-[1.5rem] overflow-hidden border-[3px] border-white/30 shadow-xl relative bg-white">
                       <img src={student.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                          <Camera className="w-6 h-6 text-white" />
                       </div>
                    </div>
                 ) : (
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-white/10 backdrop-blur-sm border-2 border-dashed border-white/40 rounded-[1.5rem] flex flex-col items-center justify-center text-white/80 hover:bg-white/20 hover:border-white/60 transition-all shadow-lg">
                       <Camera className="w-7 h-7 md:w-8 md:h-8 mb-1" />
                       <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Ganti Foto</span>
                    </div>
                 )}
                 <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
              </div>

              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 backdrop-blur-sm w-fit mb-1 shadow-inner">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-black text-blue-50 tracking-widest uppercase font-mono">{getFormattedTime()}</span>
                </div>
                <div>
                  <h2 className="text-2xl md:text-4xl font-black tracking-tight drop-shadow-sm">{student?.full_name}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold pt-1">
                  <span className="bg-black/20 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-inner">
                    <Users className="w-3.5 h-3.5 text-blue-300" /> Kelas {student?.class_group}
                  </span>
                  <span className="bg-black/20 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-inner">
                    <Award className="w-3.5 h-3.5 text-amber-300" /> NIS: {student?.student_number || '-'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-[1.5rem] p-5 flex items-center gap-4 shadow-xl text-center md:text-left self-end md:self-auto">
               <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-400/30">
                 <CheckCircle2 className="w-6 h-6 text-emerald-400" />
               </div>
               <div>
                 <p className="text-3xl font-black text-white leading-none">{totalFinishedExams} <span className="text-xs font-bold text-blue-200 uppercase tracking-widest align-middle">Selesai</span></p>
                 <p className="text-[10px] font-bold text-blue-300 mt-1.5 uppercase tracking-widest">Ujian Dikerjakan</p>
               </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6 bg-white p-4 rounded-[1.5rem] border border-slate-200 shadow-sm w-fit">
          <div className="p-2.5 bg-blue-50 rounded-xl shadow-sm border border-blue-100"><Activity className="w-5 h-5 text-blue-600" /></div>
          <div className="pr-2">
             <h3 className="text-lg font-black text-slate-800 tracking-tight">Ujian Tersedia</h3>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Jadwal Real-Time</p>
          </div>
        </div>

        {exams.length === 0 ? (
          <div className="bg-white border border-slate-200 border-dashed rounded-[3rem] p-20 text-center shadow-sm">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-inner">
              <Calendar className="w-10 h-10 text-slate-300" />
            </div>
            <h4 className="text-2xl font-black text-slate-700 mb-3">Belum Ada Jadwal Ujian</h4>
            <p className="text-slate-500 font-medium max-w-md mx-auto text-sm leading-relaxed">Saat ini tidak ada jadwal ujian yang ditugaskan untuk kelas Anda. Silakan istirahat atau hubungi pengawas jika ini adalah sebuah kesalahan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {exams.map((exam) => {
              const finishedCount = completedExamsCounts[exam.id] || 0;
              const maxAttempts = exam.max_attempts || 1;
              const isOngoing = ongoingExams.includes(exam.id);
              const timeData = getExamTimeStatus(exam);
              const isLocked = timeData.status === 'waiting' || timeData.status === 'ended';
              
              const isFullyCompleted = finishedCount >= maxAttempts;
              const hasAttemptsLeft = finishedCount > 0 && finishedCount < maxAttempts;

              return (
                <div key={exam.id} className={`group bg-white rounded-[2.5rem] p-8 transition-all duration-500 relative overflow-hidden flex flex-col justify-between h-full ${isFullyCompleted && !isOngoing ? 'border border-emerald-200 shadow-sm opacity-90' : 'border border-slate-200 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] hover:shadow-[0_20px_50px_-15px_rgba(59,130,246,0.2)] hover:border-blue-300 hover:-translate-y-2'}`}>
                  
                  {(!isFullyCompleted || isOngoing) && <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-bl-full -z-10 group-hover:scale-[1.3] transition-transform duration-700"></div>}

                  <div>
                     <div className="mb-6 flex justify-between items-start">
                       <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-[1.2rem] flex items-center justify-center border border-blue-100 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors duration-500">
                         <BookOpen className="w-7 h-7" />
                       </div>
                       {isFullyCompleted && !isOngoing ? (
                         <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-200 shadow-sm"><CheckCircle2 className="w-3.5 h-3.5"/> Selesai ({finishedCount}/{maxAttempts})</span>
                       ) : isOngoing ? (
                         <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-200 shadow-sm animate-pulse"><RotateCcw className="w-3.5 h-3.5"/> Lanjut</span>
                       ) : hasAttemptsLeft ? (
                         <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-200 shadow-sm"><Repeat className="w-3.5 h-3.5"/> Sisa {maxAttempts - finishedCount}x</span>
                       ) : (
                         <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-200 shadow-sm"><PlayCircle className="w-3.5 h-3.5"/> Menunggu</span>
                       )}
                     </div>

                     <div className="mb-6">
                       <div className="flex items-center gap-2 mb-3">
                          {exam.grade_level && <span className="bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-md border border-indigo-100 text-[9px] font-black uppercase tracking-widest">{exam.grade_level}</span>}
                       </div>
                       <h4 className="text-xl md:text-2xl font-black text-slate-800 mb-2 line-clamp-2 leading-tight group-hover:text-blue-700 transition-colors duration-300" title={exam.subject}>{exam.subject}</h4>
                       <p className="text-sm font-bold text-slate-500 line-clamp-2 leading-relaxed">{exam.title || '-'}</p>
                     </div>

                     <div className="flex flex-col gap-3 mb-8">
                       <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
                         <Clock className="w-4 h-4 text-slate-400" /> Waktu: {exam.duration_minutes} Menit
                       </div>
                       
                       {(!isFullyCompleted || isOngoing) && (
                         <div className={`flex items-center justify-center gap-2 text-[11px] font-black px-4 py-3.5 rounded-[1.2rem] border uppercase tracking-widest text-center shadow-sm transition-colors duration-500 ${timeData.bg} ${timeData.color}`}>
                           <Timer className="w-4 h-4 shrink-0" /> {timeData.text}
                         </div>
                       )}
                     </div>
                  </div>

                  <div className="mt-auto">
                     {isFullyCompleted && !isOngoing ? (
                       <div className="pt-2 border-t border-slate-100">
                         <button disabled className="w-full py-4 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-[1.2rem] font-black cursor-not-allowed uppercase tracking-widest text-[10px] flex justify-center gap-2 items-center shadow-sm">
                            <CheckCircle2 className="w-4 h-4"/> Batas Mengerjakan Habis
                         </button>
                       </div>
                     ) : (
                       <div className="space-y-4 pt-6 border-t border-slate-100 relative">
                         {!isOngoing && (
                             <div className="relative group-focus-within:shadow-md transition-shadow rounded-[1.2rem]">
                               <KeyRound className={`absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 ${isLocked ? 'text-slate-300' : 'text-slate-400 group-focus-within:text-blue-500 transition-colors'}`} />
                               <input 
                                 type="text" 
                                 placeholder={isLocked ? "Terkunci" : "Ketik Token..."}
                                 value={inputTokens[exam.id] || ''}
                                 onChange={(e) => handleTokenChange(exam.id, e.target.value)}
                                 disabled={isLocked || isStarting[exam.id]}
                                 className={`w-full pl-14 pr-4 py-4 border rounded-[1.2rem] text-sm font-black text-slate-900 tracking-[0.2em] uppercase placeholder:tracking-normal placeholder:font-bold placeholder:text-xs focus:outline-none transition-all shadow-sm
                                   ${isLocked ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400'}`
                                 }
                                 maxLength={6}
                               />
                             </div>
                         )}
                         
                         {tokenErrors[exam.id] && !isOngoing && (
                           <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 flex items-center justify-center gap-1.5 animate-in fade-in slide-in-from-top-1 bg-rose-50 p-2.5 rounded-xl border border-rose-200"><AlertCircle className="w-3.5 h-3.5"/> {tokenErrors[exam.id]}</p>
                         )}

                         <button 
                           onClick={() => handleStartExam(exam, timeData.status, isOngoing)} 
                           disabled={isLocked || isStarting[exam.id]}
                           className={`w-full py-4 rounded-[1.2rem] font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 group/btn active:scale-95
                             ${isLocked 
                               ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' 
                               : isOngoing 
                                 ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/30' 
                                 : hasAttemptsLeft
                                   ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30'
                                   : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/30'}`
                             }
                         >
                           {isStarting[exam.id] ? <LoaderCircle className="w-5 h-5 animate-spin" /> : (isLocked ? <Lock className="w-3.5 h-3.5"/> : isOngoing ? 'Lanjutkan Ujian' : hasAttemptsLeft ? 'Ulangi Ujian' : 'Mulai Kerjakan')} 
                           {!isLocked && !isStarting[exam.id] && <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />}
                         </button>
                       </div>
                     )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}