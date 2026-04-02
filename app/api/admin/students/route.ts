import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Gunakan SERVICE_ROLE_KEY untuk bypass RLS dan membuat user Auth tanpa me-logout admin
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { full_name, email, student_number, class_group, password } = body;

    // 1. Validasi input dasar
    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // 2. Buat User di sistem Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Langsung aktifkan tanpa butuh verifikasi email
      user_metadata: { full_name } // Menyimpan nama di metadata (opsional)
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 3. Masukkan profil lengkap ke tabel 'users' publik yang kita buat di skema
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId, // Cocokkan ID tabel users dengan ID Auth
        email: email,
        full_name: full_name,
        student_number: student_number,
        class_group: class_group,
        role: 'student',
        is_active: true
      });

    if (dbError) {
      // Jika gagal insert ke tabel, hapus user Auth agar tidak terjadi data yatim (orphan data)
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'Gagal menyimpan profil ke database' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Siswa berhasil dibuat' }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}