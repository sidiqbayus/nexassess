import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

const cleanHTML = (str: any) => {
   if (!str) return '';
   return String(str).replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
};

const isValidStr = (val: any) => {
    if (val === null || val === undefined) return false;
    const clean = cleanHTML(val);
    return clean !== '' && clean !== 'null';
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { examId, studentId, sessionId, answers, examInfo } = body;

    if (!examId || !studentId || !sessionId) {
      return NextResponse.json({ error: 'Data payload tidak lengkap dari frontend.' }, { status: 400 });
    }

    const safeAnswers = answers || {};

    const { data: examData, error: examError } = await supabaseServer.from('exams').select('*').eq('id', examId).maybeSingle();
    if (examError) throw new Error("Gagal menarik info ujian: " + examError.message);

    let targetSubjectId = examData?.subject_id;
    if (!targetSubjectId && examData?.subject) {
        const { data: subjData } = await supabaseServer.from('subjects').select('id').eq('name', examData.subject).maybeSingle();
        if (subjData) targetSubjectId = subjData.id;
    }

    let qQuery = supabaseServer.from('questions').select('*');
    if (targetSubjectId) qQuery = qQuery.eq('subject_id', targetSubjectId);
    else if (examData?.subject) qQuery = qQuery.eq('subject', examData.subject);
    else qQuery = qQuery.eq('exam_id', examId);

    const { data: questions, error: qError } = await qQuery;

    if (qError) throw new Error('Query soal error: ' + qError.message);
    if (!questions || questions.length === 0) throw new Error('Soal tidak ditemukan di database untuk dinilai.');

    let score = 0;
    let maxScore = 0;
    const detailsToInsert: any[] = [];

    // 3. PROSES PENILAIAN OTOMATIS
    questions.forEach(q => {
        const maxP = Number(q.points) || 0;
        
        // PERBAIKAN: maxScore SELALU ditambah poin maksimal soal (termasuk soal Esai)
        maxScore += maxP;
        
        const studentAnsObj = safeAnswers[q.id];
        const ansText = studentAnsObj?.selected_answer || '';
        let earnedPoints = 0;
        const isGraded = studentAnsObj?.flag_status === 'marked_for_review' ? true : false;

        // Soal Esai: Poin didapat (earnedPoints) dianggap 0 dahulu, menunggu guru menilai.
        if (q.question_type === 'essay' || !ansText) {
            detailsToInsert.push({ 
                exam_id: examId, student_id: studentId, session_id: sessionId, 
                question_id: q.id, answer_text: ansText, points_given: 0, 
                is_correct: false, is_graded: isGraded 
            });
            return; 
        }

        if (['multiple_choice', 'true_false', 'short_answer'].includes(q.question_type)) {
            if (cleanHTML(ansText) === cleanHTML(q.correct_answer)) earnedPoints = maxP;
        } 
        else if (q.question_type === 'complex_multiple_choice') {
            const correctArr = String(q.correct_answer || '').split(',').map(s=>s.trim().toUpperCase()).sort();
            const ansArr = String(ansText).split(',').map(s=>s.trim().toUpperCase()).sort();
            
            if (q.scoring_type === 'partial') {
                let validHits = ansArr.filter(a => correctArr.includes(a)).length;
                let invalidHits = ansArr.filter(a => !correctArr.includes(a)).length;
                let netHits = Math.max(0, validHits - invalidHits);
                earnedPoints = Number(((netHits / correctArr.length) * maxP).toFixed(2));
            } else {
                if (JSON.stringify(correctArr) === JSON.stringify(ansArr)) earnedPoints = maxP;
            }
        } 
        else if (q.question_type === 'matching') {
            try {
                const ansMap = typeof ansText === 'string' ? JSON.parse(ansText) : ansText;
                const correctMapArr = typeof q.correct_answer === 'string' ? JSON.parse(q.correct_answer) : (q.correct_answer || []);
                
                let totalValidPairs = 0; 
                let correctPairs = 0;
                
                correctMapArr.forEach((pair:any) => {
                     const premis = pair.left !== undefined ? String(pair.left) : String(pair.key);
                     const respons = pair.right !== undefined ? String(pair.right) : (pair.text !== undefined ? String(pair.text) : String(pair.value));
                     
                     if (isValidStr(premis) && isValidStr(respons)) {
                         totalValidPairs++;
                         let studentAnsVal = null;
                         for (const [sKey, sVal] of Object.entries(ansMap)) {
                             if (cleanHTML(sKey) === cleanHTML(premis)) { studentAnsVal = String(sVal); break; }
                         }
                         if (studentAnsVal !== null && cleanHTML(studentAnsVal) === cleanHTML(respons)) correctPairs++;
                     }
                });
                
                if (q.scoring_type === 'partial') {
                    earnedPoints = totalValidPairs > 0 ? Number(((correctPairs / totalValidPairs) * maxP).toFixed(2)) : 0;
                } else {
                    if (totalValidPairs > 0 && correctPairs === totalValidPairs) earnedPoints = maxP;
                }
            } catch(e) { console.error("Matching error on server", e) }
        }

        score += earnedPoints;
        detailsToInsert.push({ 
            exam_id: examId, student_id: studentId, session_id: sessionId, question_id: q.id, 
            answer_text: ansText, points_given: earnedPoints, is_correct: earnedPoints > 0, 
            is_graded: isGraded 
        });
    });

    // PERBAIKAN: finalScore dihitung dengan rumus: (Skor Diperoleh / Total Semua Skor Termasuk Esai) * 100
    const finalScore100 = maxScore > 0 ? (score / maxScore) * 100 : 0;
    const kkm = examInfo?.passing_score || examData?.passing_score || 0;
    const isPassed = finalScore100 >= kkm;

    // 4. OPTIMASI DATABASE SANGAT CEPAT (Hapus data lama, Insert data baru)
    await supabaseServer.from('student_responses').delete().eq('session_id', sessionId);
    
    if (detailsToInsert.length > 0) {
        const { error: insErr } = await supabaseServer.from('student_responses').insert(detailsToInsert);
        if (insErr) throw new Error("Gagal menyimpan rincian jawaban: " + insErr.message);
    }

    // 5. UPDATE SESSION TERAKHIR
    const { error: sessionErr } = await supabaseServer.from('exam_sessions').update({ 
        status: 'finished', 
        submitted_at: new Date().toISOString(),
        total_score: score, 
        percentage_score: finalScore100, 
        is_passed: isPassed
    }).eq('id', sessionId);

    if (sessionErr) throw new Error("Gagal update status sesi ujian: " + sessionErr.message);

    return NextResponse.json({ success: true, score: finalScore100, isPassed: isPassed });

  } catch (error: any) {
    console.error("CRITICAL API ERROR:", error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan sistem internal.' }, { status: 500 });
  }
}