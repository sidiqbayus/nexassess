'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Printer, CheckCircle2, AlertTriangle, LoaderCircle, 
  LayoutTemplate, Eye, Users, BookOpen, Building, 
  FileText, PenTool, CalendarClock, UserCircle2, ClipboardList,
  Search, Image as ImageIcon, Plus, Minus, Sliders, Bold, AlignLeft
} from 'lucide-react';

interface Student {
  id: string; 
  full_name: string; 
  student_number: string; 
  class_group: string; 
  room_id?: string;
  rooms?: { room_name: string };
}

interface Exam {
  id: string; 
  title: string; 
  subject: string; 
  grade_level: string; 
  start_time: string; 
  end_time: string; 
  target_class: any;
}

interface Teacher { id: string; full_name: string; student_number?: string; }
interface Room { id: string; room_name: string; }
interface Proctor { role: string; name: string; nip: string; }
interface HeaderLine { text: string; size: number; color: string; bold: boolean; }

const getDriveImageUrl = (url: string) => {
  if (!url) return '';
  const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
  return url;
};

// HELPER: Mengubah teks menjadi Title Case (Huruf besar di awal kata saja)
const toTitleCase = (str: string) => {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
};

// HELPER: Format Tanggal Tanpa Hari
const formatDateNoDay = (dateStr: string) => {
   if (!dateStr) return '-';
   const d = new Date(dateStr);
   return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
};

// HELPER: Format Tanggal Dengan Hari (Untuk Header Dokumen)
const formatDateId = (dateStr: string) => {
   if (!dateStr) return '-';
   const d = new Date(dateStr);
   return d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

export default function AttendanceAndReportPage() {
  const [activeTab, setActiveTab] = useState<'absen' | 'berita_acara'>('absen');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Data dari Database
  const [students, setStudents] = useState<Student[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // State Filter
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('Semua');
  const [selectedRoom, setSelectedRoom] = useState<string>('Semua');

  // State Pengaturan Dokumen Dinamis
  const [docSettings, setDocSettings] = useState({
    // Logo Kiri
    logoUrl: '',
    logoSize: 70,
    logoOffsetX: 0,
    logoOffsetY: 0,
    
    // Logo Kanan
    logo2Url: '',
    logo2Size: 70,
    logo2OffsetX: 0,
    logo2OffsetY: 0,

    headers: [
      { text: 'PEMERINTAH KABUPATEN', size: 14, color: '#000000', bold: false },
      { text: 'DINAS PENDIDIKAN DAN KEBUDAYAAN', size: 16, color: '#000000', bold: true },
      { text: 'NAMA SEKOLAH', size: 20, color: '#000000', bold: true },
      { text: 'Alamat Sekolah', size: 11, color: '#000000', bold: false },
      { text: 'Telp/Fax', size: 10, color: '#000000', bold: false },
      { text: 'Email/Web', size: 10, color: '#000000', bold: false }
    ] as HeaderLine[],
    examDate: new Date().toISOString().split('T')[0],
    
    // Teks Atas TTD (Global, tidak melekat pada nama)
    sigTopText: 'Lokasi, Tanggal\nMengetahui,',
    sigTopAlign: 'right', // left | center | right
    sigTopMarginBottom: 15, // Pendorong agar TTD tidak bertumpuk
    sigTopX: 0, // Geser Kiri / Kanan
    
    proctors: [
       { role: 'Kepala Sekolah', name: '', nip: '' },
       { role: 'Pengawas Ujian', name: '', nip: '' }
    ] as Proctor[],
    notes: 'Ujian berjalan dengan lancar dan tertib. Tidak ada kendala teknis maupun pelanggaran.'
  });

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resStudents, resExams, resTeachers, resRooms, settingData] = await Promise.all([
        supabase.from('users').select('id, full_name, student_number, class_group, room_id, rooms(room_name)').eq('role', 'student').order('full_name'),
        supabase.from('exams').select('*').order('start_time', { ascending: false }),
        supabase.from('users').select('id, full_name, student_number').eq('role', 'proctor').order('full_name'), 
        supabase.from('rooms').select('*').order('room_name'),
        supabase.from('pengaturan_aplikasi').select('*').eq('id', 1).single()
      ]);

      if (settingData.data && !settingData.error) {
         const d = settingData.data;
         
         // Merakit Alamat Title Case (Hanya kapital di awal kata)
         const addressParts = [];
         if (d.jalan) addressParts.push(toTitleCase(d.jalan));
         if (d.dusun) addressParts.push(`Dusun ${toTitleCase(d.dusun)}`);
         if (d.desa_kelurahan) addressParts.push(`Desa/Kel. ${toTitleCase(d.desa_kelurahan)}`);
         if (d.kecamatan) addressParts.push(`Kec. ${toTitleCase(d.kecamatan)}`);
         if (d.kabupaten_kota) addressParts.push(`Kab/Kota. ${toTitleCase(d.kabupaten_kota)}`);
         if (d.provinsi) addressParts.push(`Prov. ${toTitleCase(d.provinsi)}`);
         if (d.kode_pos) addressParts.push(`Kode Pos ${d.kode_pos}`);
         const fullAddress = addressParts.join(', ');

         const todayStr = new Date().toISOString().split('T')[0];
         const locationName = d.kabupaten_kota ? toTitleCase(d.kabupaten_kota) : 'Lokasi';

         setDocSettings(prev => ({
            ...prev,
            logoUrl: d.logo_kiri || prev.logoUrl,
            logo2Url: d.logo_kanan || prev.logo2Url, // Tarik Logo Kanan
            examDate: todayStr,
            sigTopText: `${locationName}, ${formatDateNoDay(todayStr)}\nMengetahui,`,
            headers: [
              { text: `PEMERINTAH KABUPATEN ${d.kabupaten_kota ? d.kabupaten_kota.toUpperCase() : ''}`, size: 14, color: '#000000', bold: false },
              { text: 'DINAS PENDIDIKAN DAN KEBUDAYAAN', size: 16, color: '#000000', bold: true },
              { text: d.nama_sekolah ? d.nama_sekolah.toUpperCase() : 'NAMA SEKOLAH', size: 20, color: '#000000', bold: true },
              { text: fullAddress, size: 10, color: '#000000', bold: false },
              { text: `Telp. ${d.telepon || '-'}, Fax. ${d.fax || '-'}`, size: 10, color: '#000000', bold: false },
              { text: `Email: ${d.email_instansi || '-'} | Website: ${d.website || '-'}`, size: 10, color: '#000000', bold: false }
            ],
            proctors: [
               { role: 'Kepala Sekolah', name: d.nama_kepsek || '', nip: d.nip_kepsek || '' },
               { role: 'Pengawas Ujian', name: '', nip: '' }
            ]
         }));
      }

      if (resStudents.data) {
         const formattedStudents: Student[] = resStudents.data.map((item: any) => ({
            id: item.id,
            full_name: item.full_name,
            student_number: item.student_number,
            class_group: item.class_group,
            room_id: item.room_id,
            rooms: Array.isArray(item.rooms) ? item.rooms[0] : item.rooms
         }));
         setStudents(formattedStudents);
      }
      
      if (resExams.data) {
         setExams(resExams.data);
         if (resExams.data.length > 0) setSelectedExamId(resExams.data[0].id);
      }
      if (resTeachers.data) setTeachers(resTeachers.data);
      if (resRooms.data) setRooms(resRooms.data);
    } catch (err: any) { showToast("Gagal memuat data: " + err.message, "error"); } 
    finally { setLoading(false); }
  };

  const handleSettingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Auto Update Tanggal di Teks TTD Jika Kalender Diubah
    if (name === 'examDate') {
       const newDateStr = formatDateNoDay(value);
       const oldDateStr = formatDateNoDay(docSettings.examDate);
       
       setDocSettings(prev => ({
          ...prev,
          examDate: value,
          sigTopText: prev.sigTopText.replace(oldDateStr, newDateStr)
       }));
       return;
    }

    setDocSettings({ 
       ...docSettings, 
       [name]: type === 'range' ? Number(value) : value 
    });
  };

  // --- LOGIKA KOP SURAT DINAMIS ---
  const handleHeaderChange = (index: number, field: string, value: any) => {
     setDocSettings(prev => {
        const newHeaders = [...prev.headers];
        newHeaders[index] = { ...newHeaders[index], [field]: value };
        return { ...prev, headers: newHeaders };
     });
  };
  const addHeader = () => setDocSettings(p => ({ ...p, headers: [...p.headers, { text: '', size: 10, color: '#000000', bold: false }] }));
  const removeHeader = () => {
     if (docSettings.headers.length > 1) {
        setDocSettings(p => ({ ...p, headers: p.headers.slice(0, -1) }));
     }
  };

  // --- LOGIKA PENGAWAS DINAMIS ---
  const handleProctorSelect = (index: number, teacherId: string) => {
     const teacher = teachers.find(t => t.id === teacherId);
     setDocSettings(prev => {
        const newProctors = [...prev.proctors];
        if (teacher) {
           newProctors[index] = { ...newProctors[index], name: teacher.full_name, nip: teacher.student_number || '' };
        } else {
           newProctors[index] = { ...newProctors[index], name: '', nip: '' };
        }
        return { ...prev, proctors: newProctors };
     });
  };

  const handleProctorTextChange = (index: number, field: 'role' | 'name' | 'nip', value: string) => {
     setDocSettings(prev => {
        const newProctors = [...prev.proctors];
        newProctors[index] = { ...newProctors[index], [field]: value };
        return { ...prev, proctors: newProctors };
     });
  };

  const addProctor = () => setDocSettings(p => ({ ...p, proctors: [...p.proctors, { role: `Pengawas ${p.proctors.length + 1}`, name: '', nip: '' }] }));
  const removeProctor = () => {
     if (docSettings.proctors.length > 1) {
        setDocSettings(p => ({ ...p, proctors: p.proctors.slice(0, -1) }));
     }
  };

  const activeExam = exams.find(e => e.id === selectedExamId);

  const filteredStudents = useMemo(() => {
    if (!activeExam) return [];
    
    let targetClasses: string[] = [];
    if (Array.isArray(activeExam.target_class)) targetClasses = activeExam.target_class;
    else if (typeof activeExam.target_class === 'string') targetClasses = activeExam.target_class.split(',').map((s: string) => s.trim());

    return students.filter(s => {
      const matchExamClass = targetClasses.length === 0 || targetClasses.includes(s.class_group);
      const matchCustomClass = selectedClass === 'Semua' || s.class_group === selectedClass;
      const matchRoom = selectedRoom === 'Semua' || s.room_id === selectedRoom;
      return matchExamClass && matchCustomClass && matchRoom;
    });
  }, [students, activeExam, selectedClass, selectedRoom]);

  const availableClassesForExam = useMemo(() => {
    if (!activeExam) return [];
    let targetClasses: string[] = [];
    if (Array.isArray(activeExam.target_class)) targetClasses = activeExam.target_class;
    else if (typeof activeExam.target_class === 'string') targetClasses = activeExam.target_class.split(',').map((s: string) => s.trim());
    return targetClasses;
  }, [activeExam]);


  // =========================================================================
  // RENDERER DOKUMEN HTML
  // =========================================================================
  const getKopSuratHtml = () => {
    const finalLogoUrl = docSettings.logoUrl ? getDriveImageUrl(docSettings.logoUrl) : '';
    const finalLogo2Url = docSettings.logo2Url ? getDriveImageUrl(docSettings.logo2Url) : '';
    
    const linkify = (text: string) => {
       const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
       return text.replace(urlRegex, (url) => {
          const href = url.startsWith('http') ? url : `http://${url}`;
          return `<a href="${href}" style="color: #2563eb; text-decoration: underline;" target="_blank">${url}</a>`;
       });
    };

    const headersHtml = docSettings.headers.map((h) => {
       const fw = h.bold ? 'bold' : 'normal';
       const textHtml = linkify(h.text);
       return `<div style="font-size: ${h.size}px; font-weight: ${fw}; color: ${h.color}; margin-bottom: 3px;">${textHtml}</div>`;
    }).join('');

    return `
      <table style="width: 100%; border-bottom: 3px double #000; margin-bottom: 20px; padding-bottom: 10px;">
         <tr>
            <td style="width: ${Math.max(80, docSettings.logoSize)}px; text-align: center; vertical-align: middle;">
               ${finalLogoUrl ? `<img src="${finalLogoUrl}" style="width: ${docSettings.logoSize}px; object-fit: contain; transform: translate(${docSettings.logoOffsetX}px, ${docSettings.logoOffsetY}px);" />` : ''}
            </td>
            <td style="text-align: center; line-height: 1.3;">
               ${headersHtml}
            </td>
            <td style="width: ${Math.max(80, docSettings.logo2Size)}px; text-align: center; vertical-align: middle;">
               ${finalLogo2Url ? `<img src="${finalLogo2Url}" style="width: ${docSettings.logo2Size}px; object-fit: contain; transform: translate(${docSettings.logo2OffsetX}px, ${docSettings.logo2OffsetY}px);" />` : ''}
            </td>
         </tr>
      </table>
    `;
  };

  const getDocHeaderHtml = (title: string) => {
    const rName = rooms.find(r => r.id === selectedRoom)?.room_name || 'Semua Ruang';
    return `
      <div style="text-align: center; margin-bottom: 20px;">
         <h2 style="margin: 0; font-size: 16px; text-transform: uppercase; text-decoration: underline;">${title}</h2>
      </div>
      <table style="width: 100%; font-size: 12px; margin-bottom: 15px;">
         <tr>
            <td style="width: 120px; padding: 3px 0;">Mata Pelajaran</td><td style="width: 10px;">:</td><td style="font-weight: bold;">${activeExam?.subject || '-'} (${activeExam?.title || '-'})</td>
            <td style="width: 100px; padding: 3px 0;">Hari, Tanggal</td><td style="width: 10px;">:</td><td>${formatDateId(docSettings.examDate)}</td>
         </tr>
         <tr>
            <td style="padding: 3px 0;">Kelas / Jenjang</td><td>:</td><td>${selectedClass === 'Semua' ? (activeExam?.grade_level || 'Umum') : selectedClass}</td>
            <td style="padding: 3px 0;">Ruang Ujian</td><td>:</td><td style="font-weight: bold;">${rName}</td>
         </tr>
      </table>
    `;
  };

  const getSignaturesHtml = () => {
    const proctors = docSettings.proctors;
    const widthPercentage = Math.floor(100 / Math.max(proctors.length, 1));
    
    const rolesHtml = proctors.map((p) => `<td style="width: ${widthPercentage}%; padding-bottom: 70px;">${p.role || '............................'}</td>`).join('');
    const namesHtml = proctors.map(p => `<td><b><u>${p.name || '...........................................'}</u></b><br/>NIP. ${p.nip || '..........................'}</td>`).join('');

    return `
      <div style="margin-top: 40px; page-break-inside: avoid; width: 100%;">
         <div style="text-align: ${docSettings.sigTopAlign}; margin-bottom: ${docSettings.sigTopMarginBottom}px; position: relative; left: ${docSettings.sigTopX}px; font-size: 12px; line-height: 1.5;">
            ${docSettings.sigTopText.split('\n').map(line => `<div>${line}</div>`).join('')}
         </div>
         
         <table style="width: 100%; font-size: 12px; text-align: center;">
            <tr>${rolesHtml}</tr>
            <tr>${namesHtml}</tr>
         </table>
      </div>
    `;
  };

  const getAttendanceHtml = () => {
    const trs = filteredStudents.map((s, i) => `
      <tr>
         <td style="text-align: center; border: 1px solid #000; padding: 6px 8px;">${i + 1}</td>
         <td style="border: 1px solid #000; padding: 6px 8px;">${s.student_number || '-'}</td>
         <td style="border: 1px solid #000; padding: 6px 8px;"><b>${s.full_name}</b></td>
         <td style="text-align: center; border: 1px solid #000; padding: 6px 8px;">${s.class_group || '-'}</td>
         <td style="border: 1px solid #000; padding: 6px 8px; position: relative; height: 35px; vertical-align: top;">
            <span style="position: absolute; top: 6px; ${i % 2 === 0 ? 'left: 6px;' : 'left: 50%;'} font-size: 10px; color: #111;">${i + 1}.</span>
         </td>
         <td style="border: 1px solid #000; padding: 6px 8px;"></td>
      </tr>
    `).join('');

    return `
      <div style="font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; padding: 10px;">
         ${getKopSuratHtml()}
         ${getDocHeaderHtml('DAFTAR HADIR PESERTA UJIAN CBT')}
         
         <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px;">
            <thead>
               <tr style="background-color: #f2f2f2;">
                  <th style="border: 1px solid #000; padding: 8px; width: 40px;">No</th>
                  <th style="border: 1px solid #000; padding: 8px; width: 100px;">NIS / NISN</th>
                  <th style="border: 1px solid #000; padding: 8px; text-align: left;">Nama Peserta</th>
                  <th style="border: 1px solid #000; padding: 8px; width: 80px;">Kelas</th>
                  <th style="border: 1px solid #000; padding: 8px; width: 120px;">Tanda Tangan</th>
                  <th style="border: 1px solid #000; padding: 8px; width: 100px;">Keterangan</th>
               </tr>
            </thead>
            <tbody>
               ${trs.length > 0 ? trs : `<tr><td colspan="6" style="text-align:center; padding: 20px; border: 1px solid #000;">Tidak ada data peserta</td></tr>`}
            </tbody>
         </table>

         ${getSignaturesHtml()}
      </div>
    `;
  };

  const getReportHtml = () => {
    const d = new Date(docSettings.examDate);
    const day = d.toLocaleDateString('id-ID', { weekday: 'long' });
    const date = d.getDate();
    const month = d.toLocaleDateString('id-ID', { month: 'long' });
    const year = d.getFullYear();

    const formattedNotes = docSettings.notes.replace(/\n/g, '<br/>');

    return `
      <div style="font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; padding: 10px; line-height: 1.5;">
         ${getKopSuratHtml()}
         ${getDocHeaderHtml('BERITA ACARA PELAKSANAAN UJIAN CBT')}
         
         <div style="font-size: 12px; text-align: justify; margin-top: 20px;">
            <p>Pada hari ini <b>${day}</b> tanggal <b>${date}</b> bulan <b>${month}</b> tahun <b>${year}</b>, telah diselenggarakan Ujian Berbasis Komputer (CBT) untuk mata pelajaran <b>${activeExam?.subject || '-'}</b> dari pukul ________ sampai dengan pukul ________.</p>
            
            <table style="width: 100%; margin: 15px 0; font-size: 12px;">
               <tr><td style="width: 30px;">1.</td><td style="width: 250px;">Jumlah Peserta Seharusnya</td><td>: <b>${filteredStudents.length}</b> Orang</td></tr>
               <tr><td>2.</td><td>Jumlah Peserta Hadir</td><td>: ........ Orang</td></tr>
               <tr><td>3.</td><td>Jumlah Peserta Tidak Hadir</td><td>: ........ Orang</td></tr>
               <tr><td style="vertical-align: top;">4.</td><td colspan="2" style="vertical-align: top;">Nama / NIS Peserta Tidak Hadir :<br/>
                  <div style="min-height: 60px; border-bottom: 1px dotted #000; margin-top: 10px;"></div>
                  <div style="min-height: 30px; border-bottom: 1px dotted #000; margin-top: 15px;"></div>
               </td></tr>
               <tr><td style="vertical-align: top; padding-top: 15px;">5.</td><td colspan="2" style="vertical-align: top; padding-top: 15px;">Catatan Penting / Kejadian Selama Ujian :<br/>
                  <div style="padding: 10px; border: 1px solid #000; min-height: 100px; margin-top: 10px;">
                     ${formattedNotes}
                  </div>
               </td></tr>
            </table>

            <p style="margin-top: 20px;">Demikian Berita Acara ini dibuat dengan sesungguhnya untuk dapat dipergunakan sebagaimana mestinya.</p>
         </div>

         ${getSignaturesHtml()}
      </div>
    `;
  };

  const handlePrint = () => {
    if (filteredStudents.length === 0 && activeTab === 'absen') { showToast("Tidak ada data untuk dicetak.", "warning"); return; }
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) { showToast("Pop-up diblokir browser.", "error"); return; }

    const htmlContent = `
      <html><head><title>Cetak Dokumen</title>
      <style>
        /* Trik Mematikan Header/Footer Tanggal, URL, dll bawaan Browser */
        @page { size: A4 portrait; margin: 0; } 
        body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff;}
        .print-container { padding: 20mm; box-sizing: border-box; }
      </style>
      </head><body>
         <div class="print-container">
            ${activeTab === 'absen' ? getAttendanceHtml() : getReportHtml()}
         </div>
      </body></html>
    `;
    
    // Script Penunggu Gambar agar tidak kosong saat diprint
    printWindow.document.write(htmlContent); 
    printWindow.document.close(); 
    
    const images = Array.from(printWindow.document.images);
    Promise.all(images.map(img => {
       if (img.complete) return Promise.resolve();
       return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
       });
    })).then(() => {
       setTimeout(() => {
          printWindow.focus();
          printWindow.print();
       }, 500);
    });
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 max-w-7xl mx-auto text-slate-900 relative pb-24">
      
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[150] w-[90%] sm:w-auto animate-in slide-in-from-top-10">
          <div className={`px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] shadow-2xl flex items-center gap-2 md:gap-3 border ${
             toast.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' : 
             toast.type === 'warning' ? 'bg-amber-500 border-amber-400 text-white' : 'bg-rose-500 border-rose-400 text-white'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 shrink-0" /> : <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 shrink-0" />}
            <p className="font-bold text-xs md:text-sm tracking-wide leading-snug">{toast.message}</p>
          </div>
        </div>
      )}

      {/* HEADER UTAMA DENGAN TOMBOL CETAK DI KANAN ATAS (Kotak Putih Melengkung) */}
      <div className="bg-white border border-slate-200 p-4 sm:p-5 md:p-6 rounded-xl md:rounded-[1.5rem] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-black text-slate-800 flex items-center gap-2 md:gap-3">
            <ClipboardList className="w-6 h-6 md:w-8 md:h-8 text-blue-600" /> <span className="truncate">Absensi & Berita Acara</span>
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium ml-8 md:ml-11 leading-snug">Buat dan cetak administrasi ujian dengan kustomisasi kop surat total.</p>
        </div>

        {/* TOMBOL CETAK */}
        <button onClick={handlePrint} className="flex items-center justify-center gap-1.5 md:gap-2 bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700 px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-2xl font-bold text-xs md:text-sm shadow-sm transition-colors shrink-0 w-full md:w-auto">
           <Printer className="w-4 h-4 md:w-5 md:h-5"/> Cetak {activeTab === 'absen' ? 'Daftar Hadir' : 'Berita Acara'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-8">
         
         {/* ================= PANEL KIRI: PENGATURAN & FILTER ================= */}
         <div className="xl:col-span-5 space-y-4 md:space-y-6">
            
            {/* TABS SELECTOR */}
            <div className="flex bg-slate-200/70 p-1 md:p-1.5 rounded-xl md:rounded-2xl shadow-inner">
               <button 
                  onClick={() => setActiveTab('absen')} 
                  className={`flex-1 py-2.5 md:py-3 px-3 md:px-4 rounded-lg md:rounded-xl font-black text-xs md:text-sm flex items-center justify-center gap-1.5 md:gap-2 transition-all truncate ${activeTab === 'absen' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
               >
                  <Users className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0"/> <span className="truncate">Daftar Hadir</span>
               </button>
               <button 
                  onClick={() => setActiveTab('berita_acara')} 
                  className={`flex-1 py-2.5 md:py-3 px-3 md:px-4 rounded-lg md:rounded-xl font-black text-xs md:text-sm flex items-center justify-center gap-1.5 md:gap-2 transition-all truncate ${activeTab === 'berita_acara' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
               >
                  <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0"/> <span className="truncate">Berita Acara</span>
               </button>
            </div>

            {/* FILTER DATA */}
            <div className="bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] p-4 md:p-6 shadow-sm space-y-3 md:space-y-4">
               <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2 border-b border-slate-100 pb-2 md:pb-3">
                  <Search className="w-4 h-4 md:w-5 md:h-5 text-indigo-500"/>
                  <h2 className="text-[10px] md:text-sm font-black text-slate-800 uppercase tracking-widest">Filter Data Siswa</h2>
               </div>
               
               <div className="space-y-1 md:space-y-1.5">
                  <label className="text-[10px] md:text-xs font-bold text-slate-500 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5"/> Jadwal Ujian (Mapel)</label>
                  <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-bold text-slate-800 outline-none cursor-pointer truncate pr-8">
                     {exams.map(e => <option key={e.id} value={e.id}>{e.subject} - {e.title} ({e.grade_level || 'Umum'})</option>)}
                  </select>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-1 md:space-y-1.5">
                     <label className="text-[10px] md:text-xs font-bold text-slate-500 flex items-center gap-1.5"><Building className="w-3.5 h-3.5"/> Ruangan</label>
                     <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-bold text-slate-800 outline-none cursor-pointer pr-8">
                        <option value="Semua">Semua Ruang</option>
                        {rooms.map(r => <option key={r.id} value={r.id}>{r.room_name}</option>)}
                     </select>
                  </div>
                  <div className="space-y-1 md:space-y-1.5">
                     <label className="text-[10px] md:text-xs font-bold text-slate-500 flex items-center gap-1.5"><Users className="w-3.5 h-3.5"/> Kelas</label>
                     <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-bold text-slate-800 outline-none cursor-pointer pr-8">
                        <option value="Semua">Semua Kelas</option>
                        {availableClassesForExam.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                  </div>
               </div>
            </div>

            {/* PENGATURAN KOP & TTD */}
            <div className="bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] p-4 md:p-6 shadow-sm space-y-3 md:space-y-4">
               
               {/* BARIS KOP SURAT DINAMIS */}
               <div className="flex justify-between items-center mb-1.5 md:mb-2 border-b border-slate-100 pb-2 md:pb-3">
                  <div className="flex items-center gap-1.5 md:gap-2">
                     <LayoutTemplate className="w-4 h-4 md:w-5 md:h-5 text-indigo-500"/>
                     <h2 className="text-[10px] md:text-sm font-black text-slate-800 uppercase tracking-widest">Kop Surat</h2>
                  </div>
                  <div className="flex gap-1.5 md:gap-2">
                     <button onClick={removeHeader} title="Kurangi Baris Kop" className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center bg-rose-100 text-rose-600 rounded-md md:rounded-lg hover:bg-rose-200 transition-colors"><Minus className="w-3 h-3"/></button>
                     <button onClick={addHeader} title="Tambah Baris Kop" className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center bg-blue-100 text-blue-600 rounded-md md:rounded-lg hover:bg-blue-200 transition-colors"><Plus className="w-3 h-3"/></button>
                  </div>
               </div>
               
               {/* KELOMPOK LOGO */}
               <div className="p-3 md:p-4 bg-slate-50 rounded-lg md:rounded-xl border border-slate-200 space-y-3 md:space-y-4">
                  <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 border-b border-slate-200 pb-1">Pengaturan Logo</p>
                  
                  {/* LOGO 1 (KIRI) */}
                  <div className="space-y-1.5">
                     <label className="text-[10px] md:text-xs font-black text-slate-600 flex items-center justify-between">
                        <span>Logo 1 (Kiri)</span><span className="text-[8px] md:text-[9px] text-blue-500 bg-blue-50 px-1 md:px-1.5 py-0.5 rounded">Kosongkan jika ingin disembunyikan</span>
                     </label>
                     <div className="relative">
                        <ImageIcon className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400"/>
                        <input type="url" name="logoUrl" value={docSettings.logoUrl} onChange={handleSettingChange} placeholder="Link Logo Kiri (GDrive)" className="w-full bg-white border border-slate-200 rounded-lg md:rounded-xl pl-8 md:pl-9 pr-3 md:pr-4 py-2 md:py-2.5 text-xs md:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                     </div>
                     {docSettings.logoUrl && (
                        <div className="pt-1.5 md:pt-2 space-y-1.5 md:space-y-2">
                           <div className="flex items-center gap-2 md:gap-3"><span className="text-[9px] md:text-[10px] font-bold text-slate-500 w-8 md:w-10">Ukuran</span><input type="range" name="logoSize" min="30" max="150" value={docSettings.logoSize} onChange={handleSettingChange} className="flex-1 accent-blue-500 h-1 md:h-1.5" /><span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-4 text-right">{docSettings.logoSize}</span></div>
                           <div className="flex items-center gap-2 md:gap-3"><span className="text-[9px] md:text-[10px] font-bold text-slate-500 w-8 md:w-10">Geser X</span><input type="range" name="logoOffsetX" min="-50" max="50" value={docSettings.logoOffsetX} onChange={handleSettingChange} className="flex-1 accent-blue-500 h-1 md:h-1.5" /><span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-4 text-right">{docSettings.logoOffsetX}</span></div>
                           <div className="flex items-center gap-2 md:gap-3"><span className="text-[9px] md:text-[10px] font-bold text-slate-500 w-8 md:w-10">Geser Y</span><input type="range" name="logoOffsetY" min="-50" max="50" value={docSettings.logoOffsetY} onChange={handleSettingChange} className="flex-1 accent-blue-500 h-1 md:h-1.5" /><span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-4 text-right">{docSettings.logoOffsetY}</span></div>
                        </div>
                     )}
                  </div>

                  {/* LOGO 2 (KANAN) */}
                  <div className="space-y-1.5 pt-2.5 md:pt-3 border-t border-slate-200">
                     <label className="text-[10px] md:text-xs font-black text-slate-600 flex items-center justify-between">
                        <span>Logo 2 (Kanan)</span><span className="text-[8px] md:text-[9px] text-blue-500 bg-blue-50 px-1 md:px-1.5 py-0.5 rounded">Kosongkan jika ingin disembunyikan</span>
                     </label>
                     <div className="relative">
                        <ImageIcon className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400"/>
                        <input type="url" name="logo2Url" value={docSettings.logo2Url} onChange={handleSettingChange} placeholder="Link Logo Kanan (GDrive)" className="w-full bg-white border border-slate-200 rounded-lg md:rounded-xl pl-8 md:pl-9 pr-3 md:pr-4 py-2 md:py-2.5 text-xs md:text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                     </div>
                     {docSettings.logo2Url && (
                        <div className="pt-1.5 md:pt-2 space-y-1.5 md:space-y-2">
                           <div className="flex items-center gap-2 md:gap-3"><span className="text-[9px] md:text-[10px] font-bold text-slate-500 w-8 md:w-10">Ukuran</span><input type="range" name="logo2Size" min="30" max="150" value={docSettings.logo2Size} onChange={handleSettingChange} className="flex-1 accent-blue-500 h-1 md:h-1.5" /><span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-4 text-right">{docSettings.logo2Size}</span></div>
                           <div className="flex items-center gap-2 md:gap-3"><span className="text-[9px] md:text-[10px] font-bold text-slate-500 w-8 md:w-10">Geser X</span><input type="range" name="logo2OffsetX" min="-50" max="50" value={docSettings.logo2OffsetX} onChange={handleSettingChange} className="flex-1 accent-blue-500 h-1 md:h-1.5" /><span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-4 text-right">{docSettings.logo2OffsetX}</span></div>
                           <div className="flex items-center gap-2 md:gap-3"><span className="text-[9px] md:text-[10px] font-bold text-slate-500 w-8 md:w-10">Geser Y</span><input type="range" name="logo2OffsetY" min="-50" max="50" value={docSettings.logo2OffsetY} onChange={handleSettingChange} className="flex-1 accent-blue-500 h-1 md:h-1.5" /><span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-4 text-right">{docSettings.logo2OffsetY}</span></div>
                        </div>
                     )}
                  </div>
               </div>

               <div className="space-y-2 mt-3 md:mt-4">
                  {docSettings.headers.map((h, i) => (
                     <div key={i} className="flex flex-col gap-2 p-2 md:p-3 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl">
                        <div className="flex gap-2 items-center">
                           <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase w-10 md:w-12 shrink-0">Baris {i+1}</span>
                           <input type="text" value={h.text} onChange={e => handleHeaderChange(i, 'text', e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-md md:rounded-lg px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm font-bold text-slate-800 outline-none min-w-0" placeholder="Teks Kop" />
                        </div>
                        <div className="flex gap-2 items-center pl-12 md:pl-14">
                           <input type="number" value={h.size} onChange={e => handleHeaderChange(i, 'size', Number(e.target.value))} className="w-12 md:w-16 bg-white border border-slate-200 rounded-md md:rounded-lg px-1.5 md:px-2 py-1 text-[10px] md:text-xs font-bold outline-none text-center" title="Ukuran Huruf (px)" />
                           <input type="color" value={h.color} onChange={e => handleHeaderChange(i, 'color', e.target.value)} className="w-6 h-6 md:w-8 md:h-8 rounded cursor-pointer border-0 p-0 shrink-0" title="Warna Teks" />
                           <button onClick={() => handleHeaderChange(i, 'bold', !h.bold)} className={`p-1 md:p-1.5 rounded-md md:rounded-lg border transition-colors shrink-0 ${h.bold ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`} title="Tebal (Bold)">
                              <Bold className="w-3.5 h-3.5 md:w-4 md:h-4"/>
                           </button>
                        </div>
                     </div>
                  ))}
               </div>

               <div className="pt-3 md:pt-4 border-t border-slate-100 space-y-3 md:space-y-4">
                  <div className="space-y-1.5">
                     <label className="text-[10px] md:text-xs font-bold text-slate-500 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5"/> Tanggal Dokumen</label>
                     <input type="date" name="examDate" value={docSettings.examDate} onChange={handleSettingChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-bold text-slate-800 outline-none" />
                  </div>

                  {/* TEKS PENGANTAR TANDA TANGAN (GLOBAL) */}
                  <div className="space-y-2.5 md:space-y-3 bg-indigo-50/50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-indigo-100 mt-3 md:mt-4 shadow-inner">
                     <p className="text-[9px] md:text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 mb-1 md:mb-2"><AlignLeft className="w-3.5 h-3.5"/> Teks Pengantar Tanda Tangan</p>
                     
                     <textarea name="sigTopText" value={docSettings.sigTopText} onChange={handleSettingChange} rows={2} placeholder="Misal: Wonosari, 30 Maret 2026..." className="w-full bg-white border border-slate-200 rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-bold text-slate-800 outline-none resize-none leading-relaxed" />
                     
                     <div className="flex gap-2 mb-1.5 md:mb-2">
                        <select name="sigTopAlign" value={docSettings.sigTopAlign} onChange={handleSettingChange} className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-bold text-slate-800 outline-none cursor-pointer">
                           <option value="left">Rata Kiri</option>
                           <option value="center">Rata Tengah</option>
                           <option value="right">Rata Kanan</option>
                        </select>
                     </div>
                     
                     <div className="flex items-center gap-2 md:gap-3">
                        <span className="text-[9px] md:text-[10px] font-bold text-slate-600 w-14 md:w-16">Jarak Bawah</span>
                        <input type="range" name="sigTopMarginBottom" min="0" max="100" value={docSettings.sigTopMarginBottom} onChange={handleSettingChange} className="flex-1 accent-indigo-500" />
                        <span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-6 text-right">{docSettings.sigTopMarginBottom}px</span>
                     </div>
                     <div className="flex items-center gap-2 md:gap-3">
                        <span className="text-[9px] md:text-[10px] font-bold text-slate-600 w-14 md:w-16">Geser Horz.</span>
                        <input type="range" name="sigTopX" min="-200" max="200" value={docSettings.sigTopX} onChange={handleSettingChange} className="flex-1 accent-indigo-500" />
                        <span className="text-[9px] md:text-[10px] font-bold text-slate-400 w-6 text-right">{docSettings.sigTopX}px</span>
                     </div>
                  </div>
                  
                  {/* PENGATURAN PENGAWAS DINAMIS */}
                  <div className="space-y-2.5 md:space-y-3 bg-slate-50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-200">
                     <div className="flex justify-between items-center">
                        <label className="text-[10px] md:text-xs font-bold text-slate-500 flex items-center gap-1.5"><UserCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4"/> Kolom Tanda Tangan</label>
                        <div className="flex gap-1.5 md:gap-2">
                           <button onClick={removeProctor} title="Kurangi Kolom TTD" className="w-5 h-5 md:w-7 md:h-7 flex items-center justify-center bg-rose-100 text-rose-600 rounded-md md:rounded-lg hover:bg-rose-200 transition-colors"><Minus className="w-3 h-3 md:w-4 md:h-4"/></button>
                           <button onClick={addProctor} title="Tambah Kolom TTD" className="w-5 h-5 md:w-7 md:h-7 flex items-center justify-center bg-blue-100 text-blue-600 rounded-md md:rounded-lg hover:bg-blue-200 transition-colors"><Plus className="w-3 h-3 md:w-4 md:h-4"/></button>
                        </div>
                     </div>

                     <div className={`grid grid-cols-1 ${docSettings.proctors.length > 1 ? 'sm:grid-cols-2' : ''} gap-3 md:gap-4`}>
                        {docSettings.proctors.map((p, idx) => (
                           <div key={idx} className="space-y-1.5 md:space-y-2 p-2.5 md:p-3 bg-white border border-slate-200 rounded-lg md:rounded-xl relative shadow-sm">
                              <p className="text-[9px] md:text-[10px] font-black text-slate-300 absolute top-2.5 right-2.5 md:top-3 md:right-3 uppercase tracking-widest">#{idx + 1}</p>
                              
                              <input type="text" value={p.role} onChange={(e) => handleProctorTextChange(idx, 'role', e.target.value)} placeholder="Jabatan (Pengawas/Kepsek)" className="w-full bg-white border border-slate-200 rounded-md md:rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-black text-blue-700 outline-none" />
                              
                              <select onChange={(e) => handleProctorSelect(idx, e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-md md:rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-bold text-slate-800 outline-none cursor-pointer">
                                 <option value="">Pilih Dari Database...</option>
                                 {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                              </select>
                              
                              <input type="text" value={p.name} onChange={(e) => handleProctorTextChange(idx, 'name', e.target.value)} placeholder="Ketik Nama Manual" className="w-full bg-white border border-slate-200 rounded-md md:rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-bold outline-none" />
                              <input type="text" value={p.nip} onChange={(e) => handleProctorTextChange(idx, 'nip', e.target.value)} placeholder="NIP (Opsional)" className="w-full bg-white border border-slate-200 rounded-md md:rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-medium outline-none" />
                           </div>
                        ))}
                     </div>
                  </div>
               </div>

               {activeTab === 'berita_acara' && (
                  <div className="pt-3 md:pt-4 border-t border-slate-100 space-y-1 md:space-y-1.5 animate-in fade-in slide-in-from-top-2">
                     <label className="text-[10px] md:text-xs font-bold text-slate-500 flex items-center gap-1.5"><PenTool className="w-3.5 h-3.5"/> Catatan Kejadian Ujian</label>
                     <textarea name="notes" value={docSettings.notes} onChange={handleSettingChange} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-medium text-slate-800 outline-none resize-none leading-relaxed" placeholder="Ketikan catatan insiden atau kejadian di sini..." />
                  </div>
               )}
            </div>

         </div>

         {/* ================= PANEL KANAN: LIVE PREVIEW ================= */}
         <div className="xl:col-span-7 space-y-6">
            {/* Pada layar mobile/tablet, tambahkan pesan instruksi scroll */}
            <div className="md:hidden text-center text-[10px] text-slate-500 font-bold mb-2">
               <span className="bg-slate-200 px-2 py-1 rounded">Geser dokumen (Preview A4) untuk melihat penuh</span>
            </div>
            
            <div className="bg-slate-200/50 border border-slate-200 rounded-xl md:rounded-[1.5rem] p-2 md:p-6 shadow-inner h-[60vh] sm:h-[80vh] md:h-[1000px] overflow-auto flex flex-col items-center custom-scrollbar">
               <div className="w-full flex items-center justify-between mb-4 md:mb-6 max-w-[210mm] shrink-0 sticky left-0 right-0">
                  <h2 className="text-[10px] md:text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 md:gap-2"><Eye className="w-3.5 h-3.5 md:w-4 h-4"/> Pratinjau Cetak (A4)</h2>
                  <span className="bg-white px-2.5 md:px-3 py-1 rounded-md md:rounded-lg border border-slate-200 text-[10px] md:text-xs font-bold text-blue-600 shadow-sm">{filteredStudents.length} Peserta</span>
               </div>

               {loading ? (
                  <div className="flex justify-center py-20 w-full"><LoaderCircle className="w-8 h-8 md:w-8 md:h-8 text-blue-500 animate-spin"/></div>
               ) : (
                  // KERTAS A4 PREVIEW (SKALA ASLI - Dalam Wrapper Overflow)
                  // Gunakan style transform untuk scale down di HP agar tidak terlalu raksasa,
                  // atau biarkan dengan overflow-auto. Di sini menggunakan overflow-auto + margin auto.
                  <div 
                     className="bg-white shadow-xl pointer-events-none shrink-0" 
                     style={{ width: '210mm', minHeight: '297mm', padding: '20mm', boxSizing: 'border-box', marginBottom: '20px' }}
                     dangerouslySetInnerHTML={{ __html: activeTab === 'absen' ? getAttendanceHtml() : getReportHtml() }}
                  />
               )}
            </div>
         </div>
      </div>
    </div>
  );
}