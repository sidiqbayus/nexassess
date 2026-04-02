import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    // 1. Ubah exam_id menjadi subject_id
    const { subject_id, questions } = await req.json();

    if (!subject_id || !questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: 'Data mata pelajaran atau soal tidak valid.' }, { status: 400 });
    }

    // 2. Siapkan data untuk di-insert
    const payload = questions.map((q: any, index: number) => ({
      ...q, // Mengambil semua data dari frontend (termasuk points, package_name, dll)
      subject_id: subject_id, // Gunakan subject_id
      question_order: index + 1, // Urutkan otomatis
    }));

    // Masukkan ke database sekaligus (Bulk Insert)
    const { error } = await supabaseAdmin.from('questions').insert(payload);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, count: payload.length });
  } catch (error: any) {
    console.error("Error Import Soal:", error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan saat menyimpan soal.' }, { status: 500 });
  }
}