'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import Cropper from 'react-easy-crop';
import html2pdf from 'html2pdf.js';
import { 
  Search, Plus, FileUp, Edit3, Trash2, CheckCircle2, 
  XCircle, Save, LoaderCircle, Globe, 
  GraduationCap, UserCircle2, KeyRound, ShieldCheck, Download,
  Info, BookOpen, Printer, Crop, UploadCloud, ZoomIn, 
  AlertTriangle, FileSpreadsheet, LayoutList, FileText, X
} from 'lucide-react';

// ============================================================================
// HELPER UNTUK FOTO (DRIVE & BASE64)
// ============================================================================
const getDriveId = (url: string | undefined | null) => {
  if (!url) return null;
  const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

const getAvatarUrl = (url: string | undefined | null) => {
  if (!url) return '';
  if (url.startsWith('data:image') || url.startsWith('http')) {
     if (url.includes('drive.google.com')) {
         const id = getDriveId(url);
         return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w500` : url;
     }
     return url; 
  }
  return '';
};

// --- HELPER UNTUK MEMOTONG GAMBAR (CANVAS) ---
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); 
    image.src = url;
  });

async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  canvas.width = 250; 
  canvas.height = 250;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, 250, 250);
  return canvas.toDataURL('image/jpeg', 0.8); 
}

// --- INTERFACES ---
interface Teacher {
  id: string;
  full_name: string;
  username: string; 
  password?: string; 
  role: string;
  taught_subjects?: string[]; 
  avatar_url?: string | null; 
  created_at?: string;
}
interface Subject { id: string; name: string; grade_level: string; }

export default function TeachersManagementPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectSearchQuery, setSubjectSearchQuery] = useState(''); 
  const [loading, setLoading] = useState(true);
  const [appName, setAppName] = useState('CBT_App'); 
  
  // ================= UI NOTIFIKASI & KONFIRMASI =================
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const confirmAction = (message: string, onConfirm: () => void, title: string = "Konfirmasi", type: 'danger' | 'warning' = 'warning') => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, type });
  };

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ full_name: string, username: string, password: string, taught_subjects: string[], avatar_url: string }>({ 
    full_name: '', username: '', password: '', taught_subjects: [], avatar_url: '' 
  });

  // CROPPER STATE 
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // Import State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // PRINT/DOWNLOAD STATE
  const [isPrintOptionsOpen, setIsPrintOptionsOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false); 

  // ================= 1. FETCH DATA =================
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: settingData } = await supabase.from('pengaturan_aplikasi').select('nama_aplikasi').eq('id', 1).single();
      if (settingData?.nama_aplikasi) setAppName(settingData.nama_aplikasi.replace(/\s+/g, '_'));

      const { data: subjData, error: subjErr } = await supabase.from('subjects').select('*').order('name');
      if (subjErr) throw subjErr;
      if (subjData) setSubjectsList(subjData as Subject[]);

      const { data: teacherData, error: teacherErr } = await supabase.from('users').select('*').eq('role', 'proctor').order('full_name', { ascending: true }); // Role di Supabase adalah 'proctor'
      if (teacherErr) throw teacherErr;
      setTeachers(teacherData || []);
    } catch (err: any) { showToast("Gagal memuat data: " + err.message, "error"); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  // ================= 2. FORM & CROPPER HANDLERS =================
  const openCreateForm = () => {
    setEditingId(null);
    setSubjectSearchQuery('');
    setFormData({ full_name: '', username: '', password: '', taught_subjects: [], avatar_url: '' });
    setIsFormOpen(true);
  };

  const openEditForm = (teacher: Teacher) => {
    setEditingId(teacher.id);
    setSubjectSearchQuery('');
    setFormData({ 
      full_name: teacher.full_name, username: teacher.username, password: teacher.password || '',
      taught_subjects: Array.isArray(teacher.taught_subjects) ? teacher.taught_subjects : [], avatar_url: teacher.avatar_url || '' 
    });
    setIsFormOpen(true);
  };

  const handleSubjectToggle = (subjId: string) => {
    setFormData(prev => {
      const current = prev.taught_subjects;
      if (current.includes(subjId)) return { ...prev, taught_subjects: current.filter(id => id !== subjId) };
      return { ...prev, taught_subjects: [...current, subjId] };
    });
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => setCropImageSrc(reader.result as string);
      reader.readAsDataURL(file);
      e.target.value = ''; 
    }
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const saveCroppedImage = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return;
    try {
      const croppedImageBase64 = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      setFormData(prev => ({ ...prev, avatar_url: croppedImageBase64 }));
      setCropImageSrc(null); 
    } catch (e) { showToast("Gagal memotong gambar", "error"); }
  };

  // --- PERBAIKAN: SUBMIT MENGGUNAKAN API AGAR AUTH TERDAFTAR ---
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.username || (!editingId && !formData.password)) {
      showToast("Kolom nama, NIP/Username, dan password wajib diisi!", "warning"); return;
    }

    const isDuplicate = teachers.some(t => t.username.toLowerCase() === formData.username.toLowerCase() && t.id !== editingId);
    if (isDuplicate) {
       showToast("Gagal: NIP atau Username tersebut sudah terdaftar di sistem!", "error");
       return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        full_name: formData.full_name, 
        username: formData.username, 
        email: `${formData.username}@nexassess.com`, 
        role: 'proctor', // PASTIKAN ROLE ADALAH PROCTOR (KARENA GURU ADALAH PENGAWAS)
        taught_subjects: formData.taught_subjects, 
        avatar_url: formData.avatar_url || null, 
        ...(formData.password ? { password: formData.password } : {})
      };

      if (editingId) {
        payload.id = editingId;
      }

      // Kirim data ke API Route Backend kita
      const response = await fetch('/api/admin/manage-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teachers: [payload] })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal menyimpan ke server. Pastikan API backend berjalan.');

      if (editingId) {
        setTeachers(prev => prev.map(t => t.id === editingId ? { ...t, ...payload } : t));
        showToast("Data guru berhasil diperbarui!", "success");
      } else {
        // Karena insert, API akan mengembalikan data lengkap (termasuk ID dari Auth)
        if (result.data && result.data.length > 0) {
          setTeachers(prev => [...prev, result.data[0] as Teacher].sort((a, b) => a.full_name.localeCompare(b.full_name)));
        }
        showToast("Guru baru berhasil ditambahkan dan didaftarkan di sistem login!", "success");
      }
      setIsFormOpen(false);
      fetchData(); // Sync ulang
    } catch (err: any) { 
      showToast(err.message, "error"); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleDelete = (id: string, name: string) => {
    confirmAction(`Apakah Anda yakin ingin menghapus akun guru "${name}"? Tindakan ini tidak dapat dibatalkan.`, async () => {
      try {
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
        showToast("Guru berhasil dihapus.", "success");
        setTeachers(prev => prev.filter(t => t.id !== id));
      } catch (err: any) { showToast("Gagal menghapus: " + err.message, "error"); }
    }, "Hapus Data Guru", "danger");
  };

  // ================= 3. IMPORT EXCEL & ANTI-DUPLIKAT =================
  const downloadTemplate = () => {
    const templateData = [
      { Nama_Lengkap: 'Budi Santoso, S.Pd', NIP_Atau_Username: '198001012005011001', Password: 'password123', Mapel_Diampu: 'Matematika - SMA Kelas 10' },
      { Nama_Lengkap: 'Siti Aminah, M.Pd', NIP_Atau_Username: 'siti.aminah', Password: '', Mapel_Diampu: 'Biologi - SMA Kelas 12' }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{wch: 30}, {wch: 25}, {wch: 20}, {wch: 40}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Guru");
    XLSX.writeFile(wb, "Template_Import_Guru.xlsx");
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
        
        const seenUsernames = new Set();

        const parsed = data.map((row: any) => {
          let matchedSubjectIds: string[] = [];
          if (row.Mapel_Diampu) {
             const rawSubjects = String(row.Mapel_Diampu).split(',').map(s => s.trim().toLowerCase());
             subjectsList.forEach(dbSubj => {
                const combinedName = `${dbSubj.name} - ${dbSubj.grade_level}`.toLowerCase();
                if (rawSubjects.includes(combinedName)) matchedSubjectIds.push(dbSubj.id);
             });
          }
          
          const rawPass = row.Password ? String(row.Password).trim() : '';
          const finalPassword = rawPass !== '' ? rawPass : `Guru${Math.floor(1000 + Math.random() * 9000)}`;
          const username = String(row.NIP_Atau_Username || row.Username_Atau_NIP || '').trim();
          
          const isDuplicateInDB = teachers.some(t => t.username.toLowerCase() === username.toLowerCase());
          const isDuplicateInFile = seenUsernames.has(username.toLowerCase());
          seenUsernames.add(username.toLowerCase());

          return {
            full_name: row.Nama_Lengkap, 
            username: username, 
            email: `${username}@nexassess.com`, 
            password: finalPassword,
            avatar_url: null, 
            role: 'proctor', // PASTIKAN INI ADALAH PROCTOR
            taught_subjects: matchedSubjectIds,
            isDuplicate: isDuplicateInDB || isDuplicateInFile
          };
        }).filter(r => r.full_name && r.username);

        setPreviewData(parsed);
      } catch (err) { showToast("Gagal membaca file Excel.", "error"); }
    };
    reader.readAsBinaryString(file);
  };

  // --- PERBAIKAN: EKSEKUSI IMPORT MENGGUNAKAN API ---
  const executeImport = async () => {
    const validData = previewData.filter(d => !d.isDuplicate);
    if (validData.length === 0) {
       showToast("Tidak ada data valid untuk diimport. Semua terdeteksi duplikat.", "error");
       return;
    }

    setIsImporting(true);
    try {
      const dataToInsert = validData.map(({ isDuplicate, ...rest }) => rest);
      
      const response = await fetch('/api/admin/manage-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teachers: dataToInsert })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Server error saat import');
      
      if (result.data && result.data.length > 0) {
        setTeachers(prev => [...prev, ...result.data].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      }
      
      showToast(`${validData.length} Data guru valid berhasil didaftarkan ke sistem!`, "success");
      setIsImportOpen(false); setPreviewData([]); setImportFile(null); fetchData();
    } catch (err: any) { 
       showToast("Gagal import: " + err.message, "error"); 
    } finally { 
       setIsImporting(false); 
    }
  };

  // ================= 4. EXPORT EXCEL & PDF =================
  const getDynamicFileName = (type: 'pdf' | 'excel') => {
    return `Data_Akun_Guru_${appName}.${type}`;
  };

  const getSortedTeachers = () => {
     return [...teachers].sort((a,b) => a.full_name.localeCompare(b.full_name));
  };

  const executeDownloadExcel = () => {
    const sortedTeachers = getSortedTeachers();
    if(sortedTeachers.length === 0) { showToast("Tidak ada data guru untuk diunduh.", "warning"); return; }

    const fileName = getDynamicFileName('excel');

    const exportData = sortedTeachers.map((t, idx) => ({
      'No': idx + 1,
      'Nama Lengkap': t.full_name,
      'NIP / Username': t.username || '-',
      'Password Login': t.password || '(Tersembunyi)'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [{wch: 5}, {wch: 35}, {wch: 25}, {wch: 20}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data_Guru");
    XLSX.writeFile(wb, fileName);
    setIsPrintOptionsOpen(false);
  };

  const executeDownloadPDF = () => {
    const sortedTeachers = getSortedTeachers();
    if(sortedTeachers.length === 0) { showToast("Tidak ada data guru untuk dicetak.", "warning"); return; }
    
    setIsGeneratingPdf(true);
    const title = `DAFTAR AKUN LOGIN GURU / PENGAWAS - ${appName.replace(/_/g, ' ')}`;
    const fileName = getDynamicFileName('pdf');

    const rowsHtml = sortedTeachers.map((t, i) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px; text-align:center; color: #64748b;">${i + 1}</td>
        <td style="padding: 12px; font-weight: bold; color: #1e293b;">${t.full_name}</td>
        <td style="padding: 12px; font-family: monospace; text-align:center; color: #0f172a; font-weight: bold;">${t.username}</td>
        <td style="padding: 12px; font-family: monospace; font-weight: bold; color: #059669; text-align:center;">${t.password || 'Tersembunyi'}</td>
        <td style="padding: 12px;"></td>
      </tr>
    `).join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #0f172a;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
           <h2 style="margin: 0 0 8px 0; font-size: 22px; text-transform: uppercase; color: #1e3a8a;">${title}</h2>
           <p style="margin: 0; font-size: 14px; color: #64748b;">Dokumen ini bersifat rahasia. Distribusikan akun secara pribadi kepada guru yang bersangkutan.</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
           <thead style="background-color: #f8fafc;">
             <tr>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 5%;">No</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; text-align: left;">Nama Lengkap</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 25%;">NIP / Username</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 25%;">Password Login</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 20%;">Tanda Tangan</th>
             </tr>
           </thead>
           <tbody>
             ${rowsHtml}
           </tbody>
        </table>
      </div>
    `;

    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    
    const opt = {
      margin:       0,
      filename:     fileName,
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

  // FILTER GURU DI TABEL UTAMA
  const filteredTeachers = teachers.filter(t => 
    t.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || t.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // FILTER MATA PELAJARAN DI MODAL TAMBAH/EDIT
  const filteredSubjectsModal = subjectsList.filter(subj => 
    subj.name.toLowerCase().includes(subjectSearchQuery.toLowerCase()) || 
    subj.grade_level.toLowerCase().includes(subjectSearchQuery.toLowerCase())
  );

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 placeholder:font-medium";

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 max-w-7xl mx-auto text-slate-900 relative pb-24 md:pb-20">
      
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
            <p className="text-slate-500 text-xs md:text-sm mb-6 md:mb-8 leading-relaxed font-medium whitespace-pre-wrap text-center">{confirmDialog.message}</p>
            <div className="flex items-center gap-2 md:gap-3">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-2.5 md:py-3.5 rounded-lg md:rounded-xl text-xs md:text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm">Batal</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className={`flex-1 py-2.5 md:py-3.5 rounded-lg md:rounded-xl text-xs md:text-sm font-bold text-white transition-all shadow-md active:scale-95 ${confirmDialog.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'}`}>
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
                    <h3 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2 truncate"><Printer className="w-5 h-5 md:w-6 md:h-6 text-blue-600 shrink-0"/> <span className="truncate">Unduh Data Guru</span></h3>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mt-1 truncate">Pilih format unduhan di bawah.</p>
                  </div>
                  <button onClick={() => setIsPrintOptionsOpen(false)} className="text-slate-400 hover:text-rose-500 bg-white rounded-full p-1.5 md:p-2 border border-slate-200 shrink-0 shadow-sm transition-colors"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
               </div>
               <div className="p-5 md:p-8 space-y-3 md:space-y-4">
                  <button onClick={executeDownloadPDF} disabled={isGeneratingPdf} className="w-full flex items-center p-3 md:p-5 rounded-xl md:rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group text-left disabled:opacity-70 disabled:cursor-not-allowed">
                     <div className="w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mr-3 md:mr-4 group-hover:scale-110 transition-transform shrink-0">
                       {isGeneratingPdf ? <LoaderCircle className="w-5 h-5 md:w-6 md:h-6 animate-spin" /> : <FileText className="w-5 h-5 md:w-6 md:h-6"/>}
                     </div>
                     <div>
                       <h4 className="font-black text-slate-800 text-sm md:text-base">{isGeneratingPdf ? 'Memproses PDF...' : 'Unduh Format PDF'}</h4>
                       <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5 md:mt-1 leading-snug">Tabel siap cetak, rapi, dan dilengkapi kolom tanda tangan.</p>
                     </div>
                  </button>
                  <button onClick={executeDownloadExcel} className="w-full flex items-center p-3 md:p-5 rounded-xl md:rounded-2xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group text-left">
                     <div className="w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mr-3 md:mr-4 group-hover:scale-110 transition-transform shrink-0"><FileSpreadsheet className="w-5 h-5 md:w-6 md:h-6"/></div>
                     <div>
                       <h4 className="font-black text-slate-800 text-sm md:text-base">Unduh Format Excel</h4>
                       <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5 md:mt-1 leading-snug">File data mentah (.xlsx) untuk kebutuhan manajemen database sekolah.</p>
                     </div>
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* ================= MODAL CROP GAMBAR ================= */}
      {cropImageSrc && (
        <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in zoom-in-95 duration-200">
           <div className="bg-white w-full max-w-md rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200">
              <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                 <h3 className="text-base md:text-lg font-black text-slate-800 flex items-center gap-2"><Crop className="w-4 h-4 md:w-5 md:h-5 text-blue-600"/> Sesuaikan Foto Profil</h3>
                 <button onClick={() => setCropImageSrc(null)} className="text-slate-400 hover:text-rose-500 p-1.5 md:p-2 bg-white rounded-full border border-slate-200 transition-colors shadow-sm"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
              </div>
              <div className="relative w-full h-64 md:h-80 bg-slate-100 shrink-0">
                <Cropper image={cropImageSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
              </div>
              <div className="p-4 md:p-6 bg-white border-t border-slate-100 space-y-4 md:space-y-5 shrink-0">
                 <div className="flex items-center gap-3 md:gap-4">
                    <ZoomIn className="w-4 h-4 md:w-5 md:h-5 text-slate-400 shrink-0"/>
                    <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-blue-600 cursor-pointer" />
                 </div>
                 <div className="flex gap-2 md:gap-3">
                    <button onClick={() => setCropImageSrc(null)} className="flex-1 py-2.5 md:py-3.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg md:rounded-xl hover:bg-slate-50 transition-colors shadow-sm text-xs md:text-sm">Batal</button>
                    <button onClick={saveCroppedImage} className="flex-1 py-2.5 md:py-3.5 bg-blue-600 text-white font-bold rounded-lg md:rounded-xl hover:bg-blue-700 shadow-md active:scale-95 transition-all text-xs md:text-sm">Simpan Potongan</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* HEADER UTAMA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 md:px-8 md:py-6 rounded-2xl md:rounded-[2rem] border border-blue-100 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2 md:gap-3">
            <GraduationCap className="w-6 h-6 md:w-8 md:h-8 text-blue-600" /> Data Guru
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium ml-8 md:ml-11 leading-snug">Kelola data pengajar, akses login, dan penugasan mata pelajaran.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 md:gap-3 w-full md:w-auto mt-2 sm:mt-0">
          <button onClick={() => setIsImportOpen(true)} className="flex items-center justify-center gap-1.5 md:gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-sm shadow-sm transition-colors w-full sm:w-auto">
            <FileUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" /> Import Massal
          </button>
          <button onClick={openCreateForm} className="flex items-center justify-center gap-1.5 md:gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-sm shadow-md shadow-blue-200 active:scale-95 w-full sm:w-auto transition-all">
            <Plus className="w-4 h-4 md:w-5 md:h-5" /> Tambah Guru
          </button>
        </div>
      </div>

      {/* SEARCH BAR DAN TOMBOL CETAK AKUN */}
      <div className="flex flex-col sm:flex-row justify-between gap-3 md:gap-4 mt-2">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
          <input type="text" placeholder="Cari nama guru atau NIP..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] pl-10 md:pl-12 pr-4 py-3 md:py-3.5 text-xs md:text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all" />
        </div>
        <button onClick={() => setIsPrintOptionsOpen(true)} className="flex items-center justify-center gap-1.5 md:gap-2 bg-white hover:bg-slate-50 text-blue-700 border border-slate-200 hover:border-blue-200 px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] font-bold text-xs md:text-sm shadow-sm transition-colors shrink-0 w-full sm:w-auto">
           <Download className="w-4 h-4 md:w-5 md:h-5 text-blue-600" /> Unduh Akun Guru
        </button>
      </div>

      {/* TABEL DATA */}
      <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-500 z-0">
        <div className="overflow-x-auto custom-scrollbar">
          {/* Tampilan Desktop (Table) */}
          <table className="w-full text-sm text-left hidden md:table min-w-[700px]">
            <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-black uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 lg:px-8 py-4 md:py-5 w-16 text-center">No</th>
                <th className="px-6 lg:px-8 py-4 md:py-5">Profil Guru</th>
                <th className="px-6 lg:px-8 py-4 md:py-5">Mata Pelajaran Diampu</th>
                <th className="px-6 lg:px-8 py-4 md:py-5">Informasi Login</th>
                <th className="px-6 lg:px-8 py-4 md:py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="py-20 md:py-24 text-center"><LoaderCircle className="w-8 h-8 md:w-10 md:h-10 text-blue-500 animate-spin mx-auto mb-3" /><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] md:text-xs">Memuat data guru...</p></td></tr>
              ) : filteredTeachers.length === 0 ? (
                <tr><td colSpan={5} className="py-20 md:py-24 text-center px-4"><div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 mb-3 md:mb-4"><GraduationCap className="w-8 h-8 md:w-10 md:h-10 text-slate-300" /></div><p className="text-slate-500 font-bold text-sm md:text-lg">Data guru tidak ditemukan.</p></td></tr>
              ) : (
                filteredTeachers.map((teacher, idx) => (
                  <tr key={teacher.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 lg:px-8 py-4 md:py-5 text-center font-black text-slate-400">{idx + 1}</td>
                    <td className="px-6 lg:px-8 py-4 md:py-5">
                      <div className="flex items-center gap-3 md:gap-4 min-w-0">
                         {teacher.avatar_url ? (
                           <img src={getAvatarUrl(teacher.avatar_url)} alt="Avatar" className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-[1.2rem] object-cover border border-slate-200 shadow-sm shrink-0" />
                         ) : (
                           <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-[1.2rem] bg-blue-50 flex items-center justify-center text-blue-600 font-black text-base md:text-lg border border-blue-100 shrink-0">
                              {teacher.full_name.charAt(0).toUpperCase()}
                           </div>
                         )}
                         <div className="min-w-0">
                            <p className="font-black text-slate-800 text-sm md:text-base leading-tight mb-1 truncate">{teacher.full_name}</p>
                            <span className="inline-flex items-center gap-1 md:gap-1.5 text-[8px] md:text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 md:px-2.5 py-0.5 md:py-1 rounded-md border border-indigo-100 uppercase tracking-widest whitespace-nowrap">
                              <ShieldCheck className="w-3 h-3"/> Guru
                            </span>
                         </div>
                      </div>
                    </td>
                    
                    <td className="px-6 lg:px-8 py-4 md:py-5">
                       <div className="flex flex-wrap gap-1.5 max-w-[200px] lg:max-w-[250px]">
                          {(!teacher.taught_subjects || teacher.taught_subjects.length === 0) ? (
                             <span className="text-[10px] md:text-xs font-bold text-slate-400 italic">Belum memegang mapel</span>
                          ) : (
                             teacher.taught_subjects.map(subjId => {
                                const subj = subjectsList.find(s => s.id === subjId);
                                if (!subj) return null;
                                return (
                                   <div key={subjId} className="bg-slate-50 border border-slate-200 px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg shadow-sm min-w-0 max-w-full">
                                      <p className="text-[10px] md:text-xs font-bold text-slate-700 leading-none truncate">{subj.name}</p>
                                      <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 truncate">{subj.grade_level}</p>
                                   </div>
                                );
                             })
                          )}
                       </div>
                    </td>

                    <td className="px-6 lg:px-8 py-4 md:py-5">
                       <div className="space-y-1.5 md:space-y-2">
                          <p className="text-xs md:text-sm font-bold text-slate-700 flex items-center gap-1.5 md:gap-2"><UserCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400 shrink-0"/> <span className="truncate">{teacher.username}</span></p>
                          {teacher.password && <p className="text-[10px] md:text-[11px] font-mono font-bold text-slate-500 flex items-center gap-1.5 md:gap-2 bg-slate-100 w-fit px-2 md:px-2.5 py-0.5 md:py-1 rounded-md border border-slate-200"><KeyRound className="w-3 h-3 shrink-0"/> {teacher.password}</p>}
                       </div>
                    </td>
                    <td className="px-6 lg:px-8 py-4 md:py-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 md:gap-2 transition-opacity">
                        <button onClick={() => openEditForm(teacher)} className="p-2 md:p-2.5 bg-white hover:bg-blue-50 text-slate-400 hover:text-blue-600 border border-slate-200 hover:border-blue-200 rounded-full transition-all shadow-sm shrink-0" title="Edit Data"><Edit3 className="w-3.5 h-3.5 md:w-4 md:h-4"/></button>
                        <button onClick={() => handleDelete(teacher.id, teacher.full_name)} className="p-2 md:p-2.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-full transition-all shadow-sm shrink-0" title="Hapus Guru"><Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4"/></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* TAMPILAN MOBILE (List Card) */}
          <div className="md:hidden flex flex-col divide-y divide-slate-100">
             {loading ? (
                <div className="py-16 text-center px-4">
                   <LoaderCircle className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Memuat data guru...</p>
                </div>
             ) : filteredTeachers.length === 0 ? (
                <div className="py-16 text-center px-4">
                   <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 mb-3"><GraduationCap className="w-8 h-8 text-slate-300" /></div>
                   <p className="text-slate-500 font-bold text-sm">Data guru tidak ditemukan.</p>
                </div>
             ) : (
                filteredTeachers.map((teacher, idx) => (
                   <div key={teacher.id} className="p-4 flex flex-col gap-3 hover:bg-blue-50/30 transition-colors">
                      <div className="flex items-start gap-3 min-w-0">
                         {teacher.avatar_url ? (
                           <img src={getAvatarUrl(teacher.avatar_url)} alt="Avatar" className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0" />
                         ) : (
                           <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-black text-lg border border-blue-100 shrink-0 mt-0.5">
                              {teacher.full_name.charAt(0).toUpperCase()}
                           </div>
                         )}
                         <div className="min-w-0 flex-1">
                            <p className="font-black text-slate-800 text-sm leading-tight mb-1 truncate">{teacher.full_name}</p>
                            <span className="inline-flex items-center gap-1 text-[8px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-widest whitespace-nowrap">
                              <ShieldCheck className="w-2.5 h-2.5"/> Guru
                            </span>
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-1">
                         <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1.5"><KeyRound className="w-3 h-3"/> Akun Login</span>
                            <p className="text-xs font-bold text-slate-700 truncate">{teacher.username}</p>
                            {teacher.password && <p className="text-[9px] font-mono font-bold text-slate-500 mt-1">{teacher.password}</p>}
                         </div>
                         <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex flex-col max-h-24 overflow-y-auto custom-scrollbar">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1.5"><BookOpen className="w-3 h-3"/> Mapel Diampu ({teacher.taught_subjects?.length || 0})</span>
                            <div className="flex flex-col gap-1">
                               {(!teacher.taught_subjects || teacher.taught_subjects.length === 0) ? (
                                  <span className="text-[10px] font-bold text-slate-400 italic">Belum ada</span>
                               ) : (
                                  teacher.taught_subjects.map(subjId => {
                                     const subj = subjectsList.find(s => s.id === subjId);
                                     if (!subj) return null;
                                     return (
                                        <div key={subjId} className="bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">
                                           <p className="text-[10px] font-bold text-slate-700 leading-none truncate">{subj.name}</p>
                                        </div>
                                     );
                                  })
                               )}
                            </div>
                         </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-1 border-t border-slate-100/60 pt-3">
                         <button onClick={() => openEditForm(teacher)} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-slate-500 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 hover:border-blue-200 rounded-lg transition-all shadow-sm text-[10px] font-bold uppercase tracking-widest"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
                         <button onClick={() => handleDelete(teacher.id, teacher.full_name)} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-rose-500 hover:bg-rose-50 hover:text-rose-600 border border-rose-200 hover:border-rose-300 rounded-lg transition-all shadow-sm text-[10px] font-bold uppercase tracking-widest"><Trash2 className="w-3.5 h-3.5" /> Hapus</button>
                      </div>
                   </div>
                ))
             )}
          </div>
        </div>
      </div>

      {/* MODAL FORM TAMBAH/EDIT GURU */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-2xl md:rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[95vh] md:max-h-[90vh]">
            <div className="p-4 md:p-6 lg:p-8 border-b border-slate-100 flex items-start sm:items-center justify-between shrink-0 bg-slate-50/80 gap-3">
               <div className="min-w-0">
                  <h2 className="text-lg md:text-xl font-black text-slate-800 truncate">
                    {editingId ? 'Edit Data Guru' : 'Tambah Guru Baru'}
                  </h2>
                  {!editingId && <p className="text-xs md:text-sm text-slate-500 mt-0.5 md:mt-1 font-medium truncate">Mendaftarkan hak akses login pengajar.</p>}
               </div>
               <button onClick={() => setIsFormOpen(false)} className="p-1.5 md:p-2 bg-white text-slate-400 hover:text-rose-500 border border-slate-200 rounded-full transition-colors shadow-sm shrink-0 ml-2"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
               <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 flex-1">
                 
                 {/* FOTO PROFIL SECTION */}
                 <div className="flex flex-col items-center justify-center p-4 md:p-6 border-2 border-dashed border-slate-200 rounded-xl md:rounded-[1.5rem] bg-slate-50 hover:bg-blue-50/50 hover:border-blue-300 transition-colors group">
                    <div className="relative">
                       {formData.avatar_url ? (
                         <img src={getAvatarUrl(formData.avatar_url)} alt="Preview" className="w-20 h-20 md:w-24 md:h-24 rounded-xl md:rounded-[1.5rem] object-cover border-4 border-white shadow-md" />
                       ) : (
                         <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl md:rounded-[1.5rem] bg-blue-100 text-blue-600 flex items-center justify-center font-black text-2xl md:text-3xl border-4 border-white shadow-md">
                            {formData.full_name ? formData.full_name.charAt(0).toUpperCase() : <UserCircle2 className="w-8 h-8 md:w-10 md:h-10"/>}
                         </div>
                       )}
                       <label className="absolute -bottom-1 -right-1 md:-bottom-2 md:-right-2 bg-blue-600 text-white p-2 md:p-2.5 rounded-lg md:rounded-xl cursor-pointer shadow-lg hover:bg-blue-700 transition-colors border-2 border-white">
                          <UploadCloud className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                       </label>
                    </div>
                    <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4 md:mt-5 mb-1.5 md:mb-2">Atau Tempel Link Drive</p>
                    <input type="url" value={formData.avatar_url} onChange={e => setFormData({...formData, avatar_url: e.target.value})} className="w-full max-w-sm bg-white border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-center shadow-sm" placeholder="https://drive.google.com/file/d/.../view" />
                 </div>

                 {/* Data Login */}
                 <div className="space-y-3 md:space-y-4">
                    <div>
                      <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block mb-1.5 md:mb-2 flex items-center gap-1.5 md:gap-2"><UserCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4"/> Nama Lengkap *</label>
                      <input type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className={inputClass} placeholder="Contoh: Budi Santoso, S.Pd" required />
                    </div>
                    {/* PERBAIKAN: Input NIP & Password bertumpuk di HP agar lega diketik */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                      <div>
                        <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block mb-1.5 md:mb-2 flex items-center gap-1.5 md:gap-2"><GraduationCap className="w-3.5 h-3.5 md:w-4 md:h-4"/> NIP (Atau Username) *</label>
                        <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className={inputClass} placeholder="Contoh: 198001012005..." required />
                      </div>
                      <div>
                        <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block mb-1.5 md:mb-2 flex items-center gap-1.5 md:gap-2"><KeyRound className="w-3.5 h-3.5 md:w-4 md:h-4"/> Password *</label>
                        <input type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className={inputClass} placeholder={editingId ? "(Kosongkan jika tetap)" : "Masukkan password"} required={!editingId} />
                      </div>
                    </div>
                 </div>

                 {/* Pemilihan Mata Pelajaran */}
                 <div className="bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-4 md:p-5 shadow-sm flex flex-col h-full">
                    <div className="flex items-center justify-between mb-2 md:mb-3">
                       <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 md:gap-2">
                          <BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4"/> Mata Pelajaran Diampu
                       </label>
                       <span className="text-[9px] md:text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 md:py-1 rounded-md">{formData.taught_subjects.length} Dipilih</span>
                    </div>

                    <div className="relative mb-2 md:mb-3">
                      <Search className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Cari mapel atau kelas..." 
                        value={subjectSearchQuery} 
                        onChange={(e) => setSubjectSearchQuery(e.target.value)} 
                        className="w-full bg-white border border-slate-200 rounded-lg md:rounded-xl pl-8 md:pl-9 pr-3 py-2 text-xs md:text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 max-h-40 md:max-h-48 overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                       {filteredSubjectsModal.length === 0 ? (
                          <p className="text-[10px] md:text-xs italic text-slate-400 col-span-1 sm:col-span-2 py-2 text-center">Mata pelajaran tidak ditemukan.</p>
                       ) : (
                          filteredSubjectsModal.map(subj => (
                             <label key={subj.id} className={`flex items-start gap-2 md:gap-3 p-2.5 md:p-3 rounded-lg md:rounded-xl border-2 cursor-pointer transition-all ${formData.taught_subjects.includes(subj.id) ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                               <input type="checkbox" checked={formData.taught_subjects.includes(subj.id)} onChange={() => handleSubjectToggle(subj.id)} className="w-3.5 h-3.5 md:w-4 md:h-4 mt-0.5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer shrink-0 shadow-sm" />
                               <div className="min-w-0 pr-1">
                                 <p className={`text-xs md:text-sm font-bold leading-tight truncate ${formData.taught_subjects.includes(subj.id) ? 'text-blue-800' : 'text-slate-700'}`}>{subj.name}</p>
                                 <p className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest mt-0.5 md:mt-1 truncate ${formData.taught_subjects.includes(subj.id) ? 'text-blue-500' : 'text-slate-400'}`}>{subj.grade_level}</p>
                               </div>
                             </label>
                          ))
                       )}
                    </div>
                 </div>
               </div>

               <div className="p-4 md:p-6 lg:p-8 border-t border-slate-100 bg-slate-50/80 flex gap-2 md:gap-3 shrink-0 mt-auto">
                 <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-3 md:py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg md:rounded-xl hover:bg-slate-100 transition-colors shadow-sm text-xs md:text-sm">Batal</button>
                 <button type="submit" disabled={isSubmitting} className="flex-1 py-3 md:py-3.5 bg-blue-600 text-white font-bold rounded-lg md:rounded-xl hover:bg-blue-700 shadow-md shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-1.5 md:gap-2 text-xs md:text-sm disabled:opacity-70">
                   {isSubmitting ? <LoaderCircle className="w-4 h-4 md:w-5 md:h-5 animate-spin"/> : <Save className="w-4 h-4 md:w-5 md:h-5"/>} Simpan Data
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPORT EXCEL (BARU) */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-2xl md:rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[95vh] md:max-h-[90vh]">
            <div className="p-4 md:p-6 lg:p-8 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center shrink-0">
               <h3 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2 md:gap-3 truncate"><FileUp className="w-5 h-5 md:w-6 md:h-6 text-emerald-500 shrink-0"/> <span className="truncate">Import Massal Data Guru</span></h3>
               <button onClick={() => {setIsImportOpen(false); setPreviewData([]); setImportFile(null);}} className="p-1.5 md:p-2 bg-white text-slate-400 hover:text-rose-500 border border-slate-200 rounded-full transition-colors shadow-sm shrink-0 ml-2"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
            </div>
            
            <div className="p-4 md:p-6 lg:p-8 overflow-y-auto space-y-4 md:space-y-6 custom-scrollbar flex-1">
               <div className="bg-blue-50 border border-blue-100 rounded-xl md:rounded-[1.5rem] p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 md:gap-6 shadow-sm">
                  <div className="flex items-start gap-3 md:gap-4">
                     <div className="p-1.5 md:p-2 bg-blue-100 rounded-full shrink-0 mt-0.5 md:mt-1"><Info className="w-4 h-4 md:w-6 md:h-6 text-blue-600"/></div>
                     <div>
                       <h4 className="font-bold text-blue-900 text-base md:text-lg mb-1">Panduan Import & Validasi Keamanan</h4>
                       <p className="text-xs md:text-sm text-blue-800/80 leading-relaxed font-medium">
                         Sistem akan mendeteksi baris dengan warna <b className="text-rose-600 bg-rose-100 px-1 rounded">merah muda</b> yang berarti NIP tersebut sudah terdaftar. <b>Baris duplikat akan otomatis diabaikan.</b>
                       </p>
                     </div>
                  </div>
                  <button onClick={downloadTemplate} className="shrink-0 w-full sm:w-auto text-xs md:text-sm font-bold text-blue-700 bg-white border border-blue-200 px-4 md:px-5 py-2.5 md:py-3 rounded-lg md:rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all flex items-center justify-center gap-1.5 md:gap-2 shadow-sm"><Download className="w-3.5 h-3.5 md:w-4 md:h-4"/> Unduh Template</button>
               </div>

               <label className={`border-2 border-dashed rounded-xl md:rounded-[2rem] p-8 sm:p-12 md:p-16 flex flex-col items-center justify-center text-center cursor-pointer transition-all group ${importFile ? 'border-emerald-400 bg-emerald-50/50' : 'border-blue-300 bg-blue-50/30 hover:border-blue-500 hover:bg-blue-50'}`}>
                 <div className="p-3 md:p-5 bg-white rounded-full md:rounded-[1.5rem] shadow-sm border border-slate-200 mb-3 md:mb-4 group-hover:scale-110 transition-all duration-300">{importFile ? <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10 text-emerald-500" /> : <FileSpreadsheet className="w-8 h-8 md:w-10 md:h-10 text-blue-600" />}</div>
                 <span className="text-base sm:text-lg md:text-xl font-black text-slate-700 mb-1 leading-tight break-words max-w-full px-2">{importFile ? importFile.name : 'Pilih File Excel (.xlsx)'}</span>
                 {!importFile && <span className="text-xs md:text-sm font-medium text-slate-500 px-4">Klik di sini untuk menelusuri file dari komputer Anda</span>}
                 <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportFileChange} />
               </label>

               {previewData.length > 0 && (
                 <div className="border border-slate-200 rounded-xl md:rounded-[1.5rem] overflow-hidden shadow-sm animate-in slide-in-from-bottom-2">
                   <div className="flex justify-between items-center p-4 md:p-5 bg-slate-50 border-b border-slate-100">
                      <p className="text-[10px] md:text-sm font-black text-slate-800 flex items-center gap-1.5 md:gap-2"><LayoutList className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400"/> Preview Data <span className="hidden sm:inline">({previewData.length} Baris)</span></p>
                      <p className="text-[9px] md:text-xs font-bold text-slate-500 bg-white px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg border border-slate-200 shadow-sm whitespace-nowrap"><b className="text-emerald-600">{previewData.filter(d=>!d.isDuplicate).length} Valid</b> <span className="mx-1">•</span> <b className="text-rose-600">{previewData.filter(d=>d.isDuplicate).length} Duplikat</b></p>
                   </div>
                   
                   <div className="overflow-x-auto max-h-64 md:max-h-80 custom-scrollbar">
                     <table className="w-full text-xs md:text-sm text-left whitespace-nowrap">
                       <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black text-[9px] md:text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-sm">
                         <tr><th className="p-3 md:p-4 px-4 md:px-6">Nama Lengkap</th><th className="p-3 md:p-4 px-4 md:px-6">NIP / Username</th><th className="p-3 md:p-4 px-4 md:px-6">Password</th><th className="p-3 md:p-4 px-4 md:px-6">Mapel Diampu</th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {previewData.slice(0, 50).map((r, i) => (
                           <tr key={i} className={r.isDuplicate ? "bg-rose-50/50" : "bg-white hover:bg-slate-50/50"}>
                             <td className={`p-3 md:p-4 px-4 md:px-6 font-bold ${r.isDuplicate ? "text-rose-700" : "text-slate-800"}`}>
                               {r.full_name} {r.isDuplicate && <span className="ml-1.5 md:ml-2 text-[8px] md:text-[9px] font-black text-rose-500 border border-rose-200 bg-rose-100 px-1.5 py-0.5 rounded md:rounded-md whitespace-nowrap">DUPLIKAT</span>}
                             </td>
                             <td className={`p-3 md:p-4 px-4 md:px-6 font-medium ${r.isDuplicate ? "text-rose-600" : "text-slate-600"}`}>{r.username}</td>
                             <td className={`p-3 md:p-4 px-4 md:px-6 font-mono font-bold ${r.isDuplicate ? "text-rose-400" : "text-emerald-600"}`}>{r.isDuplicate ? "--------" : r.password}</td>
                             <td className={`p-3 md:p-4 px-4 md:px-6 font-bold ${r.isDuplicate ? "text-rose-400" : "text-blue-600"}`}>{r.taught_subjects.length} Mapel</td>
                           </tr>
                         ))}
                         {previewData.length > 50 && <tr><td colSpan={4} className="p-3 md:p-4 text-center text-slate-400 font-bold bg-slate-50/80 text-[10px] md:text-xs">...dan {previewData.length - 50} data lainnya disembunyikan untuk performa</td></tr>}
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

    </div>
  );
}