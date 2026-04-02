'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx'; 
import Cropper from 'react-easy-crop';
import html2pdf from 'html2pdf.js';
import { 
  Search, Plus, FileUp, MoreVertical, CheckCircle2, XCircle, Users, 
  GraduationCap, LoaderCircle, X, Copy, Trash2, PowerOff, 
  Edit3, KeyRound, ArrowLeft, Building2, UploadCloud, Crop, 
  ZoomIn, Download, FileSpreadsheet, UserCircle2, Save, Globe, AlertTriangle,
  Printer, FileText, LayoutList, Info // PERBAIKAN: LayoutList dan Info sudah ditambahkan
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

// --- HELPER UNTUK MEMOTONG GAMBAR ---
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

// ============================================================================
// CUSTOM SORTING UNTUK KELAS (ROMAN NUMERALS & ANGKA)
// ============================================================================
const romanToInt = (roman: string) => {
  const rom: { [key: string]: number } = { 'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100 };
  let res = 0;
  for (let i = 0; i < roman.length; i++) {
    const curr = rom[roman[i]], next = rom[roman[i + 1]];
    if (curr < next) res -= curr;
    else res += curr;
  }
  return res;
};

const parseClassName = (className: string) => {
  const parts = className.split(' ');
  let grade = 0;
  if (parts.length > 0) {
    const firstPart = parts[0].toUpperCase();
    if (/^[IVXLC]+$/.test(firstPart)) {
       grade = romanToInt(firstPart);
    } else if (!isNaN(Number(firstPart))) {
       grade = Number(firstPart); 
    }
  }
  return { grade, rawName: className };
};

// --- INTERFACES ---
interface Student {
  id: string;
  full_name: string;
  username: string; 
  student_number: string;
  class_group: string;
  is_active: boolean;
  avatar_url?: string;
  password?: string; 
  last_login_at: string | null;
}

export default function StudentsManagementPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [appName, setAppName] = useState('CBT_App'); 

  // MODE TAMPILAN
  const [viewMode, setViewMode] = useState<'groups' | 'details'>('groups');
  const [activeClass, setActiveClass] = useState<string | null>(null);

  // STATE PENCARIAN
  const [classSearchQuery, setClassSearchQuery] = useState(''); 
  const [studentSearchQuery, setStudentSearchQuery] = useState(''); 

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newStudentCreds, setNewStudentCreds] = useState<{username: string, password: string} | null>(null);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ full_name: '', student_number: '', class_group: '', avatar_url: '' });

  // CROPPER STATE
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // IMPORT STATE
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // PRINT/DOWNLOAD STATE
  const [isPrintOptionsOpen, setIsPrintOptionsOpen] = useState(false);
  const [printTarget, setPrintTarget] = useState<'all' | 'class'>('all');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false); 

  const [resetCreds, setResetCreds] = useState<{name: string, username: string, password: string} | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

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

  useEffect(() => { 
    fetchStudents(); 
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('pengaturan_aplikasi').select('nama_aplikasi').eq('id', 1).single();
      if (data?.nama_aplikasi) setAppName(data.nama_aplikasi.replace(/\s+/g, '_'));
    } catch (e) { console.error("Gagal memuat setting:", e); }
  };

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, username, student_number, class_group, is_active, last_login_at, avatar_url, password')
      .eq('role', 'student')
      .order('full_name', { ascending: true }); 

    if (!error && data) {
      setStudents(data as Student[]);
      const classes = Array.from(new Set(data.map(s => s.class_group || 'Tanpa Kelas'))) as string[];
      const sortedClasses = classes.sort((a, b) => {
        const classA = parseClassName(a);
        const classB = parseClassName(b);
        if (classA.grade !== classB.grade) return classA.grade - classB.grade; 
        return classA.rawName.localeCompare(classB.rawName); 
      });
      setAvailableClasses(sortedClasses);
    }
    setLoading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const generateSecurePassword = () => {
    const lower = "abcdefghijklmnopqrstuvwxyz", upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", num = "0123456789", sym = "!@#$%&*?";
    const all = lower + upper + num + sym;
    let pwd = lower[Math.floor(Math.random() * lower.length)] + upper[Math.floor(Math.random() * upper.length)] + num[Math.floor(Math.random() * num.length)] + sym[Math.floor(Math.random() * sym.length)];
    for(let i = 0; i < 4; i++) pwd += all[Math.floor(Math.random() * all.length)];
    return pwd.split('').sort(() => 0.5 - Math.random()).join('');
  };

  // CROPPER HANDLERS
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => setCropImageSrc(reader.result as string);
      reader.readAsDataURL(file);
      e.target.value = ''; 
    }
  };
  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => { setCroppedAreaPixels(croppedAreaPixels); }, []);
  const saveCroppedImage = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return;
    try {
      const croppedImageBase64 = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      setFormData(prev => ({ ...prev, avatar_url: croppedImageBase64 }));
      setCropImageSrc(null); 
    } catch (e) { showToast("Gagal memotong gambar", "error"); }
  };

  // ================= CRUD HANDLERS =================
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isDuplicate = students.some(s => s.student_number === formData.student_number);
    if (isDuplicate) { showToast("Gagal: NIS tersebut sudah terdaftar di sistem!", "error"); return; }
    setIsSubmitting(true);
    try {
      const generatedPassword = generateSecurePassword();
      const emailFiktif = `${formData.student_number}@nexassess.com`;
      const payload = { ...formData, username: formData.student_number, email: emailFiktif, password: generatedPassword, role: 'student' };
      
      const response = await fetch('/api/admin/import/students', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ students: [payload] }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal menambahkan siswa ke database');

      if (formData.avatar_url && result.data && result.data[0]) {
         await supabase.from('users').update({ avatar_url: formData.avatar_url, password: generatedPassword }).eq('id', result.data[0].id);
      }
      setNewStudentCreds({ username: formData.student_number, password: generatedPassword });
      setFormData({ full_name: '', student_number: '', class_group: '', avatar_url: '' });
      fetchStudents(); showToast("Data siswa berhasil ditambahkan!", "success");
    } catch (err: any) { showToast(err.message, "error"); } finally { setIsSubmitting(false); }
  };

  const handleOpenEdit = (student: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData({
      full_name: student.full_name, student_number: student.student_number || '', 
      class_group: student.class_group || '', avatar_url: student.avatar_url || ''
    });
    setEditingStudentId(student.id); setOpenDropdownId(null); setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudentId) return;
    const isDuplicateNis = students.some(s => s.id !== editingStudentId && s.student_number === formData.student_number);
    if (isDuplicateNis) { showToast("Gagal: NIS tersebut sudah digunakan oleh siswa lain!", "error"); return; }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('users').update({
        full_name: formData.full_name, student_number: formData.student_number, 
        username: formData.student_number, class_group: formData.class_group, avatar_url: formData.avatar_url || null
      }).eq('id', editingStudentId);
      if (error) throw error;
      showToast('Data siswa berhasil diperbarui!', 'success');
      setIsEditModalOpen(false); fetchStudents();
    } catch (err: any) { showToast('Gagal mengedit data: ' + err.message, 'error'); } finally { setIsSubmitting(false); }
  };

  const handleResetPassword = (student: Student, e: React.MouseEvent) => {
    e.stopPropagation(); setOpenDropdownId(null);
    confirmAction(
      `Peringatan: Reset password untuk "${student.full_name}" akan menghapus password lamanya secara permanen dan membuat kombinasi acak baru. Lanjutkan?`,
      async () => {
        const newPassword = generateSecurePassword(); 
        try {
          const response = await fetch('/api/admin/reset-password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: student.id, newPassword })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          await supabase.from('users').update({ password: newPassword }).eq('id', student.id);
          setResetCreds({ name: student.full_name, username: student.username || student.student_number, password: newPassword });
          fetchStudents(); showToast('Password berhasil direset!', 'success');
        } catch (err: any) { showToast('Gagal mereset password: ' + err.message, 'error'); }
      }, "Reset Password Siswa", "warning"
    );
  };

  const handleDelete = (student: Student, e: React.MouseEvent) => {
    e.stopPropagation(); setOpenDropdownId(null);
    confirmAction(
      `Yakin ingin menghapus data siswa "${student.full_name}" secara permanen? Data nilai dan ujian siswa ini mungkin akan ikut terhapus.`,
      async () => {
        try {
          const { error } = await supabase.from('users').delete().eq('id', student.id);
          if (error) throw error;
          showToast('Siswa berhasil dihapus secara permanen.', 'success'); fetchStudents();
        } catch (err: any) { showToast('Gagal menghapus siswa: ' + err.message, 'error'); }
      }, "Hapus Data Siswa", "danger"
    );
  };

  const handleToggleStatus = async (student: Student, e: React.MouseEvent) => {
    e.stopPropagation(); setOpenDropdownId(null);
    const { error } = await supabase.from('users').update({ is_active: !student.is_active }).eq('id', student.id);
    if (error) { showToast('Gagal merubah status: ' + error.message, 'error'); } 
    else { showToast(`Siswa berhasil di${!student.is_active ? 'aktifkan' : 'nonaktifkan'}.`, 'success'); fetchStudents(); }
  };

  // ================= IMPORT EXCEL =================
  const downloadTemplate = () => {
    const templateData = [
      { Nama_Lengkap: 'Andi Saputra', NIS_Atau_NIM: '1001', Kelas: 'X MIPA 1' },
      { Nama_Lengkap: 'Budi Santoso', NIS_Atau_NIM: '1002', Kelas: 'XI IPS 2' }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{wch: 35}, {wch: 20}, {wch: 25}]; 
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Siswa");
    XLSX.writeFile(wb, "Template_Import_Siswa.xlsx");
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
        
        const seenNis = new Set();
        const parsed = data.map((row: any) => {
          const nis = String(row.NIS_Atau_NIM).trim();
          const isDuplicateInDB = students.some(s => s.student_number === nis);
          const isDuplicateInFile = seenNis.has(nis);
          seenNis.add(nis);

          return {
            full_name: row.Nama_Lengkap, username: nis, student_number: nis, class_group: String(row.Kelas),
            email: `${nis}@nexassess.com`,
            password: generateSecurePassword(), role: 'student', is_active: true, isDuplicate: isDuplicateInDB || isDuplicateInFile
          };
        }).filter(r => r.full_name && r.student_number);

        setPreviewData(parsed);
      } catch (err) { showToast("Gagal membaca file Excel. Pastikan format sesuai template.", "error"); }
    };
    reader.readAsBinaryString(file);
  };

  const executeImport = async () => {
    const validData = previewData.filter(d => !d.isDuplicate);
    if (validData.length === 0) { showToast("Tidak ada data valid untuk diimport. Semua terdeteksi duplikat.", "error"); return; }
    setIsImporting(true);
    try {
      const response = await fetch('/api/admin/import/students', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ students: validData }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal import siswa');

      for (const student of validData) {
          const matchedUser = result.data?.find((u: any) => u.username === student.username);
          if (matchedUser) { await supabase.from('users').update({ password: student.password }).eq('id', matchedUser.id); }
      }

      showToast(`${validData.length} Siswa valid berhasil diimport dengan Auto-Password!`, 'success');
      setIsImportOpen(false); setPreviewData([]); setImportFile(null); fetchStudents();
    } catch (err: any) { showToast("Gagal import: " + err.message, "error"); } finally { setIsImporting(false); }
  };

  // ================= DOWNLOAD/PRINT DATA =================
  const getSortedTargetStudents = () => {
    let targetStudents = students;
    if (printTarget === 'class' && activeClass) {
      targetStudents = students.filter(s => (s.class_group || 'Tanpa Kelas') === activeClass);
    }
    
    return [...targetStudents].sort((a, b) => {
       const classA = parseClassName(a.class_group || '');
       const classB = parseClassName(b.class_group || '');
       if (classA.grade !== classB.grade) return classA.grade - classB.grade; 
       if (classA.rawName !== classB.rawName) return classA.rawName.localeCompare(classB.rawName); 
       return a.full_name.localeCompare(b.full_name); 
    });
  };

  const getDynamicFileName = (type: 'pdf' | 'excel') => {
    const prefix = 'Data_Akun_Siswa';
    const target = printTarget === 'all' ? 'Semua_Kelas' : `Kelas_${activeClass?.replace(/[^a-zA-Z0-9]/g, '_')}`;
    return `${prefix}_${target}_${appName}.${type}`;
  };

  const executeDownloadExcel = () => {
    const targetStudents = getSortedTargetStudents();
    if(targetStudents.length === 0) { showToast("Tidak ada data siswa untuk diunduh.", "warning"); return; }

    const fileName = getDynamicFileName('excel');
    const sheetName = printTarget === 'all' ? 'Semua_Siswa' : `Kelas_${activeClass}`;

    const exportData = targetStudents.map((s, idx) => ({
      'No': idx + 1,
      'Nama Lengkap': s.full_name,
      'NIS / Username Login': s.student_number || '-',
      'Kelas': s.class_group || '-',
      'Password Login': s.password || '(Tersembunyi)',
      'Status': s.is_active ? 'Aktif' : 'Non-aktif'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [{wch: 5}, {wch: 35}, {wch: 25}, {wch: 15}, {wch: 25}, {wch: 15}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
    setIsPrintOptionsOpen(false);
  };

  // FITUR BARU: LANGSUNG DOWNLOAD PDF MENGGUNAKAN HTML2PDF.JS
  const executeDownloadPDF = () => {
    const targetStudents = getSortedTargetStudents();
    if(targetStudents.length === 0) { showToast("Tidak ada data siswa untuk dicetak.", "warning"); return; }
    
    setIsGeneratingPdf(true);
    const title = printTarget === 'all' ? `DAFTAR AKUN LOGIN SELURUH SISWA - ${appName.replace(/_/g, ' ')}` : `DAFTAR AKUN LOGIN SISWA - KELAS ${activeClass?.toUpperCase()} - ${appName.replace(/_/g, ' ')}`;
    const fileName = getDynamicFileName('pdf');

    const rowsHtml = targetStudents.map((s, i) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px; text-align:center; color: #64748b;">${i + 1}</td>
        <td style="padding: 12px; font-weight: bold; color: #1e293b;">${s.full_name}</td>
        <td style="padding: 12px; text-align:center; color: #475569;">${s.class_group || '-'}</td>
        <td style="padding: 12px; font-family: monospace; text-align:center; color: #0f172a; font-weight: bold;">${s.student_number}</td>
        <td style="padding: 12px; font-family: monospace; font-weight: bold; color: #059669; text-align:center;">${s.password || 'Tersembunyi'}</td>
        <td style="padding: 12px;"></td>
      </tr>
    `).join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #0f172a;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
           <h2 style="margin: 0 0 8px 0; font-size: 22px; text-transform: uppercase; color: #1e3a8a;">${title}</h2>
           <p style="margin: 0; font-size: 14px; color: #64748b;">Dokumen ini bersifat rahasia. Distribusikan akun secara pribadi kepada siswa yang bersangkutan.</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
           <thead style="background-color: #f8fafc;">
             <tr>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 5%;">No</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; text-align: left;">Nama Lengkap</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 15%;">Kelas</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 20%;">NIS / Username</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 20%;">Password Login</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 15%;">Tanda Tangan</th>
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
      // PERBAIKAN TYPESCRIPT: Menambahkan 'as const' agar mematuhi aturan strict typing html2pdf.js
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

  const getStudentCount = (className: string) => { return students.filter(s => (s.class_group || 'Tanpa Kelas') === className).length; };

  const filteredClasses = availableClasses.filter(cls => cls.toLowerCase().includes(classSearchQuery.toLowerCase()));
  const detailStudents = students.filter(student => {
    if (activeClass && (student.class_group || 'Tanpa Kelas') !== activeClass) return false;
    return (student.full_name?.toLowerCase() || '').includes(studentSearchQuery.toLowerCase()) || 
           (student.student_number?.toLowerCase() || '').includes(studentSearchQuery.toLowerCase());
  }).sort((a,b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 max-w-7xl mx-auto pb-24">
      
      {openDropdownId && <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)} />}

      {/* ================= TOAST NOTIFICATION ELEGAN ================= */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-top-10">
          <div className={`px-6 py-3.5 rounded-[1.5rem] shadow-2xl flex items-center gap-3 border ${
             toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
             toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className={`w-5 h-5 text-emerald-500`} /> : <AlertTriangle className={`w-5 h-5 ${toast.type === 'warning' ? 'text-amber-500' : 'text-rose-500'}`} />}
            <p className="font-bold text-sm tracking-wide">{toast.message}</p>
          </div>
        </div>
      )}

      {/* ================= CUSTOM CONFIRM DIALOG ================= */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner ${confirmDialog.type === 'danger' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
               <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2 text-center">{confirmDialog.title}</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed font-medium text-center">{confirmDialog.message}</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all">Batal</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className={`flex-1 py-3.5 rounded-xl text-sm font-bold text-white transition-all shadow-md active:scale-95 ${confirmDialog.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'}`}>
                 Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL PILIHAN FORMAT CETAK ================= */}
      {isPrintOptionsOpen && (
         <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-100">
               <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Printer className="w-6 h-6 text-blue-600"/> Unduh Data Akun</h3>
                    <p className="text-sm font-medium text-slate-500 mt-1">Target: {printTarget === 'all' ? 'Seluruh Siswa' : `Kelas ${activeClass}`}</p>
                  </div>
                  <button onClick={() => setIsPrintOptionsOpen(false)} className="text-slate-400 hover:text-rose-500 bg-white rounded-full p-2 border border-slate-200"><X className="w-5 h-5"/></button>
               </div>
               <div className="p-8 space-y-4">
                  <button onClick={executeDownloadPDF} disabled={isGeneratingPdf} className="w-full flex items-center p-5 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group text-left disabled:opacity-70 disabled:cursor-not-allowed">
                     <div className="w-14 h-14 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shrink-0">
                       {isGeneratingPdf ? <LoaderCircle className="w-6 h-6 animate-spin" /> : <FileText className="w-6 h-6"/>}
                     </div>
                     <div>
                       <h4 className="font-black text-slate-800 text-base">{isGeneratingPdf ? 'Memproses PDF...' : 'Unduh Format PDF'}</h4>
                       <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">Tabel siap cetak, rapi, dan dilengkapi kolom tanda tangan siswa.</p>
                     </div>
                  </button>
                  <button onClick={executeDownloadExcel} className="w-full flex items-center p-5 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group text-left">
                     <div className="w-14 h-14 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shrink-0"><FileSpreadsheet className="w-6 h-6"/></div>
                     <div>
                       <h4 className="font-black text-slate-800 text-base">Unduh Format Excel</h4>
                       <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">File data mentah (.xlsx) untuk kebutuhan manajemen database sekolah.</p>
                     </div>
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* ================= MODAL CROP GAMBAR ================= */}
      {cropImageSrc && (
        <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200">
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                 <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Crop className="w-5 h-5 text-blue-600"/> Sesuaikan Foto Profil</h3>
                 <button onClick={() => setCropImageSrc(null)} className="text-slate-400 hover:text-rose-500 p-2 bg-white rounded-full border border-slate-200"><X className="w-4 h-4"/></button>
              </div>
              <div className="relative w-full h-80 bg-slate-100">
                <Cropper image={cropImageSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
              </div>
              <div className="p-6 bg-white border-t border-slate-100 space-y-5">
                 <div className="flex items-center gap-4">
                    <ZoomIn className="w-5 h-5 text-slate-400 shrink-0"/>
                    <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-blue-600 cursor-pointer" />
                 </div>
                 <div className="flex gap-3">
                    <button onClick={() => setCropImageSrc(null)} className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm">Batal</button>
                    <button onClick={saveCroppedImage} className="flex-1 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md active:scale-95 transition-all">Simpan Potongan</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* HEADER UTAMA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:px-8 md:py-6 rounded-[2rem] border border-blue-100 shadow-sm">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" /> Data Siswa
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium ml-11">Kelola data peserta ujian, kelas, profil, dan status akun.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsImportOpen(true)} className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-6 py-3 rounded-xl font-bold text-sm shadow-sm transition-colors w-full md:w-auto">
            <FileUp className="w-5 h-5 text-emerald-500" /> Import Massal
          </button>
          <button onClick={() => { setFormData({ full_name: '', student_number: '', class_group: activeClass !== 'Tanpa Kelas' ? activeClass || '' : '', avatar_url: '' }); setNewStudentCreds(null); setIsAddModalOpen(true); }} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md shadow-blue-200 active:scale-95 w-full md:w-auto">
            <Plus className="w-5 h-5" /> Tambah Siswa
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><LoaderCircle className="w-12 h-12 text-blue-500 animate-spin" /></div>
      ) : viewMode === 'groups' ? (
        
        /* ================= TAMPILAN 1: FOLDER KELAS ================= */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" placeholder="Cari nama kelas..." value={classSearchQuery} onChange={(e) => setClassSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-[1.5rem] pl-12 pr-4 py-3.5 text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all" />
            </div>
            
            {/* TOMBOL UNDUH (SELURUH SISWA) */}
            <button onClick={() => { setPrintTarget('all'); setIsPrintOptionsOpen(true); }} className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-blue-700 border border-slate-200 hover:border-blue-200 px-6 py-3.5 rounded-[1.5rem] font-bold text-sm shadow-sm transition-colors shrink-0">
               <Download className="w-5 h-5 text-blue-600" /> Unduh Semua Data
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredClasses.map((cls) => (
              <div key={cls} onClick={() => { setActiveClass(cls); setViewMode('details'); setStudentSearchQuery(''); }} className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-blue-300 transition-all duration-300 cursor-pointer group flex flex-col justify-between">
                <div>
                  <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-inner border ${cls === 'Tanpa Kelas' ? 'bg-slate-50 text-slate-400 border-slate-100 group-hover:bg-slate-600 group-hover:text-white' : 'bg-blue-50 text-blue-600 border-blue-100 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500'}`}>
                    {cls === 'Tanpa Kelas' ? <Users className="w-7 h-7" /> : <Building2 className="w-7 h-7" />}
                  </div>
                  <h3 className="font-black text-2xl text-slate-800 line-clamp-1 group-hover:text-blue-700 transition-colors">{cls}</h3>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Peserta</span>
                  <span className="flex items-center gap-1.5 text-xs font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">{getStudentCount(cls)} Orang</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      ) : (

        /* ================= TAMPILAN 2: DAFTAR SISWA DETAIL ================= */
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <button onClick={() => setViewMode('groups')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-200 px-5 py-2.5 rounded-xl transition-all w-fit shadow-sm">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Kelas
          </button>

          <div className={`rounded-[2.5rem] p-8 md:p-10 shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative overflow-hidden ${activeClass === 'Tanpa Kelas' ? 'bg-gradient-to-br from-slate-600 to-slate-800' : 'bg-gradient-to-br from-blue-600 to-indigo-700'}`}>
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex items-center gap-5 relative z-10">
              <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 shrink-0">
                {activeClass === 'Tanpa Kelas' ? <Users className="w-8 h-8 text-white"/> : <Building2 className="w-8 h-8 text-white"/>}
              </div>
              <div>
                <p className="font-bold text-white/80 text-xs uppercase tracking-widest mb-1.5 flex items-center gap-2"><LayoutList className="w-3.5 h-3.5"/> Daftar Peserta Ujian</p>
                <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">{activeClass}</h2>
              </div>
            </div>
            
            {/* TOMBOL UNDUH (SPESIFIK KELAS INI) */}
            <button onClick={() => { setPrintTarget('class'); setIsPrintOptionsOpen(true); }} className="relative z-10 flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-3.5 rounded-xl font-bold text-sm shadow-sm transition-all backdrop-blur-md active:scale-95 w-full sm:w-auto justify-center">
               <Download className="w-5 h-5"/> Unduh Data {activeClass}
            </button>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" placeholder="Cari nama siswa atau NIS..." value={studentSearchQuery} onChange={(e) => setStudentSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-[1.5rem] pl-12 pr-4 py-3.5 text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all" />
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm z-0 overflow-hidden">
            <div className="overflow-x-visible">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/80 text-slate-500 text-xs font-black uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-5">Identitas Peserta</th>
                    <th className="px-8 py-5">Informasi Login</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailStudents.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-24"><div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 mb-4"><Users className="w-10 h-10 text-slate-300" /></div><p className="text-slate-500 font-bold text-lg">Siswa tidak ditemukan.</p></td></tr>
                  ) : (
                    detailStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            {student.avatar_url ? (
                               <img src={getAvatarUrl(student.avatar_url)} alt="Profil" className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0" />
                            ) : (
                               <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-black text-lg border border-blue-100 shrink-0">{student.full_name.charAt(0).toUpperCase()}</div>
                            )}
                            <div>
                              <p className="font-black text-slate-800 text-base mb-1">{student.full_name}</p>
                              <div className="flex items-center gap-2">
                                <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest">NIS: {student.student_number || 'Tidak Ada'}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-8 py-5">
                           <div className="space-y-1.5">
                              <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><UserCircle2 className="w-4 h-4 text-slate-400"/> {student.student_number}</p>
                              {student.password && <p className="text-[11px] font-mono font-bold text-slate-500 flex items-center gap-2 bg-slate-100 w-fit px-2.5 py-1 rounded-md border border-slate-200"><KeyRound className="w-3 h-3"/> {student.password}</p>}
                           </div>
                        </td>

                        <td className="px-8 py-5">
                          {student.is_active ? 
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-200"><CheckCircle2 className="w-4 h-4" /> Aktif</span> : 
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-200"><XCircle className="w-4 h-4" /> Nonaktif</span>
                          }
                        </td>
                        
                        <td className="px-8 py-5 text-right relative">
                          <button onClick={() => setOpenDropdownId(openDropdownId === student.id ? null : student.id)} className="p-2.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 rounded-xl transition-colors relative z-20"><MoreVertical className="w-5 h-5" /></button>
                          {openDropdownId === student.id && (
                            <div className="absolute right-14 top-8 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col text-left animate-in slide-in-from-top-2">
                              <button onClick={(e) => handleOpenEdit(student, e)} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-600 border-b border-slate-100 transition-colors"><Edit3 className="w-4 h-4 text-blue-500" /> Edit Data Siswa</button>
                              <button onClick={(e) => handleResetPassword(student, e)} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-emerald-600 border-b border-slate-100 transition-colors"><KeyRound className="w-4 h-4 text-emerald-500" /> Reset Password</button>
                              <button onClick={(e) => handleToggleStatus(student, e)} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-amber-600 border-b border-slate-100 transition-colors"><PowerOff className={`w-4 h-4 ${student.is_active ? 'text-amber-500' : 'text-emerald-500'}`} />{student.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                              <button onClick={(e) => handleDelete(student, e)} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-4 h-4" /> Hapus Permanen</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP HASIL RESET PASSWORD */}
      {resetCreds && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100 p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 shadow-inner"><KeyRound className="w-10 h-10 text-emerald-500" /></div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">Password Direset!</h2>
              <p className="text-sm text-slate-500 mt-1 font-medium">Berikan kredensial baru ini kepada <b className="text-slate-700">{resetCreds.name}</b></p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left space-y-4 relative">
              <button onClick={() => navigator.clipboard.writeText(`Username: ${resetCreds.username}\nPassword: ${resetCreds.password}`)} className="absolute top-4 right-4 p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-colors"><Copy className="w-5 h-5" /></button>
              <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Username / NIS Login</p><p className="font-bold text-slate-800 text-base">{resetCreds.username}</p></div>
              <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Password Baru</p><p className="font-mono text-xl font-black text-emerald-600 bg-emerald-100/50 inline-block px-3 py-1.5 rounded-lg border border-emerald-200">{resetCreds.password}</p></div>
            </div>
            <button onClick={() => setResetCreds(null)} className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 active:scale-95 transition-all shadow-md">Tutup Jendela</button>
          </div>
        </div>
      )}

      {/* MODAL IMPORT EXCEL */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center shrink-0">
               <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><FileUp className="w-6 h-6 text-blue-600"/> Import Massal Data Siswa</h3>
               <button onClick={() => {setIsImportOpen(false); setPreviewData([]); setImportFile(null);}} className="p-2 bg-white rounded-full border border-slate-200 text-slate-400 hover:text-rose-500 transition-colors shadow-sm"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto space-y-6">
               <div className="bg-blue-50 border border-blue-100 rounded-[1.5rem] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                     <div className="p-2 bg-blue-100 rounded-full shrink-0 mt-1"><Info className="w-6 h-6 text-blue-600"/></div>
                     <div>
                       <h4 className="font-bold text-blue-900 text-lg mb-1">Panduan Import & Validasi Keamanan</h4>
                       <p className="text-sm text-blue-800/80 leading-relaxed font-medium">
                         Sistem akan mendeteksi baris dengan warna <b className="text-rose-600 bg-rose-100 px-1 rounded">merah muda</b> yang berarti NIS tersebut sudah terdaftar. <b>Baris duplikat akan otomatis diabaikan.</b>
                       </p>
                     </div>
                  </div>
                  <button onClick={downloadTemplate} className="shrink-0 text-sm font-bold text-blue-700 bg-white border border-blue-200 px-5 py-3 rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all flex items-center gap-2 shadow-sm"><Download className="w-4 h-4"/> Unduh Template</button>
               </div>

               <label className={`border-2 border-dashed rounded-[2rem] p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all group ${importFile ? 'border-emerald-400 bg-emerald-50/50' : 'border-blue-300 bg-blue-50/30 hover:border-blue-500 hover:bg-blue-50'}`}>
                 <div className="p-5 bg-white rounded-full shadow-sm border border-slate-200 mb-4 group-hover:scale-110 transition-all duration-300">{importFile ? <CheckCircle2 className="w-10 h-10 text-emerald-500" /> : <FileSpreadsheet className="w-10 h-10 text-blue-600" />}</div>
                 <span className="text-xl font-black text-slate-700 mb-1">{importFile ? importFile.name : 'Pilih File Excel (.xlsx)'}</span>
                 {!importFile && <span className="text-sm font-medium text-slate-500">Klik di sini untuk menelusuri file dari komputer Anda</span>}
                 <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportFileChange} />
               </label>

               {previewData.length > 0 && (
                 <div className="border border-slate-200 rounded-[1.5rem] overflow-hidden shadow-sm">
                   <div className="flex justify-between items-center p-5 bg-slate-50 border-b border-slate-100">
                      <p className="text-sm font-black text-slate-800 flex items-center gap-2"><LayoutList className="w-4 h-4 text-slate-400"/> Preview Data ({previewData.length} Baris)</p>
                      <p className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><b className="text-emerald-600">{previewData.filter(d=>!d.isDuplicate).length} Valid</b> • <b className="text-rose-600">{previewData.filter(d=>d.isDuplicate).length} Ganda</b></p>
                   </div>
                   
                   <div className="overflow-x-auto max-h-80 custom-scrollbar">
                     <table className="w-full text-sm text-left">
                       <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-sm">
                         <tr><th className="p-4 px-6">Nama Lengkap</th><th className="p-4 px-6">NIS / Username</th><th className="p-4 px-6">Kelas</th><th className="p-4 px-6">Password Login</th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {previewData.slice(0, 50).map((r, i) => (
                           <tr key={i} className={r.isDuplicate ? "bg-rose-50/50" : "bg-white hover:bg-slate-50/50"}>
                             <td className={`p-4 px-6 font-bold ${r.isDuplicate ? "text-rose-700" : "text-slate-800"}`}>
                               {r.full_name} {r.isDuplicate && <span className="ml-2 text-[9px] font-black text-rose-500 border border-rose-200 bg-rose-100 px-2 py-0.5 rounded-md">DUPLIKAT</span>}
                             </td>
                             <td className={`p-4 px-6 font-medium ${r.isDuplicate ? "text-rose-600" : "text-slate-600"}`}>{r.student_number}</td>
                             <td className={`p-4 px-6 font-medium ${r.isDuplicate ? "text-rose-600" : "text-slate-600"}`}>{r.class_group}</td>
                             <td className={`p-4 px-6 font-mono font-bold ${r.isDuplicate ? "text-rose-400" : "text-emerald-600"}`}>
                                {r.isDuplicate ? "--------" : r.password}
                             </td>
                           </tr>
                         ))}
                         {previewData.length > 50 && <tr><td colSpan={4} className="p-4 text-center text-slate-400 font-bold bg-slate-50/80">...dan {previewData.length - 50} data lainnya disembunyikan untuk performa</td></tr>}
                       </tbody>
                     </table>
                   </div>
                 </div>
               )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/80 flex gap-3 shrink-0">
               <button onClick={() => {setIsImportOpen(false); setPreviewData([]); setImportFile(null);}} className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-sm">Batal</button>
               <button onClick={executeImport} disabled={previewData.filter(d=>!d.isDuplicate).length === 0 || isImporting} className="flex-1 py-3.5 bg-blue-600 text-white font-bold rounded-xl shadow-md active:scale-95 transition-all disabled:bg-slate-300 flex items-center justify-center gap-2">
                 {isImporting ? <LoaderCircle className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} Import {previewData.filter(d=>!d.isDuplicate).length} Data Valid
               </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH & EDIT SISWA */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col border border-slate-200">
            
            {newStudentCreds ? (
              <div className="p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 shadow-inner"><CheckCircle2 className="w-10 h-10 text-emerald-500" /></div>
                <h2 className="text-2xl font-black text-slate-800">Siswa Ditambahkan!</h2>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left space-y-4 relative">
                  <button onClick={() => navigator.clipboard.writeText(`Username: ${newStudentCreds.username}\nPassword: ${newStudentCreds.password}`)} className="absolute top-4 right-4 p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-400 hover:text-blue-600 transition-colors"><Copy className="w-5 h-5" /></button>
                  <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Username / NIS Login</p><p className="font-bold text-slate-800 text-base">{newStudentCreds.username}</p></div>
                  <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Password Baru</p><p className="font-mono text-xl font-black text-emerald-600 bg-emerald-100/50 inline-block px-3 py-1.5 rounded-lg border border-emerald-200">{newStudentCreds.password}</p></div>
                </div>
                <button onClick={() => { setIsAddModalOpen(false); setNewStudentCreds(null); }} className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 active:scale-95 transition-all shadow-md">Tutup Jendela</button>
              </div>
            ) : (
              <>
                <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/80">
                  <div>
                    <h2 className="text-xl font-black text-slate-800">{isEditModalOpen ? 'Edit Data Siswa' : 'Tambah Peserta Ujian'}</h2>
                    {!isEditModalOpen && <p className="text-sm text-slate-500 mt-1 font-medium">Sistem otomatis membuatkan password aman.</p>}
                  </div>
                  <button onClick={() => {setIsAddModalOpen(false); setIsEditModalOpen(false);}} className="p-2 bg-white text-slate-400 hover:text-rose-500 border border-slate-200 rounded-full transition-colors shadow-sm"><X className="w-5 h-5" /></button>
                </div>
                
                <form onSubmit={isEditModalOpen ? handleEditSubmit : handleAddSubmit} className="p-6 md:p-8 space-y-6">
                  <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-[1.5rem] bg-slate-50 hover:bg-blue-50/50 hover:border-blue-300 transition-colors group">
                    <div className="relative">
                       {formData.avatar_url ? (
                         <img src={getAvatarUrl(formData.avatar_url)} alt="Preview" className="w-24 h-24 rounded-[1.5rem] object-cover border-4 border-white shadow-md" />
                       ) : (
                         <div className="w-24 h-24 rounded-[1.5rem] bg-blue-100 text-blue-600 flex items-center justify-center font-black text-3xl border-4 border-white shadow-md">
                            {formData.full_name ? formData.full_name.charAt(0).toUpperCase() : <UserCircle2 className="w-10 h-10"/>}
                         </div>
                       )}
                       <label className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2.5 rounded-xl cursor-pointer shadow-lg hover:bg-blue-700 transition-colors border-2 border-white">
                          <UploadCloud className="w-4 h-4" />
                          <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                       </label>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-5 mb-2">Atau Tempel Link Drive</p>
                    <input type="url" name="avatar_url" value={formData.avatar_url} onChange={handleInputChange} className="w-full max-w-sm bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-center shadow-sm" placeholder="https://drive.google.com/file/d/..." />
                  </div>

                  <div className="space-y-4">
                    <div>
                       <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Nama Lengkap *</label>
                       <input type="text" required name="full_name" value={formData.full_name} onChange={handleInputChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-bold text-slate-800 placeholder-slate-400 shadow-sm transition-all" placeholder="Masukkan nama lengkap siswa..." />
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                         <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">NIS / Username *</label>
                         <input type="text" required name="student_number" value={formData.student_number} onChange={handleInputChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-bold text-slate-800 placeholder-slate-400 shadow-sm transition-all" placeholder="Cth: 12345" />
                      </div>
                      <div>
                         <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Kelas *</label>
                         <input type="text" required name="class_group" value={formData.class_group} onChange={handleInputChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-bold text-slate-800 placeholder-slate-400 shadow-sm transition-all" placeholder="Cth: X MIPA 1" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-100">
                    <button type="submit" disabled={isSubmitting} className={`w-full py-4 text-white rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 ${isEditModalOpen ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'} shadow-md text-sm`}>
                       {isSubmitting ? <LoaderCircle className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} 
                       {isSubmitting ? 'Memproses Data...' : (isEditModalOpen ? 'Simpan Perubahan' : 'Simpan & Buat Password')}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}