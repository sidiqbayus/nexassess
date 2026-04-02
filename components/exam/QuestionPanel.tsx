'use client';

import { ChevronLeft, ChevronRight, BookmarkPlus, BookmarkCheck } from 'lucide-react';
import AudioPlayer from './AudioPlayer';

interface QuestionOption { key: string; text: string; image_url?: string; }
interface Question {
  id: string;
  question_text: string;
  question_type: string;
  image_url?: string;
  audio_url?: string;
  audio_duration?: number;
  options?: QuestionOption[];
  question_order: number;
  section_name?: string;
}

interface QuestionPanelProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: string | null;
  flagStatus: string;
  onAnswerChange: (answer: string) => void;
  onToggleFlag: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export default function QuestionPanel({
  question, questionNumber, totalQuestions,
  selectedAnswer, flagStatus,
  onAnswerChange, onToggleFlag, onPrevious, onNext
}: QuestionPanelProps) {
  const isFlagged = flagStatus === 'marked_for_review';

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      {/* Header soal */}
      <div className="flex items-start justify-between pb-4 border-b border-slate-200">
        <div>
          {question.section_name && (
            <p className="text-xs text-blue-600 font-black uppercase tracking-widest mb-1.5 bg-blue-50 inline-block px-2 py-1 rounded-md">
              {question.section_name}
            </p>
          )}
          <h2 className="text-2xl font-black text-slate-800">
            Pertanyaan {questionNumber}
            <span className="text-slate-400 font-semibold text-lg ml-2">/ {totalQuestions}</span>
          </h2>
        </div>

        {/* Tombol flag ragu-ragu */}
        <button
          onClick={onToggleFlag}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all active:scale-95
            ${isFlagged
              ? 'bg-amber-50 border-amber-300 text-amber-600 shadow-sm shadow-amber-100'
              : 'bg-white border-slate-200 text-slate-500 hover:text-amber-500 hover:border-amber-200 hover:bg-amber-50 shadow-sm'
            }`}
        >
          {isFlagged ? <BookmarkCheck className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
          {isFlagged ? 'Ragu-ragu' : 'Tandai Ragu'}
        </button>
      </div>

      {/* Audio player (untuk soal listening) */}
      {question.audio_url && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-inner">
          <p className="text-xs text-slate-500 mb-3 font-bold uppercase tracking-widest flex items-center gap-2">
            <span>🎧</span> Audio Pendukung
          </p>
          <AudioPlayer src={question.audio_url} duration={question.audio_duration} />
        </div>
      )}

      {/* Teks soal */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <div
          className="question-text text-slate-800 text-lg leading-loose prose max-w-none prose-p:my-2 prose-strong:text-slate-900"
          dangerouslySetInnerHTML={{ __html: question.question_text }}
        />

        {/* Gambar soal */}
        {question.image_url && (
          <div className="mt-6">
            <img
              src={question.image_url}
              alt="Gambar soal"
              className="max-w-full rounded-2xl border border-slate-200 mx-auto shadow-sm"
              style={{ maxHeight: '400px', objectFit: 'contain' }}
            />
          </div>
        )}
      </div>

      {/* Pilihan Jawaban */}
      {question.question_type !== 'essay' && question.options && (
        <div className="space-y-4">
          {question.options.map((option) => {
            const isSelected = selectedAnswer === option.key;
            return (
              <button
                key={option.key}
                onClick={() => onAnswerChange(option.key)}
                className={`
                  w-full flex items-start gap-5 p-5 rounded-2xl border text-left
                  transition-all duration-200 hover:scale-[1.005] active:scale-[0.99]
                  ${isSelected
                    ? 'bg-emerald-50/80 border-emerald-400 shadow-md shadow-emerald-100/50 ring-1 ring-emerald-400'
                    : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
                  }
                `}
              >
                {/* Key lingkaran */}
                <span className={`
                  flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-all
                  ${isSelected
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }
                `}>
                  {option.key}
                </span>

                {/* Teks & gambar opsi */}
                <div className="flex-1 min-w-0 pt-2">
                  <span className={`text-base leading-relaxed ${isSelected ? 'text-emerald-900 font-bold' : 'text-slate-700 font-medium'}`}>
                    {option.text}
                  </span>
                  {option.image_url && (
                    <img
                      src={option.image_url}
                      alt={`Opsi ${option.key}`}
                      className="mt-4 max-h-40 rounded-xl border border-slate-200 shadow-sm"
                    />
                  )}
                </div>

                {/* Checkmark */}
                {isSelected && (
                  <span className="flex-shrink-0 pt-2 text-emerald-500">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                      <span className="font-bold">✓</span>
                    </div>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Essay textarea */}
      {question.question_type === 'essay' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <label className="text-sm text-slate-800 font-bold block mb-3 flex justify-between items-center">
            <span>Lembar Jawaban Essay:</span>
            <span className="text-xs text-slate-400 font-medium tracking-wider bg-slate-100 px-3 py-1 rounded-full">
              {(selectedAnswer ?? '').length} KARAKTER
            </span>
          </label>
          <textarea
            value={selectedAnswer ?? ''}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Tuliskan jawaban lengkap Anda di sini..."
            rows={10}
            className="selectable w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-slate-800 text-base leading-relaxed focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 focus:bg-white transition-all resize-y"
          />
        </div>
      )}

      {/* Navigasi Prev/Next */}
      <div className="flex gap-4 pt-6 border-t border-slate-200">
        <button
          onClick={onPrevious}
          disabled={questionNumber === 1}
          className="flex-1 flex items-center justify-center gap-3 py-4 bg-white hover:bg-slate-50 disabled:bg-slate-50 disabled:opacity-50 border border-slate-200 rounded-2xl text-slate-700 font-bold transition-all shadow-sm active:scale-95"
        >
          <ChevronLeft className="w-5 h-5" />
          Soal Sebelumnya
        </button>
        <button
          onClick={onNext}
          disabled={questionNumber === totalQuestions}
          className="flex-1 flex items-center justify-center gap-3 py-4 bg-white hover:bg-slate-50 disabled:bg-slate-50 disabled:opacity-50 border border-slate-200 rounded-2xl text-slate-700 font-bold transition-all shadow-sm active:scale-95"
        >
          Soal Selanjutnya
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}