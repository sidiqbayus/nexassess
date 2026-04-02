'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { 
  Search, Plus, Edit3, Trash2, CheckCircle2, 
  LoaderCircle, Globe, Building, Users, XCircle, Save,
  AlertTriangle, UserPlus, ArrowLeft, Printer, FileSpreadsheet, UserMinus, ShieldCheck, Info, LayoutList,
  FileUp, Download, FileText, BookOpen, ChevronDown, UserCircle2, X
} from 'lucide-react';

// --- INTERFACES ---
interface Room {
  id: string;
  room_name: string;
  capacity: number;
  proctor_ids?: string[]; 
  subject?: string; 
}

interface Student {
  id: string;
  full_name: string;
  student_number: string;
  class_group: string;
  room_id: string | null;
}

interface Teacher {
  id: string;
  full_name: string;
  taught_subjects?: string[]; 
}

interface SubjectData {
  id: string;
  name: string;
  grade_level: string;
}

interface Exam {
  id: string;
  title: string;
  subject: string;
  grade_level: string;
}

export default function RoomsManagementPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]); 
  const [subjects, setSubjects] = useState<SubjectData[]>([]); 
  const [exams, setExams] = useState<Exam[]>([]); 
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [appName, setAppName] = useState('CBT_App');
  
  // Custom Modals & Toasts
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger'|'warning' } | null>(null);

  // Form State (Master Ruang)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{room_name: string, capacity: number, proctor_ids: string[], subject: string}>({ room_name: '', capacity: 30, proctor_ids: [], subject: '' });
  const [proctorSearchQuery, setProctorSearchQuery] = useState('');
  
  // Custom Dropdown Mapel/Ujian State
  const [showExamDropdown, setShowExamDropdown] = useState(false);
  const [examSearchQuery, setExamSearchQuery] = useState('');
  const examDropdownRef = useRef<HTMLDivElement>(null);

  // Import State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Print Global State
  const [isPrintOptionsOpen, setIsPrintOptionsOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Mode Plotting (Atur Siswa)
  const [viewMode, setViewMode] = useState<'master' | 'plotting'>('master');
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [plotSearchQuery, setPlotSearchQuery] = useState('');

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3500);
  };
  const confirmAction = (message: string, onConfirm: () => void, title: string = "Konfirmasi", type: 'danger'|'warning' = 'warning') => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, type });
  };

  // Tutup dropdown jika klik di luar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (examDropdownRef.current && !examDropdownRef.current.contains(event.target as Node)) {
        setShowExamDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ================= 1. FETCH DATA =================
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: settingData } = await supabase.from('pengaturan_aplikasi').select('nama_aplikasi').eq('id', 1).single();
      if (settingData?.nama_aplikasi) setAppName(settingData.nama_aplikasi.replace(/\s+/g, '_'));

      const { data: roomsData, error: roomsErr } = await supabase.from('rooms').select('*').order('room_name', { ascending: true });
      if (roomsErr) throw roomsErr;
      setRooms(roomsData || []);

      const { data: studentsData } = await supabase.from('users').select('id, full_name, student_number, class_group, room_id').eq('role', 'student').order('full_name');
      setStudents(studentsData || []);

      const { data: teachersData } = await supabase.from('users').select('id, full_name, taught_subjects').eq('role', 'proctor').order('full_name');
      setTeachers(teachersData || []);

      const { data: subjectsData } = await supabase.from('subjects').select('*').order('name');
      if (subjectsData) setSubjects(subjectsData as SubjectData[]);

      const { data: examsData } = await supabase.from('exams').select('id, title, subject, grade_level').order('created_at', { ascending: false });
      if (examsData) setExams(examsData as Exam[]);
      
    } catch (err: any) { showToast("Gagal memuat data: " + err.message, "error"); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const getRoomOccupancy = (roomId: string) => students.filter(s => s.room_id === roomId).length;
  const getProctorNames = (ids: string[] | undefined) => {
     if (!ids || ids.length === 0) return '-';
     return ids.map(id => teachers.find(t => t.id === id)?.full_name).filter(Boolean).join(', ');
  };

  // ================= 2. FORM HANDLERS (MASTER RUANG) =================
  const openCreateForm = () => {
    setEditingId(null); setFormData({ room_name: '', capacity: 30, proctor_ids: [], subject: '' }); setProctorSearchQuery(''); setIsFormOpen(true);
  };
  const openEditForm = (room: Room) => {
    setEditingId(room.id); setFormData({ room_name: room.room_name, capacity: room.capacity, proctor_ids: Array.isArray(room.proctor_ids) ? room.proctor_ids : [], subject: room.subject || '' }); setProctorSearchQuery(''); setIsFormOpen(true);
  };

  const handleProctorToggle = (proctorId: string) => {
    setFormData(prev => {
      const current = prev.proctor_ids;
      if (current.includes(proctorId)) return { ...prev, proctor_ids: current.filter(id => id !== proctorId) };
      return { ...prev, proctor_ids: [...current, proctorId] };
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.room_name || !formData.capacity || !formData.subject) { showToast("Kolom Nama Ruangan, Mapel, dan Kapasitas wajib diisi!", "warning"); return; }
    
    const isDuplicate = rooms.some(r => r.room_name.toLowerCase() === formData.room_name.toLowerCase() && (r.subject || '').toLowerCase() === formData.subject.toLowerCase() && r.id !== editingId);
    if (isDuplicate) { showToast("Ruangan dengan Nama & Mapel ini sudah dibuat!", "error"); return; }

    setIsSubmitting(true);
    try {
      const payload = { room_name: formData.room_name, capacity: Number(formData.capacity), proctor_ids: formData.proctor_ids, subject: formData.subject };
      if (editingId) {
        const { error } = await supabase.from('rooms').update(payload).eq('id', editingId);
        if (error) throw error; showToast("Data ruang berhasil diperbarui!", "success");
      } else {
        const { error } = await supabase.from('rooms').insert([payload]);
        if (error) throw error; showToast("Ruang baru berhasil ditambahkan!", "success");
      }
      setIsFormOpen(false); fetchData();
    } catch (err: any) { showToast(err.message, "error"); } finally { setIsSubmitting(false); }
  };

  const handleDelete = (id: string, name: string) => {
    const occupants = getRoomOccupancy(id);
    if (occupants > 0) {
       showToast(`Kosongkan ${occupants} siswa dari ruangan ini terlebih dahulu sebelum menghapus.`, "warning"); return;
    }

    confirmAction(`Apakah Anda yakin ingin menghapus ruangan "${name}"?`, async () => {
      try {
        const { error } = await supabase.from('rooms').delete().eq('id', id);
        if (error) throw error;
        showToast("Ruang ujian berhasil dihapus.", "success");
        setRooms(prev => prev.filter(r => r.id !== id));
      } catch (err: any) { showToast("Gagal menghapus: " + err.message, "error"); }
    }, "Hapus Ruang Ujian", "danger");
  };

  // ================= 3. IMPORT EXCEL (RUANG + GURU + SISWA) =================
  const downloadTemplate = () => {
    const templateData = [
      { Nama_Ruangan: 'Lab Komputer 1', Mata_Pelajaran: 'Matematika - Kelas 10', Kapasitas: 30, Penanggung_Jawab: 'Budi Santoso, Siti Aminah', Daftar_NIS_Siswa: '1001, 1002, 1003' },
      { Nama_Ruangan: 'Lab Komputer 1', Mata_Pelajaran: 'Bahasa Inggris - Kelas 11', Kapasitas: 30, Penanggung_Jawab: 'Ahmad Faisal', Daftar_NIS_Siswa: '1004, 1005' },
      { Nama_Ruangan: 'Ruang 10A', Mata_Pelajaran: 'Biologi - Kelas 12', Kapasitas: 35, Penanggung_Jawab: '', Daftar_NIS_Siswa: '' }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{wch: 25}, {wch: 35}, {wch: 15}, {wch: 40}, {wch: 50}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Ruangan");
    XLSX.writeFile(wb, "Template_Import_Ruangan.xlsx");
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
          const roomName = String(row.Nama_Ruangan || '').trim();
          const subjectName = String(row.Mata_Pelajaran || '').trim();
          
          let proctorIds: string[] = [];
          if (row.Penanggung_Jawab) {
             const names = String(row.Penanggung_Jawab).split(',').map(n => n.trim().toLowerCase());
             teachers.forEach(t => {
                if (names.includes(t.full_name.toLowerCase())) proctorIds.push(t.id);
             });
          }

          let nisList: string[] = [];
          if (row.Daftar_NIS_Siswa) {
             nisList = String(row.Daftar_NIS_Siswa).split(',').map(n => n.trim());
          }

          const isDuplicateInDB = rooms.some(r => r.room_name.toLowerCase() === roomName.toLowerCase() && (r.subject || '').toLowerCase() === subjectName.toLowerCase());

          return {
            room_name: roomName,
            subject: subjectName,
            capacity: Number(row.Kapasitas) || 30,
            proctor_ids: proctorIds,
            nis_list: nisList,
            isDuplicate: isDuplicateInDB
          };
        }).filter(r => r.room_name && r.subject);

        setPreviewData(parsed);
      } catch (err) { showToast("Gagal membaca file Excel. Pastikan format sesuai template.", "error"); }
    };
    reader.readAsBinaryString(file);
  };

  const executeImport = async () => {
    const validData = previewData.filter(d => !d.isDuplicate);
    if (validData.length === 0) { showToast("Tidak ada data valid. Semua sesi ruangan sudah ada.", "error"); return; }
    
    setIsImporting(true);
    try {
      for (const row of validData) {
         const payload = { room_name: row.room_name, subject: row.subject, capacity: row.capacity, proctor_ids: row.proctor_ids };
         const { data: newRoom, error: roomErr } = await supabase.from('rooms').insert([payload]).select('id').single();
         if (roomErr) throw roomErr;

         if (row.nis_list.length > 0 && newRoom) {
            await supabase.from('users').update({ room_id: newRoom.id }).in('student_number', row.nis_list).eq('role', 'student');
         }
      }

      showToast(`${validData.length} Ruangan berhasil dibuat beserta plotting siswanya!`, "success");
      setIsImportOpen(false); setPreviewData([]); setImportFile(null); fetchData();
    } catch (err: any) { showToast("Gagal import: " + err.message, "error"); } finally { setIsImporting(false); }
  };

  // ================= 4. PLOTTING HANDLERS (MASUKKAN SISWA MANUAL) =================
  const handleAssignStudent = async (studentId: string) => {
    if (!activeRoom) return;
    const currentOccupants = getRoomOccupancy(activeRoom.id);
    if (currentOccupants >= activeRoom.capacity) {
       showToast("Kapasitas ruangan sudah penuh!", "warning"); return;
    }
    
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, room_id: activeRoom.id } : s));
    try {
      const { error } = await supabase.from('users').update({ room_id: activeRoom.id }).eq('id', studentId);
      if (error) throw error;
    } catch (err) { showToast("Gagal memindahkan siswa.", "error"); fetchData(); }
  };

  const handleRemoveStudent = async (studentId: string) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, room_id: null } : s));
    try {
      const { error } = await supabase.from('users').update({ room_id: null }).eq('id', studentId);
      if (error) throw error;
    } catch (err) { showToast("Gagal mengeluarkan siswa.", "error"); fetchData(); }
  };

  // ================= 5. DOWNLOAD PDF & EXCEL (RUANG SPESIFIK & GLOBAL) =================
  
  // Fitur Unduh Hadir Ruang Spesifik PDF
  const handleDownloadPDF = (room: Room) => {
    const roomStudents = students.filter(s => s.room_id === room.id).sort((a,b) => a.full_name.localeCompare(b.full_name));
    if (roomStudents.length === 0) { showToast("Ruangan ini masih kosong.", "warning"); return; }

    setIsGeneratingPdf(true);
    const proctorNames = getProctorNames(room.proctor_ids);
    const fileName = `Daftar_Hadir_${room.room_name.replace(/[^a-zA-Z0-9]/g, '_')}_${appName}.pdf`;

    const rowsHtml = roomStudents.map((s, i) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px; text-align:center; color: #64748b;">${i + 1}</td>
        <td style="padding: 12px; font-weight: bold; color: #1e293b;">${s.full_name}</td>
        <td style="padding: 12px; font-family: monospace; text-align:center; color: #0f172a; font-weight: bold;">${s.student_number}</td>
        <td style="padding: 12px; text-align:center; color: #475569;">${s.class_group}</td>
        <td style="padding: 12px;"></td>
      </tr>
    `).join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #0f172a;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
           <h2 style="margin: 0 0 8px 0; font-size: 22px; text-transform: uppercase; color: #1e3a8a;">DAFTAR HADIR PESERTA UJIAN</h2>
           <p style="margin: 4px 0; font-size: 14px; color: #64748b;">MATA PELAJARAN: <b style="color: #0f172a;">${room.subject || '-'}</b></p>
           <p style="margin: 4px 0; font-size: 14px; color: #64748b;">RUANG: <b style="color: #0f172a;">${room.room_name}</b> | KAPASITAS: <b style="color: #0f172a;">${room.capacity} SISWA</b></p>
           <p style="margin: 4px 0; font-size: 14px; color: #64748b;">PENGAWAS: <b style="color: #0f172a;">${proctorNames}</b></p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
           <thead style="background-color: #f8fafc;">
             <tr>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 5%;">No</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; text-align: left;">Nama Lengkap Peserta</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 20%;">NIS / Username</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 15%;">Kelas</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 20%;">Tanda Tangan</th>
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
      html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
    };
    html2pdf().set(opt).from(element).save().then(() => { setIsGeneratingPdf(false); showToast("PDF Daftar Hadir diunduh!", "success"); });
  };

  const handleDownloadExcel = (room: Room) => {
    const roomStudents = students.filter(s => s.room_id === room.id).sort((a,b) => a.full_name.localeCompare(b.full_name));
    if (roomStudents.length === 0) { showToast("Ruangan ini masih kosong.", "warning"); return; }

    const exportData = roomStudents.map((s, idx) => ({
      'No': idx + 1,
      'Nama Ruangan': room.room_name,
      'Mata Pelajaran': room.subject || '-',
      'Penanggung Jawab': getProctorNames(room.proctor_ids),
      'Nama Siswa': s.full_name,
      'NIS / Username': s.student_number || '-',
      'Kelas': s.class_group || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [{wch: 5}, {wch: 20}, {wch: 35}, {wch: 35}, {wch: 35}, {wch: 20}, {wch: 15}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Ruang_${room.room_name}`);
    XLSX.writeFile(wb, `Peserta_${room.room_name.replace(/[^a-zA-Z0-9]/g, '_')}_${appName}.xlsx`);
  };

  // --- PRINT GLOBAL (SELURUH RUANGAN) ---
  const executeDownloadAllExcel = () => {
    if (rooms.length === 0) { showToast("Tidak ada data ruangan untuk diunduh.", "error"); return; }
    
    const exportData = rooms.map((r, idx) => ({
      'No': idx + 1,
      'Nama Ruangan': r.room_name,
      'Mata Pelajaran': r.subject || '-',
      'Penanggung Jawab': getProctorNames(r.proctor_ids),
      'Kapasitas': r.capacity,
      'Terisi': getRoomOccupancy(r.id)
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [{wch: 5}, {wch: 25}, {wch: 35}, {wch: 40}, {wch: 15}, {wch: 15}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Data_Ruangan`);
    XLSX.writeFile(wb, `Data_Sesi_Ruangan_${appName}.xlsx`);
    setIsPrintOptionsOpen(false);
  };

  const executePrintAllPDF = () => {
    if (rooms.length === 0) { showToast("Tidak ada data ruangan untuk dicetak.", "error"); return; }
    
    setIsGeneratingPdf(true);
    const fileName = `Data_Seluruh_Sesi_Ruangan_${appName}.pdf`;

    const rowsHtml = rooms.map((r, i) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px; text-align:center; color: #64748b;">${i + 1}</td>
        <td style="padding: 12px; font-weight: bold; color: #1e293b;">${r.room_name}</td>
        <td style="padding: 12px; color: #475569;">${r.subject || '-'}</td>
        <td style="padding: 12px; color: #0f172a; font-weight: bold;">${getProctorNames(r.proctor_ids)}</td>
        <td style="padding: 12px; text-align:center; color: #475569;">${r.capacity}</td>
        <td style="padding: 12px; text-align:center; font-weight: bold; color: #059669;">${getRoomOccupancy(r.id)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #0f172a;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
           <h2 style="margin: 0 0 8px 0; font-size: 22px; text-transform: uppercase; color: #1e3a8a;">DAFTAR SESI RUANGAN UJIAN CBT</h2>
           <p style="margin: 0; font-size: 14px; color: #64748b;">Rekapitulasi data ruangan, mata pelajaran, dan pengawas bertugas - ${appName.replace(/_/g, ' ')}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
           <thead style="background-color: #f8fafc;">
             <tr>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 5%;">No</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; text-align: left;">Nama Ruangan</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; text-align: left;">Mata Pelajaran</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; text-align: left;">Penanggung Jawab</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 10%;">Kapasitas</th>
               <th style="padding: 15px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 12px; width: 10%;">Terisi</th>
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
      html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
    };
    html2pdf().set(opt).from(element).save().then(() => { 
      setIsGeneratingPdf(false); 
      setIsPrintOptionsOpen(false); 
      showToast("PDF Global Ruangan diunduh!", "success"); 
    });
  };


  // ================= FILTER DATA =================
  const filteredRooms = rooms.filter(r => 
     r.room_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     (r.subject || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredTeachersForModal = teachers.filter(t => t.full_name.toLowerCase().includes(proctorSearchQuery.toLowerCase()));
  const studentsInRoom = students.filter(s => activeRoom && s.room_id === activeRoom.id).sort((a,b) => a.full_name.localeCompare(b.full_name));
  
  const availableStudents = students.filter(s => {
     if (s.room_id !== null) return false; 
     if (!plotSearchQuery) return true;
     return s.full_name.toLowerCase().includes(plotSearchQuery.toLowerCase()) || s.class_group?.toLowerCase().includes(plotSearchQuery.toLowerCase());
  }).sort((a,b) => a.class_group.localeCompare(b.class_group));

  const filteredExamsList = exams.filter(e => 
     e.subject.toLowerCase().includes(examSearchQuery.toLowerCase()) || 
     (e.grade_level || '').toLowerCase().includes(examSearchQuery.toLowerCase())
  );

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 placeholder:font-medium";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 max-w-7xl mx-auto text-slate-900 relative pb-24">
      
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
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm">Batal</button>
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
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Printer className="w-6 h-6 text-blue-600"/> Unduh Data Seluruh Sesi</h3>
                    <p className="text-sm font-medium text-slate-500 mt-1">Pilih format unduhan di bawah.</p>
                  </div>
                  <button onClick={() => setIsPrintOptionsOpen(false)} className="text-slate-400 hover:text-rose-500 bg-white rounded-full p-2 border border-slate-200"><X className="w-5 h-5"/></button>
               </div>
               <div className="p-8 space-y-4">
                  <button onClick={executePrintAllPDF} disabled={isGeneratingPdf} className="w-full flex items-center p-5 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group text-left disabled:opacity-70 disabled:cursor-not-allowed">
                     <div className="w-14 h-14 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shrink-0">
                       {isGeneratingPdf ? <LoaderCircle className="w-6 h-6 animate-spin"/> : <FileText className="w-6 h-6"/>}
                     </div>
                     <div>
                       <h4 className="font-black text-slate-800 text-base">{isGeneratingPdf ? 'Memproses PDF...' : 'Unduh Format PDF'}</h4>
                       <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">Daftar ruangan siap print yang rapi.</p>
                     </div>
                  </button>
                  <button onClick={executeDownloadAllExcel} className="w-full flex items-center p-5 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group text-left">
                     <div className="w-14 h-14 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shrink-0"><FileSpreadsheet className="w-6 h-6"/></div>
                     <div>
                       <h4 className="font-black text-slate-800 text-base">Unduh Format Excel</h4>
                       <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">File rekap mentah untuk pelaporan panitia.</p>
                     </div>
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* ================= MODAL IMPORT EXCEL ================= */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center shrink-0">
               <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><FileUp className="w-6 h-6 text-emerald-500"/> Import Ruangan & Plot Siswa</h3>
               <button onClick={() => {setIsImportOpen(false); setPreviewData([]); setImportFile(null);}} className="p-2 bg-white rounded-full border border-slate-200 text-slate-400 hover:text-rose-500 transition-colors shadow-sm"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto space-y-6">
               <div className="bg-blue-50 border border-blue-100 rounded-[1.5rem] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                     <div className="p-2 bg-blue-100 rounded-full shrink-0 mt-1"><Info className="w-6 h-6 text-blue-600"/></div>
                     <div>
                       <h4 className="font-bold text-blue-900 text-lg mb-1">Panduan Import Sesi Ruangan Sekaligus Siswa</h4>
                       <p className="text-sm text-blue-800/80 mb-3 leading-relaxed font-medium">
                         Sistem akan membuat Ruangan untuk Mapel terkait, mengikat Pengawas, dan <b>Otomatis memindahkan Siswa (berdasarkan NIS) ke sesi ruangan tersebut</b> secara bersamaan.<br/>
                         <span className="text-rose-600 font-medium">Baris merah = Nama Ruangan DAN Mapel sudah ada di database (Akan ditolak).</span>
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
                      <p className="text-sm font-black text-slate-800 flex items-center gap-2"><LayoutList className="w-4 h-4 text-slate-400"/> Preview Data ({previewData.length} Ruangan)</p>
                      <p className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><b className="text-emerald-600">{previewData.filter(d=>!d.isDuplicate).length} Valid</b> • <b className="text-rose-600">{previewData.filter(d=>d.isDuplicate).length} Duplikat</b></p>
                   </div>
                   
                   <div className="overflow-x-auto max-h-80 custom-scrollbar">
                     <table className="w-full text-sm text-left">
                       <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-sm">
                         <tr><th className="p-4 px-6">Nama Ruangan</th><th className="p-4 px-6">Mapel Ujian</th><th className="p-4 px-6">Kapasitas</th><th className="p-4 px-6">Pengawas</th><th className="p-4 px-6">Plot Siswa</th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {previewData.map((r, i) => (
                           <tr key={i} className={r.isDuplicate ? "bg-rose-50/50" : "bg-white hover:bg-slate-50/50"}>
                             <td className={`p-4 px-6 font-bold ${r.isDuplicate ? "text-rose-700" : "text-slate-800"}`}>
                               {r.room_name} {r.isDuplicate && <span className="ml-2 text-[9px] font-black text-rose-500 border border-rose-200 bg-rose-100 px-2 py-0.5 rounded-md">SUDAH ADA</span>}
                             </td>
                             <td className={`p-4 px-6 font-bold ${r.isDuplicate ? "text-rose-600" : "text-blue-700"}`}>{r.subject}</td>
                             <td className="p-4 px-6 font-medium text-slate-700">{r.capacity} Orang</td>
                             <td className="p-4 px-6 font-medium text-blue-600">{r.proctor_ids.length} Guru</td>
                             <td className="p-4 px-6 font-mono font-bold text-emerald-600">{r.nis_list.length} Siswa</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 </div>
               )}
            </div>

            <div className="p-6 md:p-8 border-t border-slate-100 bg-white flex gap-3 shrink-0">
               <button onClick={() => {setIsImportOpen(false); setPreviewData([]); setImportFile(null);}} className="flex-1 py-3.5 bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-sm">Batal</button>
               <button onClick={executeImport} disabled={previewData.filter(d=>!d.isDuplicate).length === 0 || isImporting} className="flex-1 py-3.5 bg-emerald-500 text-white font-bold rounded-xl shadow-md active:scale-95 transition-all disabled:bg-slate-300 flex items-center justify-center gap-2">
                 {isImporting ? <LoaderCircle className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} Import & Eksekusi Plotting
               </button>
            </div>
          </div>
        </div>
      )}


      {/* ================= MODAL FORM TAMBAH/EDIT RUANG ================= */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/80">
               <div>
                 <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                   {editingId ? <Edit3 className="w-5 h-5 text-blue-600"/> : <Plus className="w-5 h-5 text-blue-600"/>} 
                   {editingId ? 'Edit Sesi Ruang Ujian' : 'Tambah Sesi Ruang Baru'}
                 </h2>
               </div>
               <button onClick={() => setIsFormOpen(false)} className="p-2 bg-white text-slate-400 hover:text-rose-500 border border-slate-200 rounded-full transition-colors shadow-sm"><X className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto">
               <div className="p-6 md:p-8 space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div>
                     <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-2"><Building className="w-4 h-4"/> Nama Ruangan Fisik *</label>
                     <input type="text" value={formData.room_name} onChange={e => setFormData({...formData, room_name: e.target.value})} className={inputClass} placeholder="Contoh: Lab Komputer 1" required />
                   </div>
                   <div>
                     <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-2"><Users className="w-4 h-4"/> Kapasitas Siswa *</label>
                     <input type="number" min="1" value={formData.capacity} onChange={e => setFormData({...formData, capacity: Number(e.target.value)})} className={inputClass} placeholder="Contoh: 30" required />
                   </div>
                 </div>

                 {/* OPSI PILIH MATA PELAJARAN UJIAN DARI JADWAL */}
                 <div className="relative" ref={examDropdownRef}>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-2"><BookOpen className="w-4 h-4"/> Jadwal Mata Pelajaran Ujian *</label>
                    <div 
                       onClick={() => setShowExamDropdown(!showExamDropdown)} 
                       className={`${inputClass} flex items-center justify-between cursor-pointer ${showExamDropdown ? 'ring-2 ring-blue-500 bg-white' : ''}`}
                    >
                       <span className={formData.subject ? 'text-slate-800' : 'text-slate-400 font-medium'}>
                          {formData.subject || 'Pilih Jadwal Ujian...'}
                       </span>
                       <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showExamDropdown ? 'rotate-180' : ''}`} />
                    </div>

                    {showExamDropdown && (
                       <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-72">
                          <div className="p-3 border-b border-slate-100 bg-slate-50 sticky top-0">
                             <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                   type="text" 
                                   autoFocus
                                   placeholder="Cari mapel atau kelas..." 
                                   value={examSearchQuery} 
                                   onChange={(e) => setExamSearchQuery(e.target.value)}
                                   className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                                />
                             </div>
                          </div>
                          <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                             {filteredExamsList.length === 0 ? (
                                <p className="p-3 text-center text-xs text-slate-400 font-bold">Jadwal ujian tidak ditemukan.</p>
                             ) : (
                                filteredExamsList.map(exam => {
                                   const relatedSubj = subjects.find(s => s.name.toLowerCase() === exam.subject?.toLowerCase() && s.grade_level?.toLowerCase() === exam.grade_level?.toLowerCase());
                                   const pengampus = teachers.filter(t => t.taught_subjects?.includes(relatedSubj?.id || ''));
                                   const pengampuText = pengampus.length > 0 ? pengampus.map(t => t.full_name).join(', ') : 'Belum ditentukan';

                                   return (
                                      <div 
                                         key={exam.id}
                                         onClick={() => {
                                            setFormData({ ...formData, subject: `${exam.subject} - Kelas ${exam.grade_level}` });
                                            setShowExamDropdown(false);
                                            setExamSearchQuery('');
                                         }}
                                         className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer border border-transparent hover:border-blue-100 transition-colors"
                                      >
                                         <p className="font-bold text-slate-800 text-sm">{exam.subject}</p>
                                         <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                            <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{exam.grade_level || 'Umum'}</span>
                                            <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded truncate max-w-[200px]"><UserCircle2 className="w-3 h-3 inline mr-1 -mt-0.5"/> {pengampuText}</span>
                                         </div>
                                      </div>
                                   );
                                })
                             )}
                          </div>
                       </div>
                    )}
                 </div>
                 
                 {/* OPSI PENGAWAS RUANGAN DENGAN SEARCH */}
                 <div className="bg-blue-50/30 border border-blue-100 rounded-2xl p-5 mt-4 shadow-sm">
                    <label className="text-xs font-black text-blue-600 uppercase tracking-widest block mb-3 flex items-center justify-between">
                       <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4"/> Pengawas Sesi Ini</span>
                       <span className="text-[10px] bg-white text-blue-700 px-2 py-1 rounded-md border border-blue-200">{formData.proctor_ids.length} Dipilih</span>
                    </label>
                    <p className="text-xs text-blue-800/70 font-medium mb-3">Cari dan centang guru yang bertugas mengawasi ruangan ini.</p>
                    
                    {/* SEARCH BAR GURU */}
                    <div className="relative mb-3">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <input 
                          type="text" placeholder="Cari nama pengawas..." 
                          value={proctorSearchQuery} onChange={e => setProctorSearchQuery(e.target.value)} 
                          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all" 
                       />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                       {teachers.length === 0 ? (
                          <p className="text-xs italic text-slate-400 col-span-2 bg-white p-3 rounded-xl border border-slate-200">Belum ada data guru/pengawas di sistem.</p>
                       ) : filteredTeachersForModal.length === 0 ? (
                          <p className="text-xs italic text-slate-400 col-span-2">Pengawas tidak ditemukan.</p>
                       ) : (
                          filteredTeachersForModal.map(teacher => (
                             <label key={teacher.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.proctor_ids.includes(teacher.id) ? 'bg-white border-blue-500 shadow-sm' : 'bg-white/50 border-slate-200 hover:border-blue-300'}`}>
                               <input type="checkbox" checked={formData.proctor_ids.includes(teacher.id)} onChange={() => handleProctorToggle(teacher.id)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer" />
                               <span className={`text-sm font-bold leading-tight ${formData.proctor_ids.includes(teacher.id) ? 'text-blue-800' : 'text-slate-600'}`}>{teacher.full_name}</span>
                             </label>
                          ))
                       )}
                    </div>
                 </div>
               </div>
               
               <div className="p-6 md:p-8 border-t border-slate-100 bg-white flex gap-3 shrink-0">
                 <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-3.5 bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-sm">Batal</button>
                 <button type="submit" disabled={isSubmitting} className="flex-1 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2">
                   {isSubmitting ? <LoaderCircle className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} Simpan Sesi Ruangan
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}


      {/* ================= AREA KONTEN UTAMA ================= */}
      {viewMode === 'master' ? (
         // --- TAMPILAN 1: MASTER RUANGAN ---
         <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:px-8 md:py-6 rounded-[2rem] border border-blue-100 shadow-sm">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-3">
                  <Building className="w-8 h-8 text-blue-600" /> Sesi Ruang Ujian
                </h1>
                <p className="text-slate-500 text-sm mt-1 font-medium ml-11">Kelola sesi ruangan berdasarkan mata pelajaran dan pengawas yang bertugas.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setIsImportOpen(true)} className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-6 py-3 rounded-xl font-bold text-sm shadow-sm transition-colors w-full md:w-auto"><FileUp className="w-5 h-5 text-emerald-500" /> Import Massal</button>
                <button onClick={openCreateForm} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md shadow-blue-200 active:scale-95 transition-all w-full md:w-auto"><Plus className="w-5 h-5" /> Tambah Sesi Ruangan</button>
              </div>
            </div>

            {/* SEARCH BAR & TOMBOL CETAK RUANGAN GLOBAL */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 mt-2">
              <div className="relative w-full max-w-xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="text" placeholder="Cari berdasarkan nama ruangan atau mapel..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-[1.5rem] pl-12 pr-4 py-3.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all placeholder-slate-400" />
              </div>
              <button onClick={() => setIsPrintOptionsOpen(true)} className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-blue-700 border border-slate-200 hover:border-blue-200 px-6 py-3.5 rounded-[1.5rem] font-bold text-sm shadow-sm transition-colors shrink-0">
                 <Download className="w-5 h-5 text-blue-600" /> Unduh Seluruh Sesi
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-500">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-black uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-5 w-16 text-center">No</th>
                      <th className="px-8 py-5">Nama Ruangan & Mapel</th>
                      <th className="px-8 py-5">Pengawas Bertugas</th>
                      <th className="px-8 py-5 text-center">Isi / Kapasitas</th>
                      <th className="px-8 py-5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr><td colSpan={5} className="py-24 text-center"><LoaderCircle className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-3" /><p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Memuat data ruangan...</p></td></tr>
                    ) : filteredRooms.length === 0 ? (
                      <tr><td colSpan={5} className="py-24 text-center"><div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 mb-4"><Building className="w-10 h-10 text-slate-300" /></div><p className="text-slate-500 font-bold text-lg">Data ruangan tidak ditemukan.</p></td></tr>
                    ) : (
                      filteredRooms.map((room, idx) => {
                        const occupants = getRoomOccupancy(room.id);
                        const isFull = occupants >= room.capacity;

                        return (
                          <tr key={room.id} className="hover:bg-blue-50/30 transition-colors group">
                            <td className="px-8 py-5 text-center font-black text-slate-400">{idx + 1}</td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 rounded-[1.2rem] bg-blue-50 text-blue-600 flex items-center justify-center font-black border border-blue-100 shadow-sm shrink-0">
                                    <Building className="w-6 h-6"/>
                                 </div>
                                 <div>
                                   <p className="font-black text-slate-800 text-base leading-tight mb-1">{room.room_name}</p>
                                   <span className="inline-flex items-center gap-1.5 text-[10px] font-black bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-md border border-emerald-200 uppercase tracking-widest">
                                      <BookOpen className="w-3 h-3"/> {room.subject || 'Belum Diatur'}
                                   </span>
                                 </div>
                              </div>
                            </td>
                            
                            <td className="px-8 py-5">
                               <div className="flex flex-wrap gap-1.5 max-w-[250px]">
                                  {(!room.proctor_ids || room.proctor_ids.length === 0) ? (
                                     <span className="text-xs text-slate-400 italic font-bold">Belum ditentukan</span>
                                  ) : (
                                     room.proctor_ids.map(pId => {
                                        const teacher = teachers.find(t => t.id === pId);
                                        if (!teacher) return null;
                                        return (
                                           <span key={pId} className="inline-flex items-center gap-1 text-[10px] font-black bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-md border border-indigo-200 uppercase tracking-widest">
                                              <ShieldCheck className="w-3 h-3"/> {teacher.full_name}
                                           </span>
                                        );
                                     })
                                  )}
                               </div>
                            </td>

                            <td className="px-8 py-5 text-center">
                               <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black border uppercase tracking-widest ${isFull ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                 <Users className="w-4 h-4"/> {occupants} / {room.capacity}
                               </span>
                            </td>
                            <td className="px-8 py-5 text-right">
                              {/* PERBAIKAN: Tombol selalu tampil dengan desain melingkar (rounded-full) */}
                              <div className="flex items-center justify-end gap-2 transition-opacity">
                                <button onClick={() => {setActiveRoom(room); setViewMode('plotting'); setPlotSearchQuery('');}} className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all shadow-md flex items-center justify-center" title="Atur Siswa di Ruangan Ini">
                                   <UserPlus className="w-4 h-4"/>
                                </button>
                                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                                <button onClick={() => handleDownloadPDF(room)} disabled={isGeneratingPdf} className="p-2.5 bg-white hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-full transition-all border border-slate-200 hover:border-blue-200 shadow-sm disabled:opacity-50" title="Unduh PDF Daftar Hadir">
                                   {isGeneratingPdf ? <LoaderCircle className="w-4 h-4 animate-spin"/> : <FileText className="w-4 h-4"/>}
                                </button>
                                <button onClick={() => handleDownloadExcel(room)} className="p-2.5 bg-white hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-full transition-all border border-slate-200 hover:border-emerald-200 shadow-sm" title="Unduh Excel"><FileSpreadsheet className="w-4 h-4"/></button>
                                <button onClick={() => openEditForm(room)} className="p-2.5 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full transition-all border border-slate-200 shadow-sm" title="Edit Sesi Ruangan"><Edit3 className="w-4 h-4"/></button>
                                <button onClick={() => handleDelete(room.id, room.room_name)} className="p-2.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-full transition-all border border-slate-200 hover:border-rose-200 shadow-sm" title="Hapus Ruangan"><Trash2 className="w-4 h-4"/></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
         </>
      ) : (

         // --- TAMPILAN 2: MODE PLOTTING (ATUR SISWA DALAM RUANGAN) ---
         <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <button onClick={() => setViewMode('master')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-200 px-5 py-2.5 rounded-xl transition-all w-fit shadow-sm">
              <ArrowLeft className="w-4 h-4" /> Kembali ke Manajemen Sesi Ruangan
            </button>

            {activeRoom && (
              <div className="rounded-[2.5rem] p-8 md:p-10 shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-gradient-to-br from-blue-600 to-indigo-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-center gap-5 relative z-10">
                  <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 shrink-0">
                    <Building className="w-8 h-8 text-white"/>
                  </div>
                  <div>
                    <p className="font-bold text-white/80 text-xs uppercase tracking-widest mb-1.5">Penempatan Peserta - {activeRoom.subject || 'Mapel Umum'}</p>
                    <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">{activeRoom.room_name}</h2>
                  </div>
                </div>
                <div className="flex flex-col items-end relative z-10">
                   <span className="text-xs font-bold text-white/80 uppercase tracking-widest mb-1.5">Kapasitas Terisi</span>
                   <div className="bg-white/20 px-5 py-2.5 rounded-xl backdrop-blur-md border border-white/30 text-white">
                      <span className="text-2xl font-black">{getRoomOccupancy(activeRoom.id)}</span><span className="text-sm font-bold ml-1">/ {activeRoom.capacity} Siswa</span>
                   </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               
               {/* BAGIAN KIRI: DAFTAR SISWA YANG BISA DIMASUKKAN */}
               <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm flex flex-col h-[700px] overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
                     <div>
                       <h3 className="font-black text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-blue-600"/> Siswa Belum Dapat Sesi</h3>
                       <p className="text-xs font-medium text-slate-500 mt-1">Pilih siswa untuk dimasukkan ke sesi ini.</p>
                     </div>
                     <span className="bg-blue-100 text-blue-700 font-black text-xs px-3 py-1.5 rounded-lg">{availableStudents.length} Siswa</span>
                  </div>
                  <div className="p-5 shrink-0 border-b border-slate-100">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" placeholder="Cari nama atau kelas siswa..." value={plotSearchQuery} onChange={(e) => setPlotSearchQuery(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-400" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-slate-50/30">
                     {availableStudents.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                           <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 mb-4"><CheckCircle2 className="w-10 h-10 text-slate-300"/></div>
                           <p className="font-bold text-slate-500">Semua siswa sudah di-plot ke ruangan.</p>
                        </div>
                     ) : (
                        <div className="space-y-1.5">
                           {availableStudents.map(student => (
                              <div key={student.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 transition-all shadow-sm">
                                 <div>
                                   <p className="font-black text-slate-800 text-sm leading-tight mb-1">{student.full_name}</p>
                                   <div className="flex gap-2 mt-1">
                                      <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">NIS: {student.student_number}</span>
                                      <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100">{student.class_group}</span>
                                   </div>
                                 </div>
                                 <button onClick={() => handleAssignStudent(student.id)} disabled={getRoomOccupancy(activeRoom?.id || '') >= (activeRoom?.capacity || 0)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-blue-600 hover:text-white border border-slate-200 hover:border-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                                    <Plus className="w-5 h-5"/>
                                 </button>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </div>

               {/* BAGIAN KANAN: DAFTAR SISWA DI DALAM RUANGAN INI */}
               <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm flex flex-col h-[700px] overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-emerald-50/50 flex items-center justify-between shrink-0">
                     <div>
                       <h3 className="font-black text-slate-800 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600"/> Peserta di Sesi Ini</h3>
                       <p className="text-xs font-medium text-slate-500 mt-1">Siswa yang telah di-plot ke {activeRoom?.room_name}.</p>
                     </div>
                     <span className="bg-emerald-100 text-emerald-700 font-black text-xs px-3 py-1.5 rounded-lg border border-emerald-200">{studentsInRoom.length} Siswa</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-slate-50/30">
                     {studentsInRoom.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                           <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 mb-4"><Users className="w-10 h-10 text-slate-300"/></div>
                           <p className="font-bold text-slate-500">Sesi Ruangan ini masih kosong.</p>
                           <p className="text-xs font-medium mt-1">Pindahkan siswa dari daftar di sebelah kiri.</p>
                        </div>
                     ) : (
                        <div className="space-y-1.5">
                           {studentsInRoom.map((student, idx) => (
                              <div key={student.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-rose-300 transition-all group animate-in fade-in slide-in-from-left-2">
                                 <div className="flex items-center gap-4">
                                   <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-xs shrink-0">{idx + 1}</div>
                                   <div>
                                     <p className="font-black text-slate-800 text-sm leading-tight mb-1">{student.full_name}</p>
                                     <div className="flex gap-2 mt-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">NIS: {student.student_number}</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100">{student.class_group}</span>
                                     </div>
                                   </div>
                                 </div>
                                 {/* PERBAIKAN: Tombol selalu tampil dengan desain melingkar */}
                                 <button onClick={() => handleRemoveStudent(student.id)} title="Keluarkan dari ruangan" className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-slate-400 hover:bg-rose-600 hover:text-white hover:border-rose-600 border border-slate-200 transition-colors shadow-sm">
                                    <UserMinus className="w-5 h-5"/>
                                 </button>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
                  {/* Footer Aksi Ruangan */}
                  <div className="p-6 border-t border-slate-100 bg-white shrink-0 grid grid-cols-2 gap-4">
                     <button onClick={() => handleDownloadPDF(activeRoom!)} disabled={isGeneratingPdf} className="flex items-center justify-center gap-2 py-3.5 bg-white border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold rounded-xl transition-all text-sm disabled:opacity-50">
                        {isGeneratingPdf ? <LoaderCircle className="w-5 h-5 animate-spin"/> : <FileText className="w-5 h-5"/>} 
                        {isGeneratingPdf ? 'Memproses...' : 'Unduh PDF Hadir'}
                     </button>
                     <button onClick={() => handleDownloadExcel(activeRoom!)} className="flex items-center justify-center gap-2 py-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl transition-colors text-sm border border-emerald-200 shadow-sm"><FileSpreadsheet className="w-5 h-5"/> Unduh Excel</button>
                  </div>
               </div>

            </div>
         </div>
      )}

    </div>
  );
}