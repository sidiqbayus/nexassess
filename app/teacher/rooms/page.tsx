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


      {/* ================= AREA KONTEN UTAMA ================= */}
      {viewMode === 'master' ? (
         // --- TAMPILAN 1: MASTER RUANGAN ---
         <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:px-8 md:py-6 rounded-[2rem] border border-blue-100 shadow-sm">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-3">
                  <Building className="w-8 h-8 text-blue-600" /> Sesi Ruang Ujian
                </h1>
                <p className="text-slate-500 text-sm mt-1 font-medium ml-11">Lihat dan pantau daftar sesi ruangan beserta pengawasnya (Mode Baca).</p>
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
                              {/* PERBAIKAN UNTUK GURU: HANYA TOMBOL LIHAT SISWA DAN DOWNLOAD */}
                              <div className="flex items-center justify-end gap-2 transition-opacity">
                                <button onClick={() => {setActiveRoom(room); setViewMode('plotting'); setPlotSearchQuery('');}} className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all shadow-md flex items-center justify-center" title="Lihat Siswa di Ruangan Ini">
                                   <Users className="w-4 h-4"/>
                                </button>
                                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                                <button onClick={() => handleDownloadPDF(room)} disabled={isGeneratingPdf} className="p-2.5 bg-white hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-full transition-all border border-slate-200 hover:border-blue-200 shadow-sm disabled:opacity-50" title="Unduh PDF Daftar Hadir">
                                   {isGeneratingPdf ? <LoaderCircle className="w-4 h-4 animate-spin"/> : <FileText className="w-4 h-4"/>}
                                </button>
                                <button onClick={() => handleDownloadExcel(room)} className="p-2.5 bg-white hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-full transition-all border border-slate-200 hover:border-emerald-200 shadow-sm" title="Unduh Excel"><FileSpreadsheet className="w-4 h-4"/></button>
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

         // --- TAMPILAN 2: MODE PLOTTING (HANYA LIHAT DAFTAR SISWA RUANGAN) ---
         <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <button onClick={() => setViewMode('master')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-200 px-5 py-2.5 rounded-xl transition-all w-fit shadow-sm">
              <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Ruangan
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

            <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm flex flex-col h-[700px] overflow-hidden">
               <div className="p-6 border-b border-slate-100 bg-emerald-50/50 flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="font-black text-slate-800 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600"/> Peserta di Sesi Ini</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Daftar siswa yang berada di ruangan {activeRoom?.room_name}. (Hanya Mode Baca)</p>
                  </div>
                  <span className="bg-emerald-100 text-emerald-700 font-black text-xs px-3 py-1.5 rounded-lg border border-emerald-200">{studentsInRoom.length} Siswa</span>
               </div>
               <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50/30">
                  {studentsInRoom.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 mb-4"><Users className="w-10 h-10 text-slate-300"/></div>
                        <p className="font-bold text-slate-500">Sesi Ruangan ini masih kosong.</p>
                     </div>
                  ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {studentsInRoom.map((student, idx) => (
                           <div key={student.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-xs shrink-0 border border-emerald-100">{idx + 1}</div>
                              <div>
                                <p className="font-black text-slate-800 text-sm leading-tight mb-1">{student.full_name}</p>
                                <div className="flex gap-2 mt-1">
                                   <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">NIS: {student.student_number}</span>
                                   <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100">{student.class_group}</span>
                                </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
               {/* Footer Aksi Ruangan */}
               <div className="p-6 border-t border-slate-100 bg-white shrink-0 flex justify-end gap-4">
                  <button onClick={() => handleDownloadPDF(activeRoom!)} disabled={isGeneratingPdf} className="flex items-center justify-center gap-2 py-3.5 px-6 bg-white border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold rounded-xl transition-all text-sm disabled:opacity-50">
                     {isGeneratingPdf ? <LoaderCircle className="w-5 h-5 animate-spin"/> : <FileText className="w-5 h-5"/>} 
                     {isGeneratingPdf ? 'Memproses...' : 'Unduh PDF Hadir'}
                  </button>
                  <button onClick={() => handleDownloadExcel(activeRoom!)} className="flex items-center justify-center gap-2 py-3.5 px-6 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl transition-colors text-sm border border-emerald-200 shadow-sm"><FileSpreadsheet className="w-5 h-5"/> Unduh Excel</button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}