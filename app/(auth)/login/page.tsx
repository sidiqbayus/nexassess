'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, User, Lock, LoaderCircle, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react'

// =========================================================================
// HELPER: Pengurai URL Google Drive
// =========================================================================

// Khusus Logo: Pakai API view agar bisa ditumpuk dengan mix-blend-mode
const getDriveLogoUrl = (url: string | undefined | null) => {
  if (!url) return '';
  const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)([a-zA-Z0-9_-]+)/);
  if (match) return `https://docs.google.com/uc?export=view&id=${match[1]}`;
  return url;
};

// Khusus Background: Pakai Thumbnail HD agar dikompresi Google dan lebih cepat dimuat.
const getDriveBackgroundUrl = (url: string | undefined | null) => {
  if (!url) return '';
  const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1920`; 
  return url;
};

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'warning' } | null>(null)
  const router = useRouter()

  // STATE UNTUK SINKRONISASI TEMA DARI PENGATURAN APLIKASI
  const [appSettings, setAppSettings] = useState({
     appName: 'NexAssess CBT',
     appIcon: '',
     bgLoginUrl: '',
     isMaintenance: false
  });
  const [loadingSettings, setLoadingSettings] = useState(true);

  const showToast = (message: string, type: 'error' | 'success' | 'warning' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Ambil Pengaturan Tema Saat Halaman Dimuat
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('pengaturan_aplikasi')
          .select('nama_aplikasi, ikon_aplikasi, background_login, mode_perbaikan')
          .eq('id', 1)
          .single();

        if (data && !error) {
          setAppSettings({
            appName: data.nama_aplikasi || 'NexAssess CBT',
            appIcon: getDriveLogoUrl(data.ikon_aplikasi) || '',
            bgLoginUrl: getDriveBackgroundUrl(data.background_login) || '',
            isMaintenance: data.mode_perbaikan || false
          });
        }
      } catch (err) {
        console.error('Gagal mengambil pengaturan aplikasi:', err);
      } finally {
        setLoadingSettings(false);
      }
    };
    fetchSettings();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier || !password) {
      showToast("Username dan Password tidak boleh kosong!", "warning");
      return;
    }
    
    // Cegah Login Jika Mode Perbaikan Aktif (Kecuali jika ngetik 'admin')
    if (appSettings.isMaintenance && !identifier.toLowerCase().includes('admin')) {
      showToast("Sistem sedang dalam perbaikan. Akses ditolak.", "error");
      return;
    }

    setLoading(true)

    try {
      const loginEmail = identifier.includes('@') ? identifier : `${identifier}@nexassess.com`;

      // 1. Proses Login Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      })

      if (authError) {
        throw new Error(authError.message === 'Invalid login credentials' ? 'Username atau password salah.' : 'Gagal Login: ' + authError.message)
      }

      if (!authData.user) throw new Error('Terjadi kesalahan yang tidak diketahui.')

      // 2. Periksa Role Pengguna (Admin atau Siswa?)
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role, is_active')
        .eq('id', authData.user.id)
        .single()

      if (profileError || !profile) {
        throw new Error('Data profil tidak ditemukan. Hubungi Admin.')
      }

      if (profile.is_active === false) {
        await supabase.auth.signOut()
        throw new Error('Akun Anda sedang dinonaktifkan.')
      }

      showToast("Login Berhasil! Mengarahkan...", "success");

     // 3. Routing Berdasarkan Role
      setTimeout(() => {
        if (['admin', 'superadmin'].includes(profile.role)) {
          // Admin & Superadmin masuk ke Portal Admin
          window.location.href = '/admin/dashboard'
        } else if (profile.role === 'teacher' || profile.role === 'proctor') {
          // Guru / Pengawas masuk ke Portal Guru
          window.location.href = '/teacher/dashboard'
        } else if (profile.role === 'student') {
          // Siswa masuk ke Portal Siswa
          window.location.href = '/student/dashboard'
        } else {
          // Role tidak valid
          showToast('Peran akun tidak dikenali.', 'error');
          setLoading(false);
        }
      }, 1000);

    } catch (err: any) {
      showToast(err.message, 'error')
      setLoading(false)
    }
  }

  // Tampilan Loading Setting Transisi
  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-slate-50">
         <LoaderCircle className="w-10 h-10 md:w-12 md:h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Tampilan Mode Perbaikan
  if (appSettings.isMaintenance && !identifier.toLowerCase().includes('admin')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-slate-50 p-4 sm:p-6">
        <div className="bg-white max-w-md w-full rounded-[2rem] md:rounded-[2.5rem] p-6 sm:p-8 md:p-10 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95 duration-500">
           <div className="w-20 h-20 md:w-24 md:h-24 bg-amber-50 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center mx-auto mb-5 md:mb-6 border-4 border-amber-100 shadow-inner">
             <ShieldAlert className="w-8 h-8 md:w-10 md:h-10 text-amber-500" />
           </div>
           <h1 className="text-2xl md:text-3xl font-black text-slate-800 mb-2 md:mb-3">Sedang Perbaikan</h1>
           <p className="text-slate-500 font-medium leading-relaxed mb-6 md:mb-8 text-sm md:text-base">
             Sistem aplikasi <b className="text-slate-800">{appSettings.appName}</b> saat ini sedang dalam <b>Mode Pemeliharaan</b> untuk peningkatan layanan. Silakan coba kembali beberapa saat lagi.
           </p>
           
           <div className="pt-5 md:pt-6 border-t border-slate-100">
              <button onClick={() => window.location.reload()} className="text-xs md:text-sm font-bold text-blue-600 bg-blue-50 px-6 py-3 md:py-4 rounded-xl md:rounded-2xl hover:bg-blue-100 transition-colors w-full active:scale-95">
                Coba Refresh Halaman
              </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    // Background Dinamis dengan min-h-[100dvh] agar rapi di browser HP (Safari/Chrome)
    <div 
      className="flex items-center justify-center min-h-[100dvh] font-sans relative px-4 py-8 sm:p-6 transition-all duration-700 overflow-hidden"
      style={{
        backgroundColor: appSettings.bgLoginUrl ? 'transparent' : '#f8fafc',
        backgroundImage: appSettings.bgLoginUrl ? `url(${appSettings.bgLoginUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Overlay Gelap Jika Pakai Gambar Background agar form tetap terbaca */}
      {appSettings.bgLoginUrl && <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"></div>}

      {/* NOTIFIKASI TOAST MELAYANG DI ATAS - Responsive Width */}
      {toast && (
        <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm sm:w-auto animate-in slide-in-from-top-10 fade-out duration-300">
          <div className={`px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] shadow-2xl flex items-center gap-3 backdrop-blur-md border ${
            toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 
            toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' : 
            'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            {toast.type === 'error' ? <AlertCircle className="w-5 h-5 md:w-6 md:h-6 shrink-0 text-rose-500" /> : 
             toast.type === 'warning' ? <AlertCircle className="w-5 h-5 md:w-6 md:h-6 shrink-0 text-amber-500" /> : 
             <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 shrink-0 text-emerald-500" />}
            <p className="font-bold text-xs md:text-sm tracking-wide leading-snug">{toast.message}</p>
          </div>
        </div>
      )}

      {/* BOX LOGIN UTAMA */}
      <div className="w-full max-w-[420px] p-6 sm:p-8 md:p-12 bg-white/95 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-2xl relative z-10 transition-all duration-300 hover:shadow-[0_20px_60px_rgba(0,0,0,0.15)] animate-in zoom-in-95 my-auto">
        
        {/* Logo & Judul Dinamis */}
        <div className="text-center mb-8 md:mb-10 flex flex-col items-center">
          {appSettings.appIcon ? (
             // Menggunakan mix-blend-multiply
             <img src={appSettings.appIcon} alt="App Logo" className="h-16 sm:h-20 w-auto object-contain mb-3 md:mb-4 mix-blend-multiply" />
          ) : (
             <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-600 rounded-[1rem] md:rounded-[1.2rem] flex items-center justify-center mb-3 md:mb-4 shadow-lg text-white font-black text-xl md:text-2xl border border-blue-400">
               {appSettings.appName.charAt(0).toUpperCase()}
             </div>
          )}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 tracking-tight px-2 break-words leading-tight">{appSettings.appName}</h1>
          <p className="text-slate-500 text-[8px] md:text-[9px] font-black mt-2 md:mt-3 uppercase tracking-widest bg-slate-50 px-2.5 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg border border-slate-200 shadow-sm">Portal Ujian CBT</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4 md:space-y-5">
          
          {/* Input Username */}
          <div className="space-y-1.5 md:space-y-2">
            <label className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Username</label>
            <div className="relative group">
              <User className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Ketik username Anda..." 
                className="w-full pl-10 md:pl-11 pr-4 py-3 md:py-3.5 bg-white border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-xs md:text-sm text-slate-900 transition-all placeholder:text-slate-400 font-bold shadow-sm"
              />
            </div>
          </div>

          {/* Input Password */}
          <div className="space-y-1.5 md:space-y-2">
            <label className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Kata Sandi</label>
            <div className="relative group">
              <Lock className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full pl-10 md:pl-11 pr-10 md:pr-12 py-3 md:py-3.5 bg-white border border-slate-200 rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-xs md:text-sm text-slate-900 transition-all placeholder:text-slate-300 font-black tracking-widest placeholder:tracking-widest shadow-sm"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg md:rounded-xl transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />}
              </button>
            </div>
          </div>

          {/* Tombol Login */}
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-black text-xs md:text-sm py-3.5 md:py-4 rounded-xl md:rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-70 disabled:scale-100 flex items-center justify-center gap-2 group mt-5 md:mt-6"
          >
            {loading ? (
              <>
                <LoaderCircle className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <span>Masuk Sistem Ujian</span>
            )}
          </button>
        </form>
        
        <p className="text-center mt-8 md:mt-10 text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest">© 2026 {appSettings.appName.toUpperCase()}</p>
      </div>
    </div>
  )
}