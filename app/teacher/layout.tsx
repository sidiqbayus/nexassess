'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  LayoutDashboard, Database, CalendarClock, 
  Settings, LogOut, LoaderCircle, Activity,
  GraduationCap, Building, BookOpen, ShieldCheck,
  Menu, ChevronLeft, UserCircle2, BarChart3
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

  useEffect(() => {
    const checkAuthAndData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }

      const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();

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

      const { data: settingData } = await supabase.from('pengaturan_aplikasi').select('nama_aplikasi, ikon_aplikasi').eq('id', 1).single();
      if (settingData) {
        setAppSettings({
          nama_aplikasi: settingData.nama_aplikasi || 'CBT SMART EXAM',
          ikon_aplikasi: settingData.ikon_aplikasi || ''
        });
      }
    };
    
    checkAuthAndData();

    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login' 
  }

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/teacher/dashboard' },
    { name: 'Ruang Ujian', icon: Building, href: '/teacher/rooms' },
    { name: 'Mata Pelajaran', icon: BookOpen, href: '/teacher/subjects' },
    { name: 'Jadwal Ujian', icon: CalendarClock, href: '/teacher/exams' },
    { name: 'Bank Soal', icon: Database, href: '/teacher/questions' },
    { name: 'Pengawasan Ujian', icon: Activity, href: '/teacher/monitoring' },
    { name: 'Penilaian', icon: BarChart3, href: '/teacher/reports' },
    { name: 'Pengaturan Profil', icon: Settings, href: '/teacher/settings' },
  ];

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
           <LoaderCircle className="w-10 h-10 md:w-12 md:h-12 text-blue-600 animate-spin" />
           <p className="font-bold text-slate-500 uppercase tracking-widest text-xs md:text-sm animate-pulse">Memverifikasi Akses Guru...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`bg-white border-r border-slate-200 flex flex-col shadow-xl md:shadow-sm z-50 transition-all duration-300 ease-in-out shrink-0 fixed md:relative h-full
        ${isSidebarOpen 
          ? 'w-[280px] md:w-72 translate-x-0' 
          : 'w-[280px] md:w-[88px] -translate-x-full md:translate-x-0 md:items-center'}
      `}>
        
        <div className={`h-20 md:h-24 flex items-center border-b border-slate-100 shrink-0 relative ${isSidebarOpen ? 'px-6 md:px-8 justify-between' : 'justify-center w-full'}`}>
          {isSidebarOpen ? (
            <div className="flex items-center gap-3 overflow-hidden">
              {finalAppIconUrl ? (
                 <img src={finalAppIconUrl} alt="Icon" className="w-8 h-8 object-contain shrink-0" />
              ) : (
                 <GraduationCap className="w-8 h-8 text-blue-600 shrink-0" />
              )}
              <div className="overflow-hidden">
                <h1 className="text-xl md:text-2xl font-black text-blue-600 tracking-tight truncate">{appSettings.nama_aplikasi}</h1>
                <p className="text-slate-400 text-[8px] md:text-[9px] font-black mt-0.5 uppercase tracking-widest">Portal Guru</p>
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
                className={`flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-[1.2rem] transition-all ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-400 hover:bg-slate-100 hover:text-blue-600'}`}
              >
                <Icon className="w-5 h-5 md:w-6 md:h-6" />
              </Link>
            )
          })}
        </nav>

        <div className={`p-4 border-t border-slate-100 bg-slate-50/80 shrink-0 ${isSidebarOpen ? '' : 'flex justify-center'}`}>
          {isSidebarOpen ? (
            <button onClick={handleLogout} className="flex items-center justify-center gap-2 px-4 py-3.5 w-full rounded-2xl font-bold text-red-600 bg-red-50 hover:bg-red-600 hover:text-white border border-red-100 transition-all active:scale-95 shadow-sm text-sm">
              <LogOut className="w-5 h-5" /> Keluar Sistem
            </button>
          ) : (
            <button onClick={handleLogout} title="Keluar Sistem" className="flex items-center justify-center w-12 h-12 rounded-[1rem] bg-red-50 text-red-500 hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-sm">
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen min-w-0 bg-slate-50/50">
        
        {/* HEADER ATAS KOSONG - HANYA TOMBOL MENU & PROFIL */}
        <header className="bg-white border-b border-slate-200 h-20 md:h-24 flex items-center justify-between px-4 sm:px-6 md:px-10 shrink-0 relative z-50 w-full">
          <div className="flex items-center">
            <button onClick={toggleSidebar} className={`p-2.5 bg-slate-100 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shrink-0 ${isSidebarOpen ? 'md:hidden' : ''}`}>
              <Menu className="w-5 h-5 md:w-5 md:h-5" />
            </button>
          </div>

          <div className="relative shrink-0 ml-auto" ref={profileRef}>
            <button 
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-2 md:gap-3 p-1 md:p-1.5 md:pr-4 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-[1rem] md:rounded-[1.5rem] transition-all select-none"
            >
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg md:rounded-xl overflow-hidden bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-black relative shrink-0">
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
              <div className="hidden sm:block text-left pr-2 md:pr-0">
                 <p className="text-xs md:text-sm font-bold text-slate-800 leading-tight max-w-[100px] md:max-w-[150px] truncate">{teacherProfile?.full_name || 'Guru'}</p>
                 <p className="text-[8px] md:text-[10px] font-black text-blue-600 uppercase tracking-widest mt-0.5">GURU PENGAMPU</p>
              </div>
            </button>

            {isProfileMenuOpen && (
              <div className="absolute z-50 top-[calc(100%+0.5rem)] right-0 w-[240px] md:w-64 bg-white border border-slate-200 rounded-[1.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.15)] overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col items-center text-center">
                   <div className="w-14 h-14 md:w-16 md:h-16 rounded-[1rem] md:rounded-[1.2rem] overflow-hidden bg-blue-100 border-2 border-white shadow-sm flex items-center justify-center text-blue-700 font-black relative mb-3">
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
                   <p className="text-sm md:text-base font-black text-slate-800 line-clamp-1 w-full" title={teacherProfile?.full_name}>{teacherProfile?.full_name}</p>
                   <p className="text-[11px] md:text-xs font-medium text-slate-500 line-clamp-1 w-full mt-0.5">{teacherProfile?.email}</p>
                   <span className="mt-2.5 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest">
                     GURU PENGAMPU
                   </span>
                </div>
                <div className="p-2">
                   <Link href="/teacher/settings" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 font-bold text-xs md:text-sm text-slate-700 transition-colors">
                     <UserCircle2 className="w-4 h-4 md:w-5 md:h-5 text-slate-400" /> Pengaturan Profil
                   </Link>
                </div>
                <div className="p-2 border-t border-slate-100">
                   <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 md:py-3 rounded-xl bg-red-50 text-red-600 font-black text-xs md:text-sm hover:bg-red-600 hover:text-white border border-red-100 transition-all active:scale-95">
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
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        @media (min-width: 768px) {
           .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}