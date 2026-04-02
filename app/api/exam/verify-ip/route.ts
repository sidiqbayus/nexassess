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
            } catch (error) {}
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ allowed: false, reason: 'not_authenticated' }, { status: 401 });

    const body = await request.json();
    const { sessionId } = body;

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

    const { data: session } = await supabase.from('exam_sessions').select('id, user_id, bound_ip').eq('id', sessionId).single();

    if (!session) return NextResponse.json({ allowed: false, reason: 'session_not_found' });

    // Jika belum ada IP yang terikat, ikat sekarang
    if (!session.bound_ip) {
      await supabase.from('exam_sessions').update({ bound_ip: clientIp, status: 'in_progress', started_at: new Date().toISOString() }).eq('id', sessionId);
      await supabase.from('users').update({ current_ip: clientIp, session_locked: true }).eq('id', user.id);
      return NextResponse.json({ allowed: true });
    }

    // Tolak jika IP berbeda
    if (session.bound_ip !== clientIp) {
      await supabase.from('audit_logs').insert({ actor_id: user.id, target_id: sessionId, action: 'security.ip_mismatch' });
      return NextResponse.json({ allowed: false, message: 'Akses ditolak: Perangkat berbeda terdeteksi.' });
    }

    return NextResponse.json({ allowed: true });
  } catch (error) {
    return NextResponse.json({ allowed: false, reason: 'server_error' }, { status: 500 });
  }
}