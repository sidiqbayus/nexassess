import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  // Gunakan Service Role Key untuk menembus batas keamanan Auth (Tanpa melogout Admin)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const body = await req.json();
    const { teachers } = body; 

    const processed = [];
    const errors = [];

    // Loop untuk menangani Pembuatan Tunggal maupun Import Massal
    for (const t of teachers) {
       if (t.id) {
          // JIKA EDIT GURU (UPDATE)
          if (t.password) {
             // Jika password diisi saat diedit admin, ubah password di Auth juga
             await supabaseAdmin.auth.admin.updateUserById(t.id, { password: t.password, user_metadata: { full_name: t.full_name } });
          } else {
             await supabaseAdmin.auth.admin.updateUserById(t.id, { user_metadata: { full_name: t.full_name } });
          }
          const { error: dbError } = await supabaseAdmin.from('users').update(t).eq('id', t.id);
          if (dbError) errors.push(dbError.message);
          else processed.push(t);

       } else {
          // JIKA GURU BARU (INSERT)
          const email = t.email || `${t.username}@nexassess.com`;
          
          // 1. Daftarkan diam-diam ke Supabase Auth Internal
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: t.password,
            email_confirm: true,
            user_metadata: { full_name: t.full_name, role: 'teacher' }
          });

          if (authError) {
             errors.push(authError.message);
             continue; // Lanjut ke row excel berikutnya jika ada error
          }

          // 2. Simpan data lengkapnya ke tabel public.users
          const payload = { ...t, id: authData.user.id };
          const { error: dbError } = await supabaseAdmin.from('users').upsert(payload);
          
          if (dbError) errors.push(dbError.message);
          else processed.push(payload);
       }
    }

    if (processed.length === 0 && errors.length > 0) {
       return NextResponse.json({ error: errors[0] }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: processed, errors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}