'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // Menggunakan koneksi terbaru kita
import { useParams } from 'next/navigation';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, XCircle, Search, ShieldAlert } from 'lucide-react';

interface StudentSession {
  id: string;
  status: string;
  started_at: string;
  tab_switch_count: number;
  bound_ip: string;
  current_question_index: number;
  users: {
    id: string;
    full_name: string;
    student_number: string;
    class_group: string;
  };
}

export default function ProctorDashboard() {
  const { examId } = useParams<{ examId: string }>();
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [resetLoading, setResetLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // 1. Ambil data awal dari API
  const fetchSessions = async () => {
    try {
      const response = await fetch(`/api/admin/exam-status?exam_id=${examId}`);
      const data = await response.json();
      setSessions(data.sessions ?? []);
      setStats(data.stats ?? {});
    } catch (error) {
      console.error("Gagal mengambil data pengawas", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, [examId]);

  // 2. Radar Real-time: Layar akan terupdate otomatis jika ada siswa yg bergerak/curang
  useEffect(() => {
    const channel = supabase
      .channel(`proctor-exam-${examId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exam_sessions', filter: `exam_id=eq.${examId}` },
        (payload) => {
          setSessions(prev =>
            prev.map(s => s.id === (payload.new as any).id ? { ...s, ...(payload.new as any) } : s)
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [examId]);

  // 3. Fungsi Membukakan Kunci IP Siswa
  const handleResetSession = async (sessionId: string, studentName: string) => {
    const reason = prompt(
      `Reset sesi keamanan untuk ${studentName}?\nTuliskan alasan (misal: "Laptop siswa mati/ganti perangkat"):`,
      'Perangkat siswa bermasalah'
    );
    if (!reason) return;

    setResetLoading(sessionId);
    try {
      const response = await fetch('/api/admin/reset-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, reason }),
      });
      const result = await response.json();

      if (result.success) {
        alert(`✅ Berhasil! ${studentName} sekarang dapat login kembali dari perangkat baru.`);
        fetchSessions();
      } else {
        alert(`❌ Gagal: ${result.message || result.error}`);
      }
    } catch (err) {
      alert('Terjadi kesalahan saat menghubungi server.');
    } finally {
      setResetLoading(null);
    }
  };

  const filteredSessions = sessions.filter(s => {
    const matchSearch =
      s.users?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.users?.student_number?.includes(searchQuery);
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      not_started: { label: 'Belum Mulai', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: <Clock className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> },
      in_progress: { label: 'Mengerjakan', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: <span className="w-2 h-2 md:w-2.5 md:h-2.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)] shrink-0" /> },
      submitted: { label: 'Selesai', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: <CheckCircle className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> },
      force_submitted: { label: 'Paksa Kumpul', color: 'bg-red-50 text-red-600 border-red-200', icon: <ShieldAlert className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> },
      expired: { label: 'Waktu Habis', color: 'bg-orange-50 text-orange-600 border-orange-200', icon: <XCircle className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" /> },
    };
    return map[status] ?? map.not_started;
  };

  if (loading) return (
    <div className="min-h-[60vh] md:min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 md:gap-4 p-4">
      <div className="w-10 h-10 md:w-12 md:h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      <p className="text-slate-500 font-semibold animate-pulse text-xs md:text-sm">Memuat Radar Pengawas...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20 md:pb-10">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 md:py-8 animate-in fade-in duration-500">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-4 bg-white p-5 md:p-6 rounded-[1.5rem] md:rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2 md:gap-3">
              <ShieldAlert className="w-6 h-6 md:w-7 md:h-7 text-blue-600" />
              Pusat Komando Pengawas
            </h1>
            <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium ml-8 md:ml-10 leading-snug">Monitoring peserta ujian secara real-time (Live)</p>
          </div>
          <button
            onClick={fetchSessions}
            className="flex items-center justify-center gap-2 px-4 md:px-5 py-3 md:py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm transition-all active:scale-95 shadow-sm w-full sm:w-auto mt-2 sm:mt-0"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Radar
          </button>
        </div>

        {/* KARTU STATISTIK */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
          {[
            { key: 'total', label: 'Total Peserta', color: 'text-slate-800', bg: 'bg-white' },
            { key: 'in_progress', label: 'Mengerjakan', color: 'text-blue-600', bg: 'bg-blue-50/50' },
            { key: 'submitted', label: 'Selesai', color: 'text-emerald-600', bg: 'bg-emerald-50/50' },
            { key: 'force_submitted', label: 'Diskualifikasi', color: 'text-red-600', bg: 'bg-red-50/50' },
            { key: 'not_started', label: 'Belum Mulai', color: 'text-slate-400', bg: 'bg-white' },
          ].map(({ key, label, color, bg }) => (
            <div key={key} className={`${bg} border border-slate-200 rounded-xl md:rounded-2xl p-4 md:p-5 text-center shadow-sm`}>
              <p className={`text-2xl sm:text-3xl md:text-4xl font-black ${color}`}>{stats[key] ?? 0}</p>
              <p className="text-[9px] md:text-xs text-slate-500 font-bold uppercase tracking-wider mt-1.5 md:mt-2 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* PENCARIAN & FILTER */}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-5 md:mb-6">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
            <input
              type="text" placeholder="Cari nama atau NIS siswa..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-3.5 bg-white border border-slate-200 rounded-xl md:rounded-2xl text-xs md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
            />
          </div>
          <select
            value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-auto px-4 py-3 md:py-3.5 bg-white border border-slate-200 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer transition-all"
          >
            <option value="all">Semua Status</option>
            <option value="in_progress">Sedang Mengerjakan</option>
            <option value="submitted">Sudah Selesai</option>
            <option value="force_submitted">Diskualifikasi (Curang)</option>
            <option value="not_started">Belum Mulai</option>
          </select>
        </div>

        {/* TABEL PESERTA - TAMPILAN DESKTOP/TABLET */}
        <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-black tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Nama Siswa</th>
                  <th className="px-6 py-4 text-center">Kelas</th>
                  <th className="px-6 py-4">Status Ujian</th>
                  <th className="px-6 py-4 text-center">Posisi Soal</th>
                  <th className="px-6 py-4 text-center">Pelanggaran</th>
                  <th className="px-6 py-4 text-center">Alamat IP</th>
                  <th className="px-6 py-4 text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSessions.map((session) => {
                  const badge = getStatusBadge(session.status);
                  const hasViolations = session.tab_switch_count > 0;
                  const isDanger = session.tab_switch_count >= 2;

                  return (
                    <tr key={session.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{session.users?.full_name}</p>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">NIS: {session.users?.student_number}</p>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-600 text-center">{session.users?.class_group}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 md:gap-2 px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold border whitespace-nowrap ${badge.color}`}>
                          {badge.icon} {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-600">
                        {session.status === 'in_progress' ? `No. ${session.current_question_index + 1}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-xs ${
                          isDanger ? 'bg-red-100 text-red-600' : hasViolations ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {session.tab_switch_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <code className="text-[10px] md:text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                          {session.bound_ip ?? 'Belum Terdeteksi'}
                        </code>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {['in_progress', 'not_started'].includes(session.status) ? (
                          <button
                            onClick={() => handleResetSession(session.id, session.users?.full_name)}
                            disabled={resetLoading === session.id}
                            className="px-3 md:px-4 py-2 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-600 hover:text-amber-600 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 md:gap-2 mx-auto shadow-sm whitespace-nowrap"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${resetLoading === session.id ? 'animate-spin' : ''}`} />
                            Buka Kunci
                          </button>
                        ) : (
                          <span className="text-[10px] md:text-xs text-slate-400 font-medium italic">Terkunci</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* TAMPILAN MOBILE (List Card) */}
        <div className="md:hidden flex flex-col gap-3">
           {filteredSessions.map((session) => {
              const badge = getStatusBadge(session.status);
              const hasViolations = session.tab_switch_count > 0;
              const isDanger = session.tab_switch_count >= 2;

              return (
                 <div key={session.id} className={`bg-white border p-4 rounded-2xl shadow-sm flex flex-col gap-3 ${isDanger ? 'border-red-300' : 'border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                       <div className="min-w-0 flex-1">
                          <p className="font-black text-slate-800 text-sm leading-tight mb-1 truncate">{session.users?.full_name}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                             <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">NIS: {session.users?.student_number}</span>
                             <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{session.users?.class_group}</span>
                          </div>
                       </div>
                       <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold border shrink-0 ${badge.color}`}>
                          {badge.icon} {badge.label}
                       </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                       <div className="flex flex-col items-center justify-center">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Posisi</span>
                          <span className="text-xs font-bold text-slate-700">{session.status === 'in_progress' ? `No.${session.current_question_index + 1}` : '-'}</span>
                       </div>
                       <div className="flex flex-col items-center justify-center border-l border-r border-slate-200">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Peringatan</span>
                          <span className={`text-xs font-black ${isDanger ? 'text-red-600' : hasViolations ? 'text-amber-600' : 'text-slate-600'}`}>{session.tab_switch_count}x</span>
                       </div>
                       <div className="flex flex-col items-center justify-center">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">IP</span>
                          <span className="text-[10px] font-mono font-bold text-slate-600 truncate max-w-full px-1">{session.bound_ip ? session.bound_ip.split(',')[0] : '-'}</span>
                       </div>
                    </div>

                    <div className="pt-1 flex justify-end">
                       {['in_progress', 'not_started'].includes(session.status) ? (
                          <button
                            onClick={() => handleResetSession(session.id, session.users?.full_name)}
                            disabled={resetLoading === session.id}
                            className="w-full py-2.5 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-600 hover:text-amber-600 rounded-xl text-[10px] font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${resetLoading === session.id ? 'animate-spin' : ''}`} />
                            Buka Kunci Perangkat
                          </button>
                        ) : (
                          <div className="w-full py-2.5 text-center text-[10px] text-slate-400 font-bold italic bg-slate-50 rounded-xl border border-slate-100">
                            Sesi Terkunci
                          </div>
                        )}
                    </div>
                 </div>
              )
           })}
        </div>

        {filteredSessions.length === 0 && (
          <div className="text-center py-16 md:py-20 bg-white border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm md:hidden">
            <ShieldAlert className="w-10 h-10 md:w-12 md:h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-bold text-sm md:text-lg">Radar Kosong</p>
            <p className="text-slate-400 text-xs md:text-sm mt-1 px-4">Tidak ada peserta ujian yang ditemukan.</p>
          </div>
        )}

      </div>
    </div>
  );
}