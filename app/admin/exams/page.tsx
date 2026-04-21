'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { 
  CalendarClock, Search, Plus, Trash2, Edit3, Clock, BookOpen, Users, 
  LoaderCircle, X, AlertCircle, ShieldAlert, Shuffle, Target, Dna, Timer, Save, Copy, Check, KeyRound,
  Printer, UserCircle2, AlertTriangle, FileText, FileSpreadsheet, Repeat, CheckCircle2, GraduationCap,
  FileUp, Download, Info
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

export default function ExamsManagementPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]); 
  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [appName, setAppName] = useState('CBT_App'); 
  const [appTimeZone, setAppTimeZone] = useState('Asia/Jakarta');
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // UI NOTIFIKASI
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger'|'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3500);
  };
  const confirmAction = (message: string, onConfirm: () => void, title: string = "Konfirmasi", type: 'danger'|'warning' = 'warning') => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, type });
  };

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subjectSearch, setSubjectSearch] = useState(''); 

  const [currentTime, setCurrentTime] = useState(Date.now());
  const editingIdRef = useRef<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // Import State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Print State 
  const [isPrintOptionsOpen, setIsPrintOptionsOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [formData, setFormData] = useState({
    title: '', subject: '', subject_id: '', grade_level: '', description: '', target_class: [] as string[],
    duration_minutes: 90, min_working_minutes: 30, passing_score: 75, max_tab_switches: 3, max_attempts: 1,
    randomize_questions: true, randomize_options: true, show_result_after: false,
    exam_token: '', token_updated_at: '', start_time: '', end_time: ''
  });

  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);

  useEffect(() => { 
    fetchInitialData(); 
    const tick = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    exams.forEach(ex => {
      if (ex.token_updated_at) {
        const elapsed = Math.floor((currentTime - new Date(ex.token_updated_at).getTime()) / 1000);
        if (elapsed >= 300) handleRotateDbToken(ex.id);
      }
    });

    if (isModalOpen && !editingId && formData.token_updated_at) {
      const elapsed = Math.floor((currentTime - new Date(formData.token_updated_at).getTime()) / 1000);
      if (elapsed >= 300) {
        const newToken = generateRandomString(6);
        setFormData(prev => ({ ...prev, exam_token: newToken, token_updated_at: new Date().toISOString() }));
      }
    }
  }, [currentTime]); 

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: settingData } = await supabase.from('pengaturan_aplikasi').select('nama_aplikasi, zona_waktu').eq('id', 1).single();
      if (settingData?.nama_aplikasi) setAppName(settingData.nama_aplikasi.replace(/\s+/g, '_'));
      
      let currentTz = 'Asia/Jakarta';
      if (settingData?.zona_waktu) {
         if (settingData.zona_waktu.includes('WITA') || settingData.zona_waktu.includes('Makassar')) currentTz = 'Asia/Makassar';
         else if (settingData.zona_waktu.includes('WIT') || settingData.zona_waktu.includes('Jayapura')) currentTz = 'Asia/Jayapura';
         setAppTimeZone(currentTz);
      }

      const { data: usersData } = await supabase.from('users').select('class_group').eq('role', 'student');
      if (usersData) {
        const classes = Array.from(new Set(usersData.map(u => u.class_group).filter(Boolean))) as string[];
        setAvailableClasses(classes.sort());
      }
      
      const { data: teachersData } = await supabase.from('users').select('id, full_name, taught_subjects').eq('role', 'proctor').order('full_name');
      if (teachersData) setTeachersList(teachersData as Teacher[]);

      const { data: subjData } = await supabase.from('subjects').select('*').order('name');
      if (subjData) setSubjectsList(subjData as Subject[]);

      const { data: examsData, error } = await supabase
        .from('exams').select('*').order('start_time', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });

      if (error) throw error;
      if (examsData) setExams(examsData as Exam[]);
    } catch (error) { showToast("Gagal memuat data", "error"); } finally { setLoading(false); }
  };

  const generateRandomString = (len: number = 6) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let res = '';
    for (let i = 0; i < len; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return res;
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

  const handleRotateDbToken = async (id: string) => {
    const newToken = generateRandomString(6); const newTime = new Date().toISOString();
    setExams(prev => prev.map(ex => ex.id === id ? { ...ex, exam_token: newToken, token_updated_at: newTime } : ex));
    if (editingIdRef.current === id) setFormData(prev => ({ ...prev, exam_token: newToken, token_updated_at: newTime }));
    await supabase.from('exams').update({ exam_token: newToken, token_updated_at: newTime }).eq('id', id);
  };

  const handleRefreshModalToken = async () => {
    const newToken = generateRandomString(6); const newTime = new Date().toISOString();
    setFormData(prev => ({ ...prev, exam_token: newToken, token_updated_at: newTime }));
    if (editingId) {
      setExams(prev => prev.map(ex => ex.id === editingId ? { ...ex, exam_token: newToken, token_updated_at: newTime } : ex));
      try { await supabase.from('exams').update({ exam_token: newToken, token_updated_at: newTime }).eq('id', editingId); } 
      catch (err) { console.error("Gagal sinkronisasi token secara realtime:", err); }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleClassToggle = (cls: string) => {
    setFormData(prev => {
      const target = prev.target_class;
      if (target.includes(cls)) return { ...prev, target_class: target.filter(c => c !== cls) };
      return { ...prev, target_class: [...target, cls] };
    });
  };

  const openCreateModal = () => {
    setError(null); setEditingId(null); setSubjectSearch('');
    setFormData({
      title: '', subject: '', subject_id: '', grade_level: '', description: '', target_class: [],
      duration_minutes: 90, min_working_minutes: 30, passing_score: 75, max_tab_switches: 3, max_attempts: 1,
      randomize_questions: true, randomize_options: true, show_result_after: false,
      exam_token: generateRandomString(6), token_updated_at: new Date().toISOString(), start_time: '', end_time: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (exam: Exam) => {
    setError(null); setSubjectSearch('');
    const formatDateTimeLocal = (dateString: string) => {
      if (!dateString) return ''; 
      const d = new Date(dateString);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    let parsedClasses: string[] = [];
    if (Array.isArray(exam.target_class)) parsedClasses = exam.target_class;
    else if (typeof exam.target_class === 'string') parsedClasses = exam.target_class.split(',').map((s: string) => s.trim()).filter(Boolean);

    setFormData({
      title: exam.title || '', subject: exam.subject || '', subject_id: exam.subject_id || '', grade_level: exam.grade_level || '', description: exam.description || '', target_class: parsedClasses,
      duration_minutes: exam.duration_minutes || 90, min_working_minutes: exam.min_working_minutes || 0, passing_score: exam.passing_score || 75, max_tab_switches: exam.max_tab_switches || 3, max_attempts: exam.max_attempts || 1,
      randomize_questions: exam.randomize_questions ?? true, randomize_options: exam.randomize_options ?? true, show_result_after: exam.show_result_after ?? false,
      exam_token: exam.exam_token || generateRandomString(6), token_updated_at: exam.token_updated_at || new Date().toISOString(), start_time: formatDateTimeLocal(exam.start_time), end_time: formatDateTimeLocal(exam.end_time)
    });
    setEditingId(exam.id); setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject || formData.subject === '') {
      showToast("Silakan pilih Mata Pelajaran dari daftar.", "warning"); return;
    }
    if (Number(formData.min_working_minutes) > Number(formData.duration_minutes)) {
      showToast("Waktu Minimal Pengerjaan tidak boleh lebih besar dari Total Durasi Ujian.", "warning"); return;
    }
    if (formData.target_class.length === 0) {
      showToast("Pilih minimal satu Target Kelas Peserta.", "warning"); return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesi tidak valid, silakan login kembali.');

      const payload = {
        title: formData.title, subject: formData.subject, subject_id: formData.subject_id, grade_level: formData.grade_level, description: formData.description,
        target_class: formData.target_class, duration_minutes: Number(formData.duration_minutes), min_working_minutes: Number(formData.min_working_minutes), 
        passing_score: Number(formData.passing_score), max_tab_switches: Number(formData.max_tab_switches), max_attempts: Number(formData.max_attempts),
        randomize_questions: formData.randomize_questions, randomize_options: formData.randomize_options, show_result_after: formData.show_result_after, 
        exam_token: formData.exam_token.toUpperCase(), token_updated_at: formData.token_updated_at, 
        start_time: formData.start_time ? new Date(formData.start_time).toISOString() : null,
        end_time: formData.end_time ? new Date(formData.end_time).toISOString() : null, created_by: user.id
      };

      if (editingId) {
        const { error } = await supabase.from('exams').update(payload).eq('id', editingId);
        if (error) throw error;
        showToast("Jadwal Ujian berhasil diperbarui!", "success");
      } else {
        const { error } = await supabase.from('exams').insert([payload]);
        if (error) throw error;
        showToast("Jadwal Ujian berhasil dibuat!", "success");
      }

      setIsModalOpen(false); fetchInitialData();
    } catch (err: any) { 
      showToast(err.message || 'Gagal menyimpan jadwal ujian.', "error");
    } finally { setIsSubmitting(false); }
  };

  const getTeachersForExam = (subjectName: string, gradeLevel: string) => {
    const subjectObj = subjectsList.find(s => s.name === subjectName && s.grade_level === gradeLevel);
    if (!subjectObj) return [];
    return teachersList.filter(t => t.taught_subjects?.includes(subjectObj.id)).map(t => t.full_name);
  };

  const handleDelete = async (exam: Exam) => {
    const teachers = getTeachersForExam(exam.subject, exam.grade_level || '').join(', ') || 'Belum ada guru pengampu';
    
    confirmAction(
      `Apakah Anda yakin ingin menghapus jadwal ujian ini?\n\n• Ujian: ${exam.title || '-'}\n• Mata Pelajaran: ${exam.subject}\n• Jenjang: ${exam.grade_level || 'Umum'}\n• Guru Pengampu: ${teachers}\n\nPeringatan: Semua riwayat yang terkait dengan ujian ini juga akan ikut terhapus permanen!`,
      async () => {
        try {
          const { error } = await supabase.from('exams').delete().eq('id', exam.id);
          if (error) throw error; 
          showToast("Jadwal Ujian berhasil dihapus.", "success");
          fetchInitialData();
        } catch (err: any) { showToast('Gagal menghapus: ' + err.message, "error"); }
      }, "Hapus Jadwal Ujian", "danger"
    );
  };

  // ================= IMPORT EXCEL MASSAL =================
  const downloadTemplate = () => {
    const templateData = [
      { Mata_Pelajaran: 'Matematika', Jenjang_Kelas: 'SMA Kelas 10', Nama_Ujian: 'Ulangan Harian 1', Target_Kelas: 'X MIPA 1, X MIPA 2', Durasi_Menit: 90, Min_Submit_Menit: 30, Batas_Mengerjakan: 1, KKM: 75, Batas_Pindah_Tab: 3, Acak_Soal: 'TRUE', Acak_Opsi: 'TRUE', Tampilkan_Nilai: 'FALSE', Waktu_Mulai: '2026-04-01 08:00', Waktu_Tutup: '2026-04-01 10:00' }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{wch: 25}, {wch: 20}, {wch: 25}, {wch: 35}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 10}, {wch: 18}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 25}, {wch: 25}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Jadwal");
    XLSX.writeFile(wb, "Template_Import_Jadwal_Ujian.xlsx");
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);

    const parseDateSafely = (dateStr: any) => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d.toISOString();
    };

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Coba cocokkan subjek dari DB untuk mendapatkan subject_id
        const parsed = data.map((row: any) => {
          const targetClass = row.Target_Kelas ? String(row.Target_Kelas).split(',').map(s => s.trim()).filter(Boolean) : [];
          
          const rawSubject = String(row.Mata_Pelajaran).trim();
          const rawGrade = String(row.Jenjang_Kelas || '').trim();
          const matchedSubject = subjectsList.find(s => s.name.toLowerCase() === rawSubject.toLowerCase() && s.grade_level.toLowerCase() === rawGrade.toLowerCase());

          return {
             title: row.Nama_Ujian || '',
             subject: rawSubject,
             subject_id: matchedSubject ? matchedSubject.id : null,
             grade_level: rawGrade,
             target_class: targetClass,
             duration_minutes: Number(row.Durasi_Menit) || 90,
             min_working_minutes: Number(row.Min_Submit_Menit) || 0,
             max_attempts: Number(row.Batas_Mengerjakan) || 1,
             passing_score: Number(row.KKM) || 75,
             max_tab_switches: Number(row.Batas_Pindah_Tab) || 3,
             randomize_questions: String(row.Acak_Soal).toUpperCase() === 'TRUE',
             randomize_options: String(row.Acak_Opsi).toUpperCase() === 'TRUE',
             show_result_after: String(row.Tampilkan_Nilai).toUpperCase() === 'TRUE',
             start_time: parseDateSafely(row.Waktu_Mulai),
             end_time: parseDateSafely(row.Waktu_Tutup),
             exam_token: generateRandomString(6).toUpperCase(),
             token_updated_at: new Date().toISOString()
          };
        }).filter(r => r.subject && r.target_class.length > 0);

        setPreviewData(parsed);
      } catch (err) { showToast("Gagal membaca file Excel. Pastikan format sesuai template.", "error"); }
    };
    reader.readAsBinaryString(file);
  };

  const executeImport = async () => {
    if (previewData.length === 0) return;
    setIsImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesi tidak valid.');

      const finalDataToInsert = previewData.map(d => ({ ...d, created_by: user.id }));

      const { error } = await supabase.from('exams').insert(finalDataToInsert);
      if (error) throw error;
      
      showToast(`${previewData.length} Jadwal Ujian berhasil diimport!`, "success");
      setIsImportOpen(false); setPreviewData([]); setImportFile(null); fetchInitialData();
    } catch (err: any) { showToast("Gagal import: " + err.message, "error"); } finally { setIsImporting(false); }
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

  // FILTER LOGIC
  const filteredExams = exams.filter(ex => 
    ex.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    ex.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredModalSubjects = subjectsList.filter(s => (s.name + s.grade_level).toLowerCase().includes(subjectSearch.toLowerCase()));

  const selectedSubjectData = subjectsList.find(s => s.name === formData.subject && s.grade_level === formData.grade_level);
  const assignedTeachers = selectedSubjectData ? teachersList.filter(t => t.taught_subjects?.includes(selectedSubjectData.id)) : [];

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 text-slate-900 relative pb-24 md:pb-20 max-w-7xl mx-auto">
      
      {/* ================= TOAST NOTIFICATION ELEGAN ================= */}
      {toast && (
        <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[150] w-[90%] sm:w-auto animate-in slide-in-from-top-10">
          <div className={`px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] shadow-2xl flex items-center gap-2 md:gap-3 border backdrop-blur-sm ${
             toast.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-700' : 
             toast.type === 'warning' ? 'bg-amber-50/95 border-amber-200 text-amber-700' : 'bg-rose-50/95 border-rose-200 text-rose-700'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-500 shrink-0" /> : <AlertTriangle className={`w-4 h-4 md:w-5 md:h-5 shrink-0 ${toast.type === 'warning' ? 'text-amber-500' : 'text-rose-500'}`} />}
            <p className="font-bold text-xs md:text-sm tracking-wide leading-snug">{toast.message}</p>
          </div>
        </div>
      )}

      {/* ================= CUSTOM CONFIRM DIALOG ================= */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[1.5rem] p-6 md:p-8 shadow-2xl border border-slate-200">
            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center mb-4 md:mb-5 ${confirmDialog.type === 'danger' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
               <AlertTriangle className="w-6 h-6 md:w-7 md:h-7" />
            </div>
            <h3 className="text-lg md:text-xl font-black text-slate-800 mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-500 text-xs md:text-sm mb-6 md:mb-8 leading-relaxed font-medium whitespace-pre-wrap">{confirmDialog.message}</p>
            <div className="flex items-center justify-end gap-2 md:gap-3 mt-4">
              <button onClick={() => setConfirmDialog(null)} className="px-4 md:px-5 py-2.5 rounded-lg md:rounded-xl text-xs md:text-sm font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all">Batal</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className={`px-4 md:px-5 py-2.5 rounded-lg md:rounded-xl text-xs md:text-sm font-bold text-white transition-all shadow-md active:scale-95 ${confirmDialog.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'}`}>
                 Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL PILIHAN FORMAT CETAK GLOBAL ================= */}
      {isPrintOptionsOpen && (
         <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-sm md:max-w-md rounded-2xl md:rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200">
               <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div>
                    <h3 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2"><Printer className="w-5 h-5 text-blue-600"/> Cetak Jadwal</h3>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mt-0.5 md:mt-1">Pilih format unduhan jadwal seluruh ujian.</p>
                  </div>
                  <button onClick={() => setIsPrintOptionsOpen(false)} className="text-slate-400 hover:text-rose-500 bg-white rounded-full p-2 border border-slate-200 shadow-sm"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
               </div>
               <div className="p-5 md:p-8 space-y-3 md:space-y-4">
                  <button onClick={handlePrintAllExamsPDF} disabled={isGeneratingPdf} className="w-full flex items-center p-3 md:p-4 rounded-xl md:rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group text-left disabled:opacity-50">
                     <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mr-3 md:mr-4 group-hover:scale-110 transition-transform shrink-0">
                        {isGeneratingPdf ? <LoaderCircle className="w-5 h-5 md:w-6 md:h-6 animate-spin" /> : <FileText className="w-5 h-5 md:w-6 md:h-6"/>}
                     </div>
                     <div>
                       <h4 className="font-bold text-slate-800 text-sm md:text-base">{isGeneratingPdf ? 'Memproses PDF...' : 'Unduh Format PDF'}</h4>
                       <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5 leading-snug">Daftar agenda ujian siap print (Landscape).</p>
                     </div>
                  </button>
                  <button onClick={handleDownloadAllExamsExcel} className="w-full flex items-center p-3 md:p-4 rounded-xl md:rounded-2xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group text-left">
                     <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mr-3 md:mr-4 group-hover:scale-110 transition-transform shrink-0"><FileSpreadsheet className="w-5 h-5 md:w-6 md:h-6"/></div>
                     <div>
                       <h4 className="font-bold text-slate-800 text-sm md:text-base">Unduh Excel (.xlsx)</h4>
                       <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5 leading-snug">File rekap mentah untuk manajemen jadwal.</p>
                     </div>
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* ================= MODAL IMPORT EXCEL MASSAL ================= */}
      {isImportOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-5xl rounded-2xl md:rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-4 md:p-6 lg:p-8 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center shrink-0">
               <h3 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2 md:gap-3"><FileUp className="w-5 h-5 md:w-6 md:h-6 text-emerald-500 shrink-0"/> <span className="truncate">Import Jadwal Ujian</span></h3>
               <button onClick={() => {setIsImportOpen(false); setPreviewData([]); setImportFile(null);}} className="p-1.5 md:p-2 bg-white rounded-full border border-slate-200 shadow-sm text-slate-400 hover:text-rose-500 transition-colors shrink-0"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
            </div>
            
            <div className="p-4 md:p-6 lg:p-8 overflow-y-auto space-y-4 md:space-y-6 custom-scrollbar flex-1">
               <div className="bg-blue-50 border border-blue-100 rounded-xl md:rounded-2xl p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 md:gap-6">
                  <div className="flex items-start gap-3 md:gap-4">
                     <div className="p-1.5 md:p-2 bg-blue-100 text-blue-600 rounded-full shrink-0 mt-0.5"><Info className="w-4 h-4 md:w-6 md:h-6"/></div>
                     <div>
                       <h4 className="font-bold text-blue-900 mb-1 text-base md:text-lg">Panduan Import Cepat</h4>
                       <p className="text-xs md:text-sm text-blue-800/80 font-medium leading-relaxed">
                         Anda dapat mengunggah puluhan jadwal sekaligus. Sistem otomatis mengatur <b>Token Ujian</b> secara acak dan aman.
                       </p>
                     </div>
                  </div>
                  <button onClick={downloadTemplate} className="shrink-0 w-full sm:w-auto text-xs md:text-sm font-bold text-blue-700 bg-white border border-blue-200 px-4 md:px-5 py-2.5 md:py-3 rounded-lg md:rounded-xl hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center gap-2 shadow-sm"><Download className="w-4 h-4"/> Unduh Template</button>
               </div>

               <label className={`border-2 border-dashed rounded-xl md:rounded-[2.5rem] p-8 md:p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all group ${importFile ? 'border-emerald-400 bg-emerald-50/50' : 'border-blue-300 bg-blue-50/30 hover:border-blue-500 hover:bg-blue-50'}`}>
                 <div className="p-3 md:p-5 bg-white rounded-full md:rounded-[1.5rem] shadow-sm border border-slate-200 mb-3 md:mb-4 group-hover:scale-110 transition-all">{importFile ? <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10 text-emerald-500" /> : <FileUp className="w-8 h-8 md:w-10 md:h-10 text-blue-600" />}</div>
                 <span className="text-base md:text-xl font-black text-slate-700 mb-1 leading-tight break-words px-2">{importFile ? importFile.name : 'Pilih File Excel (.xlsx)'}</span>
                 {!importFile && <span className="text-xs md:text-sm font-medium text-slate-500">Klik di sini untuk menelusuri file dari komputer</span>}
                 <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportFileChange} />
               </label>

               {previewData.length > 0 && (
                 <div className="border border-slate-200 rounded-xl md:rounded-[1.5rem] overflow-hidden shadow-sm animate-in slide-in-from-bottom-2">
                   <div className="flex justify-between items-center p-4 md:p-5 bg-slate-50 border-b border-slate-100">
                      <p className="text-[10px] md:text-sm font-black text-slate-800 uppercase tracking-widest">Preview Data ({previewData.length} Jadwal)</p>
                   </div>
                   
                   <div className="overflow-x-auto max-h-48 md:max-h-64 custom-scrollbar">
                     <table className="w-full text-xs md:text-sm text-left whitespace-nowrap">
                       <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] md:text-xs sticky top-0 z-10 shadow-sm">
                         <tr><th className="p-3 md:p-4 px-4 md:px-6">Mata Pelajaran & Ujian</th><th className="p-3 md:p-4 px-4 md:px-6">Target Kelas</th><th className="p-3 md:p-4 px-4 md:px-6">Waktu & Durasi</th><th className="p-3 md:p-4 px-4 md:px-6">Token Generate</th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {previewData.map((r, i) => (
                           <tr key={i} className="bg-white hover:bg-slate-50">
                             <td className="p-3 md:p-4 px-4 md:px-6">
                               <p className="font-bold text-slate-800">{r.subject}</p>
                               <p className="text-[9px] md:text-[10px] text-slate-500 uppercase tracking-widest font-black mt-0.5 md:mt-1">{r.title} • {r.grade_level}</p>
                             </td>
                             <td className="p-3 md:p-4 px-4 md:px-6 font-medium text-slate-700">{r.target_class.join(', ')}</td>
                             <td className="p-3 md:p-4 px-4 md:px-6 font-medium text-slate-700">{r.duration_minutes} Mnt</td>
                             <td className="p-3 md:p-4 px-4 md:px-6 font-mono font-bold text-emerald-600">{r.exam_token}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 </div>
               )}
            </div>

            <div className="p-4 md:p-6 lg:p-8 border-t border-slate-100 bg-white flex gap-2 md:gap-3 shrink-0">
               <button onClick={() => {setIsImportOpen(false); setPreviewData([]); setImportFile(null);}} className="flex-1 py-3 md:py-3.5 bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-lg md:rounded-xl hover:bg-slate-100 transition-colors shadow-sm text-xs md:text-sm">Batal</button>
               <button onClick={executeImport} disabled={previewData.length === 0 || isImporting} className="flex-1 py-3 md:py-3.5 bg-emerald-500 text-white font-bold rounded-lg md:rounded-xl shadow-md shadow-emerald-200 hover:bg-emerald-600 active:scale-95 transition-all disabled:bg-slate-300 flex items-center justify-center gap-1.5 md:gap-2 text-xs md:text-sm">
                 {isImporting ? <LoaderCircle className="w-4 h-4 md:w-5 md:h-5 animate-spin"/> : <Save className="w-4 h-4 md:w-5 md:h-5"/>} Import Jadwal
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= HEADER UTAMA ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 md:px-8 md:py-6 rounded-2xl md:rounded-[2rem] border border-blue-100 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2 md:gap-3">
            <CalendarClock className="w-6 h-6 md:w-8 md:h-8 text-blue-600" /> Manajemen Ujian
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium ml-8 md:ml-11 leading-snug">Kelola jadwal ujian, durasi, paket soal, serta pengaturannya.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 md:gap-3 w-full md:w-auto">
          <button onClick={() => setIsImportOpen(true)} className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-sm shadow-sm transition-colors w-full sm:w-auto"><FileUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" /> Import Jadwal</button>
          <button onClick={openCreateModal} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-sm shadow-md shadow-blue-200 transition-all active:scale-95 w-full sm:w-auto">
            <Plus className="w-4 h-4 md:w-5 md:h-5" /> Buat Jadwal Baru
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-3 md:gap-4 mt-2">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
          <input type="text" placeholder="Cari mapel atau nama ujian..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] pl-10 md:pl-12 pr-4 py-3 md:py-3.5 text-xs md:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all placeholder-slate-400" />
        </div>
        <button onClick={() => setIsPrintOptionsOpen(true)} className="flex items-center justify-center gap-1.5 md:gap-2 bg-white hover:bg-slate-50 text-blue-700 border border-slate-200 hover:border-blue-200 px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] font-bold text-xs md:text-sm shadow-sm transition-colors shrink-0 w-full sm:w-auto">
           <Download className="w-4 h-4 md:w-5 md:h-5 text-blue-600" /> Unduh Seluruh Jadwal
        </button>
      </div>

      {/* ================= TABEL DATA UJIAN ================= */}
      <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] shadow-sm overflow-hidden z-0">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left hidden md:table">
            <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-black uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 lg:px-8 py-4 md:py-5 w-[45%]">Informasi Ujian</th>
                <th className="px-6 lg:px-8 py-4 md:py-5 w-[25%]">Waktu & Aturan</th>
                <th className="px-6 lg:px-8 py-4 md:py-5 w-[20%]">Token Akses</th>
                <th className="px-6 lg:px-8 py-4 md:py-5 text-right w-[10%]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-20 md:py-24"><LoaderCircle className="w-8 h-8 md:w-10 md:h-10 text-blue-500 animate-spin mx-auto mb-3" /><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] md:text-xs">Memuat jadwal...</p></td></tr>
              ) : filteredExams.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-20 md:py-24 px-4"><div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4 border border-slate-100"><CalendarClock className="w-8 h-8 md:w-10 md:h-10 text-slate-300" /></div><p className="text-slate-500 font-bold text-sm md:text-lg">Belum ada jadwal ujian dibuat.</p></td></tr>
              ) : (
                filteredExams.map((exam) => {
                  const examTeachers = getTeachersForExam(exam.subject, exam.grade_level || '');
                  const isTitlePresent = exam.title && exam.title.trim() !== '';

                  return (
                    <tr key={exam.id} className="hover:bg-blue-50/30 transition-colors">
                      
                      <td className="px-6 lg:px-8 py-4 md:py-5">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start gap-3 md:gap-4 min-w-0">
                             <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-[1.2rem] bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0 shadow-sm mt-0.5">
                                <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-blue-600"/>
                             </div>
                             <div className="min-w-0 flex-1">
                                <p className="font-black text-slate-800 text-sm md:text-base leading-tight flex flex-wrap items-center gap-1.5 md:gap-2 mb-1 truncate">
                                  <span className="truncate">{exam.subject}</span>
                                  {isTitlePresent && <span className="text-slate-500 font-bold text-[9px] md:text-[10px] bg-white px-1.5 md:px-2 py-0.5 rounded border border-slate-200 shadow-sm whitespace-nowrap">{exam.title}</span>}
                                </p>
                                
                                <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mt-1.5 md:mt-2">
                                  <span className="inline-flex items-center gap-1 md:gap-1.5 text-[9px] md:text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 md:px-2.5 py-0.5 md:py-1 rounded-md border border-indigo-100 uppercase tracking-widest whitespace-nowrap">
                                    <GraduationCap className="w-3 h-3 md:w-3.5 md:h-3.5"/> {exam.grade_level || 'Umum'}
                                  </span>
                                  <span className="text-slate-300 hidden sm:inline">|</span>
                                  <div className="flex flex-wrap gap-1">
                                    {examTeachers.length > 0 ? (
                                       examTeachers.map((tName, i) => (
                                         <span key={i} className="text-[9px] md:text-[10px] font-bold text-slate-600 bg-white px-2 md:px-2.5 py-0.5 md:py-1 rounded-md border border-slate-200 shadow-sm flex items-center gap-1 whitespace-nowrap">
                                           <UserCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-blue-400"/> {tName}
                                         </span>
                                       ))
                                    ) : (
                                       <span className="text-[9px] md:text-[10px] italic text-slate-400 font-bold whitespace-nowrap">Tanpa pengampu</span>
                                    )}
                                  </div>
                                </div>
                             </div>
                          </div>

                          <div className="mt-2 bg-amber-50/50 p-2.5 md:p-3 rounded-xl md:rounded-[1rem] border border-amber-100 w-fit max-w-full">
                             <div className="flex items-center gap-1.5 md:gap-2">
                                <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500 shrink-0"/>
                                <span className="text-[10px] md:text-xs font-bold text-slate-700 leading-snug break-words">
                                   {Array.isArray(exam.target_class) ? exam.target_class.join(', ') : (exam.target_class || 'Semua')}
                                </span>
                             </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 lg:px-8 py-4 md:py-5">
                        <div className="flex flex-col gap-1.5 md:gap-2">
                          <p className="text-slate-700 font-black text-[11px] md:text-xs flex items-center gap-1.5 md:gap-2">
                            <CalendarClock className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500 shrink-0" /> 
                            {formatZonedTimeStr(exam.start_time)} {/* Sync Zone */}
                          </p>
                          <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 md:mt-1">
                            <span className="text-slate-500 font-bold text-[9px] md:text-[10px] bg-slate-50 px-2 md:px-2.5 py-0.5 md:py-1 rounded-md border border-slate-200 uppercase tracking-widest whitespace-nowrap">{exam.duration_minutes} Menit</span>
                            <span className="text-blue-600 font-bold text-[9px] md:text-[10px] bg-blue-50 px-2 md:px-2.5 py-0.5 md:py-1 rounded-md border border-blue-100 uppercase tracking-widest whitespace-nowrap">{exam.max_attempts || 1}x Ujian</span>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 lg:px-8 py-4 md:py-5">
                         <div className="flex items-center gap-1.5 md:gap-2 w-full md:w-48 lg:w-52">
                            <div className="relative flex-1">
                              <input type="text" value={exam.exam_token} readOnly className="w-full bg-blue-50/50 border border-blue-200 rounded-xl md:rounded-[1rem] px-2.5 md:px-3 py-2 md:py-2.5 text-[11px] md:text-xs text-center text-blue-700 font-black tracking-widest outline-none shadow-sm uppercase pr-10 md:pr-12" />
                              <div className="absolute right-1.5 md:right-2 top-1/2 -translate-y-1/2 text-[8px] md:text-[9px] font-black text-blue-500 bg-white px-1 md:px-1.5 py-0.5 rounded shadow-sm border border-blue-100">
                                {formatTime(getSecondsLeft(exam.token_updated_at))}
                              </div>
                            </div>
                            <button onClick={() => handleCopyToken(exam.id, exam.exam_token)} title="Salin Token" className="p-2 md:p-2.5 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 text-slate-400 rounded-full shadow-sm transition-colors shrink-0">
                              {copiedTokenId === exam.id ? <Check className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                            </button>
                            <button onClick={() => handleRotateDbToken(exam.id)} title="Acak Token Manual" className="p-2 md:p-2.5 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 text-slate-400 rounded-full shadow-sm transition-colors shrink-0">
                              <Shuffle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                         </div>
                      </td>

                      <td className="px-6 lg:px-8 py-4 md:py-5 text-right">
                        <div className="flex items-center justify-end gap-1.5 md:gap-2 transition-opacity">
                          <button onClick={() => openEditModal(exam)} className="p-2 md:p-2.5 bg-white hover:bg-blue-50 text-slate-400 hover:text-blue-600 border border-slate-200 hover:border-blue-200 rounded-full transition-colors shadow-sm shrink-0" title="Edit Jadwal"><Edit3 className="w-3.5 h-3.5 md:w-4 md:h-4" /></button>
                          <button onClick={() => handleDelete(exam)} className="p-2 md:p-2.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-full transition-colors shadow-sm shrink-0" title="Hapus Jadwal"><Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          {/* TAMPILAN MOBILE (List Card) */}
          <div className="md:hidden flex flex-col divide-y divide-slate-100">
             {loading ? (
                <div className="py-16 text-center px-4">
                   <LoaderCircle className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Memuat jadwal...</p>
                </div>
             ) : filteredExams.length === 0 ? (
                <div className="py-16 text-center px-4">
                   <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-100"><CalendarClock className="w-8 h-8 text-slate-300" /></div>
                   <p className="text-slate-500 font-bold text-sm">Belum ada jadwal ujian dibuat.</p>
                </div>
             ) : (
                filteredExams.map((exam) => {
                   const examTeachers = getTeachersForExam(exam.subject, exam.grade_level || '');
                   const isTitlePresent = exam.title && exam.title.trim() !== '';

                   return (
                      <div key={exam.id} className="p-4 flex flex-col gap-4 hover:bg-blue-50/30 transition-colors">
                         <div className="flex items-start gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0 shadow-sm mt-0.5">
                               <BookOpen className="w-5 h-5 text-blue-600"/>
                            </div>
                            <div className="min-w-0 flex-1">
                               <p className="font-black text-slate-800 text-sm leading-tight flex flex-wrap items-center gap-1.5 mb-1 truncate">
                                 <span className="truncate">{exam.subject}</span>
                                 {isTitlePresent && <span className="text-slate-500 font-bold text-[9px] bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-sm whitespace-nowrap">{exam.title}</span>}
                               </p>
                               <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                 <span className="inline-flex items-center gap-1 text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-widest whitespace-nowrap">
                                    <GraduationCap className="w-3 h-3"/> {exam.grade_level || 'Umum'}
                                 </span>
                                 <div className="flex flex-wrap gap-1">
                                   {examTeachers.length > 0 ? (
                                      examTeachers.map((tName, i) => (
                                        <span key={i} className="text-[9px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm flex items-center gap-1 whitespace-nowrap">
                                          <UserCircle2 className="w-2.5 h-2.5 text-blue-400"/> <span className="truncate max-w-[80px]">{tName}</span>
                                        </span>
                                      ))
                                   ) : (
                                      <span className="text-[9px] italic text-slate-400 font-bold whitespace-nowrap">Tanpa pengampu</span>
                                   )}
                                 </div>
                               </div>
                            </div>
                         </div>

                         <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
                            <div className="flex items-center gap-1.5">
                               <Users className="w-3.5 h-3.5 text-amber-500 shrink-0"/>
                               <span className="text-[10px] font-bold text-slate-700 leading-snug break-words">
                                  {Array.isArray(exam.target_class) ? exam.target_class.join(', ') : (exam.target_class || 'Semua')}
                               </span>
                            </div>
                         </div>

                         <div className="flex flex-col gap-1.5">
                           <p className="text-slate-700 font-black text-[11px] flex items-center gap-1.5">
                             <CalendarClock className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> 
                             {formatZonedTimeStr(exam.start_time)}
                           </p>
                           <div className="flex items-center gap-1.5 mt-0.5">
                             <span className="text-slate-500 font-bold text-[9px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-widest">{exam.duration_minutes} Menit</span>
                             <span className="text-blue-600 font-bold text-[9px] bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-widest">{exam.max_attempts || 1}x Ujian</span>
                           </div>
                         </div>

                         <div className="flex items-center gap-2 mt-1">
                            <div className="relative flex-1">
                              <input type="text" value={exam.exam_token} readOnly className="w-full bg-blue-50/50 border border-blue-200 rounded-lg px-2.5 py-2 text-[11px] text-center text-blue-700 font-black tracking-widest outline-none shadow-sm uppercase pr-10" />
                              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-black text-blue-500 bg-white px-1.5 py-0.5 rounded shadow-sm border border-blue-100">
                                {formatTime(getSecondsLeft(exam.token_updated_at))}
                              </div>
                            </div>
                            <button onClick={() => handleCopyToken(exam.id, exam.exam_token)} title="Salin Token" className="p-2 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 text-slate-400 rounded-lg shadow-sm transition-colors shrink-0">
                              {copiedTokenId === exam.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => handleRotateDbToken(exam.id)} title="Acak Token Manual" className="p-2 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 text-slate-400 rounded-lg shadow-sm transition-colors shrink-0">
                              <Shuffle className="w-3.5 h-3.5" />
                            </button>
                         </div>

                         <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                           <button onClick={() => openEditModal(exam)} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-slate-500 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 hover:border-blue-200 rounded-lg transition-all shadow-sm text-[10px] font-bold uppercase tracking-widest"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
                           <button onClick={() => handleDelete(exam)} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-rose-500 hover:bg-rose-50 hover:text-rose-600 border border-rose-200 hover:border-rose-300 rounded-lg transition-all shadow-sm text-[10px] font-bold uppercase tracking-widest"><Trash2 className="w-3.5 h-3.5" /> Hapus</button>
                         </div>
                      </div>
                   );
                })
             )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL SUPER LENGKAP: BUAT & EDIT JADWAL
      ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[95vh] my-auto border border-slate-200">
            
            <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 shrink-0 z-10 sticky top-0">
              <div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800">{editingId ? 'Edit Jadwal Ujian' : 'Buat Ujian Baru'}</h2>
                <p className="text-xs md:text-sm text-slate-500 mt-0.5 md:mt-1 font-medium">Konfigurasi jadwal, aturan, dan keamanan ujian.</p>
              </div>
              <div className="flex gap-2.5 md:gap-3 self-end md:self-auto w-full md:w-auto mt-2 md:mt-0">
                <button onClick={() => setIsModalOpen(false)} className="flex items-center justify-center p-2.5 md:p-3.5 bg-white border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl md:rounded-full transition-all shadow-sm shrink-0"><X className="w-4 h-4 md:w-5 md:h-5" /></button>
                <button onClick={handleSubmit} disabled={isSubmitting} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 md:px-8 py-3 md:py-3.5 rounded-xl md:rounded-2xl font-bold flex items-center justify-center gap-1.5 md:gap-2 shadow-md active:scale-95 disabled:opacity-70 transition-all text-xs md:text-sm">
                  {isSubmitting ? <LoaderCircle className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Save className="w-4 h-4 md:w-5 md:h-5" />}
                  <span className="hidden sm:inline">{isSubmitting ? 'Menyimpan...' : (editingId ? 'Update Jadwal' : 'Simpan Jadwal')}</span>
                  <span className="sm:hidden">{isSubmitting ? 'Menyimpan...' : 'Simpan'}</span>
                </button>
              </div>
            </div>

            <div id="modal-scroll-area" className="overflow-y-auto p-4 sm:p-6 md:p-8 flex-1 bg-slate-50/50 custom-scrollbar">
              <form id="exam-form" className="space-y-4 md:space-y-6 pb-6 md:pb-10">
                
                {/* 1. INFORMASI DASAR */}
                <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] p-4 sm:p-6 md:p-8 shadow-sm">
                  <div className="flex items-center gap-2.5 md:gap-3 mb-4 md:mb-6"><div className="p-2 md:p-3 bg-blue-50 text-blue-600 rounded-xl md:rounded-[1.2rem]"><BookOpen className="w-5 h-5 md:w-6 md:h-6" /></div><h2 className="text-lg md:text-xl font-black text-slate-800">Informasi Dasar Ujian</h2></div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                    
                    {/* KOLOM KIRI */}
                    <div className="space-y-4 md:space-y-6">
                       <div className="bg-slate-50 border border-slate-200 p-4 md:p-6 rounded-xl md:rounded-[1.5rem] shadow-sm">
                          <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block mb-2 md:mb-3 flex items-center gap-1.5 md:gap-2"><BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4"/> Pilih Mata Pelajaran *</label>
                          <div className="relative mb-2 md:mb-3">
                             <Search className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                             <input 
                                type="text" placeholder="Ketik untuk mencari mapel..." 
                                value={subjectSearch} onChange={(e) => setSubjectSearch(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg md:rounded-xl pl-10 md:pl-11 pr-3 md:pr-4 py-2.5 md:py-3 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
                             />
                          </div>
                          
                          <div className="max-h-40 md:max-h-48 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                             {filteredModalSubjects.length === 0 ? (
                                <p className="text-[10px] md:text-xs italic text-slate-400 text-center py-3 md:py-4 font-bold bg-white rounded-lg md:rounded-xl border border-slate-200">Mata pelajaran tidak ditemukan.</p>
                             ) : (
                                filteredModalSubjects.map(s => {
                                   const isSelected = formData.subject_id === s.id;
                                   return (
                                      <div 
                                         key={s.id} 
                                         onClick={() => setFormData(prev => ({...prev, subject: s.name, subject_id: s.id, grade_level: s.grade_level}))}
                                         className={`p-3 md:p-4 rounded-lg md:rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center ${isSelected ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-transparent hover:border-slate-200 hover:shadow-sm'}`}
                                      >
                                         <div className="min-w-0 pr-2">
                                            <p className={`text-xs md:text-sm font-black truncate ${isSelected ? 'text-blue-800' : 'text-slate-800'}`}>{s.name}</p>
                                            <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mt-0.5 md:mt-1 truncate ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>{s.grade_level}</p>
                                         </div>
                                         {isSelected && <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-blue-600 shrink-0" />}
                                      </div>
                                   )
                                })
                             )}
                          </div>
                       </div>

                       {formData.subject && (
                         <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl md:rounded-2xl p-4 md:p-5 animate-in fade-in shadow-sm">
                            <label className="text-[10px] md:text-xs font-black text-indigo-500 uppercase tracking-widest block mb-2 md:mb-3 flex items-center gap-1.5 md:gap-2"><UserCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4"/> Guru Pengampu Terdeteksi</label>
                            <div className="flex flex-wrap gap-1.5 md:gap-2">
                               {assignedTeachers.length === 0 ? (
                                  <span className="text-[10px] md:text-xs font-bold text-indigo-400 bg-white px-2.5 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg border border-indigo-100 shadow-sm">Belum ada guru</span>
                                ) : (
                                  assignedTeachers.map(t => (
                                     <span key={t.id} className="flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs font-bold text-indigo-700 bg-white px-2.5 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg border border-indigo-200 shadow-sm"><UserCircle2 className="w-3 h-3 md:w-4 md:h-4 text-indigo-400"/> {t.full_name}</span>
                                  ))
                               )}
                            </div>
                         </div>
                       )}

                       <div>
                         <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block mb-1.5 md:mb-2 mt-2 md:mt-4 ml-1">Sub Judul Ujian (Opsional)</label>
                         <input type="text" name="title" value={formData.title} onChange={handleInputChange} placeholder="Contoh: Ulangan Harian 1, UTS Ganjil..." className="w-full bg-white border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3.5 text-xs md:text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 font-bold shadow-sm transition-all" />
                       </div>
                    </div>
                    
                    {/* KOLOM KANAN */}
                    <div className="space-y-4 md:space-y-6">
                      <div className="space-y-2 md:space-y-3 bg-blue-50/30 p-4 md:p-6 rounded-xl md:rounded-[1.5rem] border border-blue-100 shadow-sm">
                        <label className="text-[10px] md:text-xs font-black text-blue-600 flex flex-wrap items-center justify-between gap-1 uppercase tracking-widest">
                          <span className="flex items-center gap-1.5 md:gap-2"><KeyRound className="w-3.5 h-3.5 md:w-4 md:h-4"/> Token Akses *</span><span className="text-[8px] md:text-[9px] text-blue-600 bg-white px-2 md:px-2.5 py-0.5 md:py-1 rounded-full border border-blue-200 shadow-sm whitespace-nowrap">Auto-Rotate</span>
                        </label>
                        <div className="flex gap-2 md:gap-3">
                          <div className="relative w-full">
                            <input type="text" required name="exam_token" value={formData.exam_token} readOnly className="w-full bg-white border-2 border-blue-200 rounded-lg md:rounded-[1.5rem] px-3 md:px-4 py-2.5 md:py-3.5 text-xs md:text-sm text-center text-blue-700 font-black tracking-widest outline-none shadow-sm uppercase pr-14 md:pr-16" />
                            <div className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[9px] md:text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 md:px-2 py-1 md:py-1.5 rounded-md md:rounded-lg border border-blue-100 shadow-sm">
                              <Timer className="w-3 h-3 md:w-3.5 md:h-3.5" /> {formatTime(getSecondsLeft(formData.token_updated_at))}
                            </div>
                          </div>
                          <button type="button" onClick={handleRefreshModalToken} title="Acak Manual & Simpan" className="w-10 h-10 md:w-14 md:h-14 bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 text-slate-400 rounded-lg md:rounded-full shadow-sm shrink-0 transition-colors flex items-center justify-center"><Shuffle className="w-4 h-4 md:w-5 md:h-5" /></button>
                        </div>
                      </div>

                      <div className="space-y-1.5 md:space-y-2">
                        <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block mb-1.5 md:mb-2 ml-1 flex items-center gap-1.5 md:gap-2"><FileText className="w-3.5 h-3.5 md:w-4 md:h-4"/> Deskripsi (Opsional)</label>
                        <textarea name="description" value={formData.description} onChange={handleInputChange} rows={4} placeholder="Instruksi pengerjaan singkat..." className="w-full bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] p-3 md:p-5 text-xs md:text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 resize-none font-medium shadow-sm transition-all custom-scrollbar" />
                      </div>
                    </div>
                  </div>

                  {/* BAWAH FULL WIDTH: TARGET KELAS */}
                  <div className="mt-6 md:mt-8 bg-slate-50 border border-slate-200 rounded-xl md:rounded-[1.5rem] p-4 md:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 md:gap-3 mb-3 md:mb-5">
                      <div className="flex items-center gap-1.5 md:gap-2"><Target className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" /><label className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest">Target Kelas *</label></div>
                      <span className="text-[9px] md:text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg shadow-sm self-start sm:self-auto">{formData.target_class.length} Terpilih</span>
                    </div>
                    <div className="flex flex-wrap gap-2 md:gap-3 max-h-[150px] md:max-h-[200px] overflow-y-auto p-1.5 md:p-2 custom-scrollbar bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-inner">
                      {availableClasses.length > 0 ? availableClasses.map(cls => (
                        <button key={cls} type="button" onClick={() => handleClassToggle(cls)} className={`px-3 md:px-5 py-2 md:py-2.5 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all border ${formData.target_class.includes(cls) ? 'bg-emerald-500 text-white border-emerald-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-emerald-300 shadow-sm'}`}>{cls}</button>
                      )) : <p className="text-xs md:text-sm text-slate-500 font-medium p-3 md:p-4 italic bg-slate-50 rounded-xl w-full text-center border border-slate-100">Belum ada data kelas siswa.</p>}
                    </div>
                  </div>
                </div>

                {/* 2. JADWAL & WAKTU & ATURAN PENGERJAAN */}
                <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] p-4 sm:p-6 md:p-8 shadow-sm">
                  <div className="flex items-center gap-2.5 md:gap-3 mb-4 md:mb-6"><div className="p-2 md:p-3 bg-amber-50 text-amber-600 rounded-xl md:rounded-[1.2rem]"><Clock className="w-5 h-5 md:w-6 md:h-6" /></div><h2 className="text-lg md:text-xl font-black text-slate-800">Aturan & Waktu Ujian</h2></div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
                    <div className="space-y-1.5 md:space-y-3">
                      <label className="text-[9px] md:text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest block ml-0.5 md:ml-1">Durasi (Menit) *</label>
                      <input type="number" required min="5" name="duration_minutes" value={formData.duration_minutes} onChange={handleInputChange} className="w-full bg-white border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3.5 text-sm md:text-base font-black text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-2 text-center shadow-sm transition-all" />
                    </div>
                    <div className="space-y-1.5 md:space-y-3">
                      <label className="text-[9px] md:text-[10px] sm:text-xs font-black text-emerald-600 uppercase tracking-widest block ml-0.5 md:ml-1">Min. Submit *</label>
                      <input type="number" required min="0" max={formData.duration_minutes} name="min_working_minutes" value={formData.min_working_minutes} onChange={handleInputChange} className="w-full bg-emerald-50 border-2 border-emerald-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3.5 text-sm md:text-base font-black text-emerald-800 focus:outline-none focus:border-emerald-500 focus:ring-2 text-center shadow-sm transition-all" placeholder="0 = Bebas" title="Mencegah siswa langsung submit" />
                    </div>
                    <div className="space-y-1.5 md:space-y-3">
                      <label className="text-[9px] md:text-[10px] sm:text-xs font-black text-blue-600 uppercase tracking-widest block ml-0.5 md:ml-1">Batas Coba *</label>
                      <input type="number" required min="1" name="max_attempts" value={formData.max_attempts} onChange={handleInputChange} className="w-full bg-blue-50 border-2 border-blue-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3.5 text-sm md:text-base font-black text-blue-800 focus:outline-none focus:border-blue-500 focus:ring-2 text-center shadow-sm transition-all" title="Jumlah maksimal siswa boleh mengulang (Default 1)" />
                    </div>
                    <div className="space-y-1.5 md:space-y-3">
                      <label className="text-[9px] md:text-[10px] sm:text-xs font-black text-indigo-600 uppercase tracking-widest block ml-0.5 md:ml-1">KKM (Lulus) *</label>
                      <input type="number" required min="0" max="100" name="passing_score" value={formData.passing_score} onChange={handleInputChange} className="w-full bg-indigo-50 border-2 border-indigo-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3.5 text-sm md:text-base font-black text-indigo-800 focus:outline-none focus:border-indigo-500 focus:ring-2 text-center shadow-sm transition-all" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 p-4 md:p-6 bg-amber-50/50 rounded-xl md:rounded-[1.5rem] border border-amber-100 shadow-sm relative">
                    <div className="absolute -top-2 md:-top-3 right-3 md:right-5 text-[8px] md:text-[10px] font-black text-amber-600 bg-amber-100 px-2 md:px-3 py-0.5 md:py-1 rounded-full uppercase tracking-widest border border-amber-200">Waktu {appTimeZone}</div>
                    <div className="space-y-2 md:space-y-3"><label className="text-[10px] md:text-xs font-black text-amber-800 uppercase tracking-widest block ml-0.5 md:ml-1 flex items-center gap-1.5 md:gap-2"><CalendarClock className="w-3.5 h-3.5 md:w-4 md:h-4"/> Waktu Mulai Akses (Opsional)</label><input type="datetime-local" name="start_time" value={formData.start_time} onChange={handleInputChange} className="w-full bg-white border border-amber-200 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3.5 text-xs md:text-sm text-slate-800 font-black focus:outline-none focus:border-amber-500 focus:ring-2 shadow-sm transition-all" /></div>
                    <div className="space-y-2 md:space-y-3"><label className="text-[10px] md:text-xs font-black text-amber-800 uppercase tracking-widest block ml-0.5 md:ml-1 flex items-center gap-1.5 md:gap-2"><CalendarClock className="w-3.5 h-3.5 md:w-4 md:h-4"/> Waktu Tutup Akses (Opsional)</label><input type="datetime-local" name="end_time" value={formData.end_time} onChange={handleInputChange} className="w-full bg-white border border-amber-200 rounded-lg md:rounded-xl px-3 md:px-5 py-2.5 md:py-3.5 text-xs md:text-sm text-slate-800 font-black focus:outline-none focus:border-amber-500 focus:ring-2 shadow-sm transition-all" /></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {/* 3. ACAK & OPSI */}
                  <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] p-4 sm:p-6 md:p-8 shadow-sm h-full">
                    <div className="flex items-center gap-2.5 md:gap-3 mb-4 md:mb-6"><div className="p-2 md:p-3 bg-indigo-50 text-indigo-600 rounded-xl md:rounded-[1.2rem]"><Dna className="w-5 h-5 md:w-6 md:h-6" /></div><h2 className="text-lg md:text-xl font-black text-slate-800">Acak & Opsi</h2></div>
                    <div className="space-y-3 md:space-y-4">
                      <label className="flex items-start gap-3 md:gap-4 cursor-pointer group p-3 md:p-4 rounded-xl md:rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-all shadow-sm">
                        <input type="checkbox" name="randomize_questions" checked={formData.randomize_questions} onChange={handleInputChange} className="w-5 h-5 md:w-6 md:h-6 mt-0.5 md:mt-0.5 cursor-pointer accent-indigo-600 rounded shadow-sm shrink-0" />
                        <div><span className="text-xs md:text-sm font-black text-slate-800 block leading-tight">Acak Urutan Soal</span><span className="text-[10px] md:text-xs font-medium text-slate-500 block mt-0.5 md:mt-1 leading-snug">Mencegah siswa saling mencocokkan nomor urut.</span></div>
                      </label>
                      <label className="flex items-start gap-3 md:gap-4 cursor-pointer group p-3 md:p-4 rounded-xl md:rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-all shadow-sm">
                        <input type="checkbox" name="randomize_options" checked={formData.randomize_options} onChange={handleInputChange} className="w-5 h-5 md:w-6 md:h-6 mt-0.5 md:mt-0.5 cursor-pointer accent-indigo-600 rounded shadow-sm shrink-0" />
                        <div><span className="text-xs md:text-sm font-black text-slate-800 block leading-tight">Acak Pilihan Jawaban (A, B, C)</span><span className="text-[10px] md:text-xs font-medium text-slate-500 block mt-0.5 md:mt-1 leading-snug">Berlaku untuk tipe PG dan Menjodohkan.</span></div>
                      </label>
                      <label className="flex items-start gap-3 md:gap-4 cursor-pointer group p-3 md:p-4 rounded-xl md:rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-all shadow-sm">
                        <input type="checkbox" name="show_result_after" checked={formData.show_result_after} onChange={handleInputChange} className="w-5 h-5 md:w-6 md:h-6 mt-0.5 md:mt-0.5 cursor-pointer accent-indigo-600 rounded shadow-sm shrink-0" />
                        <div><span className="text-xs md:text-sm font-black text-slate-800 block leading-tight">Tampilkan Nilai Instan</span><span className="text-[10px] md:text-xs font-medium text-slate-500 block mt-0.5 md:mt-1 leading-snug">Siswa dapat melihat skor akhir setelah klik selesai.</span></div>
                      </label>
                    </div>
                  </div>

                  {/* 4. KEAMANAN */}
                  <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] p-4 sm:p-6 md:p-8 shadow-sm h-full">
                    <div className="flex items-center gap-2.5 md:gap-3 mb-4 md:mb-6"><div className="p-2 md:p-3 bg-rose-50 text-rose-600 rounded-xl md:rounded-[1.2rem]"><ShieldAlert className="w-5 h-5 md:w-6 md:h-6" /></div><h2 className="text-lg md:text-xl font-black text-slate-800">Keamanan Anti-Cheat</h2></div>
                    <div className="space-y-3 md:space-y-4">
                      <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block ml-0.5 md:ml-1">Batas Pindah Aplikasi/Tab</label>
                      <div className="bg-rose-50/50 border border-rose-100 p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm">
                         <p className="text-[10px] md:text-xs text-rose-800 font-bold mb-4 md:mb-5 leading-snug md:leading-relaxed">Sistem akan memblokir dan menutup paksa ujian (force submit) jika siswa pindah tab untuk mencari jawaban di internet melebihi batas ini.</p>
                         <div className="flex items-center gap-3 md:gap-5">
                           <input type="range" min="1" max="10" name="max_tab_switches" value={formData.max_tab_switches} onChange={handleInputChange} className="flex-1 accent-rose-500 h-1.5 md:h-2 bg-slate-200 rounded-lg cursor-pointer shadow-sm" />
                           <span className="bg-white text-rose-600 font-black px-3 md:px-5 py-2 md:py-2.5 rounded-lg md:rounded-xl border border-rose-200 w-12 md:w-20 text-center shadow-sm text-sm md:text-lg">{formData.max_tab_switches}</span>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button onClick={handleSubmit} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-3.5 sm:py-4 rounded-xl md:rounded-2xl font-black flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all mt-6 md:hidden text-xs sm:text-sm">
                  {isSubmitting ? <LoaderCircle className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Save className="w-4 h-4 sm:w-5 sm:h-5" />}
                  {isSubmitting ? 'Menyimpan...' : (editingId ? 'Update Jadwal' : 'Simpan Jadwal Ujian')}
                </button>

              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}