import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
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
            } catch (error) {}
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const examId = request.nextUrl.searchParams.get('exam_id');
    if (!examId) return NextResponse.json({ error: 'exam_id diperlukan' }, { status: 400 });

    const { data: sessions } = await supabase
      .from('exam_sessions')
      .select(`id, status, started_at, submitted_at, expires_at, tab_switch_count, bound_ip, current_question_index, total_score, percentage_score, reset_count, users (id, full_name, student_number, class_group)`)
      .eq('exam_id', examId);

    const stats = {
      total: sessions?.length ?? 0,
      not_started: sessions?.filter(s => s.status === 'not_started').length ?? 0,
      in_progress: sessions?.filter(s => s.status === 'in_progress').length ?? 0,
      submitted: sessions?.filter(s => s.status === 'submitted').length ?? 0,
      force_submitted: sessions?.filter(s => s.status === 'force_submitted').length ?? 0,
    };

    return NextResponse.json({ sessions, stats });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}