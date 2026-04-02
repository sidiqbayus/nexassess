import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (error) {
              // Abaikan error jika dipanggil dari Server Component
            }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });

    const body = await request.json();
    const { session_id, question_id, exam_id, selected_answer, flag_status } = body;

    const { data: session } = await supabase
      .from('exam_sessions')
      .select('status, expires_at')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (!session) return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 404 });

    if (new Date(session.expires_at) < new Date()) {
      await supabase.from('exam_sessions').update({ status: 'expired', submitted_at: new Date().toISOString() }).eq('id', session_id);
      return NextResponse.json({ error: 'Waktu habis' }, { status: 403 });
    }

    const { data: savedAnswer, error: saveError } = await supabase.rpc('fn_autosave_answer', {
      p_session_id: session_id,
      p_question_id: question_id,
      p_exam_id: exam_id,
      p_user_id: user.id,
      p_answer: selected_answer ?? null,
      p_flag: flag_status ?? 'answered',
    });

    if (saveError) throw saveError;

    return NextResponse.json({ success: true, data: savedAnswer });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}