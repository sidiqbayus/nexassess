'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
  Users, GraduationCap, Database, CalendarClock, 
  Activity, BarChart3, IdCard, Settings, LoaderCircle, Server,
  TrendingUp, Clock, ShieldCheck, ArrowRight, BookOpen, Building
} from 'lucide-react';

export default function AdminDashboard() {
  const [adminName, setAdminName] = useState('Admin');
  const [greeting, setGreeting] = useState('Selamat Datang');
  const [currentDate, setCurrentDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // State untuk Statistik
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    questions: 0,
    exams: 0
  });

  useEffect(() => {
    // Set Waktu & Ucapan
    const hour = new Date().getHours();
    if (hour < 11) setGreeting('Selamat Pagi');
    else if (hour < 15) setGreeting('Selamat Siang');
    else if (hour < 18) setGreeting('Selamat Sore');
    else setGreeting('Selamat Malam');

    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setCurrentDate(new Date().toLocaleDateString('id-ID', options));

    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // 1. Ambil Nama Admin
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('users').select('full_name').eq('id', user.id).single();
        if (profile?.full_name) setAdminName(profile.full_name);
      }

      // 2. Ambil Statistik (Gunakan count exact untuk performa)
      const [studentsRes, teachersRes, questionsRes, examsRes] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'proctor'),
        supabase.from('questions').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('exams').select('*', { count: 'exact', head: true })
      ]);

      setStats({
        students: studentsRes.count || 0,
        teachers: teachersRes.count || 0,
        questions: questionsRes.count || 0,
        exams: examsRes.count || 0
      });

    } catch (error) {
      console.error('Gagal memuat data dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Daftar Menu Pintasan Cepat (Highlight fitur terpenting)
  const quickLinks = [
    { title: 'Manajemen Ujian', desc: 'Atur sesi & durasi', icon: CalendarClock, href: '/admin/exams', color: 'bg-blue-50 text-blue-600', hover: 'hover:border-blue-300 hover:shadow-blue-100' },
    { title: 'Bank Soal', desc: 'Kelola butir soal', icon: Database, href: '/admin/questions', color: 'bg-emerald-50 text-emerald-600', hover: 'hover:border-emerald-300 hover:shadow-emerald-100' },
    { title: 'Pengawasan Ujian', desc: 'Pantau ujian aktif', icon: Activity, href: '/admin/monitoring', color: 'bg-rose-50 text-rose-600', hover: 'hover:border-rose-300 hover:shadow-rose-100' },
    { title: 'Penilaian', desc: 'Rekap & analisis nilai', icon: BarChart3, href: '/admin/reports', color: 'bg-indigo-50 text-indigo-600', hover: 'hover:border-indigo-300 hover:shadow-indigo-100' },
    { title: 'Data Siswa', desc: 'Manajemen peserta', icon: Users, href: '/admin/students', color: 'bg-amber-50 text-amber-600', hover: 'hover:border-amber-300 hover:shadow-amber-100' },
    { title: 'Kartu Ujian', desc: 'Cetak kartu login', icon: IdCard, href: '/admin/cards', color: 'bg-cyan-50 text-cyan-600', hover: 'hover:border-cyan-300 hover:shadow-cyan-100' },
  ];

  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <LoaderCircle className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs animate-pulse">Memuat Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 max-w-7xl mx-auto text-slate-900 pb-20">
      
      {/* BANNER WELCOME */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[2.5rem] p-8 md:p-10 shadow-lg text-white relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        {/* Ornamen Dekorasi */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-20 w-40 h-40 bg-blue-400 opacity-20 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10">
          <p className="text-blue-200 font-bold tracking-widest uppercase text-xs mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" /> {currentDate}
          </p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
            {greeting}, {adminName.split(' ')[0]}! 👋
          </h1>
          <p className="text-blue-100 font-medium max-w-xl leading-relaxed text-sm md:text-base">
            Pantau seluruh aktivitas ujian, kelola bank soal, dan lihat laporan penilaian peserta didik langsung dari pusat kendali ini.
          </p>
        </div>

        <div className="relative z-10 shrink-0">
          <Link href="/admin/settings" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md px-6 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 shadow-sm">
            <Settings className="w-4 h-4" /> Pengaturan Sistem
          </Link>
        </div>
      </div>

      {/* STATISTIK OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Total Siswa', value: stats.students, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { title: 'Bank Soal Aktif', value: stats.questions, icon: Database, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { title: 'Total Jadwal Ujian', value: stats.exams, icon: CalendarClock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { title: 'Guru / Pengawas', value: stats.teachers, icon: GraduationCap, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-5 hover:border-slate-300 hover:shadow-md transition-all group">
            <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 border ${stat.bg} ${stat.color} ${stat.border} group-hover:scale-110 transition-transform duration-300`}>
              <stat.icon className="w-8 h-8" />
            </div>
            <div>
              <p className="text-3xl font-black text-slate-800 tracking-tight">{stat.value}</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{stat.title}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* KIRI: PINTASAN MENU CEPAT (Banyak Menu) */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" /> Pintasan Menu Akses
            </h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {quickLinks.map((link, idx) => (
              <Link 
                key={idx} 
                href={link.href} 
                className={`bg-white p-6 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col justify-between h-40 group transition-all duration-300 hover:-translate-y-1 ${link.hover}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${link.color}`}>
                  <link.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base group-hover:text-blue-600 transition-colors">{link.title}</h3>
                  <p className="text-xs font-medium text-slate-500 mt-1">{link.desc}</p>
                </div>
                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                   <ArrowRight className="w-5 h-5 text-blue-500" />
                </div>
              </Link>
            ))}
          </div>

          {/* MENU TAMBAHAN (Secondary Links) */}
          <div className="bg-slate-100 border border-slate-200 rounded-[1.5rem] p-6 flex flex-wrap gap-4 mt-6">
             <Link href="/admin/rooms" className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all">
                <Building className="w-4 h-4 text-slate-400" /> Ruang Ujian
             </Link>
             <Link href="/admin/subjects" className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all">
                <BookOpen className="w-4 h-4 text-slate-400" /> Mata Pelajaran
             </Link>
             <Link href="/admin/security" className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all">
                <ShieldCheck className="w-4 h-4 text-slate-400" /> Keamanan
             </Link>
          </div>
        </div>

        {/* KANAN: AKTIVITAS & SISTEM */}
        <div className="xl:col-span-1 space-y-6">
          
          {/* Box Status Server */}
          <div className="bg-slate-800 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-lg border border-slate-700">
             <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 opacity-20 rounded-full blur-3xl"></div>
             <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Server className="w-4 h-4" /> Status Sistem
             </h3>
             
             <div className="space-y-5 relative z-10">
                <div className="flex justify-between items-center pb-4 border-b border-slate-700">
                   <span className="text-sm font-medium text-slate-300">Server Database</span>
                   <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-lg border border-emerald-400/20">
                     <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div> Online
                   </span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-slate-700">
                   <span className="text-sm font-medium text-slate-300">Zona Waktu</span>
                   <span className="text-xs font-bold text-white">WIB (Jakarta)</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-sm font-medium text-slate-300">Mode Perbaikan</span>
                   <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-600">
                     Nonaktif
                   </span>
                </div>
             </div>
          </div>

          {/* Box Panduan / Bantuan Cepat */}
          <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
             <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Butuh Bantuan?</h3>
             <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
                Ikuti urutan langkah ini untuk memulai ujian baru:
             </p>
             <ol className="space-y-4 text-sm font-bold text-slate-700">
                <li className="flex gap-3 items-start">
                   <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">1</div>
                   <p>Buat <Link href="/admin/subjects" className="text-blue-600 hover:underline">Mata Pelajaran</Link> & <Link href="/admin/rooms" className="text-blue-600 hover:underline">Ruang Ujian</Link>.</p>
                </li>
                <li className="flex gap-3 items-start">
                   <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">2</div>
                   <p>Input soal di <Link href="/admin/questions" className="text-blue-600 hover:underline">Bank Soal</Link>.</p>
                </li>
                <li className="flex gap-3 items-start">
                   <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">3</div>
                   <p>Buat <Link href="/admin/exams" className="text-blue-600 hover:underline">Jadwal Ujian</Link> dan rilis Token.</p>
                </li>
             </ol>
          </div>

        </div>

      </div>
    </div>
  );
}