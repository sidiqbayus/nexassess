'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { 
  Search, Plus, FileUp, Edit3, Trash2, CheckCircle2, 
  AlertTriangle, XCircle, Save, LoaderCircle, Globe, 
  BookOpen, Layers, Download, Info, Printer, FileText, FileSpreadsheet, UserCircle2, X
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

export default function SubjectsManagementPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]); // Menyimpan data guru untuk relasi
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [appName, setAppName] = useState('CBT_App'); 
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger'|'warning' } | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', grade_level: '' });

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // State untuk Pop-up Cetak
  const [isPrintOptionsOpen, setIsPrintOptionsOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const confirmAction = (message: string, onConfirm: () => void, title: string = "Konfirmasi", type: 'danger'|'warning' = 'warning') => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, type });
  };

  // ================= FETCH DATA (MAPEL & GURU) =================
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Nama Aplikasi
      const { data: settingData } = await supabase.from('pengaturan_aplikasi').select('nama_aplikasi').eq('id', 1).single();
      if (settingData?.nama_aplikasi) setAppName(settingData.nama_aplikasi.replace(/\s+/g, '_'));

      // 1. Fetch Mata Pelajaran
      const { data: subjData, error: subjErr } = await supabase.from('subjects').select('*').order('name', { ascending: true });
      if (subjErr) throw subjErr;
      setSubjects(subjData || []);

      // 2. Fetch Guru (Proctor) untuk mendapatkan relasi mapel
      const { data: teacherData, error: teacherErr } = await supabase.from('users').select('id, full_name, taught_subjects').eq('role', 'proctor');
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

  // ================= FORM HANDLERS =================
  const openCreateForm = () => {
    setEditingId(null);
    setFormData({ name: '', grade_level: '' });
    setIsFormOpen(true);
  };

  const openEditForm = (subject: Subject) => {
    setEditingId(subject.id);
    setFormData({ name: subject.name, grade_level: subject.grade_level });
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.grade_level) {
      showToast("Semua kolom wajib diisi!", "warning"); return;
    }
    
    // Cek Duplikat
    const isDuplicate = subjects.some(s => s.name.toLowerCase() === formData.name.toLowerCase() && s.grade_level.toLowerCase() === formData.grade_level.toLowerCase() && s.id !== editingId);
    if (isDuplicate) {
       showToast("Mata Pelajaran dengan jenjang kelas tersebut sudah ada!", "error"); return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('subjects').update(formData).eq('id', editingId);
        if (error) throw error;
        showToast("Mata pelajaran berhasil diperbarui!", "success");
      } else {
        const { error } = await supabase.from('subjects').insert([formData]);
        if (error) throw error;
        showToast("Mata pelajaran berhasil ditambahkan!", "success");
      }
      setIsFormOpen(false);
      fetchData();
    } catch (err: any) { showToast(err.message, "error"); } 
    finally { setIsSubmitting(false); }
  };

  const handleDelete = (id: string, name: string, grade: string) => {
    const relatedTeachers = getTeachersForSubject(id);
    if (relatedTeachers.length > 0) {
       showToast(`Tidak bisa dihapus! Mapel ini sedang diampu oleh ${relatedTeachers.length} guru.`, "error"); return;
    }

    confirmAction(`Yakin ingin menghapus mapel "${name} - ${grade}"? Data yang terhapus tidak dapat dikembalikan.`, async () => {
      try {
        const { error } = await supabase.from('subjects').delete().eq('id', id);
        if (error) throw error;
        showToast("Mata pelajaran berhasil dihapus.", "success");
        setSubjects(prev => prev.filter(s => s.id !== id));
      } catch (err: any) { showToast("Gagal menghapus: " + err.message, "error"); }
    }, "Hapus Mata Pelajaran", "danger");
  };

  // ================= IMPORT EXCEL HANDLERS =================
  const downloadTemplate = () => {
    const templateData = [{ Nama_Mata_Pelajaran: 'Matematika Lanjut', Jenjang_Kelas: 'SMA Kelas 11' }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{wch: 35}, {wch: 25}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Mapel");
    XLSX.writeFile(wb, "Template_Import_Mapel.xlsx");
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const parsed = data.map((row: any) => {
          const isDuplicateInDB = subjects.some(s => s.name.toLowerCase() === String(row.Nama_Mata_Pelajaran).toLowerCase() && s.grade_level.toLowerCase() === String(row.Jenjang_Kelas).toLowerCase());
          return {
             name: row.Nama_Mata_Pelajaran, 
             grade_level: String(row.Jenjang_Kelas),
             isDuplicate: isDuplicateInDB
          };
        }).filter(r => r.name && r.grade_level);
        
        setPreviewData(parsed);
      } catch (err) { showToast("Gagal membaca file Excel.", "error"); }
    };
    reader.readAsBinaryString(file);
  };

  const executeImport = async () => {
    const validData = previewData.filter(d => !d.isDuplicate);
    if (validData.length === 0) { showToast("Tidak ada data valid untuk diimport.", "error"); return; }

    setIsImporting(true);
    try {
      const dataToInsert = validData.map(({ isDuplicate, ...rest }) => rest);
      const { error } = await supabase.from('subjects').insert(dataToInsert);
      if (error) throw error;
      showToast(`${dataToInsert.length} Mapel berhasil diimport!`, "success");
      setIsImportOpen(false); setPreviewData([]); setImportFile(null); fetchData();
    } catch (err: any) { showToast("Gagal import: " + err.message, "error"); } 
    finally { setIsImporting(false); }
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
        <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[150] w-[90%] sm:w-auto animate-in slide-in-from-top-10">
          <div className={`px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] shadow-2xl flex items-center gap-2 md:gap-3 border backdrop-blur-sm ${
             toast.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-700' : 
             toast.type === 'warning' ? 'bg-amber-50/95 border-amber-200 text-amber-700' : 'bg-rose-50/95 border-rose-200 text-rose-700'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className={`w-4 h-4 md:w-5 md:h-5 text-emerald-500 shrink-0`} /> : <AlertTriangle className={`w-4 h-4 md:w-5 md:h-5 shrink-0 ${toast.type === 'warning' ? 'text-amber-500' : 'text-rose-500'}`} />}
            <p className="font-bold text-xs md:text-sm tracking-wide leading-snug">{toast.message}</p>
          </div>
        </div>
      )}

      {/* ================= CUSTOM CONFIRM DIALOG ================= */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl md:rounded-[2rem] p-6 md:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-inner ${confirmDialog.type === 'danger' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
               <AlertTriangle className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <h3 className="text-lg md:text-xl font-black text-slate-800 mb-2 text-center leading-tight">{confirmDialog.title}</h3>
            <p className="text-slate-500 text-xs md:text-sm mb-6 md:mb-8 leading-relaxed font-medium text-center">{confirmDialog.message}</p>
            <div className="flex items-center gap-2 md:gap-3">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3 md:py-3.5 rounded-lg md:rounded-xl text-xs md:text-sm font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all shadow-sm">Batal</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className={`flex-1 py-3 md:py-3.5 rounded-lg md:rounded-xl text-xs md:text-sm font-bold text-white transition-all shadow-md active:scale-95 ${confirmDialog.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'}`}>
                 Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL PILIHAN FORMAT CETAK ================= */}
      {isPrintOptionsOpen && (
         <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm md:max-w-md rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-100">
               <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0 gap-2">
                  <div className="min-w-0">
                    <h3 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2 truncate"><Printer className="w-5 h-5 md:w-6 md:h-6 text-indigo-600 shrink-0"/> <span className="truncate">Unduh Data Mapel</span></h3>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mt-1 hidden sm:block">Pilih format unduhan di bawah.</p>
                  </div>
                  <button onClick={() => setIsPrintOptionsOpen(false)} className="text-slate-400 hover:text-rose-500 bg-white rounded-full p-1.5 md:p-2 border border-slate-200 shrink-0 shadow-sm transition-colors"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
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

      {/* ================= MODAL IMPORT EXCEL ================= */}
      {isImportOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl md:rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[95vh] md:max-h-[90vh]">
            <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center shrink-0">
               <h3 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2 md:gap-3 truncate"><FileUp className="w-5 h-5 md:w-6 md:h-6 text-emerald-500 shrink-0"/> <span className="truncate">Import Massal Mapel</span></h3>
               <button onClick={() => {setIsImportOpen(false); setPreviewData([]); setImportFile(null);}} className="p-1.5 md:p-2 bg-white rounded-full border border-slate-200 text-slate-400 hover:text-rose-500 transition-colors shadow-sm shrink-0 ml-2"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
            </div>
            
            <div className="p-4 md:p-6 lg:p-8 overflow-y-auto space-y-4 md:space-y-6 custom-scrollbar flex-1">
               <div className="bg-blue-50 border border-blue-100 rounded-xl md:rounded-[1.5rem] p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 md:gap-6 shadow-sm">
                  <div className="flex items-start gap-3 md:gap-4">
                     <div className="p-1.5 md:p-2 bg-blue-100 rounded-full shrink-0 mt-0.5 md:mt-1"><Info className="w-4 h-4 md:w-6 md:h-6 text-blue-600"/></div>
                     <div>
                       <h4 className="font-bold text-blue-900 text-base md:text-lg mb-1">Panduan Import & Validasi</h4>
                       <p className="text-xs md:text-sm text-blue-800/80 leading-relaxed font-medium">Sistem akan menolak (mengabaikan) baris <b className="text-rose-600 bg-rose-100 px-1 rounded">merah muda</b> yang menduplikasi Mata Pelajaran di Jenjang Kelas yang sama.</p>
                     </div>
                  </div>
                  <button onClick={downloadTemplate} className="shrink-0 w-full sm:w-auto text-xs md:text-sm font-bold text-blue-700 bg-white border border-blue-200 px-4 md:px-5 py-2.5 md:py-3 rounded-lg md:rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all flex items-center justify-center gap-2 shadow-sm"><Download className="w-3.5 h-3.5 md:w-4 md:h-4"/> Unduh Template</button>
               </div>

               <label className={`border-2 border-dashed rounded-xl md:rounded-[2rem] p-8 sm:p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all group ${importFile ? 'border-emerald-400 bg-emerald-50/50' : 'border-blue-300 bg-blue-50/30 hover:border-blue-500 hover:bg-blue-50'}`}>
                 <div className="p-3 md:p-5 bg-white rounded-full md:rounded-[1.5rem] shadow-sm border border-slate-200 mb-3 md:mb-4 group-hover:scale-110 transition-all duration-300">{importFile ? <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10 text-emerald-500" /> : <FileSpreadsheet className="w-8 h-8 md:w-10 md:h-10 text-blue-600" />}</div>
                 <span className="text-base md:text-xl font-black text-slate-700 mb-1 leading-tight break-words px-2 max-w-full">{importFile ? importFile.name : 'Pilih File Excel (.xlsx)'}</span>
                 {!importFile && <span className="text-xs md:text-sm font-medium text-slate-500 px-4">Klik di sini untuk menelusuri file dari komputer Anda</span>}
                 <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportFileChange} />
               </label>

               {previewData.length > 0 && (
                 <div className="border border-slate-200 rounded-xl md:rounded-[1.5rem] overflow-hidden shadow-sm animate-in slide-in-from-bottom-2">
                   <div className="flex justify-between items-center p-4 md:p-5 bg-slate-50 border-b border-slate-100">
                      <p className="text-[10px] md:text-sm font-black text-slate-800 flex items-center gap-1.5 md:gap-2"><BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400"/> Preview Data <span className="hidden sm:inline">({previewData.length} Baris)</span></p>
                      <p className="text-[9px] md:text-xs font-bold text-slate-500 bg-white px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg border border-slate-200 shadow-sm whitespace-nowrap"><b className="text-emerald-600">{previewData.filter(d=>!d.isDuplicate).length} Valid</b> <span className="mx-1">•</span> <b className="text-rose-600">{previewData.filter(d=>d.isDuplicate).length} Duplikat</b></p>
                   </div>
                   
                   <div className="overflow-x-auto max-h-64 md:max-h-80 custom-scrollbar">
                     <table className="w-full text-xs md:text-sm text-left whitespace-nowrap">
                       <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-sm">
                         <tr><th className="p-3 md:p-4 px-4 md:px-6">Nama Mata Pelajaran</th><th className="p-3 md:p-4 px-4 md:px-6">Jenjang Kelas</th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {previewData.slice(0, 50).map((r, i) => (
                           <tr key={i} className={r.isDuplicate ? "bg-rose-50/50" : "bg-white hover:bg-slate-50/50"}>
                             <td className={`p-3 md:p-4 px-4 md:px-6 font-bold ${r.isDuplicate ? "text-rose-700" : "text-slate-800"}`}>
                               {r.name} {r.isDuplicate && <span className="ml-1.5 md:ml-2 text-[8px] md:text-[9px] font-black text-rose-500 border border-rose-200 bg-rose-100 px-1.5 py-0.5 rounded md:rounded-md whitespace-nowrap">SUDAH ADA</span>}
                             </td>
                             <td className={`p-3 md:p-4 px-4 md:px-6 font-medium ${r.isDuplicate ? "text-rose-600" : "text-slate-600"}`}>{r.grade_level}</td>
                           </tr>
                         ))}
                         {previewData.length > 50 && <tr><td colSpan={2} className="p-3 md:p-4 text-center text-slate-400 font-bold bg-slate-50/80 text-[10px] md:text-xs">...dan {previewData.length - 50} data lainnya disembunyikan untuk performa</td></tr>}
                       </tbody>
                     </table>
                   </div>
                 </div>
               )}
            </div>

            <div className="p-4 md:p-6 lg:p-8 border-t border-slate-100 bg-slate-50/80 flex gap-2 md:gap-3 shrink-0">
               <button onClick={() => {setIsImportOpen(false); setPreviewData([]); setImportFile(null);}} className="flex-1 py-3 md:py-3.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg md:rounded-xl hover:bg-slate-100 transition-colors shadow-sm text-xs md:text-sm">Batal</button>
               <button onClick={executeImport} disabled={previewData.filter(d=>!d.isDuplicate).length === 0 || isImporting} className="flex-1 py-3 md:py-3.5 bg-blue-600 text-white font-bold rounded-lg md:rounded-xl shadow-md active:scale-95 transition-all disabled:bg-slate-300 flex items-center justify-center gap-1.5 md:gap-2 text-xs md:text-sm shadow-blue-200 hover:bg-blue-700">
                 {isImporting ? <LoaderCircle className="w-4 h-4 md:w-5 md:h-5 animate-spin"/> : <Save className="w-4 h-4 md:w-5 md:h-5"/>} Import <span className="hidden sm:inline">Data Valid</span>
               </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORM TAMBAH/EDIT */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm md:max-w-md rounded-2xl md:rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-5 md:p-6 lg:p-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/80 gap-3">
               <div className="min-w-0">
                 <h2 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2 truncate">
                   {editingId ? <Edit3 className="w-4 h-4 md:w-5 md:h-5 text-blue-600 shrink-0"/> : <Plus className="w-4 h-4 md:w-5 md:h-5 text-blue-600 shrink-0"/>} 
                   <span className="truncate">{editingId ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}</span>
                 </h2>
               </div>
               <button onClick={() => setIsFormOpen(false)} className="p-1.5 md:p-2 bg-white text-slate-400 hover:text-rose-500 border border-slate-200 rounded-full transition-colors shadow-sm shrink-0 ml-2"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
               <div className="p-5 md:p-6 lg:p-8 space-y-4 md:space-y-6 flex-1">
                 <div>
                   <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block mb-1.5 md:mb-2 flex items-center gap-1.5 md:gap-2"><BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4"/> Nama Mata Pelajaran *</label>
                   <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3.5 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm placeholder-slate-400" placeholder="Contoh: Matematika Lanjut" required />
                 </div>
                 <div>
                   <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block mb-1.5 md:mb-2 flex items-center gap-1.5 md:gap-2"><Layers className="w-3.5 h-3.5 md:w-4 md:h-4"/> Jenjang Kelas / Target Tingkat *</label>
                   <input type="text" value={formData.grade_level} onChange={e => setFormData({...formData, grade_level: e.target.value})} className="w-full bg-white border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3.5 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm placeholder-slate-400" placeholder="Contoh: SMA Kelas 10" required />
                 </div>
               </div>
               <div className="p-5 md:p-6 lg:p-8 border-t border-slate-100 bg-slate-50/80 flex gap-2 md:gap-3 shrink-0">
                 <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-3 md:py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg md:rounded-xl hover:bg-slate-100 transition-colors shadow-sm text-xs md:text-sm">Batal</button>
                 <button type="submit" disabled={isSubmitting} className="flex-1 py-3 md:py-3.5 bg-blue-600 text-white font-bold rounded-lg md:rounded-xl hover:bg-blue-700 shadow-md shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-1.5 md:gap-2 text-xs md:text-sm">
                   {isSubmitting ? <LoaderCircle className="w-4 h-4 md:w-5 md:h-5 animate-spin"/> : <Save className="w-4 h-4 md:w-5 md:h-5"/>} Simpan Data
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* HEADER UTAMA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 bg-white p-4 sm:p-5 md:px-8 md:py-6 rounded-2xl md:rounded-[2rem] border border-blue-100 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2 md:gap-3">
            <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-blue-600" /> Mata Pelajaran
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium md:ml-11 leading-snug">Kelola data mata pelajaran, kurikulum, dan keterkaitan dengan guru.</p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 md:gap-3 w-full md:w-auto mt-2 sm:mt-0">
          <button onClick={() => setIsImportOpen(true)} className="flex items-center justify-center gap-1.5 md:gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm shadow-sm transition-colors w-full sm:w-auto"><FileUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" /> Import Massal</button>
          <button onClick={openCreateForm} className="flex items-center justify-center gap-1.5 md:gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm shadow-md shadow-blue-200 active:scale-95 transition-all w-full sm:w-auto"><Plus className="w-4 h-4 md:w-5 md:h-5" /> Tambah Mapel</button>
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
            className="w-full bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] pl-10 md:pl-12 pr-4 py-3 md:py-3.5 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all placeholder-slate-400" 
          />
        </div>
        <button onClick={() => setIsPrintOptionsOpen(true)} className="flex items-center justify-center gap-1.5 md:gap-2 bg-white hover:bg-slate-50 text-blue-700 border border-slate-200 hover:border-blue-200 px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] font-bold text-xs md:text-sm shadow-sm transition-colors shrink-0 w-full sm:w-auto">
           <Download className="w-4 h-4 md:w-5 md:h-5 text-blue-600" /> Unduh Data Mapel
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
                <th className="px-6 lg:px-8 py-4 md:py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="py-20 md:py-24 text-center"><LoaderCircle className="w-8 h-8 md:w-10 md:h-10 text-indigo-500 animate-spin mx-auto mb-3" /><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] md:text-xs">Memuat data...</p></td></tr>
              ) : filteredSubjects.length === 0 ? (
                <tr><td colSpan={5} className="py-20 md:py-24 text-center"><div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 mb-3 md:mb-4"><BookOpen className="w-8 h-8 md:w-10 md:h-10 text-slate-300" /></div><p className="text-slate-500 font-bold text-sm md:text-lg">Mata pelajaran tidak ditemukan.</p></td></tr>
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

                      <td className="px-6 lg:px-8 py-4 md:py-5 text-right">
                        {/* PERBAIKAN: Tombol aksi selalu tampil & Melingkar (rounded-full) */}
                        <div className="flex items-center justify-end gap-1.5 md:gap-2 transition-opacity">
                          <button onClick={() => openEditForm(subject)} className="p-2 md:p-2.5 bg-white hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-full transition-all border border-slate-200 hover:border-blue-200 shadow-sm" title="Edit Mapel"><Edit3 className="w-3.5 h-3.5 md:w-4 md:h-4"/></button>
                          <button onClick={() => handleDelete(subject.id, subject.name, subject.grade_level)} className="p-2 md:p-2.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-full transition-all border border-slate-200 hover:border-rose-200 shadow-sm" title="Hapus Mapel"><Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4"/></button>
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
              <div className="text-center py-16 px-4">
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
                     
                     <div className="flex items-center justify-end gap-2 mt-1 border-t border-slate-100/60 pt-3">
                        <button onClick={() => openEditForm(subject)} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-slate-500 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 hover:border-blue-200 rounded-lg transition-all shadow-sm text-[10px] font-bold uppercase tracking-widest"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
                        <button onClick={() => handleDelete(subject.id, subject.name, subject.grade_level)} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-rose-500 hover:bg-rose-50 hover:text-rose-600 border border-rose-200 hover:border-rose-300 rounded-lg transition-all shadow-sm text-[10px] font-bold uppercase tracking-widest"><Trash2 className="w-3.5 h-3.5" /> Hapus</button>
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