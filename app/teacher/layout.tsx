'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  LayoutDashboard, Database, CalendarClock, 
  Settings, LogOut, LoaderCircle, Activity,
  GraduationCap, Building, BookOpen, ShieldCheck,
  Menu, ChevronLeft, UserCircle2, BarChart3 // <-- Import BarChart3 ditambahkan
} from 'lucide-react'

// HELPER: Mengubah Link Drive menjadi link Thumbnail (Stabil)
const getDriveImageUrl = (url: string | undefined | null) => {
  if (!url) return '';
  const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w200`;
  return url;
};

// INTERFACES
interface AppSettings {
  nama_aplikasi: string;
  ikon_aplikasi: string;
}

interface TeacherProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url: string;
  skala_avatar: number;
  posisi_x_avatar: number;
  posisi_y_avatar: number;
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true) 
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false) 

  const [appSettings, setAppSettings] = useState<AppSettings>({ nama_aplikasi: 'CBT SMART EXAM', ikon_aplikasi: '' })
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null)

  const profileRef = useRef<HTMLDivElement>(null)

  // LOGIKA "SATPAM" KEAMANAN (Mencegah Siswa / Admin Masuk)
  useEffect(() => {
    const checkAuthAndData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }

      const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();

      // STRICT ROLE CHECK: Hanya izinkan role 'teacher' atau 'proctor'
      if (!profile || !['teacher', 'proctor'].includes(profile.role)) {
        if (profile?.role === 'admin' || profile?.role === 'superadmin') {
            window.location.href = '/admin/dashboard';
        } else {
            window.location.href = '/student/dashboard';
        }
        return;
      } 
      
      setIsAuthorized(true);
      setTeacherProfile({
        id: user.id,
        email: user.email || profile.email || '',
        full_name: profile.full_name || 'Guru Pengampu',
        role: profile.role.toUpperCase(),
        avatar_url: profile.avatar_url || '',
        skala_avatar: profile.skala_avatar ?? 100,
        posisi_x_avatar: profile.posisi_x_avatar ?? 0,
        posisi_y_avatar: profile.posisi_y_avatar ?? 0
      });

      // Ambil Nama & Icon Aplikasi dari Pengaturan
      const { data: settingData } = await supabase.from('pengaturan_aplikasi').select('nama_aplikasi, ikon_aplikasi').eq('id', 1).single();
      if (settingData) {
        setAppSettings({
          nama_aplikasi: settingData.nama_aplikasi || 'CBT SMART EXAM',
          ikon_aplikasi: settingData.ikon_aplikasi || ''
        });
      }
    };
    
    checkAuthAndData();

    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login' 
  }

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // DAFTAR MENU KHUSUS GURU (Lebih Sedikit dari Admin)
  const menuItems = [
    { name: 'Dashboard', desc: 'Ringkasan aktivitas guru, statistik mata pelajaran, dan jadwal terdekat.', icon: LayoutDashboard, href: '/teacher/dashboard' },
    { name: 'Ruang Ujian', desc: 'Lihat daftar ruang ujian dan peserta yang ada di dalamnya (Read-only).', icon: Building, href: '/teacher/rooms' },
    { name: 'Mata Pelajaran', desc: 'Lihat daftar mata pelajaran yang Anda ampu (Read-only).', icon: BookOpen, href: '/teacher/subjects' },
    { name: 'Jadwal Ujian', desc: 'Lihat jadwal ujian, waktu pelaksanaan, dan token (Read-only).', icon: CalendarClock, href: '/teacher/exams' },
    { name: 'Bank Soal', desc: 'Kelola kumpulan soal hanya pada mata pelajaran yang Anda ampu.', icon: Database, href: '/teacher/questions' },
    { name: 'Pengawasan Ujian', desc: 'Pantau ujian secara langsung untuk mapel yang Anda ampu atau awasi.', icon: Activity, href: '/teacher/monitoring' },
    { name: 'Penilaian', desc: 'Akses rekap nilai, esai, dan analisis untuk mapel yang Anda ampu.', icon: BarChart3, href: '/teacher/reports' }, // <-- MENU BARU DITAMBAHKAN
    { name: 'Pengaturan Profil', desc: 'Perbarui nama, NIP, foto profil, dan kata sandi Anda.', icon: Settings, href: '/teacher/settings' },
  ];

  const currentMenu = menuItems.find(item => pathname.startsWith(item.href)) || menuItems[0];
  const finalAvatarUrl = useMemo(() => getDriveImageUrl(teacherProfile?.avatar_url), [teacherProfile?.avatar_url]);
  const finalAppIconUrl = useMemo(() => getDriveImageUrl(appSettings.ikon_aplikasi), [appSettings.ikon_aplikasi]);

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length === 0) return 'GR';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  if (!isAuthorized) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
           <LoaderCircle className="w-12 h-12 text-blue-600 animate-spin" />
           <p className="font-bold text-slate-500 uppercase tracking-widest text-sm animate-pulse">Memverifikasi Akses Guru...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* ================= SIDEBAR KIRI (COLLAPSIBLE) ================= */}
      <aside className={`bg-white border-r border-slate-200 flex flex-col shadow-sm z-20 transition-all duration-300 ease-in-out shrink-0 ${isSidebarOpen ? 'w-72' : 'w-[88px] items-center'}`}>
        
        <div className={`h-24 flex items-center border-b border-slate-100 shrink-0 relative ${isSidebarOpen ? 'px-8 justify-between' : 'justify-center w-full'}`}>
          {isSidebarOpen ? (
            <div className="flex items-center gap-3 overflow-hidden">
              {finalAppIconUrl ? (
                 <img src={finalAppIconUrl} alt="Icon" className="w-8 h-8 object-contain shrink-0" />
              ) : (
                 <GraduationCap className="w-8 h-8 text-blue-600 shrink-0" />
              )}
              <div className="overflow-hidden">
                <h1 className="text-2xl font-black text-blue-600 tracking-tight truncate">{appSettings.nama_aplikasi}</h1>
                <p className="text-slate-400 text-[9px] font-black mt-0.5 uppercase tracking-widest">Portal Guru</p>
              </div>
            </div>
          ) : (
            finalAppIconUrl ? <img src={finalAppIconUrl} alt="Icon" className="w-10 h-10 object-contain" /> : <GraduationCap className="w-8 h-8 text-blue-600" />
          )}
          
          {isSidebarOpen && (
            <button onClick={toggleSidebar} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className={`flex-1 overflow-y-auto py-6 space-y-1.5 custom-scrollbar ${isSidebarOpen ? 'px-4' : 'px-3 w-full flex flex-col items-center'}`}>
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            const Icon = item.icon
            
            return isSidebarOpen ? (
              <Link 
                key={item.name} 
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all text-sm ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'}`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.name}</span>
              </Link>
            ) : (
              <Link 
                key={item.name} 
                href={item.href}
                title={item.name}
                className={`flex items-center justify-center w-14 h-14 rounded-[1.2rem] transition-all ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-400 hover:bg-slate-100 hover:text-blue-600'}`}
              >
                <Icon className="w-6 h-6" />
              </Link>
            )
          })}
        </nav>

        <div className={`p-4 border-t border-slate-100 bg-slate-50/80 shrink-0 ${isSidebarOpen ? '' : 'flex justify-center'}`}>
          {isSidebarOpen ? (
            <button onClick={handleLogout} className="flex items-center justify-center gap-2 px-4 py-3.5 w-full rounded-2xl font-bold text-red-600 bg-red-50 hover:bg-red-600 hover:text-white border border-red-100 transition-all active:scale-95 shadow-sm">
              <LogOut className="w-5 h-5" /> Keluar Sistem
            </button>
          ) : (
            <button onClick={handleLogout} title="Keluar Sistem" className="flex items-center justify-center w-12 h-12 rounded-[1rem] bg-red-50 text-red-500 hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-sm">
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* ================= AREA KONTEN UTAMA (KANAN) ================= */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50/50">
        
        <header className="bg-white border-b border-slate-200 h-24 flex items-center justify-between px-6 md:px-10 shrink-0 z-10">
          
          <div className="flex items-center gap-4 overflow-hidden">
            {!isSidebarOpen && (
              <button onClick={toggleSidebar} className="p-2.5 bg-slate-100 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shrink-0">
                <Menu className="w-5 h-5" />
              </button>
            )}
            
            <div className="flex flex-col justify-center overflow-hidden h-full py-2">
               <h2 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                 <currentMenu.icon className="w-6 h-6 text-blue-600 hidden md:block" /> 
                 {currentMenu.name}
               </h2>
               <p className="text-sm font-medium text-slate-500 mt-1 hidden sm:block truncate pr-4">
                 {currentMenu.desc}
               </p>
            </div>
          </div>

          <div className="relative shrink-0" ref={profileRef}>
            <button 
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-3 p-1.5 pr-4 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-[1.5rem] transition-all select-none"
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-black relative shrink-0">
                {finalAvatarUrl ? (
                  <img 
                    src={finalAvatarUrl} 
                    alt="Profil" 
                    className="absolute"
                    style={{ 
                       maxWidth: 'none',
                       width: `${teacherProfile?.skala_avatar}%`, 
                       height: `${teacherProfile?.skala_avatar}%`, 
                       objectFit: 'cover',
                       transform: `translate(${teacherProfile?.posisi_x_avatar}px, ${teacherProfile?.posisi_y_avatar}px)` 
                    }} 
                  />
                ) : (
                  getInitials(teacherProfile?.full_name || '')
                )}
              </div>
              <div className="hidden md:block text-left">
                 <p className="text-sm font-bold text-slate-800 leading-tight">{teacherProfile?.full_name || 'Guru'}</p>
                 <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">GURU</p>
              </div>
            </button>

            {isProfileMenuOpen && (
              <div className="absolute top-[calc(100%+0.5rem)] right-0 w-64 bg-white border border-slate-200 rounded-[1.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.08)] overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col items-center text-center">
                   <div className="w-16 h-16 rounded-[1.2rem] overflow-hidden bg-blue-100 border-2 border-white shadow-sm flex items-center justify-center text-blue-700 font-black relative mb-3">
                    {finalAvatarUrl ? (
                      <img 
                        src={finalAvatarUrl} 
                        alt="Profil" 
                        className="absolute"
                        style={{ 
                           maxWidth: 'none',
                           width: `${teacherProfile?.skala_avatar}%`, 
                           height: `${teacherProfile?.skala_avatar}%`, 
                           objectFit: 'cover',
                           transform: `translate(${teacherProfile?.posisi_x_avatar}px, ${teacherProfile?.posisi_y_avatar}px)` 
                        }} 
                      />
                    ) : (
                      getInitials(teacherProfile?.full_name || '')
                    )}
                   </div>
                   <p className="text-base font-black text-slate-800 line-clamp-1 w-full" title={teacherProfile?.full_name}>{teacherProfile?.full_name}</p>
                   
                   <p className="text-xs font-medium text-slate-500 line-clamp-1 w-full mt-0.5">{teacherProfile?.email}</p>
                   
                   <span className="mt-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                     GURU PENGAMPU
                   </span>
                </div>
                <div className="p-2">
                   <Link href="/teacher/settings" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 font-bold text-sm text-slate-700 transition-colors">
                     <UserCircle2 className="w-5 h-5 text-slate-400" /> Pengaturan Profil
                   </Link>
                </div>
                <div className="p-2 border-t border-slate-100">
                   <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 font-black text-sm hover:bg-red-600 hover:text-white border border-red-100 transition-all active:scale-95">
                     <LogOut className="w-4 h-4" /> Keluar
                   </button>
                </div>
              </div>
            )}
          </div>

        </header>

        <div className="flex-1 overflow-y-auto relative custom-scrollbar">
          {children}
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}