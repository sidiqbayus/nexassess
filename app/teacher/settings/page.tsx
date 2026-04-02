'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Save, LoaderCircle, CheckCircle2, AlertTriangle, 
  UserCircle2, AlertCircle, KeyRound, Info, UploadCloud
} from 'lucide-react';

// HELPER: Mengubah Link Drive menjadi link Thumbnail
const getDriveImageUrl = (url: string | undefined | null) => {
  if (!url) return '';
  const match = url.match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)|docs\.google\.com\/file\/d\/)([a-zA-Z0-9_-]+)/);
  if (match) return `https://lh3.googleusercontent.com/d/$$${match[1]}`;
  return url;
};

export default function TeacherSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // State Profil Guru Terhubung dengan Tabel `users`
  const [teacherProfile, setTeacherProfile] = useState({
    id: '',
    email: '',
    full_name: '',
    role: 'teacher',
    avatar_url: '',
    skala_avatar: 100,
    posisi_x_avatar: 0,
    posisi_y_avatar: 0,
  });

  // State Ubah Password Langsung
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    setAvatarError(false);
  }, [teacherProfile.avatar_url]);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData, error: userError } = await supabase.from('users').select('*').eq('id', user.id).single();
        if (userError) throw userError;

        setTeacherProfile({
          id: user.id,
          email: user.email || userData?.email || '',
          full_name: userData?.full_name || '',
          role: userData?.role || 'teacher',
          avatar_url: userData?.avatar_url || '',
          skala_avatar: userData?.skala_avatar ?? 100,
          posisi_x_avatar: userData?.posisi_x_avatar ?? 0,
          posisi_y_avatar: userData?.posisi_y_avatar ?? 0,
        });
      }
    } catch (error: any) {
      showToast("Gagal memuat profil. Detail: " + error.message, "warning");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (teacherProfile.id) {
        const updatePayload: any = { 
          full_name: teacherProfile.full_name,
          avatar_url: teacherProfile.avatar_url,
          skala_avatar: teacherProfile.skala_avatar,
          posisi_x_avatar: teacherProfile.posisi_x_avatar,
          posisi_y_avatar: teacherProfile.posisi_y_avatar
        };

        const { error: profileError } = await supabase.from('users').update(updatePayload).eq('id', teacherProfile.id);
        if (profileError) throw profileError;
      }
      showToast("Profil berhasil diperbarui!", "success");
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
      const fileName = `profiles/avatar_${teacherProfile.id}_${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage.from('avatars').upload(fileName, file);
      if (error) throw error;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);

      setTeacherProfile(prev => ({ ...prev, avatar_url: data.publicUrl }));
      showToast("Foto profil berhasil diunggah!", "success");
    } catch (err: any) {
      showToast("Gagal unggah: " + err.message, "error");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // ================= FUNGSI GANTI PASSWORD =================
  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      showToast("Kata sandi baru dan konfirmasi wajib diisi.", "warning");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Konfirmasi kata sandi tidak cocok!", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("Kata sandi minimal 6 karakter.", "warning");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      // 1. Update ke Supabase Auth (Sistem Login Inti)
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (authError) throw authError;

      // 2. Update kolom 'password' di tabel public users (Sesuai permintaan)
      const { error: dbError } = await supabase.from('users').update({
        password: newPassword
      }).eq('id', teacherProfile.id);
      
      if (dbError) throw dbError;

      showToast("Kata sandi berhasil diubah!", "success");
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      showToast("Gagal mengubah kata sandi: " + error.message, "error");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setTeacherProfile(prev => ({ 
      ...prev, 
      [name]: type === 'range' || type === 'number' ? Number(value) : value 
    }));
  };

  const finalAvatarUrl = useMemo(() => getDriveImageUrl(teacherProfile.avatar_url), [teacherProfile.avatar_url]);

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all placeholder:text-slate-400";
  const labelClass = "text-xs font-black text-slate-500 uppercase tracking-widest block mb-2";

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><LoaderCircle className="w-12 h-12 text-blue-500 animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 max-w-4xl mx-auto text-slate-900 relative pb-20">
      
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

      {/* HEADER & TOMBOL SIMPAN PROFIL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:px-8 md:py-6 rounded-[2rem] border border-blue-100 shadow-sm">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><UserCircle2 className="w-6 h-6" /></div>
           <div>
             <h1 className="text-xl font-black text-slate-800">Pengaturan Profil</h1>
             <p className="text-slate-500 text-sm font-medium">Sesuaikan identitas akun pengampu Anda.</p>
           </div>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-md shadow-blue-200 active:scale-95 whitespace-nowrap w-full md:w-auto">
          {isSaving ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {isSaving ? 'Menyimpan...' : 'Simpan Profil'}
        </button>
      </div>

      {/* KONTEN PROFIL */}
      <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-800">Data Diri & Keamanan</h2>
              <p className="text-sm text-slate-500 font-medium mt-1">Ubah nama, foto profil, dan atur kata sandi akun Anda.</p>
            </div>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase flex items-center gap-2">
            Role Saat Ini: {teacherProfile.role === 'teacher' ? 'GURU PENGAMPU' : teacherProfile.role}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* BAGIAN FOTO PROFIL */}
          <div className="col-span-1 flex flex-col items-center gap-4 bg-slate-50 border border-slate-200 p-6 rounded-[2rem] h-fit">
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
                       width: `${teacherProfile.skala_avatar}%`, 
                       height: `${teacherProfile.skala_avatar}%`, 
                       objectFit: 'cover',
                       transform: `translate(${teacherProfile.posisi_x_avatar}px, ${teacherProfile.posisi_y_avatar}px)` 
                    }} 
                  />
               ) : (
                  <UserCircle2 className="w-16 h-16 text-slate-400" />
               )}
             </div>

             <div className="w-full space-y-3 mt-2">
               <div className="flex gap-2">
                  <input type="url" name="avatar_url" value={teacherProfile.avatar_url} onChange={handleProfileChange} className={`${inputClass} !py-2 !px-3 !text-xs`} placeholder="Tempel URL GDrive..." />
                  <label className={`shrink-0 flex items-center justify-center px-3 rounded-xl cursor-pointer transition-all ${isUploadingAvatar ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`} title="Upload Foto">
                    {isUploadingAvatar ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploadingAvatar} />
                  </label>
               </div>
             </div>
          </div>

          {/* BAGIAN IDENTITAS */}
          <div className="col-span-1 md:col-span-2 space-y-6">
            <div className="space-y-2">
              <label className={labelClass}>Nama Lengkap & Gelar</label>
              <input 
                type="text" 
                name="full_name" 
                value={teacherProfile.full_name} 
                onChange={handleProfileChange} 
                className={inputClass} 
                placeholder="Masukkan nama beserta gelar..."
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Username / Akun Login (Email)</label>
              <input 
                type="email" 
                value={teacherProfile.email} 
                disabled 
                className={`${inputClass} bg-slate-100/70 border-slate-200 text-slate-500 cursor-not-allowed select-none shadow-inner`} 
              />
              <p className="text-[10px] font-bold text-slate-400 mt-1">Username tidak dapat diubah sendiri. Hubungi admin jika perlu diganti.</p>
            </div>
          </div>
        </div>

        {/* FITUR UBAH PASSWORD LANGSUNG */}
        <div className="pt-8 border-t border-slate-100 flex flex-col gap-6 bg-slate-50 border border-slate-200 p-6 rounded-[2rem]">
          <div>
            <h3 className={`${labelClass} flex items-center gap-2 text-blue-600 !mb-1`}>
              <KeyRound className="w-4 h-4" /> Ubah Kata Sandi
            </h3>
            <p className="text-xs text-slate-500 font-bold leading-relaxed max-w-lg mt-1">
              Perbarui kata sandi akun Anda. Pastikan menggunakan kombinasi yang mudah diingat namun aman.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={labelClass}>Kata Sandi Baru</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass} 
                placeholder="Minimal 6 karakter"
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Konfirmasi Kata Sandi</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass} 
                placeholder="Ketik ulang kata sandi baru"
              />
            </div>
          </div>
          
          <div className="flex justify-end mt-2">
            <button 
              type="button" 
              onClick={handleUpdatePassword} 
              disabled={isUpdatingPassword || !newPassword || !confirmPassword}
              className="shrink-0 flex items-center justify-center gap-2 bg-slate-800 hover:bg-black text-white px-8 py-3.5 rounded-xl font-black text-sm transition-all shadow-md active:scale-95 disabled:bg-slate-300 w-full md:w-auto"
            >
              {isUpdatingPassword ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isUpdatingPassword ? 'Memperbarui...' : 'Simpan Sandi Baru'}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}