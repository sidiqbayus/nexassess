'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, Palette, Database, Save, LoaderCircle, 
  CheckCircle2, AlertTriangle, MonitorSmartphone, MapPin, 
  UserCircle2, FileImage, Server, AlertCircle, Trash2, KeyRound,
  Phone, Mail, Globe, Printer, UploadCloud, Send, Sliders, HelpCircle, Info
} from 'lucide-react';

// HELPER: Mengubah Link Drive menjadi link Thumbnail
const getDriveImageUrl = (url: string | undefined | null) => {
  if (!url) return '';
  const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
  return url;
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profil' | 'akun' | 'tampilan' | 'sistem'>('profil');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // FITUR BARU: Custom Dialog Modal State
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean; type: 'confirm' | 'danger'; title: string; message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'confirm', title: '', message: '' });

  // State Pengaturan (Sesuai kolom bahasa Indonesia di Supabase)
  const [settings, setSettings] = useState({
    nama_sekolah: '',
    tahun_ajaran: '',
    jalan: '',
    dusun: '',
    rt: '',
    rw: '',
    desa_kelurahan: '',
    kecamatan: '',
    kabupaten_kota: '',
    provinsi: '',
    kode_pos: '',
    telepon: '',
    fax: '',
    email_instansi: '',
    website: '',
    logo_kiri: '',
    logo_kanan: '',
    nama_kepsek: '',
    nip_kepsek: '',
    ttd_kepsek: '',
    nama_aplikasi: 'CBT SMART',
    ikon_aplikasi: '',
    background_login: '',
    teks_pengumuman: '',
    mode_perbaikan: false,
    zona_waktu: 'Asia/Jakarta'
  });

  // State Profil Admin Terhubung dengan Tabel `users`
  const [adminProfile, setAdminProfile] = useState({
    id: '',
    email: '',
    full_name: '',
    role: '',
    avatar_url: '',
    skala_avatar: 100,
    posisi_x_avatar: 0,
    posisi_y_avatar: 0,
    password: '••••••••'
  });

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState<string | null>(null); 
  const [avatarError, setAvatarError] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const showDialog = useCallback((type: 'confirm' | 'danger', title: string, message: string, onConfirm: () => void) => {
    setDialogConfig({ isOpen: true, type, title, message, onConfirm });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogConfig(prev => ({ ...prev, isOpen: false }));
  }, []);

  useEffect(() => {
    fetchSettingsAndProfile();
  }, []);

  useEffect(() => {
    setAvatarError(false);
  }, [adminProfile.avatar_url]);

  const fetchSettingsAndProfile = async () => {
    setIsLoading(true);
    try {
      const { data: appData, error: appError } = await supabase.from('pengaturan_aplikasi').select('*').eq('id', 1).single();
      if (appError && appError.code !== 'PGRST116') console.warn("Tabel pengaturan_aplikasi error:", appError);
      
      if (appData) {
        const safeData: any = {};
        Object.keys(appData).forEach(key => {
          safeData[key] = appData[key] === null ? '' : appData[key];
        });
        setSettings(prev => ({ ...prev, ...safeData }));
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData, error: userError } = await supabase.from('users').select('*').eq('id', user.id).single();
        if (userError) console.warn("Gagal menarik profil user:", userError);

        setAdminProfile({
          id: user.id,
          email: user.email || userData?.email || '',
          full_name: userData?.full_name || '',
          role: userData?.role || 'admin',
          avatar_url: userData?.avatar_url || '',
          skala_avatar: userData?.skala_avatar ?? 100,
          posisi_x_avatar: userData?.posisi_x_avatar ?? 0,
          posisi_y_avatar: userData?.posisi_y_avatar ?? 0,
          password: '••••••••'
        });
      }
    } catch (error: any) {
      console.warn("Gagal memuat pengaturan:", error);
      showToast("Data dimuat dengan default. Detail: " + error.message, "warning");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error: appError } = await supabase.from('pengaturan_aplikasi').upsert({ id: 1, ...settings });
      if (appError) throw appError;

      if (adminProfile.id) {
        const updatePayload: any = { 
          full_name: adminProfile.full_name,
          avatar_url: adminProfile.avatar_url,
          skala_avatar: adminProfile.skala_avatar,
          posisi_x_avatar: adminProfile.posisi_x_avatar,
          posisi_y_avatar: adminProfile.posisi_y_avatar
        };

        const { error: profileError } = await supabase.from('users').update(updatePayload).eq('id', adminProfile.id);
        if (profileError) console.warn("Gagal update profil admin:", profileError);
      }

      showToast("Pengaturan berhasil disimpan!", "success");
    } catch (error: any) {
      showToast("Gagal menyimpan: " + error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { 
      showToast("Ukuran file maksimal 5MB.", "warning");
      return;
    }

    setIsUploadingAvatar(true);
    showToast("Mengunggah foto...", "info");

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `profiles/avatar_${adminProfile.id}_${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage.from('avatars').upload(fileName, file);
      if (error) throw error;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);

      setAdminProfile(prev => ({ ...prev, avatar_url: data.publicUrl }));
      showToast("Foto profil berhasil diunggah!", "success");
    } catch (err: any) {
      showToast("Gagal unggah: " + err.message, "error");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // PERBAIKAN: Upload Media Instansi kini masuk ke folder 'instansi' di bucket 'avatars'
  const handleInstansiMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { 
      showToast("Ukuran file terlalu besar! Maksimal 5MB.", "error");
      return;
    }

    setIsUploadingMedia(fieldName);
    showToast("Sedang mengunggah file ke server...", "info");

    try {
      const fileExt = file.name.split('.').pop();
      // Mengarahkan path ke folder instansi/
      const fileName = `instansi/media_${fieldName}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error } = await supabase.storage.from('avatars').upload(fileName, file);
      if (error) throw error;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);

      setSettings(prev => ({ ...prev, [fieldName]: data.publicUrl }));
      showToast("File berhasil diunggah!", "success");
    } catch (err: any) {
      showToast("Gagal unggah: " + err.message, "error");
    } finally {
      setIsUploadingMedia(null);
    }
  };

  const handleSendResetPassword = async () => {
    if (!adminProfile.email) return;
    
    showDialog('confirm', 'Kirim Link Pemulihan', `Sistem akan mengirimkan tautan reset kata sandi ke email:\n${adminProfile.email}\n\nApakah Anda ingin melanjutkan?`, async () => {
      closeDialog();
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(adminProfile.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        showToast("Link reset password telah dikirim ke email Anda!", "success");
      } catch (error: any) {
        showToast("Gagal mengirim email: " + error.message, "error");
      }
    });
  };

  const handleClearSessions = async () => {
    showDialog('danger', 'Peringatan Berbahaya!', "Apakah Anda yakin ingin MENGHAPUS SEMUA DATA SESI UJIAN DAN JAWABAN SISWA?\n\nTindakan ini tidak bisa dibatalkan!", async () => {
      closeDialog();
      try {
        const { error } = await supabase.from('exam_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        showToast("Seluruh sesi ujian berhasil di-reset.", "success");
      } catch (error: any) {
        showToast("Gagal reset sesi: " + error.message, "error");
      }
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setSettings(prev => ({ ...prev, [name]: checked }));
    } else {
      setSettings(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setAdminProfile(prev => ({ 
      ...prev, 
      [name]: type === 'range' || type === 'number' ? Number(value) : value 
    }));
  };

  const finalAvatarUrl = useMemo(() => getDriveImageUrl(adminProfile.avatar_url), [adminProfile.avatar_url]);

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all placeholder:text-slate-400";
  const labelClass = "text-xs font-black text-slate-500 uppercase tracking-widest block mb-2";

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><LoaderCircle className="w-12 h-12 text-blue-500 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 max-w-7xl mx-auto text-slate-900 relative">
      
      {/* TOAST NOTIFIKASI */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-top-10">
          <div className={`px-6 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border ${
             toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
             toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' : 
             toast.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-700' :
             'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : 
             toast.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> : 
             toast.type === 'info' ? <Info className="w-5 h-5" /> :
             <AlertCircle className="w-5 h-5" />}
            <p className="font-bold text-sm tracking-wide">{toast.message}</p>
          </div>
        </div>
      )}

      {/* CUSTOM DIALOG MODAL */}
      {dialogConfig.isOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/50">
            <div className="p-8 flex flex-col items-center text-center">
               <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-inner border 
                  ${dialogConfig.type === 'confirm' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                  {dialogConfig.type === 'confirm' ? <HelpCircle className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
               </div>
               <h3 className="text-2xl font-black text-slate-800 mb-3">{dialogConfig.title}</h3>
               <p className="text-slate-500 font-medium text-sm leading-relaxed whitespace-pre-wrap">{dialogConfig.message}</p>
            </div>
            <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex gap-3 justify-center">
               <button onClick={closeDialog} className="px-6 py-3.5 rounded-2xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors w-full shadow-sm">Batal</button>
               <button onClick={dialogConfig.onConfirm} className={`px-6 py-3.5 rounded-2xl font-bold text-white transition-all shadow-lg active:scale-95 w-full ${dialogConfig.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}>
                 {dialogConfig.type === 'danger' ? 'Ya, Hapus Data' : 'Ya, Kirim'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* PERBAIKAN: HEADER & TOMBOL SIMPAN (Menghapus efek sticky top-4 z-40) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:px-8 md:py-6 rounded-[2rem] border border-blue-100 shadow-sm">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><MonitorSmartphone className="w-6 h-6" /></div>
           <div>
             <h1 className="text-xl font-black text-slate-800">Pengaturan Sistem</h1>
             <p className="text-slate-500 text-sm font-medium">Kelola konfigurasi global aplikasi CBT Anda.</p>
           </div>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-md shadow-blue-200 active:scale-95 whitespace-nowrap w-full md:w-auto">
          {isSaving ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* SIDEBAR TABS */}
        <div className="lg:col-span-1 space-y-3 flex flex-row lg:flex-col overflow-x-auto pb-2 lg:pb-0">
          <button onClick={() => setActiveTab('profil')} className={`flex items-center gap-3 p-4 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'profil' ? 'bg-blue-50 text-blue-700 border-blue-200 border-2 shadow-sm' : 'bg-white text-slate-600 border-2 border-transparent hover:border-slate-200 hover:bg-slate-50'}`}>
            <Building2 className="w-5 h-5" /> Profil Instansi
          </button>
          
          <button onClick={() => setActiveTab('akun')} className={`flex items-center gap-3 p-4 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'akun' ? 'bg-blue-50 text-blue-700 border-blue-200 border-2 shadow-sm' : 'bg-white text-slate-600 border-2 border-transparent hover:border-slate-200 hover:bg-slate-50'}`}>
            <UserCircle2 className="w-5 h-5" /> Akun Admin
          </button>

          <button onClick={() => setActiveTab('tampilan')} className={`flex items-center gap-3 p-4 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'tampilan' ? 'bg-blue-50 text-blue-700 border-blue-200 border-2 shadow-sm' : 'bg-white text-slate-600 border-2 border-transparent hover:border-slate-200 hover:bg-slate-50'}`}>
            <Palette className="w-5 h-5" /> Tema & Tampilan
          </button>

          <button onClick={() => setActiveTab('sistem')} className={`flex items-center gap-3 p-4 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'sistem' ? 'bg-blue-50 text-blue-700 border-blue-200 border-2 shadow-sm' : 'bg-white text-slate-600 border-2 border-transparent hover:border-slate-200 hover:bg-slate-50'}`}>
            <Database className="w-5 h-5" /> Sistem & Data
          </button>
        </div>

        {/* KONTEN TAB */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm min-h-[600px]">
          
          {/* TAB 1: PROFIL INSTANSI */}
          {activeTab === 'profil' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className={labelClass}>Nama Sekolah / Instansi Utama</label>
                  <input type="text" name="nama_sekolah" value={settings.nama_sekolah} onChange={handleChange} className={inputClass} placeholder="Contoh: SMA Negeri 1 Bima" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className={labelClass}>Tahun Ajaran / Periode</label>
                  <input type="text" name="tahun_ajaran" value={settings.tahun_ajaran} onChange={handleChange} className={inputClass} placeholder="Contoh: Tahun Ajaran 2025/2026" />
                </div>
              </div>

              {/* SECTION ALAMAT LENGKAP */}
              <div className="pt-6 border-t border-slate-100">
                <div className="mb-6 flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><MapPin className="w-4 h-4"/></div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Alamat Lengkap Instansi</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <label className={labelClass}>Nama Jalan</label>
                    <input type="text" name="jalan" value={settings.jalan} onChange={handleChange} className={inputClass} placeholder="Contoh: Jl. Pendidikan No. 1" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Dusun / Lingkungan</label>
                    <input type="text" name="dusun" value={settings.dusun} onChange={handleChange} className={inputClass} placeholder="Contoh: Dusun Mekar Sari" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelClass}>RT</label>
                      <input type="text" name="rt" value={settings.rt} onChange={handleChange} className={inputClass} placeholder="001" />
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>RW</label>
                      <input type="text" name="rw" value={settings.rw} onChange={handleChange} className={inputClass} placeholder="002" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Desa / Kelurahan</label>
                    <input type="text" name="desa_kelurahan" value={settings.desa_kelurahan} onChange={handleChange} className={inputClass} placeholder="Contoh: Suka Maju" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Kecamatan</label>
                    <input type="text" name="kecamatan" value={settings.kecamatan} onChange={handleChange} className={inputClass} placeholder="Contoh: Bima Kota" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Kabupaten / Kota</label>
                    <input type="text" name="kabupaten_kota" value={settings.kabupaten_kota} onChange={handleChange} className={inputClass} placeholder="Contoh: Kota Bima" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Provinsi</label>
                    <input type="text" name="provinsi" value={settings.provinsi} onChange={handleChange} className={inputClass} placeholder="Contoh: Nusa Tenggara Barat" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className={labelClass}>Kode Pos</label>
                    <input type="text" name="kode_pos" value={settings.kode_pos} onChange={handleChange} className={inputClass} placeholder="Contoh: 84111" />
                  </div>
                </div>
              </div>

              {/* SECTION KONTAK */}
              <div className="pt-6 border-t border-slate-100">
                <div className="mb-6 flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Phone className="w-4 h-4"/></div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Kontak & Digital</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className={labelClass}>Nomor Telepon Sekolah</label>
                    <div className="relative"><Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/><input type="text" name="telepon" value={settings.telepon} onChange={handleChange} className={`${inputClass} pl-10`} placeholder="(021) 1234567" /></div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Nomor Fax</label>
                    <div className="relative"><Printer className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/><input type="text" name="fax" value={settings.fax} onChange={handleChange} className={`${inputClass} pl-10`} placeholder="(021) 1234567" /></div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Alamat Email Instansi</label>
                    <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/><input type="email" name="email_instansi" value={settings.email_instansi} onChange={handleChange} className={`${inputClass} pl-10`} placeholder="info@sekolah.sch.id" /></div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Website Instansi</label>
                    <div className="relative"><Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/><input type="url" name="website" value={settings.website} onChange={handleChange} className={`${inputClass} pl-10`} placeholder="https://sekolah.sch.id" /></div>
                  </div>
                </div>
              </div>

              {/* SECTION LOGO & TTD (TERMASUK TOMBOL UPLOAD) */}
              <div className="pt-6 border-t border-slate-100">
                <div className="mb-6 flex items-center gap-2">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><FileImage className="w-4 h-4"/></div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Logo & Pejabat</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* LOGO KIRI */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Logo 1 (Kiri)</label>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <FileImage className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                        <input type="url" name="logo_kiri" value={settings.logo_kiri} onChange={handleChange} className={`${inputClass} pl-10`} placeholder="Tempel URL atau Upload..." />
                      </div>
                      <label className={`shrink-0 flex items-center justify-center px-4 rounded-xl cursor-pointer transition-all ${isUploadingMedia === 'logo_kiri' ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`} title="Upload Logo Kiri">
                        {isUploadingMedia === 'logo_kiri' ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleInstansiMediaUpload(e, 'logo_kiri')} disabled={isUploadingMedia !== null} />
                      </label>
                    </div>
                    {settings.logo_kiri && (
                      <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center p-1 shadow-inner mt-2">
                        <img src={getDriveImageUrl(settings.logo_kiri)} alt="Logo 1" className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                      </div>
                    )}
                  </div>

                  {/* LOGO KANAN */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Logo 2 (Kanan)</label>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <FileImage className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                        <input type="url" name="logo_kanan" value={settings.logo_kanan} onChange={handleChange} className={`${inputClass} pl-10`} placeholder="Tempel URL atau Upload..." />
                      </div>
                      <label className={`shrink-0 flex items-center justify-center px-4 rounded-xl cursor-pointer transition-all ${isUploadingMedia === 'logo_kanan' ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`} title="Upload Logo Kanan">
                        {isUploadingMedia === 'logo_kanan' ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleInstansiMediaUpload(e, 'logo_kanan')} disabled={isUploadingMedia !== null} />
                      </label>
                    </div>
                    {settings.logo_kanan && (
                      <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center p-1 shadow-inner mt-2">
                        <img src={getDriveImageUrl(settings.logo_kanan)} alt="Logo 2" className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Nama Kepala Instansi / Sekolah</label>
                    <input type="text" name="nama_kepsek" value={settings.nama_kepsek} onChange={handleChange} className={inputClass} placeholder="Nama Lengkap & Gelar (Cth: Dr. H. Budi, M.Pd.)" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>NIP Kepala Instansi</label>
                    <input type="text" name="nip_kepsek" value={settings.nip_kepsek} onChange={handleChange} className={inputClass} placeholder="Kosongkan jika tidak ada" />
                  </div>
                  
                  {/* TANDA TANGAN */}
                  <div className="space-y-2 md:col-span-2 mt-2">
                    <label className={labelClass}>URL Tanda Tangan Digital (Tanpa Background)</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <FileImage className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                        <input type="url" name="ttd_kepsek" value={settings.ttd_kepsek} onChange={handleChange} className={`${inputClass} pl-10`} placeholder="Tempel URL atau Upload..." />
                      </div>
                      <label className={`shrink-0 flex items-center justify-center px-4 rounded-xl cursor-pointer transition-all ${isUploadingMedia === 'ttd_kepsek' ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`} title="Upload TTD">
                        {isUploadingMedia === 'ttd_kepsek' ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleInstansiMediaUpload(e, 'ttd_kepsek')} disabled={isUploadingMedia !== null} />
                      </label>
                    </div>
                    {settings.ttd_kepsek && (
                      <div className="w-24 h-16 bg-slate-100 border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center p-1 shadow-inner bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mt-2">
                        <img src={getDriveImageUrl(settings.ttd_kepsek)} alt="TTD" className="w-full h-full object-contain mix-blend-multiply" onError={(e) => e.currentTarget.style.display = 'none'} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AKUN ADMIN */}
          {activeTab === 'akun' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><UserCircle2 className="w-5 h-5" /></div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">Profil & Keamanan Akun</h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">Ubah nama, foto profil, dan atur pemulihan kata sandi Anda.</p>
                  </div>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase flex items-center gap-2">
                  Role Saat Ini: {adminProfile.role || 'Admin'}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                {/* BAGIAN FOTO PROFIL */}
                <div className="col-span-1 flex flex-col items-center gap-4 bg-slate-50 border border-slate-200 p-6 rounded-[2rem]">
                   <label className={labelClass + " text-center mb-0"}>Foto Profil (Avatar)</label>
                   
                   <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-md relative bg-slate-200 flex shrink-0 items-center justify-center">
                     {!avatarError && finalAvatarUrl ? (
                        <img 
                          src={finalAvatarUrl} 
                          alt="Avatar" 
                          className="absolute"
                          onError={() => setAvatarError(true)} 
                          style={{ 
                             maxWidth: 'none',
                             width: `${adminProfile.skala_avatar}%`, 
                             height: `${adminProfile.skala_avatar}%`, 
                             objectFit: 'cover',
                             transform: `translate(${adminProfile.posisi_x_avatar}px, ${adminProfile.posisi_y_avatar}px)` 
                          }} 
                        />
                     ) : (
                        <UserCircle2 className="w-16 h-16 text-slate-400" />
                     )}
                   </div>

                   <div className="w-full space-y-3 mt-2">
                     <div className="flex gap-2">
                        <input type="url" name="avatar_url" value={adminProfile.avatar_url} onChange={handleProfileChange} className={`${inputClass} !py-2 !px-3 !text-xs`} placeholder="Tempel URL GDrive..." />
                        <label className={`shrink-0 flex items-center justify-center px-3 rounded-xl cursor-pointer transition-all ${isUploadingAvatar ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`} title="Upload Foto">
                          {isUploadingAvatar ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                          <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploadingAvatar} />
                        </label>
                     </div>
                     
                     {/* KONTROL SLIDER FOTO */}
                     {adminProfile.avatar_url && (
                        <div className="space-y-3 p-3 bg-white rounded-xl border border-slate-200">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Sliders className="w-3 h-3"/> Sesuaikan Foto</p>
                           <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-500 w-10">Zoom</span>
                              <input type="range" name="skala_avatar" min="50" max="300" value={adminProfile.skala_avatar} onChange={handleProfileChange} className="flex-1 accent-blue-500 h-1.5" />
                           </div>
                           <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-500 w-10">Geser X</span>
                              <input type="range" name="posisi_x_avatar" min="-100" max="100" value={adminProfile.posisi_x_avatar} onChange={handleProfileChange} className="flex-1 accent-blue-500 h-1.5" />
                           </div>
                           <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-500 w-10">Geser Y</span>
                              <input type="range" name="posisi_y_avatar" min="-100" max="100" value={adminProfile.posisi_y_avatar} onChange={handleProfileChange} className="flex-1 accent-blue-500 h-1.5" />
                           </div>
                        </div>
                     )}
                   </div>
                </div>

                {/* BAGIAN IDENTITAS */}
                <div className="col-span-1 md:col-span-2 space-y-6">
                  <div className="space-y-2">
                    <label className={labelClass}>Email Terdaftar (Login)</label>
                    <input 
                      type="email" 
                      value={adminProfile.email} 
                      disabled 
                      className={`${inputClass} bg-slate-100/70 border-slate-200 text-slate-500 cursor-not-allowed select-none shadow-inner`} 
                    />
                    <p className="text-[10px] font-bold text-slate-400 mt-1">Email tidak dapat diubah dari panel ini.</p>
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Nama Lengkap Anda</label>
                    <input 
                      type="text" 
                      name="full_name" 
                      value={adminProfile.full_name} 
                      onChange={handleProfileChange} 
                      className={inputClass} 
                      placeholder="Masukkan nama Anda..."
                    />
                  </div>
                </div>
              </div>

              {/* FITUR RESET PASSWORD MELALUI EMAIL */}
              <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-50 border border-slate-200 p-6 rounded-[2rem]">
                <div>
                  <h3 className={`${labelClass} flex items-center gap-2 text-blue-600 !mb-1`}>
                    <KeyRound className="w-4 h-4" /> Pemulihan Password
                  </h3>
                  <p className="text-xs text-slate-500 font-bold leading-relaxed max-w-lg mt-1">
                    Demi keamanan, perubahan password dilakukan melalui email pemulihan. Kami akan mengirimkan tautan (link) ke <b>{adminProfile.email}</b>.
                  </p>
                </div>
                <button type="button" onClick={handleSendResetPassword} className="shrink-0 flex items-center gap-2 bg-slate-800 hover:bg-black text-white px-6 py-3.5 rounded-xl font-black text-sm transition-all shadow-md active:scale-95 w-full md:w-auto">
                  <Send className="w-4 h-4" /> Kirim Link Reset
                </button>
              </div>

            </div>
          )}

          {/* TAB 3: TAMPILAN & TEMA */}
          {activeTab === 'tampilan' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl"><Palette className="w-5 h-5" /></div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">Tema & Branding Aplikasi</h2>
                  <p className="text-sm text-slate-500 font-medium mt-1">Ubah nama, logo aplikasi, dan background login siswa.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className={labelClass}>Nama Aplikasi</label>
                  <input type="text" name="nama_aplikasi" value={settings.nama_aplikasi} onChange={handleChange} className={inputClass} placeholder="Contoh: CBT SMART EXAM" />
                </div>
                
                {/* ICON APLIKASI */}
                <div className="space-y-2">
                  <label className={labelClass}>Icon Aplikasi (Logo Kecil)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <FileImage className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                      <input type="url" name="ikon_aplikasi" value={settings.ikon_aplikasi} onChange={handleChange} className={`${inputClass} pl-10`} placeholder="Tempel URL atau Upload..." />
                    </div>
                    <label className={`shrink-0 flex items-center justify-center px-4 rounded-xl cursor-pointer transition-all ${isUploadingMedia === 'ikon_aplikasi' ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`} title="Upload Icon">
                      {isUploadingMedia === 'ikon_aplikasi' ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleInstansiMediaUpload(e, 'ikon_aplikasi')} disabled={isUploadingMedia !== null} />
                    </label>
                  </div>
                  {settings.ikon_aplikasi && (
                    <div className="w-12 h-12 shrink-0 bg-slate-100 border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center p-1 shadow-inner mt-2">
                      <img src={getDriveImageUrl(settings.ikon_aplikasi)} alt="Icon" className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                    </div>
                  )}
                </div>

                {/* BACKGROUND LOGIN */}
                <div className="space-y-2 md:col-span-2">
                  <label className={labelClass}>Background Halaman Login (URL Gambar)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <FileImage className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                      <input type="url" name="background_login" value={settings.background_login} onChange={handleChange} className={`${inputClass} pl-10`} placeholder="Kosongkan untuk menggunakan warna gradasi bawaan." />
                    </div>
                    <label className={`shrink-0 flex items-center justify-center px-4 rounded-xl cursor-pointer transition-all ${isUploadingMedia === 'background_login' ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`} title="Upload Background">
                      {isUploadingMedia === 'background_login' ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleInstansiMediaUpload(e, 'background_login')} disabled={isUploadingMedia !== null} />
                    </label>
                  </div>
                  {settings.background_login && (
                    <div className="w-16 h-12 shrink-0 bg-slate-100 border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center shadow-inner mt-2">
                      <img src={getDriveImageUrl(settings.background_login)} alt="Background" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                    </div>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2 mt-4">
                  <label className={labelClass}>Teks Pengumuman (Marquee di Dashboard Siswa)</label>
                  <textarea name="teks_pengumuman" value={settings.teks_pengumuman} onChange={handleChange} rows={3} className={inputClass + " resize-none"} placeholder="Tuliskan pengumuman penting di sini..." />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SISTEM & DATA */}
          {activeTab === 'sistem' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl"><Server className="w-5 h-5" /></div>
                <h2 className="text-xl font-black text-slate-800">Sistem & Pemeliharaan</h2>
              </div>
              
              <div className="space-y-8">
                <div className="space-y-2 max-w-md">
                  <label className={labelClass}>Zona Waktu Server Aplikasi</label>
                  <select name="zona_waktu" value={settings.zona_waktu} onChange={handleChange} className={inputClass + " cursor-pointer"}>
                    <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                    <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                    <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
                  </select>
                </div>

                <div className="p-5 border border-amber-200 bg-amber-50 rounded-2xl max-w-2xl">
                  <div className="flex items-start gap-4">
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input type="checkbox" name="mode_perbaikan" checked={settings.mode_perbaikan} onChange={handleChange} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                    <div>
                      <span className="text-sm font-black text-amber-900 block">Mode Perbaikan (Maintenance Mode)</span>
                      <span className="text-xs font-bold text-amber-700/80 block mt-1.5 leading-relaxed">Aktifkan fitur ini jika Anda sedang melakukan rombak data atau perbaikan soal. Siswa tidak akan bisa Login dan akan dialihkan ke halaman "Sedang Perbaikan".</span>
                    </div>
                  </div>
                </div>

                {/* DANGER ZONE */}
                <div className="mt-10 pt-6 border-t border-slate-200">
                  <h3 className="text-sm font-black text-rose-600 uppercase tracking-widest mb-4 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Zona Berbahaya</h3>
                  <div className="p-6 border-2 border-rose-100 bg-white rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                      <p className="font-black text-slate-800 text-lg">Reset Riwayat Sesi (Tahun Ajaran Baru)</p>
                      <p className="text-sm font-medium text-slate-500 mt-1 max-w-xl">Tindakan ini akan mengosongkan seluruh riwayat pengerjaan, nilai, dan sesi aktif siswa. Gunakan fitur ini hanya saat ingin menyambut tahun ajaran / semester baru.</p>
                    </div>
                    <button onClick={handleClearSessions} className="shrink-0 flex items-center justify-center gap-2 bg-white border-2 border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white font-black px-6 py-3.5 rounded-xl transition-all shadow-sm active:scale-95 w-full md:w-auto">
                      <Trash2 className="w-5 h-5"/> Bersihkan Sesi
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}