'use client';

interface Question { 
  id: string; 
  question_order: number; 
  section_name?: string; 
}

interface Answer { 
  question_id: string; 
  selected_answer: string | null; 
  flag_status: string; 
}

interface QuestionNavigatorProps {
  questions: Question[];
  answers: Record<string, Answer>;
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export default function QuestionNavigator({
  questions, answers, currentIndex, onNavigate
}: QuestionNavigatorProps) {
  
  // 1. Kelompokkan soal per section (Fitur Asli Anda yang sangat bagus)
  const sections = questions.reduce((acc, q, idx) => {
    const section = q.section_name ?? 'Soal';
    if (!acc[section]) acc[section] = [];
    acc[section].push({ ...q, index: idx });
    return acc;
  }, {} as Record<string, Array<Question & { index: number }>>);

  // 2. Logika Penentuan Warna (Prioritas Diperbaiki)
  const getButtonStyle = (question: Question, index: number): string => {
    const answer = answers[question.id];
    const isCurrent = index === currentIndex;
    const isAnswered = !!answer?.selected_answer;
    const isFlagged = answer?.flag_status === 'marked_for_review';

    // Base style untuk bentuk kotak dan animasi
    let style = "w-10 h-10 rounded-xl text-sm font-bold transition-all duration-200 border shadow-sm flex items-center justify-center";

    // --- PRIORITAS WARNA STATUS JAWABAN ---
    if (isFlagged) {
      // Prioritas 1: RAGU-RAGU (Kuning/Amber) - Walaupun sudah dijawab, kuning tetap menang
      style += " bg-amber-400 text-white border-amber-500 hover:bg-amber-500";
    } else if (isAnswered) {
      // Prioritas 2: SUDAH DIJAWAB (Hijau/Emerald)
      style += " bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600";
    } else {
      // Prioritas 3: BELUM DIJAWAB (Abu-abu/Putih)
      style += " bg-white text-slate-500 border-slate-200 hover:bg-slate-50";
    }

    // --- EFEK SOAL YANG SEDANG DIBUKA (ACTIVE) ---
    if (isCurrent) {
      // Jika sedang dibuka, berikan cincin/border biru menyala agar siswa tahu posisinya
      style += " ring-4 ring-blue-200 ring-offset-1 border-blue-500 scale-110 z-10";
    }

    return style;
  };

  return (
    <div className="space-y-6">
      {Object.entries(sections).map(([sectionName, sectionQuestions]) => (
        <div key={sectionName}>
          {/* Judul Section (Hanya muncul jika memang ada section_name di database) */}
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3">
            {sectionName}
          </p>
          
          <div className="flex flex-wrap gap-2">
            {sectionQuestions.map((q) => (
              <button
                key={q.id}
                onClick={() => onNavigate(q.index)}
                className={getButtonStyle(q, q.index)}
                title={`Soal ${q.question_order}`}
              >
                {q.question_order}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}