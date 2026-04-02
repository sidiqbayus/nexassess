'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { 
  CalendarClock, Search, Clock, BookOpen, 
  LoaderCircle, X, CheckCircle2, GraduationCap, Users, // <-- Ditambahkan di sini
  Printer, UserCircle2, AlertTriangle, FileText, FileSpreadsheet,
  Download, Copy, Check
} from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  subject: string;
  subject_id?: string;
  target_class: string | string[]; 
  grade_level?: string;
  description?: string;
  duration_minutes: number;
  min_working_minutes: number; 
  passing_score?: number;
  max_tab_switches?: number;
  max_attempts?: number; 
  randomize_questions?: boolean;
  randomize_options?: boolean;
  show_result_after?: boolean;
  exam_token: string;        
  token_updated_at: string; 
  start_time: string;
  end_time: string;
}

interface Teacher { id: string; full_name: string; taught_subjects?: string[]; }
interface Subject { id: string; name: string; grade_level: string; }

export default function TeacherSchedulesPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [myTeacherProfile, setMyTeacherProfile] = useState<Teacher | null>(null);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]); 
  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [appName, setAppName] = useState('CBT_App'); 
  const [appTimeZone, setAppTimeZone] = useState('Asia/Jakarta');
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // UI NOTIFIKASI
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  
  // Print State 
  const [isPrintOptionsOpen, setIsPrintOptionsOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { 
    fetchInitialData(); 
    const tick = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesi tidak valid.');

      const { data: settingData } = await supabase.from('pengaturan_aplikasi').select('nama_aplikasi, zona_waktu').eq('id', 1).single();
      if (settingData?.nama_aplikasi) setAppName(settingData.nama_aplikasi.replace(/\s+/g, '_'));
      
      let currentTz = 'Asia/Jakarta';
      if (settingData?.zona_waktu) {
         if (settingData.zona_waktu.includes('WITA') || settingData.zona_waktu.includes('Makassar')) currentTz = 'Asia/Makassar';
         else if (settingData.zona_waktu.includes('WIT') || settingData.zona_waktu.includes('Jayapura')) currentTz = 'Asia/Jayapura';
         setAppTimeZone(currentTz);
      }
      
      const { data: teachersData } = await supabase.from('users').select('id, full_name, taught_subjects').eq('role', 'teacher').order('full_name');
      if (teachersData) {
          setTeachersList(teachersData as Teacher[]);
          const myProfile = teachersData.find(t => t.id === user.id);
          setMyTeacherProfile(myProfile || null);
      }

      const { data: subjData } = await supabase.from('subjects').select('*').order('name');
      if (subjData) setSubjectsList(subjData as Subject[]);

      const { data: examsData, error } = await supabase
        .from('exams').select('*').order('start_time', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });

      if (error) throw error;
      if (examsData) setExams(examsData as Exam[]);
    } catch (error) { showToast("Gagal memuat data", "error"); } finally { setLoading(false); }
  };

  const getSecondsLeft = (updatedAt: string) => {
    if (!updatedAt) return 0;
    const elapsed = Math.floor((currentTime - new Date(updatedAt).getTime()) / 1000);
    return Math.max(0, 300 - elapsed); 
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60); const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatZonedTimeStr = (isoString: string | null) => {
     if (!isoString) return 'Belum diatur';
     return new Date(isoString).toLocaleString('id-ID', { timeZone: appTimeZone, dateStyle: 'medium', timeStyle: 'short' });
  };

  const handleCopyToken = (id: string, token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(id); 
    showToast("Token ujian berhasil disalin!", "success");
    setTimeout(() => setCopiedTokenId(null), 2000); 
  };

  const getTeachersForExam = (subjectName: string, gradeLevel: string) => {
    const subjectObj = subjectsList.find(s => s.name === subjectName && s.grade_level === gradeLevel);
    if (!subjectObj) return [];
    return teachersList.filter(t => t.taught_subjects?.includes(subjectObj.id)).map(t => t.full_name);
  };

  // ================= CETAK JADWAL GLOBAL =================
  const handlePrintAllExamsPDF = () => {
    if (exams.length === 0) { showToast("Tidak ada jadwal untuk dicetak.", "warning"); return; }
    setIsGeneratingPdf(true);
    
    const fileName = `Jadwal_Ujian_${appName}.pdf`;

    const rowsHtml = exams.map((ex, i) => {
      const dateStr = formatZonedTimeStr(ex.start_time); // Sync Zone
      const classes = Array.isArray(ex.target_class) ? ex.target_class.join(', ') : ex.target_class;
      const teachers = getTeachersForExam(ex.subject, ex.grade_level || '').join(', ') || '-';
      
      return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px; text-align:center; color: #64748b;">${i + 1}</td>
        <td style="padding: 12px;"><b style="color: #1e293b;">${ex.subject}</b><br/><span style="font-size:11px; color:#64748b;">${ex.grade_level || '-'}</span></td>
        <td style="padding: 12px; color: #475569;">${teachers}</td>
        <td style="padding: 12px; color: #0f172a; font-weight: bold;">${ex.title}</td>
        <td style="padding: 12px; text-align:center; color: #475569;">${classes}</td>
        <td style="padding: 12px; color: #475569;">${dateStr}</td>
      </tr>
      `;
    }).join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #0f172a;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
          <h2 style="margin: 0 0 8px 0; font-size: 22px; text-transform: uppercase; color: #1e3a8a;">JADWAL UJIAN CBT</h2>
          <p style="margin: 0; font-size: 14px; color: #64748b;">Daftar lengkap agenda ujian terdaftar di sistem - ${appName.replace(/_/g, ' ')}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead style="background-color: #f8fafc;">
            <tr>
              <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 5%;">No</th>
              <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; text-align: left;">Mata Pelajaran</th>
              <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; text-align: left;">Guru Pengampu</th>
              <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; text-align: left;">Nama Ujian</th>
              <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; text-align: center;">Target Kelas</th>
              <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; text-align: left;">Waktu Pelaksanaan</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    const opt = {
      margin: 0, filename: fileName, image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' as const } 
    };
    html2pdf().set(opt).from(element).save().then(() => { 
      setIsGeneratingPdf(false); 
      setIsPrintOptionsOpen(false); 
      showToast("PDF Jadwal berhasil diunduh!", "success"); 
    }).catch(() => {
      setIsGeneratingPdf(false);
      showToast("Gagal memproses PDF.", "error");
    });
  };

  const handleDownloadAllExamsExcel = () => {
    if (exams.length === 0) { showToast("Tidak ada jadwal untuk diunduh.", "warning"); return; }
    
    const exportData = exams.map((ex, idx) => ({
      'No': idx + 1,
      'Mata Pelajaran': ex.subject,
      'Jenjang Kelas': ex.grade_level || '-',
      'Guru Pengampu': getTeachersForExam(ex.subject, ex.grade_level || '').join(', ') || 'Belum ada guru',
      'Nama Ujian': ex.title,
      'Target Kelas': Array.isArray(ex.target_class) ? ex.target_class.join(', ') : ex.target_class,
      'Waktu Mulai': ex.start_time ? new Date(ex.start_time).toLocaleString('id-ID', { timeZone: appTimeZone }) : 'Belum diatur', // Sync Zone
      'Durasi (Menit)': ex.duration_minutes,
      'Max Mengerjakan': ex.max_attempts || 1
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [{wch: 5}, {wch: 25}, {wch: 15}, {wch: 35}, {wch: 30}, {wch: 25}, {wch: 25}, {wch: 15}, {wch: 15}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Jadwal_Ujian`);
    XLSX.writeFile(wb, `Jadwal_Ujian_${appName}.xlsx`);
    setIsPrintOptionsOpen(false);
  };

  // ================= FILTER LOGIC (ROLE TEACHER) =================
  // Guru hanya melihat ujian yang subject_id nya ada di dalam taught_subjects miliknya
  const filteredExams = exams.filter(ex => {
    // Cek Search Query
    const matchSearch = ex.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        ex.subject.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Cek Ownership (Mapel Diampu)
    let isMySubject = false;
    if (myTeacherProfile?.taught_subjects && ex.subject_id) {
        isMySubject = myTeacherProfile.taught_subjects.includes(ex.subject_id);
    } else if (myTeacherProfile?.taught_subjects && !ex.subject_id) {
        // Fallback jika subject_id kosong: cari dari nama mapel
        const relatedSubj = subjectsList.find(s => s.name === ex.subject && s.grade_level === ex.grade_level);
        if (relatedSubj) {
            isMySubject = myTeacherProfile.taught_subjects.includes(relatedSubj.id);
        }
    }

    return matchSearch && isMySubject;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 text-slate-900 relative pb-24 max-w-7xl mx-auto">
      
      {/* ================= TOAST NOTIFICATION ELEGAN ================= */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-top-10">
          <div className={`px-6 py-3.5 rounded-[1.5rem] shadow-2xl flex items-center gap-3 border backdrop-blur-sm ${
             toast.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-700' : 
             toast.type === 'warning' ? 'bg-amber-50/95 border-amber-200 text-amber-700' : 'bg-rose-50/95 border-rose-200 text-rose-700'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className={`w-5 h-5 ${toast.type === 'warning' ? 'text-amber-500' : 'text-rose-500'}`} />}
            <p className="font-bold text-sm tracking-wide">{toast.message}</p>
          </div>
        </div>
      )}

      {/* ================= MODAL PILIHAN FORMAT CETAK GLOBAL ================= */}
      {isPrintOptionsOpen && (
         <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200">
               <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Printer className="w-5 h-5 text-blue-600"/> Cetak Jadwal Ujian</h3>
                    <p className="text-sm font-medium text-slate-500 mt-1">Pilih format unduhan jadwal seluruh ujian.</p>
                  </div>
                  <button onClick={() => setIsPrintOptionsOpen(false)} className="text-slate-400 hover:text-rose-500 bg-white rounded-full p-2 border border-slate-200 shadow-sm"><X className="w-5 h-5"/></button>
               </div>
               <div className="p-8 space-y-4">
                  <button onClick={handlePrintAllExamsPDF} disabled={isGeneratingPdf} className="w-full flex items-center p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group text-left disabled:opacity-50">
                     <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                        {isGeneratingPdf ? <LoaderCircle className="w-6 h-6 animate-spin" /> : <FileText className="w-6 h-6"/>}
                     </div>
                     <div>
                       <h4 className="font-bold text-slate-800 text-base">{isGeneratingPdf ? 'Memproses PDF...' : 'Unduh Format PDF'}</h4>
                       <p className="text-xs text-slate-500 font-medium mt-0.5">Daftar agenda ujian siap print (Landscape).</p>
                     </div>
                  </button>
                  <button onClick={handleDownloadAllExamsExcel} className="w-full flex items-center p-4 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group text-left">
                     <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform"><FileSpreadsheet className="w-6 h-6"/></div>
                     <div>
                       <h4 className="font-bold text-slate-800 text-base">Unduh Excel (.xlsx)</h4>
                       <p className="text-xs text-slate-500 font-medium mt-0.5">File rekap mentah untuk pelaporan.</p>
                     </div>
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* ================= HEADER UTAMA ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:px-8 md:py-6 rounded-[2rem] border border-indigo-100 shadow-sm">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-3">
            <CalendarClock className="w-8 h-8 text-indigo-600" /> Jadwal Ujian
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium ml-11">Melihat agenda pelaksanaan ujian khusus mapel Anda.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input type="text" placeholder="Cari jadwal mapel Anda..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-[1.5rem] pl-12 pr-4 py-3.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all placeholder-slate-400" />
        </div>
        <button onClick={() => setIsPrintOptionsOpen(true)} className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-indigo-700 border border-slate-200 hover:border-indigo-200 px-6 py-3.5 rounded-[1.5rem] font-bold text-sm shadow-sm transition-colors shrink-0">
           <Download className="w-5 h-5 text-indigo-600" /> Unduh Data Jadwal
        </button>
      </div>

      {/* ================= TABEL DATA UJIAN ================= */}
      <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden z-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-black uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 w-[45%]">Informasi Ujian Mapel Anda</th>
                <th className="px-8 py-5 w-[25%]">Waktu & Aturan</th>
                <th className="px-8 py-5 w-[20%]">Token Akses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={3} className="text-center py-24"><LoaderCircle className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-3" /><p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Memuat jadwal Anda...</p></td></tr>
              ) : filteredExams.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-24"><div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100"><CalendarClock className="w-10 h-10 text-slate-300" /></div><p className="text-slate-500 font-bold text-lg">Tidak ada jadwal ujian untuk Anda.</p></td></tr>
              ) : (
                filteredExams.map((exam) => {
                  const examTeachers = getTeachersForExam(exam.subject, exam.grade_level || '');
                  const isTitlePresent = exam.title && exam.title.trim() !== '';

                  return (
                    <tr key={exam.id} className="hover:bg-indigo-50/30 transition-colors">
                      
                      <td className="px-8 py-5">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start gap-4">
                             <div className="w-12 h-12 rounded-[1.2rem] bg-indigo-50 flex items-center justify-center border border-indigo-100 shrink-0 shadow-sm mt-0.5">
                                <BookOpen className="w-6 h-6 text-indigo-600"/>
                             </div>
                             <div>
                                <p className="font-black text-slate-800 text-base leading-tight flex flex-wrap items-center gap-2 mb-1">
                                  {exam.subject}
                                  {isTitlePresent && <span className="text-slate-500 font-bold text-xs bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">{exam.title}</span>}
                                </p>
                                
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-md border border-emerald-100 uppercase tracking-widest">
                                    <GraduationCap className="w-3.5 h-3.5"/> {exam.grade_level || 'Umum'}
                                  </span>
                                  <span className="text-slate-300">|</span>
                                  <div className="flex flex-wrap gap-1">
                                    {examTeachers.length > 0 ? (
                                       examTeachers.map((tName, i) => (
                                         <span key={i} className="text-[10px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm flex items-center gap-1">
                                           <UserCircle2 className="w-3 h-3 text-indigo-400"/> {tName}
                                         </span>
                                       ))
                                    ) : (
                                       <span className="text-[10px] italic text-slate-400 font-bold">Tanpa pengampu</span>
                                    )}
                                  </div>
                                </div>
                             </div>
                          </div>

                          <div className="mt-2 bg-amber-50/50 p-3 rounded-[1rem] border border-amber-100 w-fit max-w-full">
                             <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-amber-500 shrink-0"/>
                                <span className="text-xs font-bold text-slate-700 leading-snug break-words">
                                   {Array.isArray(exam.target_class) ? exam.target_class.join(', ') : (exam.target_class || 'Semua')}
                                </span>
                             </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-8 py-5">
                        <div className="flex flex-col gap-2">
                          <p className="text-slate-700 font-black text-xs flex items-center gap-2">
                            <CalendarClock className="w-4 h-4 text-emerald-500" /> 
                            {formatZonedTimeStr(exam.start_time)} {/* Sync Zone */}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-slate-500 font-bold text-[10px] bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 uppercase tracking-widest">{exam.duration_minutes} Menit</span>
                            <span className="text-indigo-600 font-bold text-[10px] bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 uppercase tracking-widest">{exam.max_attempts || 1}x Ujian</span>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-8 py-5">
                         <div className="flex items-center gap-2 w-52">
                            <div className="relative flex-1">
                              <input type="text" value={exam.exam_token} readOnly className="w-full bg-indigo-50/50 border border-indigo-200 rounded-[1rem] px-3 py-2.5 text-xs text-center text-indigo-700 font-black tracking-widest outline-none shadow-sm uppercase pr-12" />
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-indigo-500 bg-white px-1.5 py-0.5 rounded shadow-sm border border-indigo-100">
                                {formatTime(getSecondsLeft(exam.token_updated_at))}
                              </div>
                            </div>
                            <button onClick={() => handleCopyToken(exam.id, exam.exam_token)} title="Salin Token" className="p-2.5 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 text-slate-400 rounded-full shadow-sm transition-colors">
                              {copiedTokenId === exam.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                         </div>
                      </td>
                      
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}