'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import { 
  ShieldCheck, MonitorSmartphone, MapPin, Camera, 
  Save, LoaderCircle, CheckCircle2, AlertCircle, 
  Search, ShieldAlert, Globe, Info, HelpCircle, AlertTriangle, ChevronDown
} from 'lucide-react';

// Import komponen peta secara dinamis (Wajib untuk Next.js + Leaflet)
const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-[250px] md:h-[300px] w-full bg-slate-50 animate-pulse rounded-xl md:rounded-2xl flex flex-col items-center justify-center text-slate-400 font-bold border border-slate-200 text-xs md:text-sm">
      <LoaderCircle className="w-5 h-5 md:w-6 md:h-6 animate-spin mb-2" /> Memuat Peta Interaktif...
    </div>
  )
});

interface Exam {
  id: string;
  title: string;
  subject: string;
  grade_level: string;
}

interface SecuritySettings {
  exam_id: string;
  enable_fullscreen: boolean;
  enable_copy_paste: boolean;
  enable_watermark: boolean;
  enable_camera_proctoring: boolean;
  enable_geolocation: boolean;
  allowed_radius_meters: number;
  school_latitude: number | null;
  school_longitude: number | null;
  enable_ip_tracking: boolean;
  single_device_lock: boolean;
}

const defaultSettings: SecuritySettings = {
  exam_id: '',
  enable_fullscreen: true,
  enable_copy_paste: false,
  enable_watermark: true,
  enable_camera_proctoring: false,
  enable_geolocation: false,
  allowed_radius_meters: 100,
  school_latitude: null,
  school_longitude: null,
  enable_ip_tracking: true,
  single_device_lock: true,
};

export default function ExamSecurityPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [settings, setSettings] = useState<SecuritySettings>(defaultSettings);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // UI NOTIFIKASI
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [dialogConfig, setDialogConfig] = useState<{
      isOpen: boolean; type: 'alert' | 'confirm' | 'success'; title: string; message: string;
      onConfirm?: () => void; onCancel?: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  // Pemicu unik untuk memaksa peta me-render ulang dengan aman (Menghindari Error 'Reused by another instance')
  const mapKey = `map-${selectedExamId}-${settings.enable_geolocation ? 'on' : 'off'}`;

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const showDialog = useCallback((type: 'alert'|'confirm'|'success', title: string, message: string, onConfirm?: () => void, onCancel?: () => void) => {
    setDialogConfig({ isOpen: true, type, title, message, onConfirm, onCancel });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogConfig(prev => ({ ...prev, isOpen: false }));
  }, []);

  // 1. Ambil Daftar Ujian
  useEffect(() => {
    const fetchExams = async () => {
      try {
        const { data, error } = await supabase.from('exams').select('id, title, subject, grade_level').order('created_at', { ascending: false });
        if (error) throw error;
        setExams(data || []);
        if (data && data.length > 0) {
          setSelectedExamId(data[0].id);
        }
      } catch (err: any) {
        showToast("Gagal memuat ujian: " + err.message, "error");
      } finally {
        setLoading(false);
      }
    };
    fetchExams();
  }, []);

  // 2. Ambil Pengaturan Saat Ujian Dipilih
  useEffect(() => {
    if (!selectedExamId) return;
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('exam_security_settings').select('*').eq('exam_id', selectedExamId).single();
        
        if (error && error.code !== 'PGRST116') throw error; 
        
        if (data) {
          setSettings(data as SecuritySettings);
        } else {
          setSettings({ ...defaultSettings, exam_id: selectedExamId });
        }
      } catch (err: any) {
        showToast("Gagal memuat pengaturan: " + err.message, "error");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [selectedExamId]);

  // 3. Simpan Pengaturan (Super Aman & Anti-Overflow)
  const handleSave = async () => {
    if (!selectedExamId) return;
    setSaving(true);
    try {
      const payload = { 
        exam_id: selectedExamId,
        enable_fullscreen: settings.enable_fullscreen,
        enable_copy_paste: settings.enable_copy_paste,
        enable_watermark: settings.enable_watermark,
        enable_camera_proctoring: settings.enable_camera_proctoring,
        enable_geolocation: settings.enable_geolocation,
        enable_ip_tracking: settings.enable_ip_tracking,
        single_device_lock: settings.single_device_lock,
        
        allowed_radius_meters: Math.round(Number(settings.allowed_radius_meters) || 100),
        school_latitude: settings.school_latitude ? Number(Number(settings.school_latitude).toFixed(4)) : null,
        school_longitude: settings.school_longitude ? Number(Number(settings.school_longitude).toFixed(4)) : null,
        
        updated_at: new Date().toISOString() 
      };

      const { error } = await supabase.from('exam_security_settings').upsert(payload, { onConflict: 'exam_id' });
      
      if (error) throw error;
      showToast("Sistem Pertahanan berhasil diperbarui!", "success");
    } catch (err: any) {
      showToast("Gagal menyimpan: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (field: keyof SecuritySettings) => {
    setSettings(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleNumberChange = (field: keyof SecuritySettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast("Browser Anda tidak mendukung Geolocation.", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(4));
        const lng = Number(position.coords.longitude.toFixed(4));

        setSettings(prev => ({
          ...prev,
          school_latitude: lat,
          school_longitude: lng
        }));
        showToast("Titik koordinat berhasil didapatkan!", "success");
      },
      (error) => {
        showToast("Gagal mendapatkan lokasi. Pastikan izin GPS diberikan.", "error");
      }
    );
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 max-w-7xl mx-auto text-slate-900 relative pb-24 md:pb-20">
      
      {/* TOAST NOTIFIKASI ELEGAN */}
      {toast && (
        <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[150] w-[90%] sm:w-auto animate-in slide-in-from-top-10">
          <div className={`px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] shadow-2xl flex items-center gap-2 md:gap-3 border backdrop-blur-md ${
             toast.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-700' : 
             toast.type === 'warning' ? 'bg-amber-50/95 border-amber-200 text-amber-700' : 'bg-rose-50/95 border-rose-200 text-rose-700'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className={`w-4 h-4 md:w-5 md:h-5 shrink-0 text-emerald-500`} /> : <AlertTriangle className={`w-4 h-4 md:w-5 md:h-5 shrink-0 ${toast.type === 'warning' ? 'text-amber-500' : 'text-rose-500'}`} />}
            <p className="font-bold text-xs md:text-sm tracking-wide leading-snug">{toast.message}</p>
          </div>
        </div>
      )}

      {/* CUSTOM DIALOG MODAL (POPUP ELEGANT) */}
      {dialogConfig.isOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm md:max-w-md rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
            <div className="p-6 md:p-8 flex flex-col items-center text-center">
               <div className={`w-16 h-16 md:w-20 md:h-20 rounded-xl md:rounded-[1.5rem] flex items-center justify-center mb-4 md:mb-6 shadow-inner border 
                  ${dialogConfig.type === 'confirm' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                    dialogConfig.type === 'success' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 
                    'bg-rose-50 text-rose-600 border-rose-100'}`}>
                  {dialogConfig.type === 'confirm' ? <HelpCircle className="w-8 h-8 md:w-10 md:h-10" /> : 
                   dialogConfig.type === 'success' ? <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10" /> :
                   <AlertTriangle className="w-8 h-8 md:w-10 md:h-10" />}
               </div>
               <h3 className="text-xl md:text-2xl font-black text-slate-800 mb-2 md:mb-3">{dialogConfig.title}</h3>
               <p className="text-slate-500 font-medium text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{dialogConfig.message}</p>
            </div>
            <div className="p-3 md:p-4 bg-slate-50/80 border-t border-slate-100 flex gap-2 md:gap-3 justify-center">
               {dialogConfig.type === 'confirm' && (
                 <button onClick={() => { closeDialog(); if(dialogConfig.onCancel) dialogConfig.onCancel(); }} className="px-4 md:px-6 py-3 md:py-3.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors w-full shadow-sm text-sm">Batal</button>
               )}
               <button onClick={() => { closeDialog(); if(dialogConfig.onConfirm) dialogConfig.onConfirm(); }} className={`px-4 md:px-6 py-3 md:py-3.5 rounded-xl font-bold text-white transition-all shadow-md active:scale-95 w-full text-sm ${dialogConfig.type === 'alert' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : dialogConfig.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}>Mengerti</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER DENGAN KOTAK PUTIH (SESUAI TEMA APLIKASI) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 md:px-8 md:py-6 rounded-2xl md:rounded-[2rem] border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2 md:gap-3">
            <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-blue-600" /> Keamanan Lanjutan
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium ml-8 md:ml-11 leading-snug">Kelola pengaturan keamanan ujian seperti token, deteksi kecurangan.</p>
        </div>
        <button onClick={handleSave} disabled={saving || loading} className="flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 px-6 md:px-8 py-3 md:py-3.5 rounded-xl font-bold text-xs md:text-sm shadow-md shadow-blue-200 transition-all active:scale-95 disabled:opacity-70 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
           {saving ? <LoaderCircle className="w-4 h-4 md:w-5 md:h-5 animate-spin"/> : <Save className="w-4 h-4 md:w-5 md:h-5"/>} {saving ? 'Mengunci...' : 'Terapkan Keamanan'}
        </button>
      </div>

      {/* SELECTOR UJIAN */}
      <div className="bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] p-4 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
         <div className="flex items-center gap-2 md:gap-3 text-slate-700 font-bold text-xs md:text-sm shrink-0">
            <Search className="w-4 h-4 md:w-5 md:h-5 text-blue-500" /> Pilih Target Jadwal Ujian :
         </div>
         <div className="relative w-full">
           <select 
              value={selectedExamId} 
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl pl-3 md:pl-4 pr-8 py-2.5 md:py-3 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-sm transition-colors appearance-none truncate"
           >
              {exams.length === 0 ? <option>Belum ada ujian tersedia</option> : null}
              {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.subject} - {ex.title} ({ex.grade_level || 'Umum'})</option>)}
           </select>
           <ChevronDown className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
         </div>
      </div>

      {loading ? (
         <div className="py-16 md:py-20 flex justify-center"><LoaderCircle className="w-8 h-8 md:w-10 md:h-10 text-blue-500 animate-spin" /></div>
      ) : (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 pb-20">
            
            {/* PANEL 1: MONITOR & DEVICE */}
            <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[1.5rem] overflow-hidden shadow-sm h-fit">
               <div className="bg-slate-50 border-b border-slate-100 p-4 md:p-5 flex items-center gap-2 md:gap-3">
                  <MonitorSmartphone className="w-5 h-5 md:w-6 md:h-6 text-indigo-500" />
                  <h2 className="font-black text-slate-800 text-base md:text-lg">Perangkat & Layar</h2>
               </div>
               <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                  {/* Toggle Fullscreen */}
                  <div className="flex items-start justify-between gap-3 md:gap-4">
                     <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-800 text-sm">Wajib Mode Layar Penuh (Fullscreen)</p>
                        <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-1 leading-snug">Mengunci tampilan penuh. Jika siswa keluar layar penuh (Esc/F11), ujian diblokir sementara.</p>
                     </div>
                     <ToggleSwitch checked={settings.enable_fullscreen} onChange={() => handleToggle('enable_fullscreen')} />
                  </div>

                  {/* Deteksi Device */}
                  <div className="flex items-start justify-between gap-3 md:gap-4 border-t border-slate-100 pt-4 md:pt-5">
                     <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-800 text-sm">Kunci Sidik Jari Perangkat (1 Device Only)</p>
                        <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-1 leading-snug">Mencegah login ganda. Jika login di HP lalu mencoba login di Laptop, sesi pertama akan ditutup paksa.</p>
                     </div>
                     <ToggleSwitch checked={settings.single_device_lock} onChange={() => handleToggle('single_device_lock')} />
                  </div>
               </div>
            </div>

            {/* PANEL 2: INTEGRITAS SOAL */}
            <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[1.5rem] overflow-hidden shadow-sm h-fit">
               <div className="bg-slate-50 border-b border-slate-100 p-4 md:p-5 flex items-center gap-2 md:gap-3">
                  <ShieldAlert className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
                  <h2 className="font-black text-slate-800 text-base md:text-lg">Integritas Konten Ujian</h2>
               </div>
               <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                  {/* Toggle Copy Paste */}
                  <div className="flex items-start justify-between gap-3 md:gap-4">
                     <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-800 text-sm">Cegah Copy, Paste & Klik Kanan</p>
                        <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-1 leading-snug">Mematikan fungsi Ctrl+C, Ctrl+V, menu klik kanan, dan memblok seleksi teks pada soal.</p>
                     </div>
                     <ToggleSwitch checked={!settings.enable_copy_paste} onChange={() => handleToggle('enable_copy_paste')} />
                  </div>
                  
                  {/* Toggle Watermark */}
                  <div className="flex items-start justify-between gap-3 md:gap-4 border-t border-slate-100 pt-4 md:pt-5">
                     <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-800 text-sm">Watermark Bergerak Anti-Bocor</p>
                        <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-1 leading-snug">Menampilkan nama dan NIS siswa secara transparan di seluruh layar untuk melacak pelaku tangkapan layar/foto HP.</p>
                     </div>
                     <ToggleSwitch checked={settings.enable_watermark} onChange={() => handleToggle('enable_watermark')} />
                  </div>
               </div>
            </div>

            {/* PANEL 3: GEOLOCATION & JARINGAN */}
            <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[1.5rem] overflow-hidden shadow-sm h-fit">
               <div className="bg-slate-50 border-b border-slate-100 p-4 md:p-5 flex items-center gap-2 md:gap-3">
                  <MapPin className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />
                  <h2 className="font-black text-slate-800 text-base md:text-lg">Lokasi & Jaringan</h2>
               </div>
               <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                  {/* Toggle Geolocation */}
                  <div className="flex items-start justify-between gap-3 md:gap-4">
                     <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-800 text-sm">Pembatasan Radius Lokasi GPS</p>
                        <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-1 leading-snug">Siswa harus berada di area sekolah untuk bisa mengakses soal. (Wajib aktifkan GPS).</p>
                     </div>
                     <ToggleSwitch checked={settings.enable_geolocation} onChange={() => handleToggle('enable_geolocation')} />
                  </div>
                  
                  {/* Set Koordinat */}
                  {settings.enable_geolocation && (
                     <div className="bg-emerald-50 p-4 md:p-5 rounded-xl md:rounded-2xl border border-emerald-100 space-y-3 md:space-y-4 animate-in fade-in slide-in-from-top-2 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                           <div>
                              <label className="text-[9px] md:text-[10px] font-black text-emerald-700 uppercase tracking-widest block mb-1.5 md:mb-2">Titik Latitude</label>
                              <input type="number" step="any" value={settings.school_latitude || ''} onChange={(e) => handleNumberChange('school_latitude', e.target.value)} className="w-full bg-white border border-emerald-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-bold text-slate-800 outline-none shadow-sm" placeholder="-6.200000" />
                           </div>
                           <div>
                              <label className="text-[9px] md:text-[10px] font-black text-emerald-700 uppercase tracking-widest block mb-1.5 md:mb-2">Titik Longitude</label>
                              <input type="number" step="any" value={settings.school_longitude || ''} onChange={(e) => handleNumberChange('school_longitude', e.target.value)} className="w-full bg-white border border-emerald-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-bold text-slate-800 outline-none shadow-sm" placeholder="106.816666" />
                           </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 md:gap-4 pt-1">
                           <div className="w-full sm:flex-1">
                              <label className="text-[9px] md:text-[10px] font-black text-emerald-700 uppercase tracking-widest block mb-1.5 md:mb-2">Maksimal Radius (Jarak)</label>
                              <div className="flex items-center gap-2 md:gap-3">
                                 <input type="number" min="10" value={settings.allowed_radius_meters} onChange={(e) => handleNumberChange('allowed_radius_meters', e.target.value)} className="w-20 md:w-24 bg-white border border-emerald-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-black text-emerald-800 outline-none text-center shadow-sm" />
                                 <span className="text-xs md:text-sm font-bold text-emerald-600">Meter</span>
                              </div>
                           </div>
                           <button onClick={getCurrentLocation} className="w-full sm:w-auto text-[10px] md:text-xs font-bold bg-white border border-emerald-200 text-emerald-600 px-4 md:px-5 py-2.5 rounded-lg md:rounded-xl hover:bg-emerald-100 flex justify-center items-center gap-1.5 md:gap-2 transition-colors shadow-sm active:scale-95 shrink-0">
                              <Globe className="w-3.5 h-3.5 md:w-4 md:h-4"/> Titik Saat Ini
                           </button>
                        </div>

                        {/* Peta Interaktif - Ditambahkan key untuk hindari error reused */}
                        <div className="rounded-lg md:rounded-xl overflow-hidden border border-emerald-200 shadow-sm relative z-0 mt-2">
                           <MapPicker 
                             key={mapKey}
                             lat={settings.school_latitude} 
                             lng={settings.school_longitude} 
                             radius={settings.allowed_radius_meters}
                             onChange={(newLat, newLng) => {
                               setSettings(prev => ({ ...prev, school_latitude: newLat, school_longitude: newLng }));
                             }}
                           />
                        </div>
                     </div>
                  )}

                  {/* Toggle IP Tracking */}
                  <div className="flex items-start justify-between gap-3 md:gap-4 border-t border-slate-100 pt-4 md:pt-5">
                     <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-800 text-sm">Lacak Alamat IP Jaringan</p>
                        <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-1 leading-snug">Mencatat IP siswa untuk memastikan mereka terhubung ke WiFi sekolah (Bukan pakai VPN/Data Seluler).</p>
                     </div>
                     <ToggleSwitch checked={settings.enable_ip_tracking} onChange={() => handleToggle('enable_ip_tracking')} />
                  </div>
               </div>
            </div>

            {/* PANEL 4: PROCTORING (KAMERA) */}
            <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[1.5rem] overflow-hidden shadow-sm h-fit">
               <div className="bg-slate-50 border-b border-slate-100 p-4 md:p-5 flex items-center gap-2 md:gap-3">
                  <Camera className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
                  <h2 className="font-black text-slate-800 text-base md:text-lg">Proctoring Biometrik</h2>
               </div>
               <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                  <div className="flex items-start justify-between gap-3 md:gap-4">
                     <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-800 text-sm">Tangkapan Kamera Acak (Webcam/Kamera Depan)</p>
                        <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-1 leading-snug">Sistem akan meminta izin kamera dan mengambil foto wajah siswa setiap beberapa menit secara acak (Random Snapshot) untuk memastikan tidak ada joki yang menggantikan.</p>
                     </div>
                     <ToggleSwitch checked={settings.enable_camera_proctoring} onChange={() => handleToggle('enable_camera_proctoring')} />
                  </div>
                  
                  {settings.enable_camera_proctoring && (
                     <div className="bg-blue-50 p-4 md:p-5 rounded-xl md:rounded-2xl border border-blue-100 text-xs md:text-sm font-medium text-blue-800 flex items-start gap-2.5 md:gap-3 animate-in fade-in shadow-sm">
                        <Info className="w-5 h-5 md:w-6 md:h-6 shrink-0 mt-0.5 md:mt-0 text-blue-600" />
                        <p className="leading-snug md:leading-relaxed">Pastikan server penyimpanan Anda memadai karena fitur ini akan menghasilkan ribuan foto gambar kecil selama ujian berlangsung.</p>
                     </div>
                  )}
               </div>
            </div>

         </div>
      )}
    </div>
  );
}

// Komponen Toggle Switch Custom Tailwind (Warna Biru)
function ToggleSwitch({ checked, onChange }: { checked: boolean, onChange: () => void }) {
   return (
      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5 shadow-sm rounded-full">
         <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
         <div className="w-12 h-6 md:w-14 md:h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 md:after:h-6 md:after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
   );
}