'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Search, Printer, FileText, 
  IdCard, Users, CheckCircle2, AlertTriangle, 
  LoaderCircle, LayoutTemplate, Eye, Image as ImageIcon, Sliders, Download
} from 'lucide-react';

interface Student {
  id: string;
  full_name: string;
  student_number: string;
  username: string;
  password?: string;
  class_group: string;
  room_id?: string | null;
  rooms?: { room_name: string };
}

// HELPER: Mengubah Link Drive menjadi link Thumbnail langsung (ANTI BROKEN IMAGE)
const getDriveImageUrl = (url: string | undefined | null) => {
  if (!url) return '';
  const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w500`;
  return url;
};

// HELPER: Format Nama (PERBAIKAN: Ditampilkan utuh tanpa disingkat)
const formatName = (name: string) => {
  if (!name) return '-';
  return name.trim();
};

export default function ExamCardsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // State Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('Semua Kelas');

  // UI Notifikasi
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // State Pengaturan Desain Kartu Ujian
  const [cardSettings, setCardSettings] = useState({
    headerText: 'KARTU PESERTA UJIAN CBT',
    schoolName: 'SMA NEGERI 1 BIMA SEJAHTERA',
    schoolYear: 'Tahun Pelajaran 2025/2026',
    
    // Logo 1 (Kiri)
    logoUrl: '', 
    logoWidth: 35,
    logoOffsetX: 0,
    logoOffsetY: 0,
    
    // Logo 2 (Kanan - Menggantikan QR)
    logo2Url: '', 
    logo2Width: 35,
    logo2OffsetX: 0,
    logo2OffsetY: 0,
    
    // Tanda Tangan
    signatureUrl: '', 
    sigWidth: 80, 
    sigOffsetX: 0, 
    sigOffsetY: -10, 
    
    locationDate: 'Jakarta, 12 Mei 2026',
    signatureRole: 'Kepala Sekolah',
    signatureName: 'Dr. H. Budi Santoso, M.Pd.',
    signatureNip: '19750101 200003 1 001',
    notes: '1. Kartu wajib dibawa selama ujian.\n2. Jaga kerahasiaan password Anda.'
  });

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3000);
  };

  const handleSettingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setCardSettings({ 
      ...cardSettings, 
      [name]: type === 'range' ? Number(value) : value 
    });
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data: settingData, error: settingError } = await supabase.from('pengaturan_aplikasi').select('*').eq('id', 1).single();
      
      if (!settingError && settingData) {
         // Membuat format tanggal dinamis (Hari Ini) + Menarik Kabupaten/Kota
         const today = new Date();
         const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
         const formattedDate = today.toLocaleDateString('id-ID', dateOptions);
         const fetchedLocation = settingData.kabupaten_kota || 'Jakarta';
         const autoLocationDate = `${fetchedLocation}, ${formattedDate}`;

         setCardSettings(prev => ({
            ...prev,
            schoolName: settingData.nama_sekolah || prev.schoolName,
            schoolYear: settingData.tahun_ajaran || prev.schoolYear,
            logoUrl: settingData.logo_kiri || prev.logoUrl,
            logo2Url: settingData.logo_kanan || prev.logo2Url,
            signatureUrl: settingData.ttd_kepsek || prev.signatureUrl,
            signatureName: settingData.nama_kepsek || prev.signatureName,
            signatureNip: settingData.nip_kepsek || prev.signatureNip,
            locationDate: autoLocationDate
         }));
      }

      const { data, error } = await supabase
        .from('users')
        .select(`
          id, full_name, student_number, username, password, class_group, room_id,
          rooms ( room_name )
        `)
        .eq('role', 'student')
        .order('class_group', { ascending: true })
        .order('full_name', { ascending: true });

      if (error) throw error;
      
      const formattedStudents: Student[] = (data || []).map((item: any) => ({
        id: item.id,
        full_name: item.full_name,
        student_number: item.student_number,
        username: item.username,
        password: item.password,
        class_group: item.class_group,
        room_id: item.room_id,
        rooms: Array.isArray(item.rooms) ? item.rooms[0] : item.rooms
      }));

      setStudents(formattedStudents);
      
      const classes = Array.from(new Set(formattedStudents.map(s => s.class_group).filter(Boolean))) as string[];
      setAvailableClasses(classes.sort());
    } catch (err: any) {
      showToast("Gagal memuat data siswa: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchClass = selectedClass === 'Semua Kelas' || s.class_group === selectedClass;
      const matchSearch = s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (s.student_number || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchClass && matchSearch;
    });
  }, [students, selectedClass, searchQuery]);

  const finalLogoUrl = useMemo(() => getDriveImageUrl(cardSettings.logoUrl) || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNjYmQ1ZTEiIHN0cm9rZS13aWR0aD0iMSI+PHBhdGggZD0iTTMgMTZWMGEyIDIgMCAwIDEgMi0yaDE0YTIgMiAwIDAgMSAyIDJ2MTZNMTEgMTZsLTQgNGgtNHY0aDE4di00aC00bC00LTRNMTEgMTZ2NG0yLTR2NCIvPjwvc3ZnPg==', [cardSettings.logoUrl]);
  const finalLogo2Url = useMemo(() => getDriveImageUrl(cardSettings.logo2Url) || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNjYmQ1ZTEiIHN0cm9rZS13aWR0aD0iMSI+PHBhdGggZD0iTTMgMTZWMGEyIDIgMCAwIDEgMi0yaDE0YTIgMiAwIDAgMSAyIDJ2MTZNMTEgMTZsLTQgNGgtNHY0aDE4di00aC00bC00LTRNMTEgMTZ2NG0yLTR2NCIvPjwvc3ZnPg==', [cardSettings.logo2Url]);
  const finalSignatureUrl = useMemo(() => getDriveImageUrl(cardSettings.signatureUrl), [cardSettings.signatureUrl]);


  // =========================================================================
  // EXPORT 1: PDF / DIRECT PRINT DENGAN PROMISE IMAGE (ANTI GAMBAR KOSONG)
  // =========================================================================
  const handlePrintPDF = () => {
    if (filteredStudents.length === 0) { showToast("Tidak ada data siswa untuk dicetak.", "warning"); return; }
    
    setIsGeneratingPdf(true);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) { 
      showToast("Pop-up diblokir browser.", "error"); 
      setIsGeneratingPdf(false);
      return; 
    }

    const formattedNotes = cardSettings.notes.split('\n').map(n => `<div style="margin-bottom:1px;">${n}</div>`).join('');

    const cardsHtml = filteredStudents.map(s => {
      const roomName = s.rooms?.room_name || 'Belum diplot';
      const parsedName = formatName(s.full_name);

      return `
      <div class="card">
         <div class="header">
            <div style="width: 45px; height: 45px; position: relative; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
               <img src="${finalLogoUrl}" style="position: absolute; width: ${cardSettings.logoWidth}px; object-fit: contain; transform: translate(${cardSettings.logoOffsetX}px, ${cardSettings.logoOffsetY}px);" />
            </div>

            <div class="header-text">
               <div class="title">${cardSettings.headerText}</div>
               <div class="school">${cardSettings.schoolName}</div>
               <div class="year">${cardSettings.schoolYear}</div>
            </div>
            
            <div style="width: 45px; height: 45px; position: relative; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
               <img src="${finalLogo2Url}" style="position: absolute; width: ${cardSettings.logo2Width}px; object-fit: contain; transform: translate(${cardSettings.logo2OffsetX}px, ${cardSettings.logo2OffsetY}px);" />
            </div>
         </div>

         <div class="content">
            <div class="photo-box">Foto<br/>3x4</div>
            
            <div class="bio-container">
               <table class="bio-table">
                  <tr><td class="label">Nama Peserta</td><td class="colon">:</td><td class="val"><b>${parsedName}</b></td></tr>
                  <tr><td class="label">Kelas</td><td class="colon">:</td><td class="val">${s.class_group || '-'}</td></tr>
                  <tr><td class="label">Ruang</td><td class="colon">:</td><td class="val">${roomName}</td></tr>
                  <tr><td class="label" style="color: #1e40af;">Username</td><td class="colon" style="color: #1e40af;">:</td><td class="mono" style="color: #1e40af;"><b>${s.username || s.student_number}</b></td></tr>
                  <tr><td class="label" style="color: #047857;">Password</td><td class="colon" style="color: #047857;">:</td><td class="mono" style="color: #047857;"><b>${s.password || '123456'}</b></td></tr>
               </table>
            </div>
         </div>

         <div class="footer">
            <div class="notes">
              <b>Catatan:</b><br/>
              ${formattedNotes}
            </div>
            <div class="signature">
              <p>${cardSettings.locationDate}</p>
              <p>${cardSettings.signatureRole}</p>
              <div class="sig-container">
                 ${finalSignatureUrl ? `<img src="${finalSignatureUrl}" class="sig-img" />` : ``}
              </div>
              <p style="text-decoration: underline; font-weight: bold; margin-bottom:0; position: relative; z-index: 1;">${cardSettings.signatureName}</p>
              <p style="position: relative; z-index: 1;">NIP. ${cardSettings.signatureNip}</p>
            </div>
         </div>
      </div>
    `}).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html><head><title>Cetak Kartu Peserta Ujian</title>
      <style>
        /* MENGHILANGKAN HEADER & FOOTER BAWAAN BROWSER */
        @page { size: A4 portrait; margin: 0; } 
        body { 
            font-family: 'Arial', sans-serif; 
            color: #000; 
            margin: 0; 
            padding: 10mm; /* Margin dikembalikan melalui body agar isi tidak terpotong */
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            background-color: white;
        }
        
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        
        .card { 
            border: 1px solid #000; 
            padding: 6px 10px; 
            border-radius: 0px; 
            page-break-inside: avoid; 
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            background-color: #fff;
            min-height: 6.6cm; /* Pas 8 Kartu Per A4 */
        }
        
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
        
        /* HEADER DIBUAT SEDIKIT RENGGANG */
        .header-text { text-align: center; flex: 1; padding: 0 5px; line-height: 1.3; }
        .header-text .title { font-weight: 900; font-size: 11px; margin-bottom: 3px; }
        .header-text .school { font-weight: bold; font-size: 10px; margin-bottom: 3px; }
        .header-text .year { font-size: 8px; }
        
        .content { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 4px; flex: 1;}
        
        .photo-box { width: 55px; height: 75px; border: 1px solid #000; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 9px; font-weight: bold; color: #666; flex-shrink: 0; }
        
        .bio-container { flex: 1; display: flex; flex-direction: column; justify-content: center; }
        
        .bio-table { border-collapse: collapse; font-size: 10px; width: 100%; }
        .bio-table td { padding: 1.5px 0; vertical-align: top; } 
        .bio-table td.label { width: 65px; font-weight: 500;}
        .bio-table td.colon { width: 5px; }
        .bio-table td.val { line-height: 1.1; }
        .mono { font-family: 'Courier New', Courier, monospace; font-size: 11px; font-weight: bold; letter-spacing: 1px;}
        
        .footer { display: flex; justify-content: space-between; align-items: flex-end; font-size: 8px; padding-top: 4px; line-height: 1.2; color: #000; margin-top: auto;}
        .notes { flex: 1; padding-right: 10px; }
        .signature { text-align: center; width: 130px; flex-shrink: 0;}
        .signature p { margin: 1px 0; }

        .sig-container { position: relative; height: 25px; width: 100%; display: flex; justify-content: center; }
        .sig-img { 
            position: absolute; 
            width: ${cardSettings.sigWidth}px; 
            object-fit: contain; 
            mix-blend-mode: multiply; 
            transform: translate(${cardSettings.sigOffsetX}px, ${cardSettings.sigOffsetY}px);
            z-index: 10; 
        }
      </style>
      </head><body>
         <div class="grid">${cardsHtml}</div>
         
         <script>
           // SKRIP PENGAWAS GAMBAR: Memaksa browser menunggu semua gambar (Logo & TTD) dari Supabase selesai didownload sebelum memunculkan jendela Print
           const images = Array.from(document.images);
           Promise.all(images.map(img => {
             if (img.complete) return Promise.resolve();
             return new Promise((resolve) => {
               img.onload = resolve;
               img.onerror = resolve; // Jika gambar gagal muat, tetap lanjut agar tidak macet
             });
           })).then(() => {
             setTimeout(() => {
               window.print();
             }, 400); // Ekstra jeda sedikit agar layout sempurna
           });
         </script>
      </body></html>
    `;
    printWindow.document.write(htmlContent); 
    printWindow.document.close(); 
    printWindow.focus();

    // Hapus status loading setelah 3 detik (asumsi jendela sudah terbuka)
    setTimeout(() => { setIsGeneratingPdf(false); }, 3000);
  };


  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 max-w-7xl mx-auto text-slate-900 relative pb-24">
      
      {/* ================= TOAST NOTIFICATION ELEGAN ================= */}
      {toast && (
        <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[150] w-[90%] sm:w-auto animate-in slide-in-from-top-10">
          <div className={`px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-2xl shadow-2xl flex items-center gap-2 md:gap-3 border ${
             toast.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' : 
             toast.type === 'warning' ? 'bg-amber-500 border-amber-400 text-white' : 'bg-rose-500 border-rose-400 text-white'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 shrink-0" /> : <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 shrink-0" />}
            <p className="font-bold text-xs md:text-sm tracking-wide leading-snug">{toast.message}</p>
          </div>
        </div>
      )}

      {/* HEADER UTAMA & TOMBOL CETAK KARTU */}
      <div className="bg-white border border-slate-200 p-4 md:p-6 rounded-xl md:rounded-[1.5rem] shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
        <div className="text-center md:text-left w-full md:w-auto">
          <h1 className="text-xl md:text-3xl font-black text-slate-800 flex items-center justify-center md:justify-start gap-2 md:gap-3">
            <IdCard className="w-6 h-6 md:w-8 md:h-8 text-blue-600" /> Kartu Ujian
          </h1>
          <p className="text-slate-500 text-[10px] md:text-sm mt-1 font-medium md:ml-11 leading-snug">Kelola dan cetak kartu ujian peserta sebagai identitas pelaksanaan.</p>
        </div>
        
        <button onClick={handlePrintPDF} disabled={isGeneratingPdf || loading} className="flex items-center justify-center gap-2 bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700 px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm transition-all shadow-sm active:scale-95 whitespace-nowrap w-full md:w-auto shrink-0">
          {isGeneratingPdf ? <LoaderCircle className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Printer className="w-4 h-4 md:w-5 md:h-5" />} 
          {isGeneratingPdf ? 'Menyiapkan Data...' : 'Cetak / Simpan PDF'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 items-start">
         
         {/* PANEL KIRI: PENGATURAN KARTU (SETTINGS) */}
         <div className="xl:col-span-1 space-y-4 md:space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] p-4 md:p-6 shadow-sm">
               <div className="flex items-center gap-2 mb-4 md:mb-6 border-b border-slate-100 pb-3 md:pb-4">
                  <LayoutTemplate className="w-4 h-4 md:w-5 md:h-5 text-indigo-500"/>
                  <h2 className="text-base md:text-lg font-black text-slate-800">Desain Kartu Ujian</h2>
               </div>
               
               <div className="space-y-4 overflow-y-auto max-h-[50vh] md:max-h-[60vh] pr-2 custom-scrollbar">
                  
                  {/* --- KELOMPOK LOGO --- */}
                  <div className="p-3 md:p-4 bg-slate-50 rounded-lg md:rounded-xl border border-slate-200 space-y-3 md:space-y-4">
                      <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 border-b border-slate-200 pb-1">Pengaturan Logo</p>
                      
                      {/* LOGO 1 (KIRI) */}
                      <div className="space-y-1.5">
                         <label className="text-[10px] md:text-xs font-black text-slate-600 flex flex-wrap items-center justify-between gap-1">
                            <span>Logo 1 (Kiri)</span><span className="text-[8px] md:text-[9px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap">Link / URL</span>
                         </label>
                         <div className="relative">
                            <ImageIcon className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400"/>
                            <input type="url" name="logoUrl" value={cardSettings.logoUrl} onChange={handleSettingChange} placeholder="https://..." className="w-full bg-white border border-slate-200 rounded-lg md:rounded-xl pl-8 md:pl-9 pr-3 md:pr-4 py-2 md:py-2.5 text-xs md:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                         </div>
                         {cardSettings.logoUrl && (
                            <div className="pt-1.5 md:pt-2 space-y-1.5 md:space-y-2">
                               <div className="flex items-center gap-2 md:gap-3"><span className="text-[9px] md:text-[10px] font-bold text-slate-500 w-8 md:w-10">Ukuran</span><input type="range" name="logoWidth" min="10" max="80" value={cardSettings.logoWidth} onChange={handleSettingChange} className="flex-1 accent-blue-500 h-1.5" /><span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-5 md:w-4 text-right">{cardSettings.logoWidth}</span></div>
                               <div className="flex items-center gap-2 md:gap-3"><span className="text-[9px] md:text-[10px] font-bold text-slate-500 w-8 md:w-10">Geser X</span><input type="range" name="logoOffsetX" min="-50" max="50" value={cardSettings.logoOffsetX} onChange={handleSettingChange} className="flex-1 accent-blue-500 h-1.5" /><span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-5 md:w-4 text-right">{cardSettings.logoOffsetX}</span></div>
                               <div className="flex items-center gap-2 md:gap-3"><span className="text-[9px] md:text-[10px] font-bold text-slate-500 w-8 md:w-10">Geser Y</span><input type="range" name="logoOffsetY" min="-50" max="50" value={cardSettings.logoOffsetY} onChange={handleSettingChange} className="flex-1 accent-blue-500 h-1.5" /><span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-5 md:w-4 text-right">{cardSettings.logoOffsetY}</span></div>
                            </div>
                         )}
                      </div>

                      {/* LOGO 2 (KANAN) */}
                      <div className="space-y-1.5 pt-2.5 md:pt-3 border-t border-slate-200">
                         <label className="text-[10px] md:text-xs font-black text-slate-600 flex flex-wrap items-center justify-between gap-1">
                            <span>Logo 2 (Kanan)</span><span className="text-[8px] md:text-[9px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap">Link / URL</span>
                         </label>
                         <div className="relative">
                            <ImageIcon className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400"/>
                            <input type="url" name="logo2Url" value={cardSettings.logo2Url} onChange={handleSettingChange} placeholder="https://..." className="w-full bg-white border border-slate-200 rounded-lg md:rounded-xl pl-8 md:pl-9 pr-3 md:pr-4 py-2 md:py-2.5 text-xs md:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                         </div>
                         {cardSettings.logo2Url && (
                            <div className="pt-1.5 md:pt-2 space-y-1.5 md:space-y-2">
                               <div className="flex items-center gap-2 md:gap-3"><span className="text-[9px] md:text-[10px] font-bold text-slate-500 w-8 md:w-10">Ukuran</span><input type="range" name="logo2Width" min="10" max="80" value={cardSettings.logo2Width} onChange={handleSettingChange} className="flex-1 accent-blue-500 h-1.5" /><span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-5 md:w-4 text-right">{cardSettings.logo2Width}</span></div>
                               <div className="flex items-center gap-2 md:gap-3"><span className="text-[9px] md:text-[10px] font-bold text-slate-500 w-8 md:w-10">Geser X</span><input type="range" name="logo2OffsetX" min="-50" max="50" value={cardSettings.logo2OffsetX} onChange={handleSettingChange} className="flex-1 accent-blue-500 h-1.5" /><span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-5 md:w-4 text-right">{cardSettings.logo2OffsetX}</span></div>
                               <div className="flex items-center gap-2 md:gap-3"><span className="text-[9px] md:text-[10px] font-bold text-slate-500 w-8 md:w-10">Geser Y</span><input type="range" name="logo2OffsetY" min="-50" max="50" value={cardSettings.logo2OffsetY} onChange={handleSettingChange} className="flex-1 accent-blue-500 h-1.5" /><span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-5 md:w-4 text-right">{cardSettings.logo2OffsetY}</span></div>
                            </div>
                         )}
                      </div>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest">Judul Kartu</label>
                     <input type="text" name="headerText" value={cardSettings.headerText} onChange={handleSettingChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest">Nama Instansi / Sekolah</label>
                     <input type="text" name="schoolName" value={cardSettings.schoolName} onChange={handleSettingChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest">Tahun / Periode</label>
                     <input type="text" name="schoolYear" value={cardSettings.schoolYear} onChange={handleSettingChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                  </div>
                  
                  <div className="pt-3 md:pt-4 border-t border-slate-100 space-y-3 md:space-y-4">
                     <div className="space-y-1.5">
                        <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest">Tempat & Tanggal</label>
                        <input type="text" name="locationDate" value={cardSettings.locationDate} onChange={handleSettingChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest flex flex-wrap items-center justify-between gap-1">
                           <span>TTD Digital</span>
                           <span className="text-[8px] md:text-[9px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap">Link / URL</span>
                        </label>
                        <div className="relative">
                           <ImageIcon className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400"/>
                           <input type="url" name="signatureUrl" value={cardSettings.signatureUrl} onChange={handleSettingChange} placeholder="Kosongkan jika TTD Manual..." className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl pl-8 md:pl-9 pr-3 md:pr-4 py-2 md:py-2.5 text-xs md:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                        </div>
                     </div>
                     
                     {/* SLIDER KONTROL TTD */}
                     {cardSettings.signatureUrl && (
                        <div className="bg-slate-50 p-3 md:p-4 rounded-lg md:rounded-xl border border-slate-200 space-y-2 md:space-y-3">
                           <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1 md:mb-2"><Sliders className="w-3 h-3 md:w-3.5 md:h-3.5"/> Atur Posisi TTD</p>
                           
                           <div className="flex items-center gap-2 md:gap-3">
                              <span className="text-[9px] md:text-[10px] font-bold text-slate-600 w-10 md:w-12">Ukuran</span>
                              <input type="range" name="sigWidth" min="20" max="150" value={cardSettings.sigWidth} onChange={handleSettingChange} className="flex-1 accent-blue-500" />
                              <span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-5 md:w-6 text-right">{cardSettings.sigWidth}</span>
                           </div>
                           <div className="flex items-center gap-2 md:gap-3">
                              <span className="text-[9px] md:text-[10px] font-bold text-slate-600 w-10 md:w-12">Geser X</span>
                              <input type="range" name="sigOffsetX" min="-50" max="50" value={cardSettings.sigOffsetX} onChange={handleSettingChange} className="flex-1 accent-blue-500" />
                              <span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-5 md:w-6 text-right">{cardSettings.sigOffsetX}</span>
                           </div>
                           <div className="flex items-center gap-2 md:gap-3">
                              <span className="text-[9px] md:text-[10px] font-bold text-slate-600 w-10 md:w-12">Geser Y</span>
                              <input type="range" name="sigOffsetY" min="-50" max="50" value={cardSettings.sigOffsetY} onChange={handleSettingChange} className="flex-1 accent-blue-500" />
                              <span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-5 md:w-6 text-right">{cardSettings.sigOffsetY}</span>
                           </div>
                        </div>
                     )}

                     <div className="space-y-1.5">
                        <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest">Jabatan TTD</label>
                        <input type="text" name="signatureRole" value={cardSettings.signatureRole} onChange={handleSettingChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest">Nama Pejabat</label>
                        <input type="text" name="signatureName" value={cardSettings.signatureName} onChange={handleSettingChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest">NIP (Opsional)</label>
                        <input type="text" name="signatureNip" value={cardSettings.signatureNip} onChange={handleSettingChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                     </div>
                  </div>

                  <div className="pt-3 md:pt-4 border-t border-slate-100 space-y-1.5">
                     <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest">Catatan / Tata Tertib</label>
                     <textarea name="notes" value={cardSettings.notes} onChange={handleSettingChange} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none resize-none leading-relaxed shadow-sm" />
                  </div>
               </div>
            </div>
         </div>

         {/* PANEL KANAN: LIVE PREVIEW & FILTER */}
         <div className="xl:col-span-2 space-y-4 md:space-y-6">
            
            {/* FILTER BAR */}
            <div className="bg-white border border-slate-200 p-3 sm:p-4 rounded-xl md:rounded-[1.5rem] shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4">
               <div className="relative w-full sm:w-56 md:w-64 shrink-0">
                  <Users className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select 
                     value={selectedClass} 
                     onChange={(e) => setSelectedClass(e.target.value)}
                     className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl pl-9 md:pl-10 pr-8 md:pr-4 py-2.5 md:py-3 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer appearance-none shadow-sm truncate"
                  >
                     <option value="Semua Kelas">Semua Kelas ({students.length})</option>
                     {availableClasses.map(c => <option key={c} value={c}>Kelas {c}</option>)}
                  </select>
               </div>
               <div className="relative w-full">
                  <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                     type="text" placeholder="Cari nama atau NIS siswa..." 
                     value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} 
                     className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl pl-9 md:pl-10 pr-3 md:pr-4 py-2.5 md:py-3 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm placeholder-slate-400" 
                  />
               </div>
            </div>

            {/* LIVE PREVIEW CARDS */}
            <div className="bg-slate-100 border border-slate-200 rounded-xl md:rounded-[1.5rem] p-3 sm:p-4 md:p-6 shadow-inner h-[60vh] sm:h-[70vh] md:h-[800px] overflow-y-auto custom-scrollbar relative">
               
               {/* Notifikasi geser di layar kecil jika konten kurang lebar */}
               <div className="md:hidden text-center text-[10px] text-slate-400 font-bold mb-2">
                 <span className="bg-slate-200/70 px-2 py-1 rounded">Geser konten jika kartu terpotong</span>
               </div>

               <div className="flex items-center justify-between mb-4 md:mb-6 sticky left-0 right-0">
                  <h2 className="text-[10px] md:text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 md:gap-2"><Eye className="w-3.5 h-3.5 md:w-4 h-4"/> Preview Kartu (Kompak)</h2>
                  <span className="bg-white px-2 md:px-3 py-1 rounded-md md:rounded-lg border border-slate-200 text-[10px] md:text-xs font-bold text-slate-600 shadow-sm whitespace-nowrap">{filteredStudents.length} Siswa</span>
               </div>

               {loading ? (
                  <div className="flex justify-center py-20 w-full"><LoaderCircle className="w-6 h-6 md:w-8 h-8 text-blue-500 animate-spin"/></div>
               ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-16 md:py-20 bg-white rounded-xl md:rounded-2xl border border-dashed border-slate-300 mx-1 md:mx-0 sticky left-0 right-0">
                     <Users className="w-8 h-8 md:w-10 h-10 text-slate-300 mx-auto mb-2 md:mb-3"/>
                     <p className="font-bold text-slate-500 text-xs md:text-sm px-4">Tidak ada siswa yang sesuai dengan filter.</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 overflow-x-auto pb-2 min-w-min" style={{ minWidth: 'min-content' }}>
                     {filteredStudents.slice(0, 20).map((s, idx) => {
                        const parsedName = formatName(s.full_name);
                        
                        return (
                        <div key={idx} className="bg-white border border-slate-800 shadow-sm relative flex flex-col group hover:border-blue-500 transition-colors w-[85mm] sm:w-[auto]" style={{ padding: '6px 10px', minHeight: '6.6cm' }}>
                           
                           {/* HEADER KARTU (KOP) */}
                           <div className="flex justify-between items-center border-b-[2px] border-slate-800" style={{ paddingBottom: '4px', marginBottom: '6px' }}>
                              {/* LOGO 1 */}
                              <div style={{ width: '45px', height: '45px', position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                 <img src={finalLogoUrl} alt="Logo 1" style={{ position: 'absolute', objectFit: 'contain', width: `${cardSettings.logoWidth}px`, transform: `translate(${cardSettings.logoOffsetX}px, ${cardSettings.logoOffsetY}px)`}} />
                              </div>
                              
                              <div className="text-center flex-1 px-1.5" style={{ lineHeight: '1.3' }}>
                                 <div style={{ fontWeight: 900, fontSize: '11px', marginBottom: '3px', textTransform: 'uppercase' }}>{cardSettings.headerText}</div>
                                 <div style={{ fontWeight: 'bold', fontSize: '10px', marginBottom: '3px' }}>{cardSettings.schoolName}</div>
                                 <div style={{ fontSize: '8px', color: '#64748b' }}>{cardSettings.schoolYear}</div>
                              </div>

                              {/* LOGO 2 */}
                              <div style={{ width: '45px', height: '45px', position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                 <img src={finalLogo2Url} alt="Logo 2" style={{ position: 'absolute', objectFit: 'contain', width: `${cardSettings.logo2Width}px`, transform: `translate(${cardSettings.logo2OffsetX}px, ${cardSettings.logo2OffsetY}px)`}} />
                              </div>
                           </div>
                           
                           {/* BODY KARTU (FOTO KIRI, BIO & AKUN KANAN) */}
                           <div className="flex items-start flex-1" style={{ gap: '12px', marginBottom: '4px' }}>
                              {/* FOTO 3X4 */}
                              <div className="border border-slate-400 flex items-center justify-center text-center text-slate-500 font-bold shrink-0 bg-slate-50" style={{ width: '55px', height: '75px', fontSize: '9px' }}>
                                 Foto<br/>3x4
                              </div>
                              
                              {/* BIODATA */}
                              <div className="flex-1 flex flex-col justify-center">
                                 <table className="text-slate-800 font-medium w-full border-collapse" style={{ fontSize: '10px' }}>
                                    <tbody>
                                       <tr>
                                          <td className="align-top font-medium" style={{ width: '65px', padding: '1.5px 0' }}>Nama Peserta</td>
                                          <td className="align-top" style={{ width: '5px', padding: '1.5px 0' }}>:</td>
                                          <td className="align-top" style={{ padding: '1.5px 0', lineHeight: '1.1' }}><b>{parsedName}</b></td>
                                       </tr>
                                       <tr>
                                          <td className="align-top font-medium" style={{ padding: '1.5px 0' }}>Kelas</td>
                                          <td className="align-top" style={{ padding: '1.5px 0' }}>:</td>
                                          <td className="align-top" style={{ padding: '1.5px 0', lineHeight: '1.1' }}>{s.class_group || '-'}</td>
                                       </tr>
                                       <tr>
                                          <td className="align-top font-medium" style={{ padding: '1.5px 0' }}>Ruang</td>
                                          <td className="align-top" style={{ padding: '1.5px 0' }}>:</td>
                                          <td className="align-top" style={{ padding: '1.5px 0', lineHeight: '1.1' }}>{s.rooms?.room_name || 'Belum diplot'}</td>
                                       </tr>
                                       <tr>
                                          <td className="align-top font-medium text-blue-800" style={{ padding: '1.5px 0' }}>Username</td>
                                          <td className="align-top text-blue-800" style={{ padding: '1.5px 0' }}>:</td>
                                          <td className="align-top font-bold text-blue-800" style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '11px', letterSpacing: '1px', padding: '1.5px 0', lineHeight: '1.1' }}>{s.username || s.student_number}</td>
                                       </tr>
                                       <tr>
                                          <td className="align-top font-medium text-emerald-700" style={{ padding: '1.5px 0' }}>Password</td>
                                          <td className="align-top text-emerald-700" style={{ padding: '1.5px 0' }}>:</td>
                                          <td className="align-top font-bold text-emerald-700" style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '11px', letterSpacing: '1px', padding: '1.5px 0', lineHeight: '1.1' }}>{s.password || '123456'}</td>
                                       </tr>
                                    </tbody>
                                 </table>
                              </div>
                           </div>

                           {/* FOOTER KARTU */}
                           <div className="flex justify-between items-end text-slate-900 mt-auto" style={{ fontSize: '8px', paddingTop: '4px', lineHeight: '1.2' }}>
                              <div className="flex-1" style={{ paddingRight: '10px' }}>
                                 <b>Catatan:</b><br/>
                                 {cardSettings.notes.split('\n').map((n, i) => (
                                     <div key={i} style={{ marginBottom: '1px' }}>{n}</div>
                                 ))}
                              </div>
                              <div className="text-center shrink-0" style={{ width: '130px' }}>
                                 <p style={{ margin: '1px 0' }}>{cardSettings.locationDate}</p>
                                 <p style={{ margin: '1px 0' }}>{cardSettings.signatureRole}</p>
                                 
                                 {/* TTD (Absolute agar menabrak tulisan seperti di print) */}
                                 <div className="relative flex justify-center items-center pointer-events-none" style={{ height: '25px', width: '100%' }}>
                                    {finalSignatureUrl && (
                                       <img 
                                          src={finalSignatureUrl} 
                                          className="absolute z-10 object-contain mix-blend-multiply" 
                                          style={{ 
                                             width: `${cardSettings.sigWidth}px`,
                                             transform: `translate(${cardSettings.sigOffsetX}px, ${cardSettings.sigOffsetY}px)`
                                          }} 
                                          alt="TTD" 
                                       />
                                    )}
                                 </div>
                                 
                                 <p className="font-bold underline relative z-0" style={{ margin: '1px 0', marginBottom: 0 }}>{cardSettings.signatureName}</p>
                                 <p className="relative z-0" style={{ margin: '1px 0' }}>NIP. {cardSettings.signatureNip}</p>
                              </div>
                           </div>
                        </div>
                        )})}
                  </div>
               )}
               
               {filteredStudents.length > 20 && (
                  <div className="text-center py-4 md:py-6 sticky left-0 right-0">
                     <p className="text-xs md:text-sm font-bold text-slate-400">Menampilkan 20 kartu pertama di Pratinjau.<br/>({filteredStudents.length - 20} kartu lainnya akan disertakan saat dicetak).</p>
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}