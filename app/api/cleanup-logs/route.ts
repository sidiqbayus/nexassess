import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

export async function GET(request: Request) {
  try {
    // PROTEKSI KEAMANAN: Pastikan yang memanggil API ini memiliki password rahasia
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Akses Ditolak. Kunci Rahasia Salah.' }, { status: 401 });
    }

    // 1. Hapus log pengawasan (foto) yang usianya lebih dari 7 hari (Untuk versi gratis, 7 hari lebih aman dari 30 hari agar DB tidak cepat penuh)
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 7);
    const deleteBefore = thresholdDate.toISOString();

    const { count, error: deleteLogsError } = await supabaseServer
      .from('exam_proctoring_logs')
      .delete({ count: 'exact' })
      .lt('created_at', deleteBefore);

    if (deleteLogsError) throw deleteLogsError;

    // 2. Membersihkan sesi ujian yang "nyangkut" (ongoing lebih dari 2 hari)
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 2);
    
    await supabaseServer
      .from('exam_sessions')
      .update({ status: 'finished' })
      .eq('status', 'ongoing')
      .lt('created_at', staleDate.toISOString());

    return NextResponse.json({ 
        success: true, 
        message: `Pembersihan berhasil. ${count || 0} baris log foto lama telah dihapus permanen.`,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}