import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  // WAJIB Service Role Key. Jika tidak ada, langsung tolak sebelum error di tengah jalan.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server misconfiguration: Missing Service Role Key' }, { status: 500 });
  }

  // Gunakan Service Role Key untuk menembus batas keamanan Auth (Tanpa melogout Admin)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
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
          // ==========================================
          // 1. JIKA EDIT GURU (UPDATE)
          // ==========================================
          if (t.password) {
             // Jika password diisi saat diedit admin, ubah password di Auth juga
             await supabaseAdmin.auth.admin.updateUserById(t.id, { 
                 password: t.password, 
                 user_metadata: { full_name: t.full_name } 
             });
          } else {
             await supabaseAdmin.auth.admin.updateUserById(t.id, { 
                 user_metadata: { full_name: t.full_name } 
             });
          }
          
          const { error: dbError } = await supabaseAdmin.from('users').update(t).eq('id', t.id);
          
          if (dbError) {
              errors.push(`Gagal update DB untuk ${t.username}: ${dbError.message}`);
          } else {
              processed.push(t);
          }

       } else {
          // ==========================================
          // 2. JIKA GURU BARU (INSERT)
          // ==========================================
          const email = t.email || `${t.username}@nexassess.com`;
          const targetRole = t.role || 'teacher'; // Ambil role dari payload frontend
          
          // 2A. Daftarkan diam-diam ke Supabase Auth Internal
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: t.password,
            email_confirm: true, // Bypass verifikasi email
            user_metadata: { full_name: t.full_name, role: targetRole }
          });

          if (authError || !authData.user) {
             errors.push(`Gagal membuat Auth untuk ${t.username}: ${authError?.message}`);
             continue; // Lanjut ke row excel berikutnya jika ada error
          }

          // 2B. Simpan data lengkapnya ke tabel public.users
          const payload = { ...t, id: authData.user.id, role: targetRole };
          const { error: dbError } = await supabaseAdmin.from('users').upsert(payload);
          
          // FITUR ROLLBACK: Jika masuk DB gagal, hapus Auth yang terlanjur dibuat
          if (dbError) {
             await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
             errors.push(`Gagal menyimpan ke DB untuk ${t.username}: ${dbError.message}`);
          } else {
             processed.push(payload);
          }
       }
    }

    // Jika semua gagal total
    if (processed.length === 0 && errors.length > 0) {
       return NextResponse.json({ error: errors[0] }, { status: 400 });
    }

    // Berhasil (Bisa jadi berhasil semua, atau berhasil sebagian jika import massal)
    return NextResponse.json({ success: true, data: processed, errors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}