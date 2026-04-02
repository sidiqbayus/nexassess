import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, 
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const students = body.students;

    if (!students || !Array.isArray(students)) {
      return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
    }

    let successCount = 0;
    let errors: string[] = [];

    for (const student of students) {
      try {
        // 1. Buat akun di Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: student.email,
          password: student.password,
          email_confirm: true,
        });

        if (authError) throw new Error(authError.message);

        // 2. Gunakan UPSERT (Timpa) agar tidak bentrok dengan Trigger Database
        if (authData.user) {
          const { error: dbError } = await supabaseAdmin.from('users').upsert({
            id: authData.user.id,
            email: student.email,
            full_name: student.full_name,
            student_number: student.student_number,
            class_group: student.class_group,
            role: 'student', // Ini menjamin siswa tidak akan nyasar ke Admin
            is_active: true
          });

          if (dbError) throw new Error(dbError.message);
          successCount++;
        }
      } catch (err: any) {
        errors.push(`${student.full_name}: ${err.message}`);
      }
    }

    // Jika semua gagal, berikan respon error yang tegas
    if (successCount === 0 && errors.length > 0) {
      return NextResponse.json({ error: errors[0] }, { status: 400 });
    }

    return NextResponse.json({ count: successCount, errors });

  } catch (error: any) {
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}