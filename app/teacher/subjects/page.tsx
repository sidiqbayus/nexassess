'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { 
  Search, CheckCircle2, AlertTriangle, LoaderCircle, 
  BookOpen, Layers, Download, Printer, FileText, FileSpreadsheet, UserCircle2, X
} from 'lucide-react';

interface Subject {
  id: string;
  name: string;
  grade_level: string;
}

interface Teacher {
  id: string;
  full_name: string;
  taught_subjects?: string[];
}

export default function TeacherSubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]); 
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [appName, setAppName] = useState('CBT_App'); 
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // State untuk Pop-up Cetak
  const [isPrintOptionsOpen, setIsPrintOptionsOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ================= FETCH DATA (MAPEL & GURU) =================
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: settingData } = await supabase.from('pengaturan_aplikasi').select('nama_aplikasi').eq('id', 1).single();
      if (settingData?.nama_aplikasi) setAppName(settingData.nama_aplikasi.replace(/\s+/g, '_'));

      const { data: subjData, error: subjErr } = await supabase.from('subjects').select('*').order('name', { ascending: true });
      if (subjErr) throw subjErr;
      setSubjects(subjData || []);

      const { data: teacherData, error: teacherErr } = await supabase.from('users').select('id, full_name, taught_subjects').eq('role', 'teacher');
      if (teacherErr) throw teacherErr;
      setTeachers(teacherData || []);

    } catch (err: any) {
      showToast("Gagal memuat data: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Helper: Mendapatkan nama-nama guru untuk mapel tertentu
  const getTeachersForSubject = (subjectId: string) => {
    return teachers.filter(t => t.taught_subjects && t.taught_subjects.includes(subjectId)).map(t => t.full_name);
  };

  // ================= CETAK DATA HANDLERS =================
  const getDynamicFileName = (type: 'pdf' | 'excel') => {
    return `Data_Mata_Pelajaran_${appName}.${type}`;
  };

  const handleDownloadExcel = () => {
    if (subjects.length === 0) { showToast("Tidak ada data untuk diunduh.", "warning"); return; }
    
    const exportData = subjects.map((s, idx) => ({
      'No': idx + 1,
      'Mata Pelajaran': s.name,
      'Jenjang Kelas': s.grade_level,
      'Guru Pengampu': getTeachersForSubject(s.id).join(', ') || 'Belum ada guru'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [{wch: 5}, {wch: 35}, {wch: 25}, {wch: 50}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Data_Mapel`);
    XLSX.writeFile(wb, getDynamicFileName('excel'));
    setIsPrintOptionsOpen(false);
  };

  const handleDownloadPDF = () => {
    if (subjects.length === 0) { showToast("Tidak ada data untuk dicetak.", "warning"); return; }

    setIsGeneratingPdf(true);
    const title = `DAFTAR MATA PELAJARAN UJIAN CBT - ${appName.replace(/_/g, ' ')}`;
    
    const rowsHtml = subjects.map((s, i) => {
       const teacherNames = getTeachersForSubject(s.id);
       const teacherString = teacherNames.length > 0 ? teacherNames.join(', ') : '<i>Belum ada guru</i>';
       return `
         <tr style="border-bottom: 1px solid #e2e8f0;">
           <td style="padding: 12px; text-align:center; color: #64748b;">${i + 1}</td>
           <td style="padding: 12px; font-weight: bold; color: #1e293b;">${s.name}</td>
           <td style="padding: 12px; text-align:center; color: #475569;">${s.grade_level}</td>
           <td style="padding: 12px; color: #0f172a;">${teacherString}</td>
         </tr>
       `;
    }).join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #0f172a;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
           <h2 style="margin: 0 0 8px 0; font-size: 22px; text-transform: uppercase; color: #1e3a8a;">${title}</h2>
           <p style="margin: 0; font-size: 14px; color: #64748b;">Rekapitulasi data mata pelajaran dan guru pengampu di sistem</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
           <thead style="background-color: #f8fafc;">
             <tr>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 5%;">No</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; text-align: left; width: 35%;">Mata Pelajaran</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 20%;">Jenjang Kelas</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; text-align: left; width: 40%;">Guru Pengampu</th>
             </tr>
           </thead>
           <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    
    const opt = {
      margin:       0,
      filename:     getDynamicFileName('pdf'),
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      setIsGeneratingPdf(false);
      setIsPrintOptionsOpen(false);
      showToast("PDF berhasil diunduh!", "success");
    }).catch(() => {
      setIsGeneratingPdf(false);
      showToast("Terjadi kesalahan saat memproses PDF.", "error");
    });
  };

  const filteredSubjects = subjects.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.grade_level.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto text-slate-900 relative pb-24">
      
      {/* ================= TOAST NOTIFICATION ELEGAN ================= */}
      {toast && (
        <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-top-10 w-[90%] sm:w-auto">
          <div className={`px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] shadow-2xl flex items-center gap-2 md:gap-3 border backdrop-blur-sm ${
             toast.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-700' : 
             toast.type === 'warning' ? 'bg-amber-50/95 border-amber-200 text-amber-700' : 'bg-rose-50/95 border-rose-200 text-rose-700'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className={`w-4 h-4 md:w-5 md:h-5 text-emerald-500`} /> : <AlertTriangle className={`w-4 h-4 md:w-5 md:h-5 ${toast.type === 'warning' ? 'text-amber-500' : 'text-rose-500'}`} />}
            <p className="font-bold text-xs md:text-sm tracking-wide leading-snug">{toast.message}</p>
          </div>
        </div>
      )}

      {/* ================= MODAL PILIHAN FORMAT CETAK ================= */}
      {isPrintOptionsOpen && (
         <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-sm md:max-w-md rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-100">
               <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 gap-2 shrink-0">
                  <div className="min-w-0">
                    <h3 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2 truncate"><Printer className="w-5 h-5 md:w-6 md:h-6 text-indigo-600 shrink-0"/> <span className="truncate">Unduh Data Mapel</span></h3>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mt-1 hidden sm:block">Pilih format unduhan di bawah.</p>
                  </div>
                  <button onClick={() => setIsPrintOptionsOpen(false)} className="text-slate-400 hover:text-rose-500 bg-white rounded-full p-1.5 md:p-2 border border-slate-200 shrink-0"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
               </div>
               <div className="p-5 md:p-8 space-y-3 md:space-y-4">
                  <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="w-full flex items-center p-3 md:p-5 rounded-xl md:rounded-2xl border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all group text-left disabled:opacity-70 disabled:cursor-not-allowed">
                     <div className="w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mr-3 md:mr-4 group-hover:scale-110 transition-transform shrink-0">
                       {isGeneratingPdf ? <LoaderCircle className="w-5 h-5 md:w-6 md:h-6 animate-spin"/> : <FileText className="w-5 h-5 md:w-6 md:h-6"/>}
                     </div>
                     <div>
                       <h4 className="font-black text-slate-800 text-sm md:text-base">{isGeneratingPdf ? 'Memproses PDF...' : 'Unduh Format PDF'}</h4>
                       <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5 md:mt-1 leading-snug">Daftar mapel siap print yang rapi.</p>
                     </div>
                  </button>
                  <button onClick={handleDownloadExcel} className="w-full flex items-center p-3 md:p-5 rounded-xl md:rounded-2xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group text-left">
                     <div className="w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mr-3 md:mr-4 group-hover:scale-110 transition-transform shrink-0"><FileSpreadsheet className="w-5 h-5 md:w-6 md:h-6"/></div>
                     <div>
                       <h4 className="font-black text-slate-800 text-sm md:text-base">Unduh Format Excel</h4>
                       <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5 md:mt-1 leading-snug">File rekap mentah untuk manajemen database.</p>
                     </div>
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* HEADER UTAMA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 bg-white p-4 md:px-8 md:py-6 rounded-2xl md:rounded-[2rem] border border-indigo-100 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2 md:gap-3">
            <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-indigo-600" /> Mata Pelajaran
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium ml-8 md:ml-11 leading-snug">Lihat daftar mata pelajaran yang terdaftar pada sistem (Mode Baca).</p>
        </div>
      </div>

      {/* SEARCH BAR DAN TOMBOL CETAK */}
      <div className="flex flex-col sm:flex-row justify-between gap-3 md:gap-4 mt-2">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari mapel atau jenjang..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] pl-10 md:pl-12 pr-4 py-3 md:py-3.5 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all placeholder-slate-400" 
          />
        </div>
        <button onClick={() => setIsPrintOptionsOpen(true)} className="flex items-center justify-center gap-1.5 md:gap-2 bg-white hover:bg-slate-50 text-indigo-700 border border-slate-200 hover:border-indigo-200 px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] font-bold text-xs md:text-sm shadow-sm transition-colors shrink-0 w-full sm:w-auto">
           <Download className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" /> Unduh Data Mapel
        </button>
      </div>

      {/* TABEL DATA */}
      <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-500 z-0">
        <div className="overflow-x-auto">
          {/* Tampilan Desktop & Tablet (Tabel Biasa) */}
          <table className="w-full text-sm text-left hidden md:table">
            <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-black uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 lg:px-8 py-4 md:py-5 w-16 text-center">No</th>
                <th className="px-6 lg:px-8 py-4 md:py-5 w-1/4">Mata Pelajaran</th>
                <th className="px-6 lg:px-8 py-4 md:py-5 w-1/4">Jenjang / Tingkat</th>
                <th className="px-6 lg:px-8 py-4 md:py-5">Guru Pengampu (Otomatis)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="py-20 md:py-24 text-center"><LoaderCircle className="w-8 h-8 md:w-10 md:h-10 text-indigo-500 animate-spin mx-auto mb-3" /><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] md:text-xs">Memuat data...</p></td></tr>
              ) : filteredSubjects.length === 0 ? (
                <tr><td colSpan={4} className="py-20 md:py-24 text-center"><div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 mb-3 md:mb-4"><BookOpen className="w-8 h-8 md:w-10 md:h-10 text-slate-300" /></div><p className="text-slate-500 font-bold text-sm md:text-lg">Mata pelajaran tidak ditemukan.</p></td></tr>
              ) : (
                filteredSubjects.map((subject, idx) => {
                  const subjectTeachers = getTeachersForSubject(subject.id);

                  return (
                    <tr key={subject.id} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="px-6 lg:px-8 py-4 md:py-5 text-center font-black text-slate-400">{idx + 1}</td>
                      <td className="px-6 lg:px-8 py-4 md:py-5 font-black text-slate-800 text-sm md:text-base">{subject.name}</td>
                      <td className="px-6 lg:px-8 py-4 md:py-5">
                         <span className="inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-black bg-indigo-50 text-indigo-600 border border-indigo-200 uppercase tracking-widest whitespace-nowrap">
                           <Layers className="w-3 h-3 md:w-3.5 md:h-3.5"/> {subject.grade_level}
                         </span>
                      </td>
                      
                      {/* KOLOM: GURU PENGAMPU */}
                      <td className="px-6 lg:px-8 py-4 md:py-5">
                         <div className="flex flex-wrap gap-1.5 max-w-sm lg:max-w-xl">
                            {subjectTeachers.length === 0 ? (
                               <span className="text-[10px] md:text-xs text-slate-400 italic font-bold">Belum ada guru pengampu</span>
                            ) : (
                               subjectTeachers.map((teacherName, i) => (
                                 <span key={i} className="inline-flex items-center gap-1 text-[9px] md:text-[10px] font-bold bg-white text-slate-600 px-2 md:px-2.5 py-0.5 md:py-1 rounded-md border border-slate-200 shadow-sm whitespace-nowrap">
                                    <UserCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-slate-400"/> {teacherName}
                                 </span>
                               ))
                            )}
                         </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* TAMPILAN MOBILE (List Card) */}
          <div className="md:hidden flex flex-col divide-y divide-slate-100">
            {loading ? (
              <div className="text-center py-16">
                 <LoaderCircle className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
                 <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Memuat data...</p>
              </div>
            ) : filteredSubjects.length === 0 ? (
              <div className="text-center py-16 px-4">
                 <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 mb-3"><BookOpen className="w-8 h-8 text-slate-300" /></div>
                 <p className="text-slate-500 font-bold text-sm">Mata pelajaran tidak ditemukan.</p>
              </div>
            ) : (
              filteredSubjects.map((subject, idx) => {
                const subjectTeachers = getTeachersForSubject(subject.id);

                return (
                  <div key={subject.id} className="p-4 flex flex-col gap-3 hover:bg-indigo-50/30 transition-colors">
                     <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black border border-indigo-100 shadow-sm shrink-0 mt-0.5">
                           {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-slate-800 text-sm leading-tight mb-1.5 truncate">{subject.name}</p>
                          <span className="inline-flex items-center gap-1 text-[8px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-200 uppercase tracking-widest whitespace-nowrap">
                             <Layers className="w-2.5 h-2.5"/> {subject.grade_level}
                          </span>
                        </div>
                     </div>
                     
                     <div className="flex flex-col gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-1">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><UserCircle2 className="w-3 h-3"/> Pengampu:</span>
                       <div className="flex flex-wrap gap-1.5">
                          {subjectTeachers.length === 0 ? (
                             <span className="text-[10px] text-slate-400 italic font-bold">Belum ada guru</span>
                          ) : (
                             subjectTeachers.map((teacherName, i) => (
                               <span key={i} className="inline-flex items-center gap-1 text-[9px] font-bold bg-white text-slate-600 px-2 py-0.5 rounded border border-slate-200 shadow-sm whitespace-nowrap">
                                  {teacherName}
                               </span>
                             ))
                          )}
                       </div>
                     </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}