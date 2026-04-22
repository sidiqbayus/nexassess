'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { 
  Search, CheckCircle2, LoaderCircle, Building, Users, 
  AlertTriangle, ArrowLeft, Printer, FileSpreadsheet, ShieldCheck, 
  Download, FileText, BookOpen, X
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

export default function TeacherRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]); 
  const [subjects, setSubjects] = useState<SubjectData[]>([]); 
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [appName, setAppName] = useState('CBT_App');
  
  // Custom Modals & Toasts
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Print Global State
  const [isPrintOptionsOpen, setIsPrintOptionsOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Mode Plotting (Hanya Lihat Siswa)
  const [viewMode, setViewMode] = useState<'master' | 'plotting'>('master');
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [plotSearchQuery, setPlotSearchQuery] = useState('');

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3500);
  };

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

    } catch (err: any) { showToast("Gagal memuat data: " + err.message, "error"); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const getRoomOccupancy = (roomId: string) => students.filter(s => s.room_id === roomId).length;
  const getProctorNames = (ids: string[] | undefined) => {
      if (!ids || ids.length === 0) return '-';
      return ids.map(id => teachers.find(t => t.id === id)?.full_name).filter(Boolean).join(', ');
  };

  // ================= 2. DOWNLOAD PDF & EXCEL (RUANG SPESIFIK & GLOBAL) =================
  
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
  
  const studentsInRoom = students.filter(s => activeRoom && s.room_id === activeRoom.id).sort((a,b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 max-w-7xl mx-auto text-slate-900 relative pb-24">
      
      {/* ================= TOAST NOTIFICATION ELEGAN ================= */}
      {toast && (
        <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-top-10 w-[90%] max-w-sm sm:w-auto">
          <div className={`px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] shadow-2xl flex items-center gap-2 md:gap-3 border backdrop-blur-sm ${
             toast.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-700' : 
             toast.type === 'warning' ? 'bg-amber-50/95 border-amber-200 text-amber-700' : 'bg-rose-50/95 border-rose-200 text-rose-700'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 shrink-0 text-emerald-500" /> : <AlertTriangle className={`w-4 h-4 md:w-5 md:h-5 shrink-0 ${toast.type === 'warning' ? 'text-amber-500' : 'text-rose-500'}`} />}
            <p className="font-bold text-xs md:text-sm tracking-wide leading-snug">{toast.message}</p>
          </div>
        </div>
      )}

      {/* ================= MODAL PILIHAN FORMAT CETAK ================= */}
      {isPrintOptionsOpen && (
         <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-sm md:max-w-md rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-100">
               <div className="p-4 md:p-6 border-b border-slate-100 flex items-start sm:items-center justify-between bg-slate-50 gap-2">
                  <div className="min-w-0">
                    <h3 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2 truncate"><Printer className="w-5 h-5 md:w-6 md:h-6 text-blue-600 shrink-0"/> <span className="truncate">Unduh Data Seluruh Sesi</span></h3>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mt-1 hidden sm:block">Pilih format unduhan di bawah.</p>
                  </div>
                  <button onClick={() => setIsPrintOptionsOpen(false)} className="text-slate-400 hover:text-rose-500 bg-white rounded-full p-1.5 md:p-2 border border-slate-200 shrink-0 shadow-sm transition-colors"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
               </div>
               <div className="p-5 sm:p-6 md:p-8 space-y-3 md:space-y-4">
                  <button onClick={executePrintAllPDF} disabled={isGeneratingPdf} className="w-full flex items-center p-3 md:p-5 rounded-xl md:rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group text-left disabled:opacity-70 disabled:cursor-not-allowed">
                     <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mr-3 md:mr-4 group-hover:scale-110 transition-transform shrink-0">
                       {isGeneratingPdf ? <LoaderCircle className="w-5 h-5 md:w-6 md:h-6 animate-spin"/> : <FileText className="w-5 h-5 md:w-6 md:h-6"/>}
                     </div>
                     <div>
                       <h4 className="font-black text-slate-800 text-sm md:text-base">{isGeneratingPdf ? 'Memproses PDF...' : 'Unduh Format PDF'}</h4>
                       <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5 md:mt-1 leading-snug">Daftar ruangan siap print yang rapi.</p>
                     </div>
                  </button>
                  <button onClick={executeDownloadAllExcel} className="w-full flex items-center p-3 md:p-5 rounded-xl md:rounded-2xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group text-left">
                     <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mr-3 md:mr-4 group-hover:scale-110 transition-transform shrink-0"><FileSpreadsheet className="w-5 h-5 md:w-6 md:h-6"/></div>
                     <div>
                       <h4 className="font-black text-slate-800 text-sm md:text-base">Unduh Format Excel</h4>
                       <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5 md:mt-1 leading-snug">File rekap mentah untuk pelaporan panitia.</p>
                     </div>
                  </button>
               </div>
            </div>
         </div>
      )}


      {/* ================= AREA KONTEN UTAMA ================= */}
      {viewMode === 'master' ? (
         // --- TAMPILAN 1: MASTER RUANGAN ---
         <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 bg-white p-4 sm:p-5 md:px-8 md:py-6 rounded-2xl md:rounded-[2rem] border border-blue-100 shadow-sm">
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2 md:gap-3">
                  <Building className="w-6 h-6 md:w-8 md:h-8 text-blue-600" /> Ruang Ujian
                </h1>
                <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium md:ml-11">Lihat dan pantau daftar sesi ruangan beserta pengawasnya.</p>
              </div>
            </div>

            {/* SEARCH BAR & TOMBOL CETAK RUANGAN GLOBAL */}
            <div className="flex flex-col sm:flex-row justify-between gap-3 md:gap-4 mt-2">
              <div className="relative w-full max-w-xl">
                <Search className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                <input type="text" placeholder="Cari berdasarkan nama ruangan atau mapel..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] pl-10 md:pl-12 pr-4 py-3 md:py-3.5 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all placeholder-slate-400" />
              </div>
              <button onClick={() => setIsPrintOptionsOpen(true)} className="flex items-center justify-center gap-1.5 md:gap-2 bg-white hover:bg-slate-50 text-blue-700 border border-slate-200 hover:border-blue-200 px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] font-bold text-xs md:text-sm shadow-sm transition-colors shrink-0 w-full sm:w-auto">
                 <Download className="w-4 h-4 md:w-5 md:h-5 text-blue-600" /> Unduh Seluruh Sesi
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-500">
              <div className="overflow-x-auto">
                {/* Tabel disembunyikan pada layar mobile (md:max), diganti dengan layout flex-col */}
                <table className="w-full text-sm text-left hidden md:table">
                  <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-black uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 lg:px-8 py-4 md:py-5 w-16 text-center">No</th>
                      <th className="px-6 lg:px-8 py-4 md:py-5">Nama Ruangan & Mapel</th>
                      <th className="px-6 lg:px-8 py-4 md:py-5">Pengawas Bertugas</th>
                      <th className="px-6 lg:px-8 py-4 md:py-5 text-center">Isi / Kapasitas</th>
                      <th className="px-6 lg:px-8 py-4 md:py-5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr><td colSpan={5} className="py-20 md:py-24 text-center"><LoaderCircle className="w-8 h-8 md:w-10 md:h-10 text-blue-500 animate-spin mx-auto mb-3" /><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] md:text-xs">Memuat data ruangan...</p></td></tr>
                    ) : filteredRooms.length === 0 ? (
                      <tr><td colSpan={5} className="py-20 md:py-24 text-center"><div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 mb-3 md:mb-4"><Building className="w-8 h-8 md:w-10 md:h-10 text-slate-300" /></div><p className="text-slate-500 font-bold text-sm md:text-lg">Data ruangan tidak ditemukan.</p></td></tr>
                    ) : (
                      filteredRooms.map((room, idx) => {
                        const occupants = getRoomOccupancy(room.id);
                        const isFull = occupants >= room.capacity;

                        return (
                          <tr key={room.id} className="hover:bg-blue-50/30 transition-colors group">
                            <td className="px-6 lg:px-8 py-4 md:py-5 text-center font-black text-slate-400">{idx + 1}</td>
                            <td className="px-6 lg:px-8 py-4 md:py-5">
                              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                                 <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-[1.2rem] bg-blue-50 text-blue-600 flex items-center justify-center font-black border border-blue-100 shadow-sm shrink-0">
                                    <Building className="w-5 h-5 md:w-6 md:h-6"/>
                                 </div>
                                 <div className="min-w-0">
                                   <p className="font-black text-slate-800 text-sm md:text-base leading-tight mb-1 truncate">{room.room_name}</p>
                                   <span className="inline-flex items-center gap-1 md:gap-1.5 text-[9px] md:text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 md:px-2.5 py-0.5 md:py-1 rounded-md border border-emerald-200 uppercase tracking-widest whitespace-nowrap">
                                      <BookOpen className="w-3 h-3"/> {room.subject || 'Belum Diatur'}
                                   </span>
                                 </div>
                              </div>
                            </td>
                            
                            <td className="px-6 lg:px-8 py-4 md:py-5">
                               <div className="flex flex-wrap gap-1.5 max-w-[200px] lg:max-w-[250px]">
                                  {(!room.proctor_ids || room.proctor_ids.length === 0) ? (
                                     <span className="text-[10px] md:text-xs text-slate-400 italic font-bold">Belum ditentukan</span>
                                  ) : (
                                     room.proctor_ids.map(pId => {
                                        const teacher = teachers.find(t => t.id === pId);
                                        if (!teacher) return null;
                                        return (
                                           <span key={pId} className="inline-flex items-center gap-1 text-[9px] md:text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 md:px-2.5 py-0.5 md:py-1 rounded-md border border-indigo-200 uppercase tracking-widest whitespace-nowrap">
                                              <ShieldCheck className="w-2.5 h-2.5 md:w-3 md:h-3"/> {teacher.full_name}
                                           </span>
                                        );
                                     })
                                  )}
                               </div>
                            </td>

                            <td className="px-6 lg:px-8 py-4 md:py-5 text-center">
                               <span className={`inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-[11px] font-black border uppercase tracking-widest whitespace-nowrap ${isFull ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                 <Users className="w-3 h-3 md:w-4 md:h-4"/> {occupants} / {room.capacity}
                               </span>
                            </td>
                            <td className="px-6 lg:px-8 py-4 md:py-5 text-right">
                              {/* PERBAIKAN UNTUK GURU: HANYA TOMBOL LIHAT SISWA DAN DOWNLOAD */}
                              <div className="flex items-center justify-end gap-1.5 md:gap-2 transition-opacity">
                                <button onClick={() => {setActiveRoom(room); setViewMode('plotting'); setPlotSearchQuery('');}} className="p-2 md:p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all shadow-md flex items-center justify-center shrink-0" title="Lihat Siswa di Ruangan Ini">
                                   <Users className="w-3.5 h-3.5 md:w-4 md:h-4"/>
                                </button>
                                <div className="w-px h-5 md:h-6 bg-slate-200 mx-0.5 md:mx-1"></div>
                                <button onClick={() => handleDownloadPDF(room)} disabled={isGeneratingPdf} className="p-2 md:p-2.5 bg-white hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-full transition-all border border-slate-200 hover:border-blue-200 shadow-sm disabled:opacity-50 shrink-0" title="Unduh PDF Daftar Hadir">
                                   {isGeneratingPdf ? <LoaderCircle className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin"/> : <FileText className="w-3.5 h-3.5 md:w-4 md:h-4"/>}
                                </button>
                                <button onClick={() => handleDownloadExcel(room)} className="p-2 md:p-2.5 bg-white hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-full transition-all border border-slate-200 hover:border-emerald-200 shadow-sm shrink-0" title="Unduh Excel"><FileSpreadsheet className="w-3.5 h-3.5 md:w-4 md:h-4"/></button>
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
                    <div className="py-16 text-center">
                       <LoaderCircle className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
                       <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Memuat data ruangan...</p>
                    </div>
                  ) : filteredRooms.length === 0 ? (
                    <div className="py-16 text-center px-4">
                       <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 mb-3"><Building className="w-8 h-8 text-slate-300" /></div>
                       <p className="text-slate-500 font-bold text-sm">Data ruangan tidak ditemukan.</p>
                    </div>
                  ) : (
                    filteredRooms.map((room, idx) => {
                      const occupants = getRoomOccupancy(room.id);
                      const isFull = occupants >= room.capacity;

                      return (
                        <div key={room.id} className="p-4 flex flex-col gap-3 hover:bg-blue-50/30 transition-colors">
                           <div className="flex items-start gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black border border-blue-100 shadow-sm shrink-0 mt-0.5">
                                 <Building className="w-5 h-5"/>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-slate-800 text-sm leading-tight mb-1.5 truncate">{room.room_name}</p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                   <span className="inline-flex items-center gap-1 text-[8px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-widest whitespace-nowrap">
                                      <BookOpen className="w-2.5 h-2.5"/> {room.subject || 'Belum Diatur'}
                                   </span>
                                   <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-widest whitespace-nowrap ${isFull ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                     <Users className="w-2.5 h-2.5"/> {occupants}/{room.capacity}
                                   </span>
                                </div>
                              </div>
                           </div>
                           
                           <div className="flex flex-col gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Pengawas:</span>
                             <div className="flex flex-wrap gap-1.5">
                                {(!room.proctor_ids || room.proctor_ids.length === 0) ? (
                                   <span className="text-[10px] text-slate-400 italic font-bold">Belum ditentukan</span>
                                ) : (
                                   room.proctor_ids.map(pId => {
                                      const teacher = teachers.find(t => t.id === pId);
                                      if (!teacher) return null;
                                      return (
                                         <span key={pId} className="inline-flex items-center gap-1 text-[9px] font-bold bg-white text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 whitespace-nowrap">
                                            {teacher.full_name}
                                         </span>
                                      );
                                   })
                                )}
                             </div>
                           </div>

                           <div className="flex items-center justify-end gap-2 mt-1">
                              <button onClick={() => handleDownloadPDF(room)} disabled={isGeneratingPdf} className="flex-1 sm:flex-none p-2.5 bg-white hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-xl transition-all border border-slate-200 hover:border-blue-200 shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 text-[10px] font-bold">
                                 {isGeneratingPdf ? <LoaderCircle className="w-3.5 h-3.5 animate-spin"/> : <FileText className="w-3.5 h-3.5"/>} PDF Hadir
                              </button>
                              <button onClick={() => handleDownloadExcel(room)} className="flex-1 sm:flex-none p-2.5 bg-white hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 rounded-xl transition-all border border-slate-200 hover:border-emerald-200 shadow-sm flex items-center justify-center gap-1.5 text-[10px] font-bold">
                                 <FileSpreadsheet className="w-3.5 h-3.5"/> Excel
                              </button>
                              <button onClick={() => {setActiveRoom(room); setViewMode('plotting'); setPlotSearchQuery('');}} className="flex-1 sm:flex-none p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 text-[10px] font-bold">
                                 <Users className="w-3.5 h-3.5"/> Siswa
                              </button>
                           </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            </div>
         </>
      ) : (

         // --- TAMPILAN 2: MODE PLOTTING (HANYA LIHAT DAFTAR SISWA RUANGAN) ---
         <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <button onClick={() => setViewMode('master')} className="flex items-center justify-center sm:justify-start gap-1.5 md:gap-2 text-xs md:text-sm font-bold text-slate-500 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-200 px-4 md:px-5 py-2.5 md:py-2.5 rounded-xl transition-all w-full sm:w-fit shadow-sm">
              <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Kembali ke Daftar Ruangan</span><span className="sm:hidden">Kembali</span>
            </button>

            {activeRoom && (
              <div className="rounded-2xl md:rounded-[2.5rem] p-5 sm:p-6 md:p-10 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 bg-gradient-to-br from-blue-600 to-indigo-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 md:w-40 md:h-40 bg-white opacity-10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-start md:items-center gap-3 md:gap-5 relative z-10 w-full md:w-auto">
                  <div className="p-3 md:p-4 bg-white/20 backdrop-blur-md rounded-xl md:rounded-2xl border border-white/20 shrink-0">
                    <Building className="w-6 h-6 md:w-8 md:h-8 text-white"/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white/80 text-[10px] md:text-xs uppercase tracking-widest mb-0.5 md:mb-1.5 truncate">Peserta - {activeRoom.subject || 'Umum'}</p>
                    <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight truncate leading-tight">{activeRoom.room_name}</h2>
                  </div>
                </div>
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto relative z-10 bg-white/10 md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none">
                   <span className="text-[10px] md:text-xs font-bold text-white/80 uppercase tracking-widest mb-0 md:mb-1.5">Kapasitas</span>
                   <div className="md:bg-white/20 md:px-5 md:py-2.5 md:rounded-xl md:backdrop-blur-md md:border md:border-white/30 text-white">
                      <span className="text-lg md:text-2xl font-black">{getRoomOccupancy(activeRoom.id)}</span><span className="text-xs md:text-sm font-bold ml-1">/ {activeRoom.capacity}</span>
                   </div>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] shadow-sm flex flex-col h-[500px] sm:h-[600px] md:h-[700px] overflow-hidden">
               <div className="p-4 md:p-6 border-b border-slate-100 bg-emerald-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                 <div>
                   <h3 className="font-black text-slate-800 flex items-center gap-1.5 md:gap-2 text-sm md:text-base"><CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-600"/> Peserta di Sesi Ini</h3>
                   <p className="text-[10px] md:text-xs font-medium text-slate-500 mt-0.5 md:mt-1">Daftar siswa yang berada di ruangan {activeRoom?.room_name}. (Hanya Mode Baca)</p>
                 </div>
                 <span className="bg-emerald-100 text-emerald-700 font-black text-[10px] md:text-xs px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg border border-emerald-200 self-start sm:self-auto">{studentsInRoom.length} Siswa</span>
               </div>
               <div className="flex-1 overflow-y-auto p-4 md:p-5 custom-scrollbar bg-slate-50/30">
                  {studentsInRoom.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-400 p-4 md:p-6 text-center">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 mb-3 md:mb-4"><Users className="w-8 h-8 md:w-10 md:h-10 text-slate-300"/></div>
                        <p className="font-bold text-slate-500 text-sm md:text-base">Sesi Ruangan ini masih kosong.</p>
                     </div>
                  ) : (
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        {studentsInRoom.map((student, idx) => (
                           <div key={student.id} className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-white border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-[10px] md:text-xs shrink-0 border border-emerald-100">{idx + 1}</div>
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-slate-800 text-xs md:text-sm leading-tight mb-1 truncate">{student.full_name}</p>
                                <div className="flex gap-1.5 md:gap-2 mt-0.5 md:mt-1">
                                   <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-1.5 md:px-2 py-0.5 rounded border border-slate-200 truncate max-w-[80px] md:max-w-none">NIS: {student.student_number}</span>
                                   <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 px-1.5 md:px-2 py-0.5 rounded border border-indigo-100 whitespace-nowrap">{student.class_group}</span>
                                </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
               {/* Footer Aksi Ruangan */}
               <div className="p-4 md:p-6 border-t border-slate-100 bg-white shrink-0 flex flex-col sm:flex-row justify-end gap-2.5 md:gap-4">
                  <button onClick={() => handleDownloadPDF(activeRoom!)} disabled={isGeneratingPdf} className="flex items-center justify-center gap-1.5 md:gap-2 py-3 md:py-3.5 px-4 md:px-6 bg-white border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold rounded-xl transition-all text-xs md:text-sm disabled:opacity-50 w-full sm:w-auto">
                     {isGeneratingPdf ? <LoaderCircle className="w-4 h-4 md:w-5 md:h-5 animate-spin"/> : <FileText className="w-4 h-4 md:w-5 md:h-5"/>} 
                     {isGeneratingPdf ? 'Memproses...' : 'Unduh PDF Hadir'}
                  </button>
                  <button onClick={() => handleDownloadExcel(activeRoom!)} className="flex items-center justify-center gap-1.5 md:gap-2 py-3 md:py-3.5 px-4 md:px-6 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl transition-colors text-xs md:text-sm border border-emerald-200 shadow-sm w-full sm:w-auto">
                     <FileSpreadsheet className="w-4 h-4 md:w-5 md:h-5"/> Unduh Excel
                  </button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}