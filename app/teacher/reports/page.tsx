'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { 
  BarChart3, Search, Download, Printer, CheckCircle2, AlertCircle, 
  Eye, Edit3, TrendingUp, Users, FileSpreadsheet, ChevronRight, 
  ArrowLeft, FileText, CheckSquare, XCircle, FileOutput, LoaderCircle,
  Save, Filter, BookOpen, Award, Info, Target, Globe, Calculator, 
  SlidersHorizontal, UserCircle2, HelpCircle, Trash2, Headphones, Activity, BookCheck, Check, X, AlertTriangle, FileEdit, ChevronDown, ListOrdered, ChevronLeft
} from 'lucide-react';
import dynamic from 'next/dynamic';

const ReactQuill = dynamic(() => import('react-quill-new'), { 
  ssr: false, 
  loading: () => <div className="h-20 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 font-medium text-xs md:text-sm">Memuat Editor...</div> 
});

// KOMPONEN EDITOR ANTI-LAG
const OptimizedQuillEditor = ({ value, onChange, placeholder, className }: any) => {
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<any>(null);

  useEffect(() => { if (value !== localValue) setLocalValue(value); }, [value]);

  const handleChange = (content: string) => {
    setLocalValue(content);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { onChange(content); }, 400); 
  };

  return (
    <ReactQuill theme="snow" modules={{ toolbar: [['bold', 'italic', 'underline'], ['clean']] }} value={localValue || ''} onChange={handleChange} placeholder={placeholder} className={className} />
  );
};

// --- HELPER UTILS ---
const cleanHTML = (str: any) => {
   if (!str) return '';
   return String(str).replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
};

const isValidStr = (val: any) => {
    if (val === null || val === undefined) return false;
    return cleanHTML(val) !== '' && cleanHTML(val) !== 'null';
};

const getSafeImageUrl = (url: string | undefined | null) => {
  if (!url) return '';
  const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)([a-zA-Z0-9_-]+)/);
  if (driveMatch) return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w1000`;
  return url; 
};

const getDriveMediaUrl = (url: string | undefined | null) => {
  const driveMatch = url?.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)([a-zA-Z0-9_-]+)/);
  return driveMatch ? `https://docs.google.com/uc?export=open&id=${driveMatch[1]}` : (url || '');
};

const SmartMediaRenderer = ({ url, className = "" }: { url?: string, className?: string }) => {
  if (!url || typeof url !== 'string') return null;
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  if (ytMatch) return (<div className={`relative w-full max-w-xl mx-auto aspect-video rounded-xl overflow-hidden shadow-sm border border-slate-200 mt-3 md:mt-4 ${className}`}><iframe src={`https://www.youtube.com/embed/${ytMatch[1]}?modestbranding=1&rel=0`} className="w-full h-full border-0" /></div>);
  if (url.match(/\.(mp4|webm|ogg)$/i)) return (<div className={`relative w-full max-w-xl mx-auto aspect-video rounded-xl overflow-hidden shadow-sm border border-slate-200 mt-3 md:mt-4 bg-black ${className}`}><video src={url} controls className="w-full h-full" /></div>);
  if (url.match(/\.(mp3|wav|m4a)$/i)) return <audio src={url} controls className={`w-full h-10 outline-none mt-3 md:mt-4 ${className}`} />;
  return null; 
};

const processHtmlMedia = (html: string) => {
  if (!html || typeof html !== 'string') return '';
  let p = html;
  p = p.replace(/allowfullscreen(="")?/gi, '');
  p = p.replace(/(?:<a[^>]*href="|>|\s|^)(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s<]{11})[^<]*(?:<\/a>|<|\s|$)/g, (match, videoId) => `<div class="relative w-full max-w-2xl mx-auto aspect-video rounded-xl overflow-hidden shadow-sm border border-slate-200 my-4"><iframe src="https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&controls=0&fs=0&disablekb=1" class="w-full h-full border-0"></iframe></div>`);
  p = p.replace(/<a[^>]*href="((?:https?:\/\/)?drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)([a-zA-Z0-9_-]+)[^"]*)"[^>]*>(.*?)<\/a>/gi, (match, fullUrl, driveId, text) => {
      if (text.toUpperCase().includes('AUDIO') || text.toUpperCase().includes('MP3') || text.toUpperCase().includes('SUARA')) return `<div class="my-4 p-3 bg-blue-50 border border-blue-200 rounded-xl w-full max-w-xl"><span class="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 flex items-center gap-1">🎧 Audio</span><audio src="https://docs.google.com/uc?export=open&id=${driveId}" controls controlsList="nodownload" class="w-full h-10 outline-none mt-1"></audio></div>`;
      return `<div class="relative w-full max-w-xl aspect-video rounded-xl overflow-hidden shadow-sm border border-slate-200 my-4"><iframe src="https://drive.google.com/file/d/${driveId}/preview" class="w-full h-full border-0"></iframe></div>`;
  });
  p = p.replace(/<a[^>]*href="([^"]+\.(?:mp3|wav|m4a))"[^>]*>.*?<\/a>/gi, '<div class="my-4 p-3 bg-blue-50 border border-blue-200 rounded-xl w-full max-w-xl"><span class="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 flex items-center gap-1">🎧 Audio Jawaban Siswa</span><audio src="$1" controls controlsList="nodownload" class="w-full h-10 outline-none mt-1"></audio></div>');
  p = p.replace(/<a[^>]*href="([^"]+\.(?:mp4|webm|ogg))"[^>]*>.*?<\/a>/gi, `<div class="relative w-full max-w-xl aspect-video rounded-xl overflow-hidden shadow-sm border border-slate-200 my-4 bg-black"><video src="$1" controls controlsList="nodownload nofullscreen" class="w-full h-full"></video></div>`);
  return p;
};

// --- INTERFACES ---
interface Exam { id: string; title: string; subject: string; target_class: any; grade_level?: string; passing_score?: number; teacherNames?: string; subject_id?: string;}
interface SessionAttempt {
  id: string; attempt_number: number; obj_score: number; essay_score: number; total_score: number; percentage_score: number; is_passed: boolean; status: string; is_highest: boolean;
  responses: any[]; 
  max_score: number; 
}
interface StudentGroupedResult {
  student_id: string; users: { full_name: string; student_number: string; class_group: string; };
  highest_percentage: number; highest_session_id: string; attempts: SessionAttempt[];
}
interface EssayAnswer {
  id: string; student_id: string; session_id: string; attempt_number: number; answer_text: string; points_given: number; teacher_notes: string; is_graded: boolean;
  questions: { question_text: string; points: number; };
  users: { full_name: string; student_number: string; class_group: string; };
}
interface StudentDetailedResponse {
  question_id: string; question_text: string; question_type: string; correct_answer: any; student_answer: string; is_correct: boolean; points_given: number; max_points: number;
}
interface TeacherProfile { id: string; full_name: string; taught_subjects?: string[]; }

export default function TeacherReportsAndAnalyticsPage() {
  const [activeView, setActiveView] = useState<'list' | 'detail'>('list');
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [activeTab, setActiveTab] = useState<'rekap' | 'esai' | 'analisis'>('rekap');
  const [appName, setAppName] = useState('CBT_App'); 
  
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingReview, setLoadingReview] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [studentGroupedResults, setStudentGroupedResults] = useState<StudentGroupedResult[]>([]);
  const [essayAnswers, setEssayAnswers] = useState<EssayAnswer[]>([]);
  const [itemAnalysis, setItemAnalysis] = useState<any[]>([]);
  const [examStats, setExamStats] = useState({ maxObj: 0, maxEss: 0, maxTotal: 0 });
  const [questionsMapData, setQuestionsMapData] = useState<Record<string, any>>({}); 
  const [exams, setExams] = useState<Exam[]>([]);
  const [myProfile, setMyProfile] = useState<TeacherProfile | null>(null);

  // State Modal Review & Pagination
  const [selectedStudentGroup, setSelectedStudentGroup] = useState<StudentGroupedResult | null>(null);
  const [activeAttemptSessionId, setActiveAttemptSessionId] = useState<string | null>(null);
  const [studentDetailedResponses, setStudentDetailedResponses] = useState<StudentDetailedResponse[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [essaySearchQuery, setEssaySearchQuery] = useState('');
  const [selectedStudentForEssay, setSelectedStudentForEssay] = useState<string | null>(null);
  const [activeEssaySessionId, setActiveEssaySessionId] = useState<string | null>(null); 

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [printConfig, setPrintConfig] = useState({
    filterClass: 'Semua Kelas', format: 'pdf' as 'pdf' | 'excel',
    cols: { nisn: true, class_group: true, obj: false, ess: false, total: true, scale100: true, status: true, attempts: true }
  });

  const [isGlobalPrintModalOpen, setIsGlobalPrintModalOpen] = useState(false);
  const [globalPrintFormat, setGlobalPrintFormat] = useState<'pdf' | 'excel'>('pdf');
  const [isPrintingGlobal, setIsPrintingGlobal] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); };
  
  useEffect(() => { fetchExams(); fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('pengaturan_aplikasi').select('nama_aplikasi').eq('id', 1).single();
      if (data?.nama_aplikasi) setAppName(data.nama_aplikasi.replace(/\s+/g, '_'));
    } catch (e) {}
  };

  const fetchExams = async () => {
    setLoadingExams(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesi tidak valid.');
      
      const { data: profile } = await supabase.from('users').select('id, full_name, taught_subjects').eq('id', user.id).single();
      setMyProfile(profile as TeacherProfile);

      const { data: examsData, error } = await supabase.from('exams').select('id, title, subject, subject_id, target_class, grade_level, passing_score').order('created_at', { ascending: false });
      if (error) throw error;
      
      if (examsData) {
          // GURU HANYA MELIHAT UJIAN DARI MAPEL YANG IA AMPU
          const filteredExams = examsData.filter(ex => {
              if (profile?.taught_subjects && ex.subject_id) {
                  return profile.taught_subjects.includes(ex.subject_id);
              } else if (profile?.taught_subjects && !ex.subject_id) {
                  return profile.taught_subjects.includes(ex.subject); 
              }
              return false;
          });
          
          const finalExams = filteredExams.map(ex => ({ ...ex, teacherNames: profile?.full_name }));
          setExams(finalExams as any);
      }
    } catch (err) { 
       showToast("Gagal muat data laporan", "error"); 
    }
    finally { setLoadingExams(false); }
  };

  const fetchExamDetails = async (exam: Exam) => {
    setActiveExam(exam); setLoadingDetail(true); setActiveView('detail'); setActiveTab('rekap'); setCurrentPage(1);
    try {
      const { data: sessions } = await supabase.from('exam_sessions').select('*').eq('exam_id', exam.id).eq('status', 'finished').order('start_time', { ascending: true });
      const { data: responses } = await supabase.from('student_responses').select('*').eq('exam_id', exam.id);
      
      let questionsData: any[] = [];
      let targetSubjectId = null;
      
      if (exam.subject) {
          const { data: subjData } = await supabase.from('subjects').select('id').eq('name', exam.subject).maybeSingle();
          if (subjData) targetSubjectId = subjData.id;
      }

      if (targetSubjectId) {
          const { data: qBySubjectId } = await supabase.from('questions').select('*').eq('subject_id', targetSubjectId);
          if (qBySubjectId) questionsData = qBySubjectId;
      }

      if (questionsData.length === 0 && exam.subject) {
          const { data: qBySubjectName } = await supabase.from('questions').select('*').eq('subject', exam.subject);
          if (qBySubjectName) questionsData = qBySubjectName;
      }
      
      if (questionsData.length === 0) {
          const { data: qByExam } = await supabase.from('questions').select('*').eq('exam_id', exam.id);
          if (qByExam) questionsData = qByExam;
      }

      const qMap: Record<string, any> = {};
      const packageStats: Record<string, { maxObj: number, maxEss: number, maxTotal: number }> = {};
      
      (questionsData || []).forEach(q => {
        qMap[q.id] = q;
        const pkg = q.package_name || 'Paket 1';
        if (!packageStats[pkg]) packageStats[pkg] = { maxObj: 0, maxEss: 0, maxTotal: 0 };
        
        const pts = Number(q.points) || 0;
        if (q.question_type === 'essay') packageStats[pkg].maxEss += pts; 
        else packageStats[pkg].maxObj += pts;
        
        packageStats[pkg].maxTotal += pts;
      });
      
      setQuestionsMapData(qMap);
      
      const defaultPkg = Object.keys(packageStats)[0] || 'Paket 1';
      setExamStats(packageStats[defaultPkg] || { maxObj: 0, maxEss: 0, maxTotal: 0 });

      const studentIds = Array.from(new Set(sessions?.map(s => s.student_id) || []));
      const { data: users } = await supabase.from('users').select('id, full_name, student_number, class_group').in('id', studentIds);
      const usersMap = Object.fromEntries(users?.map(u => [u.id, u]) || []);

      const grouped = new Map<string, StudentGroupedResult>();
      
      sessions?.forEach(s => {
        const sResponses = responses?.filter(r => r.session_id === s.id) || [];
        
        let obj_score = 0;
        let essay_score = 0;
        let studentPackage = 'Paket 1';
         
        sResponses.forEach(r => { 
           const q = qMap[r.question_id];
           if (q) {
              studentPackage = q.package_name || 'Paket 1'; 
              if (q.question_type === 'essay') { 
                 essay_score += (Number(r.points_given) || 0); 
              } else {
                 let earnedPoints = 0;
                 const maxP = Number(q.points) || 0;
                 const ans = r.answer_text;

                 if (ans && q.correct_answer) {
                    if (['multiple_choice', 'true_false', 'short_answer'].includes(q.question_type)) {
                        if (cleanHTML(ans) === cleanHTML(q.correct_answer)) { earnedPoints = maxP; }
                    } 
                    else if (q.question_type === 'complex_multiple_choice') {
                        const correctArr = String(q.correct_answer).split(',').map(s=>s.trim().toUpperCase()).sort();
                        const ansArr = String(ans).split(',').map(s=>s.trim().toUpperCase()).sort();
                        if (q.scoring_type === 'partial') {
                            let validHits = ansArr.filter(a => correctArr.includes(a)).length;
                            let invalidHits = ansArr.filter(a => !correctArr.includes(a)).length;
                            let netHits = Math.max(0, validHits - invalidHits);
                            earnedPoints = Number(((netHits / correctArr.length) * maxP).toFixed(2));
                        } else {
                            if (JSON.stringify(correctArr) === JSON.stringify(ansArr)) { earnedPoints = maxP; }
                        }
                    } 
                    else if (q.question_type === 'matching') {
                        try {
                            const ansMap = typeof ans === 'string' ? JSON.parse(ans) : ans; 
                            const correctMapArr = typeof q.correct_answer === 'string' ? JSON.parse(q.correct_answer) : q.correct_answer;
                            let totalValidPairs = 0; let correctPairs = 0;
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
                                if (totalValidPairs > 0 && correctPairs === totalValidPairs) { earnedPoints = maxP; }
                            }
                        } catch(e) {}
                    }
                 }
                 r.points_given = earnedPoints;
                 obj_score += earnedPoints;
              }
           } 
        });

        const calculatedTotal = obj_score + essay_score;
        const studentMaxTotal = packageStats[studentPackage]?.maxTotal || packageStats[defaultPkg]?.maxTotal || 0;
        const calculatedPercentage = studentMaxTotal > 0 ? (calculatedTotal / studentMaxTotal) * 100 : 0;

        const attempt: SessionAttempt = {
          id: s.id, attempt_number: 0, 
          obj_score: obj_score, 
          essay_score: essay_score, 
          total_score: calculatedTotal, 
          percentage_score: calculatedPercentage,
          is_passed: calculatedPercentage >= (exam.passing_score || 0), 
          status: s.status, is_highest: false,
          responses: sResponses,
          max_score: studentMaxTotal 
        };

        if (!grouped.has(s.student_id)) {
          grouped.set(s.student_id, {
            student_id: s.student_id, users: usersMap[s.student_id] || { full_name: 'Tanpa Nama', student_number: '-', class_group: '-' },
            highest_percentage: calculatedPercentage, highest_session_id: s.id, attempts: [attempt]
          });
        } else {
          const g = grouped.get(s.student_id)!; g.attempts.push(attempt);
          if (calculatedPercentage > g.highest_percentage) { 
              g.highest_percentage = calculatedPercentage; 
              g.highest_session_id = s.id; 
          }
        }
      });

      const finalGrouped = Array.from(grouped.values()).map(g => {
        g.attempts.forEach((a, i) => { a.attempt_number = i + 1; a.is_highest = a.id === g.highest_session_id; });
        return g;
      });
      setStudentGroupedResults(finalGrouped);

      if (responses) {
          const finalEssays: any[] = [];
          responses.forEach(r => {
             const q = qMap[r.question_id];
             if (q && q.question_type === 'essay') {
                 const sg = grouped.get(r.student_id);
                 if (sg) {
                     const attemptMeta = sg.attempts.find(a => a.id === r.session_id) || sg.attempts[0];
                     finalEssays.push({
                         id: r.id, student_id: r.student_id, session_id: r.session_id, attempt_number: attemptMeta?.attempt_number || 1,
                         answer_text: r.answer_text, points_given: r.points_given, teacher_notes: r.teacher_notes, is_graded: r.is_graded,
                         questions: q, users: sg.users
                     });
                 }
             }
          });
          setEssayAnswers(finalEssays);

          const analysisData = responses.map(r => ({ ...r, questions: qMap[r.question_id] })).filter(r => r.questions && r.questions.question_type !== 'essay');
          const stats = transformAnalysis(analysisData);
          setItemAnalysis(stats);
      }

    } catch (err: any) { showToast("Gagal memuat detail ujian: " + err.message, "error"); }
    finally { setLoadingDetail(false); }
  };

  const transformAnalysis = (raw: any[]) => {
    const map = new Map();
    raw.forEach(r => {
      if (!map.has(r.question_id)) {
        map.set(r.question_id, { id: r.question_id, text: r.questions.question_text, type: r.questions.question_type, imageUrl: r.questions.image_url, audioUrl: r.questions.audio_url, videoUrl: r.questions.video_url, correct: 0, total: 0 });
      }
      const current = map.get(r.question_id);
      
      let isCorrect = false; 
      const ans = r.answer_text; 
      const q = r.questions;
      
      if (ans && q.correct_answer) {
         if (['multiple_choice', 'true_false', 'short_answer'].includes(q.question_type)) {
             if (cleanHTML(ans) === cleanHTML(q.correct_answer)) isCorrect = true;
         } 
         else if (q.question_type === 'complex_multiple_choice') {
             const correctArr = String(q.correct_answer).split(',').map(s=>s.trim().toUpperCase()).sort();
             const ansArr = String(ans).split(',').map(s=>s.trim().toUpperCase()).sort();
             if (JSON.stringify(correctArr) === JSON.stringify(ansArr)) isCorrect = true;
         } 
         else if (q.question_type === 'matching') {
             try {
                 const ansMap = typeof ans === 'string' ? JSON.parse(ans) : ans; 
                 const correctMapArr = typeof q.correct_answer === 'string' ? JSON.parse(q.correct_answer) : q.correct_answer;
                 
                 let totalValidPairs = 0; let correctPairs = 0;
                 
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
                 if (totalValidPairs > 0 && correctPairs === totalValidPairs) isCorrect = true;
             } catch(e) {}
         }
      }
      
      if (isCorrect) current.correct += 1;
      current.total += 1;
    });
    return Array.from(map.values());
  };

  const openReviewModal = async (group: StudentGroupedResult) => {
      setSelectedStudentGroup(group);
      setActiveAttemptSessionId(group.highest_session_id);
      await fetchStudentDetailedResponses(group.student_id, group.highest_session_id);
  };

  const fetchStudentDetailedResponses = async (studentId: string, sessionId: string) => {
    setLoadingReview(true);
    try {
      const { data: responses } = await supabase.from('student_responses').select('*').eq('session_id', sessionId);
      
      const details = responses?.map(r => {
        const q = questionsMapData[r.question_id];
        
        let parsedCorrectAnswer = q?.correct_answer;
        if (q?.question_type === 'matching' && typeof parsedCorrectAnswer === 'string') {
            try { 
               const arr = JSON.parse(parsedCorrectAnswer);
               if (Array.isArray(arr)) parsedCorrectAnswer = arr;
            } catch(e) {}
        }

        return {
          question_id: r.question_id, question_text: q?.question_text || 'Soal Dihapus',
          question_type: q?.question_type || 'unknown', correct_answer: parsedCorrectAnswer,
          student_answer: r.answer_text, is_correct: (r.points_given || 0) > 0,
          points_given: r.points_given || 0, max_points: q?.points || 0
        };
      }) || [];
      
      setStudentDetailedResponses(details);
    } catch (e) {
      console.error(e);
      showToast("Gagal memuat jawaban", "error");
    } finally { setLoadingReview(false); }
  };

  const switchReviewAttemptTab = async (attempt: SessionAttempt) => {
      setActiveAttemptSessionId(attempt.id);
      await fetchStudentDetailedResponses(selectedStudentGroup!.student_id, attempt.id);
  };

  const saveEssayScore = async (answerId: string, studentId: string, points: number, notes: string) => {
    if (!activeExam) return;
    try {
      const { error } = await supabase.from('student_responses').update({ points_given: points, teacher_notes: notes, is_graded: true }).eq('id', answerId);
      if (error) throw error;

      setEssayAnswers(prev => prev.map(a => a.id === answerId ? { ...a, points_given: points, teacher_notes: notes, is_graded: true } : a));

      const groupIndex = studentGroupedResults.findIndex(g => g.student_id === studentId);
      if (groupIndex === -1) return;
      
      const group = { ...studentGroupedResults[groupIndex] };
      const currentAttempt = group.attempts.find(a => a.id === activeEssaySessionId) || group.attempts.find(a => a.is_highest) || group.attempts[group.attempts.length - 1]; 

      if (!currentAttempt) return;

      const objScore = currentAttempt.obj_score; 
      let totalNewEssayScore = 0;
      
      essayAnswers.forEach(ea => {
         if (ea.student_id === studentId && (ea.session_id === currentAttempt.id || ea.attempt_number === currentAttempt.attempt_number)) {
             if (ea.id === answerId) totalNewEssayScore += Number(points); 
             else totalNewEssayScore += (Number(ea.points_given) || 0); 
         }
      });

      const newTotalScore = objScore + totalNewEssayScore;
      const newPercentage = currentAttempt.max_score > 0 ? (newTotalScore / currentAttempt.max_score) * 100 : 0;
      const isPassed = newPercentage >= (activeExam.passing_score || 0);

      await supabase.from('exam_sessions').update({ total_score: newTotalScore, percentage_score: newPercentage, is_passed: isPassed }).eq('id', currentAttempt.id);
      
      currentAttempt.essay_score = totalNewEssayScore;
      currentAttempt.total_score = newTotalScore;
      currentAttempt.percentage_score = newPercentage;
      currentAttempt.is_passed = isPassed;

      let newHighestPercentage = -1;
      let newHighestSessionId = '';
      group.attempts.forEach(a => {
          a.is_highest = false; 
          if (a.percentage_score > newHighestPercentage) {
              newHighestPercentage = a.percentage_score;
              newHighestSessionId = a.id;
          }
      });
      group.highest_percentage = newHighestPercentage;
      group.highest_session_id = newHighestSessionId;
      group.attempts.find(a => a.id === newHighestSessionId)!.is_highest = true;

      const newGroupedResults = [...studentGroupedResults];
      newGroupedResults[groupIndex] = group;
      setStudentGroupedResults(newGroupedResults);
      
      if (selectedStudentGroup?.student_id === studentId) setSelectedStudentGroup(group);

      showToast("Nilai esai berhasil disimpan & ditambahkan ke rekap!", "success");
      
    } catch (err: any) { showToast("Gagal simpan nilai: " + err.message, "error"); }
  };


  const handleGlobalPrint = async () => {
     setIsPrintingGlobal(true);
     try {
        const { data: sessions, error: err1 } = await supabase.from('exam_sessions').select('student_id, exam_id, percentage_score').eq('status', 'finished');
        if (err1) throw err1;

        const { data: studentsData, error: err2 } = await supabase.from('users').select('id, full_name, student_number, class_group').eq('role', 'student').order('class_group', { ascending: true }).order('full_name', { ascending: true });
        if (err2) throw err2;

        if (!studentsData || studentsData.length === 0) {
           showToast("Belum ada data siswa di sistem.", "error"); setIsPrintingGlobal(false); return;
        }

        const pivotData = studentsData.map(s => {
           let row: any = { 'Nama Siswa': s.full_name, 'NIS': s.student_number || '-', 'Kelas': s.class_group || '-' };
           exams.forEach(ex => {
              const colName = `${ex.subject} (${ex.grade_level || 'Umum'})`;
              const studentSessions = sessions?.filter(ss => ss.student_id === s.id && ss.exam_id === ex.id) || [];
              let highestScore = null;
              if (studentSessions.length > 0) {
                 highestScore = Math.max(...studentSessions.map(ss => Number(ss.percentage_score)));
              }
              row[colName] = highestScore !== null ? Number(highestScore).toFixed(2) : '-';
           });
           return row;
        });

        if (globalPrintFormat === 'excel') {
           const worksheet = XLSX.utils.json_to_sheet(pivotData);
           const workbook = XLSX.utils.book_new();
           XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap_Global");
           XLSX.writeFile(workbook, `Laporan_Seluruh_Hasil_Ujian_${myProfile?.full_name?.replace(/[^a-zA-Z0-9]/g, '_')}_${appName}.xlsx`);
           setIsGlobalPrintModalOpen(false);
           setIsPrintingGlobal(false);
        } 
        else {
           const examColsHtml = exams.map(ex => `<th style="padding: 10px 8px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 10px; text-align: center;">${(ex.subject || '').substring(0, 15)}<br/><span style="font-size:9px; font-weight:normal;">${ex.grade_level||''}</span></th>`).join('');
           
           const rowsHtml = studentsData.map((s, i) => {
              const tdScores = exams.map(ex => {
                 const studentSessions = sessions?.filter(ss => ss.student_id === s.id && ss.exam_id === ex.id) || [];
                 let highestScore = null;
                 if (studentSessions.length > 0) {
                    highestScore = Math.max(...studentSessions.map(ss => Number(ss.percentage_score)));
                 }
                 return `<td style="padding: 8px; text-align:center; font-weight:bold; color:${highestScore !== null ? '#047857' : '#94a3b8'}">${highestScore !== null ? highestScore.toFixed(2) : '-'}</td>`;
              }).join('');

              return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px; text-align:center; color: #64748b;">${i + 1}</td>
                  <td style="padding: 8px; font-weight: bold; color: #1e293b;">${s.full_name}</td>
                  <td style="padding: 8px; text-align:center; color: #475569;">${s.class_group || '-'}</td>
                  ${tdScores}
                </tr>
              `;
           }).join('');

           const htmlContent = `
             <div style="font-family: Arial, sans-serif; padding: 30px; color: #0f172a;">
               <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">
                 <h2 style="margin: 0 0 5px 0; font-size: 20px; text-transform: uppercase; color: #1e3a8a;">LAPORAN KESELURUHAN HASIL UJIAN CBT</h2>
                 <p style="margin: 0; font-size: 12px; color: #64748b;">Rekapitulasi Nilai Seluruh Siswa pada Mapel Anda - ${appName.replace(/_/g, ' ')}</p>
               </div>
               <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                 <thead style="background-color: #f8fafc;">
                   <tr>
                     <th style="padding: 10px 8px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 10px; width: 30px;">No</th>
                     <th style="padding: 10px 8px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 10px; text-align: left; width: 180px;">Nama Siswa</th>
                     <th style="padding: 10px 8px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 10px; width: 80px;">Kelas</th>
                     ${examColsHtml}
                   </tr>
                 </thead>
                 <tbody>${rowsHtml}</tbody>
               </table>
             </div>
           `;

           const element = document.createElement('div');
           element.innerHTML = htmlContent;
           
           const opt = {
             margin:       0,
             filename:     `Laporan_Global_Ujian_Guru_${myProfile?.full_name?.replace(/[^a-zA-Z0-9]/g, '_')}_${appName}.pdf`,
             image:        { type: 'jpeg' as const, quality: 0.98 },
             html2canvas:  { scale: 2 },
             jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' as const } 
           };

           html2pdf().set(opt).from(element).save().then(() => {
             setIsPrintingGlobal(false);
             setIsGlobalPrintModalOpen(false);
             showToast("PDF Rekap Global berhasil diunduh!", "success");
           }).catch(() => {
             setIsPrintingGlobal(false);
             showToast("Terjadi kesalahan saat memproses PDF.", "error");
           });
        }
     } catch (err: any) { showToast("Gagal memproses data: " + err.message, "error"); setIsPrintingGlobal(false); }
  };

  const extractUniqueClasses = () => {
    const classes = new Set<string>();
    studentGroupedResults.forEach(s => { if (s.users?.class_group) classes.add(s.users.class_group); });
    return Array.from(classes).sort();
  };

  const handlePrintOrExportDetail = () => {
    const filteredGroups = printConfig.filterClass === 'Semua Kelas' ? studentGroupedResults : studentGroupedResults.filter(s => s.users?.class_group === printConfig.filterClass);
    if (filteredGroups.length === 0) { showToast("Tidak ada siswa di kelas yang dipilih.", "error"); return; }

    const cleanSubjectName = activeExam?.subject.replace(/[^a-zA-Z0-9]/g, '_') || 'Mapel';
    const cleanClassName = printConfig.filterClass.replace(/[^a-zA-Z0-9]/g, '_');

    if (printConfig.format === 'excel') {
       const exportData = filteredGroups.map((g, idx) => {
         const highestAttempt = g.attempts.find(a => a.is_highest) || g.attempts[0];
         let rowData: any = { 'No': idx + 1, 'Nama Siswa': g.users?.full_name || 'Tanpa Nama' };
         if(printConfig.cols.nisn) rowData['NISN'] = g.users?.student_number || '-';
         if(printConfig.cols.class_group) rowData['Kelas'] = g.users?.class_group || '-';
         if(printConfig.cols.attempts) rowData['Total Percobaan'] = g.attempts.length;
         if(printConfig.cols.obj) rowData['Poin Objektif'] = highestAttempt.obj_score;
         if(printConfig.cols.ess) rowData['Poin Esai'] = highestAttempt.essay_score;
         if(printConfig.cols.total) rowData['Total Poin'] = highestAttempt.total_score;
         if(printConfig.cols.scale100) rowData['Skala 100 (Max)'] = Number(g.highest_percentage).toFixed(2);
         if(printConfig.cols.status) rowData['Status'] = highestAttempt.is_passed ? 'Lulus' : 'Tidak Lulus';
         return rowData;
       });
       const worksheet = XLSX.utils.json_to_sheet(exportData); const workbook = XLSX.utils.book_new();
       XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap_Nilai");
       XLSX.writeFile(workbook, `Rekap_Nilai_${cleanSubjectName}_${cleanClassName}.xlsx`);
       setIsPrintModalOpen(false);
    } 
    else {
       setIsGeneratingPdf(true); 
       const fileName = `Rekap_Nilai_${cleanSubjectName}_${cleanClassName}_${appName}.pdf`;

       const ths = `
         <th style="padding: 12px 10px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 11px; width:40px; text-align:center;">No</th>
         <th style="padding: 12px 10px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 11px; text-align:left;">Nama Siswa</th>
         ${printConfig.cols.nisn ? `<th style="padding: 12px 10px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 11px; text-align:center;">NISN</th>` : ''} 
         ${printConfig.cols.class_group ? `<th style="padding: 12px 10px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 11px; text-align:center;">Kelas</th>` : ''}
         ${printConfig.cols.attempts ? `<th style="padding: 12px 10px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 11px; text-align:center;">Percobaan</th>` : ''} 
         ${printConfig.cols.obj ? `<th style="padding: 12px 10px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 11px; text-align:center;">Objektif</th>` : ''} 
         ${printConfig.cols.ess ? `<th style="padding: 12px 10px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 11px; text-align:center;">Esai</th>` : ''}
         ${printConfig.cols.total ? `<th style="padding: 12px 10px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 11px; text-align:center;">Total</th>` : ''} 
         ${printConfig.cols.scale100 ? `<th style="padding: 12px 10px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 11px; text-align:center;">Skala 100</th>` : ''}
         ${printConfig.cols.status ? `<th style="padding: 12px 10px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; font-size: 11px; text-align:center;">Status</th>` : ''}
       `;

       const trs = filteredGroups.map((g, i) => {
         const a = g.attempts.find(at => at.is_highest) || g.attempts[0];
         return `
         <tr style="border-bottom: 1px solid #f1f5f9;">
           <td style="padding: 10px; text-align:center; color: #64748b;">${i + 1}</td>
           <td style="padding: 10px; font-weight: bold; color: #1e293b;">${g.users?.full_name || 'Tanpa Nama'}</td>
           ${printConfig.cols.nisn ? `<td style="padding: 10px; text-align:center; color: #475569;">${g.users?.student_number || '-'}</td>` : ''} 
           ${printConfig.cols.class_group ? `<td style="padding: 10px; text-align:center; color: #475569;">${g.users?.class_group || '-'}</td>` : ''}
           ${printConfig.cols.attempts ? `<td style="padding: 10px; text-align:center; color: #475569;">${g.attempts.length}x</td>` : ''} 
           ${printConfig.cols.obj ? `<td style="padding: 10px; text-align:center; color: #0f172a;">${a.obj_score}</td>` : ''} 
           ${printConfig.cols.ess ? `<td style="padding: 10px; text-align:center; color: #0f172a;">${a.essay_score}</td>` : ''}
           ${printConfig.cols.total ? `<td style="padding: 10px; text-align:center; font-weight:bold; color: #0f172a;">${a.total_score}</td>` : ''} 
           ${printConfig.cols.scale100 ? `<td style="padding: 10px; text-align:center; color:#059669; font-weight:bold; font-size:14px;">${Number(g.highest_percentage).toFixed(2)}</td>` : ''}
           ${printConfig.cols.status ? `<td style="padding: 10px; text-align:center; font-weight:bold; color:${a.is_passed ? '#15803d' : '#e11d48'}">${a.is_passed ? 'LULUS' : 'TIDAK LULUS'}</td>` : ''}
         </tr>
         `;
       }).join('');

       const htmlContent = `
         <div style="font-family: Arial, sans-serif; padding: 40px; color: #0f172a;">
           <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
             <h2 style="margin: 0 0 8px 0; font-size: 20px; text-transform: uppercase; color: #1e3a8a;">LAPORAN REKAPITULASI PENILAIAN UJIAN CBT</h2>
             <div style="display: flex; justify-content: space-between; font-size: 12px; color: #475569; margin-top: 15px; text-align: left;">
                <div>
                   <p style="margin: 3px 0;">Mata Pelajaran: <b style="color: #0f172a;">${activeExam?.subject} - ${activeExam?.grade_level || 'Umum'}</b></p>
                   <p style="margin: 3px 0;">Guru Pengampu: <b style="color: #0f172a;">${activeExam?.teacherNames}</b></p>
                </div>
                <div style="text-align: right;">
                   <p style="margin: 3px 0;">Filter Kelas: <b style="color: #0f172a;">${printConfig.filterClass}</b></p>
                   <p style="margin: 3px 0;">KKM (Lulus): <b style="color: #0f172a;">${activeExam?.passing_score || 0}</b></p>
                </div>
             </div>
           </div>
           <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
             <thead style="background-color: #f8fafc;">
               <tr>${ths}</tr>
             </thead>
             <tbody>${trs}</tbody>
           </table>
           <div style="margin-top: 60px; text-align: right; font-size:14px; padding-right: 40px; color: #1e293b;">
              <p style="margin-bottom: 60px;">Mengetahui,</p>
              <p><b>Guru Mata Pelajaran</b></p>
           </div>
         </div>
       `;

       const element = document.createElement('div');
       element.innerHTML = htmlContent;
       
       const opt = {
         margin:       0,
         filename:     fileName,
         image:        { type: 'jpeg' as const, quality: 0.98 },
         html2canvas:  { scale: 2 },
         jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' as const } 
       };

       html2pdf().set(opt).from(element).save().then(() => {
         setIsGeneratingPdf(false);
         setIsPrintModalOpen(false);
         showToast("PDF Rekap Kelas berhasil diunduh!", "success");
       }).catch(() => {
         setIsGeneratingPdf(false);
         showToast("Terjadi kesalahan saat memproses PDF.", "error");
       });
    }
  };

  const paginatedData = useMemo(() => {
    const filtered = studentGroupedResults.filter(g => g.users.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const safePage = Math.max(1, Math.min(currentPage, totalPages));
    if (safePage !== currentPage && totalPages > 0) setCurrentPage(safePage);

    return { data: filtered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage), total: totalPages };
  }, [studentGroupedResults, searchQuery, currentPage]);

  const classStats = useMemo(() => {
     const currentStudentsView = activeTab === 'rekap' ? (printConfig.filterClass === 'Semua Kelas' ? studentGroupedResults : studentGroupedResults.filter(s => s.users?.class_group === printConfig.filterClass)) : studentGroupedResults;
     
     if (currentStudentsView.length === 0) return { avg: 0, high: 0, low: 0, passedCount: 0, passPercentage: 0 };
     let totalScore = 0; let high = -1; let low = 101; let passed = 0;
     currentStudentsView.forEach(g => {
        const val = g.highest_percentage; totalScore += val;
        if (val > high) high = val; if (val < low) low = val;
        const highestAttempt = g.attempts.find(a => a.is_highest) || g.attempts[0];
        if (highestAttempt.is_passed) passed++;
     });
     return { avg: (totalScore / currentStudentsView.length).toFixed(2), high: high.toFixed(2), low: low === 101 ? 0 : low.toFixed(2), passedCount: passed, passPercentage: Math.round((passed / currentStudentsView.length) * 100) };
  }, [studentGroupedResults, activeTab, printConfig.filterClass]);

  const essayStudentsGrouped = useMemo(() => {
     const map: Record<string, { student_id: string, name: string, nis: string, class_group: string, attempts: { session_id: string, attempt_number: number, is_graded: boolean, total: number, graded: number, answers: EssayAnswer[] }[] }> = {};
     
     essayAnswers.forEach(ea => {
         if (!map[ea.student_id]) {
             map[ea.student_id] = { 
                student_id: ea.student_id, name: ea.users?.full_name, nis: ea.users?.student_number, class_group: ea.users?.class_group, 
                attempts: [] 
             };
         }
         
         const studentObj = map[ea.student_id];
         let attemptObj = studentObj.attempts.find(a => a.session_id === ea.session_id);
         
         if (!attemptObj) {
             attemptObj = { session_id: ea.session_id, attempt_number: ea.attempt_number, is_graded: false, total: 0, graded: 0, answers: [] };
             studentObj.attempts.push(attemptObj);
         }
         
         attemptObj.total++; 
         if (ea.is_graded) attemptObj.graded++; 
         attemptObj.answers.push(ea);
         attemptObj.is_graded = attemptObj.graded >= attemptObj.total;
     });
     
     Object.values(map).forEach(s => {
         s.attempts.sort((a,b) => a.attempt_number - b.attempt_number);
     });

     return Object.values(map).filter(s => s.name.toLowerCase().includes(essaySearchQuery.toLowerCase()) || s.class_group?.toLowerCase().includes(essaySearchQuery.toLowerCase()));
  }, [essayAnswers, essaySearchQuery]);

  const selectedEssayStudentData = selectedStudentForEssay && activeEssaySessionId ? essayStudentsGrouped.find(s => s.student_id === selectedStudentForEssay)?.attempts.find(a => a.session_id === activeEssaySessionId) : null;
  const selectedStudentMeta = selectedStudentForEssay ? essayStudentsGrouped.find(s => s.student_id === selectedStudentForEssay) : null;
  
  const hardestQuestion = [...itemAnalysis].sort((a,b) => (a.correct/a.total) - (b.correct/b.total))[0];
  const easiestQuestion = [...itemAnalysis].sort((a,b) => (b.correct/b.total) - (a.correct/a.total))[0];

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto pb-24 md:pb-20 font-sans text-slate-800">
      
      {toast && (
        <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[200] w-[90%] sm:w-auto animate-in slide-in-from-top-10">
          <div className={`px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] shadow-2xl flex items-center gap-2 md:gap-3 border ${
             toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
             toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className={`w-4 h-4 md:w-5 md:h-5 text-emerald-500 shrink-0`} /> : <AlertTriangle className={`w-4 h-4 md:w-5 md:h-5 shrink-0 ${toast.type === 'warning' ? 'text-amber-500' : 'text-rose-500'}`} />}
            <p className="font-bold text-xs md:text-sm tracking-wide">{toast.message}</p>
          </div>
        </div>
      )}

      {activeView === 'list' ? (
        <div className="space-y-4 md:space-y-6 animate-in fade-in">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 bg-white p-4 sm:p-5 md:px-8 md:py-6 rounded-2xl md:rounded-[2rem] border border-blue-100 shadow-sm">
             <div>
               <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2 md:gap-3">
                 <BarChart3 className="w-6 h-6 md:w-8 md:h-8 text-blue-600" /> Laporan Penilaian Guru
               </h1>
               <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium ml-8 md:ml-11">Akses rekap nilai, esai, dan analisis untuk mapel yang Anda ampu.</p>
             </div>
             <button onClick={() => setIsGlobalPrintModalOpen(true)} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-3 md:py-3.5 rounded-xl font-bold text-xs md:text-sm shadow-md shadow-blue-200 transition-all shrink-0 w-full md:w-auto active:scale-95">
                <Printer className="w-4 h-4 md:w-4 md:h-4"/> Cetak Hasil Keseluruhan
             </button>
           </div>

           <div className="relative w-full max-w-xl">
             <Search className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
             <input type="text" placeholder="Cari laporan berdasarkan nama mapel Anda..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] pl-10 md:pl-12 pr-4 py-3 md:py-3.5 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all placeholder-slate-400" />
           </div>

           {loadingExams ? (
             <div className="py-16 md:py-20 flex justify-center"><LoaderCircle className="w-10 h-10 md:w-12 md:h-12 text-blue-500 animate-spin" /></div>
           ) : exams.filter(ex => (ex.subject || '').toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
             <div className="bg-white border-2 border-dashed border-slate-200 rounded-[1.5rem] md:rounded-[2rem] py-16 md:py-20 text-center flex flex-col items-center px-4">
                 <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-full flex items-center justify-center mb-3 md:mb-4 border border-slate-100"><BarChart3 className="w-8 h-8 md:w-10 md:h-10 text-slate-300"/></div>
                 <h2 className="text-lg md:text-xl font-black text-slate-700 mb-1">Tidak Ada Laporan Tersedia</h2>
                 <p className="text-slate-500 font-medium text-xs md:text-sm max-w-md">Belum ada ujian di mata pelajaran yang Anda ampu, atau pencarian Anda tidak cocok.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
               {exams.filter(ex => (ex.subject || '').toLowerCase().includes(searchQuery.toLowerCase())).map((exam) => (
                 <div key={exam.id} onClick={() => fetchExamDetails(exam)} className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] p-5 md:p-6 lg:p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-blue-300 transition-all duration-300 cursor-pointer group flex flex-col justify-between">
                   <div>
                     <div className="flex items-start gap-3 md:gap-4 min-w-0">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-50 border border-blue-100 rounded-xl md:rounded-[1.2rem] flex items-center justify-center shrink-0 group-hover:bg-blue-600 transition-colors shadow-inner mt-0.5">
                           <FileSpreadsheet className="w-6 h-6 md:w-7 md:h-7 text-blue-600 group-hover:text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                           <h3 className="font-black text-lg md:text-xl text-slate-800 leading-tight group-hover:text-blue-700 transition-colors truncate">{exam.subject}</h3>
                           <span className="inline-block mt-1 md:mt-1.5 text-[9px] md:text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 md:px-2.5 py-0.5 md:py-1 rounded-md border border-indigo-100 uppercase tracking-widest truncate max-w-full">
                              {exam.grade_level || 'UMUM'}
                           </span>
                        </div>
                     </div>
                     
                     <div className="mt-4 md:mt-6 space-y-2 md:space-y-3">
                        <div className="flex items-start gap-2.5 md:gap-3 min-w-0">
                           <UserCircle2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5 md:mt-1"/>
                           <div className="min-w-0 flex-1">
                             <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Guru Pengampu</p>
                             <p className="text-xs md:text-sm font-bold text-slate-700 leading-snug mt-1 truncate">{exam.teacherNames}</p>
                           </div>
                        </div>
                        <div className="flex items-start gap-2.5 md:gap-3 pt-2 md:pt-3 border-t border-slate-100 min-w-0">
                           <BookOpen className="w-4 h-4 text-slate-400 shrink-0 mt-0.5 md:mt-1"/>
                           <div className="min-w-0 flex-1">
                             <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Nama Ujian</p>
                             <p className="text-xs md:text-sm font-bold text-slate-700 leading-snug mt-1 truncate">{exam.title || '-'}</p>
                           </div>
                        </div>
                     </div>
                   </div>

                   <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-slate-100 flex items-center justify-between">
                     <span className="flex items-center gap-1 md:gap-1.5 text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[80%]">
                        <Users className="w-3.5 h-3.5 text-amber-500 shrink-0" /> <span className="truncate">{Array.isArray(exam.target_class) ? exam.target_class.join(', ') : exam.target_class}</span>
                     </span>
                     <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-transform group-hover:translate-x-1 shrink-0" />
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      ) : (
        <div className="space-y-4 md:space-y-6 animate-in fade-in duration-300">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
             <button onClick={() => { setActiveView('list'); setSearchQuery(''); }} className="flex items-center justify-center sm:justify-start gap-1.5 md:gap-2 text-xs md:text-sm font-bold text-slate-500 hover:text-blue-600 bg-white border border-slate-200 px-4 md:px-5 py-2.5 md:py-2.5 rounded-lg md:rounded-xl transition-colors shadow-sm w-full sm:w-auto"><ArrowLeft className="w-4 h-4 md:w-4 md:h-4" /> Kembali</button>
             <button onClick={() => setIsPrintModalOpen(true)} className="flex items-center justify-center gap-1.5 md:gap-2 bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 hover:border-blue-200 px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-sm shadow-sm transition-colors w-full sm:w-auto shrink-0">
                <Printer className="w-4 h-4 md:w-5 md:h-5 text-blue-600"/> Unduh Laporan
             </button>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 border border-indigo-800 rounded-2xl md:rounded-[2.5rem] p-5 sm:p-6 md:p-10 shadow-lg flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 md:w-40 md:h-40 bg-white opacity-10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-10 md:left-20 w-24 h-24 md:w-32 md:h-32 bg-indigo-400 opacity-20 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex items-start gap-3 md:gap-6 relative z-10 w-full min-w-0">
              <div className="p-3 md:p-4 bg-white/20 backdrop-blur-md text-white rounded-xl md:rounded-2xl shadow-inner border border-white/20 shrink-0"><BarChart3 className="w-6 h-6 md:w-8 md:h-8" /></div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight leading-tight truncate">{activeExam?.subject} <span className="text-sm sm:text-base md:text-xl font-medium text-blue-200 whitespace-nowrap">- {activeExam?.grade_level || 'Umum'}</span></h1>
                <p className="text-blue-100 font-bold text-xs md:text-sm mt-1 truncate">{activeExam?.title}</p>
                <div className="flex flex-wrap gap-1.5 md:gap-2 mt-2 md:mt-3 text-[10px] md:text-xs font-bold text-blue-100">
                  <span className="bg-white/20 backdrop-blur-sm px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg border border-white/10 flex items-center gap-1 md:gap-1.5 whitespace-nowrap"><UserCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> <span className="truncate max-w-[120px] md:max-w-none">{activeExam?.teacherNames}</span></span>
                  <span className="bg-white/20 backdrop-blur-sm px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg border border-white/10 flex items-center gap-1 md:gap-1.5 whitespace-nowrap"><Target className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> <span className="truncate max-w-[100px] md:max-w-none">{Array.isArray(activeExam?.target_class) ? activeExam?.target_class.join(', ') : activeExam?.target_class}</span></span>
                </div>
              </div>
            </div>
            
            <div className="flex w-full lg:w-auto relative z-10 bg-black/20 p-3 md:p-5 rounded-xl md:rounded-2xl border border-white/10 backdrop-blur-sm shadow-inner justify-between md:justify-center">
               <div className="text-center px-2 sm:px-4 flex-1 md:flex-none">
                  <p className="text-[9px] md:text-[10px] font-black text-blue-200 uppercase tracking-widest leading-none mb-1 md:mb-1.5">Max Poin</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-black">{examStats.maxTotal}</p>
               </div>
               <div className="w-px bg-white/20"></div>
               <div className="text-center px-2 sm:px-4 flex-1 md:flex-none">
                  <p className="text-[9px] md:text-[10px] font-black text-emerald-200 uppercase tracking-widest leading-none mb-1 md:mb-1.5">Objektif</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-black">{examStats.maxObj}</p>
               </div>
               <div className="w-px bg-white/20"></div>
               <div className="text-center px-2 sm:px-4 flex-1 md:flex-none">
                  <p className="text-[9px] md:text-[10px] font-black text-amber-200 uppercase tracking-widest leading-none mb-1 md:mb-1.5">Esai</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-black">{examStats.maxEss}</p>
               </div>
            </div>
          </div>

          <div className="flex w-full sm:w-auto overflow-x-auto custom-scrollbar bg-white p-1.5 md:p-2 rounded-xl md:rounded-[1.5rem] border border-slate-200 shadow-sm hide-scroll-mobile">
            <button onClick={() => {setActiveTab('rekap'); setSearchQuery('');}} className={`flex-1 sm:flex-none px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-1.5 md:gap-2 transition-all whitespace-nowrap ${activeTab === 'rekap' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}><FileSpreadsheet className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0"/> Rekap Nilai</button>
            <button onClick={() => setActiveTab('esai')} className={`flex-1 sm:flex-none px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-1.5 md:gap-2 transition-all whitespace-nowrap ${activeTab === 'esai' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}><Edit3 className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0"/> Koreksi Esai <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-[10px]">({essayAnswers.length})</span></button>
            <button onClick={() => setActiveTab('analisis')} className={`flex-1 sm:flex-none px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-1.5 md:gap-2 transition-all whitespace-nowrap ${activeTab === 'analisis' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}><TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0"/> Analisis Soal</button>
          </div>

          {loadingDetail ? (
             <div className="py-16 md:py-20 flex justify-center"><LoaderCircle className="w-8 h-8 md:w-10 md:h-10 text-blue-500 animate-spin" /></div>
          ) : (
             <>
               {activeTab === 'rekap' && (
                 <div className="space-y-4 md:space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                       <div className="bg-white border border-slate-200 p-4 md:p-6 rounded-xl md:rounded-[2rem] shadow-sm flex flex-col justify-center text-center sm:text-left">
                          <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 md:mb-1.5 flex items-center justify-center sm:justify-start gap-1 md:gap-1.5"><Activity className="w-3 h-3 md:w-4 md:h-4 text-blue-500 shrink-0"/> Rata-Rata Kelas</p>
                          <p className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800">{classStats.avg}</p>
                       </div>
                       <div className="bg-white border border-slate-200 p-4 md:p-6 rounded-xl md:rounded-[2rem] shadow-sm flex flex-col justify-center text-center sm:text-left">
                          <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 md:mb-1.5 flex items-center justify-center sm:justify-start gap-1 md:gap-1.5"><TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-emerald-500 shrink-0"/> Nilai Tertinggi</p>
                          <p className="text-2xl sm:text-3xl md:text-4xl font-black text-emerald-600">{classStats.high}</p>
                       </div>
                       <div className="bg-white border border-slate-200 p-4 md:p-6 rounded-xl md:rounded-[2rem] shadow-sm flex flex-col justify-center text-center sm:text-left">
                          <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 md:mb-1.5 flex items-center justify-center sm:justify-start gap-1 md:gap-1.5"><TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-rose-500 rotate-180 shrink-0"/> Nilai Terendah</p>
                          <p className="text-2xl sm:text-3xl md:text-4xl font-black text-rose-600">{classStats.low}</p>
                       </div>
                       <div className="bg-white border border-slate-200 p-4 md:p-6 rounded-xl md:rounded-[2rem] shadow-sm flex flex-col justify-center text-center sm:text-left">
                          <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 md:mb-1.5 flex items-center justify-center sm:justify-start gap-1 md:gap-1.5"><CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-indigo-500 shrink-0"/> Kelulusan (KKM)</p>
                          <p className="text-xl sm:text-2xl md:text-3xl font-black text-indigo-600 leading-none">{classStats.passPercentage}% <span className="text-[10px] md:text-xs font-bold text-slate-500 block mt-1 md:mt-1.5">({classStats.passedCount} Lulus)</span></p>
                       </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl md:rounded-[2rem] overflow-hidden shadow-sm z-0">
                      <div className="p-3 md:p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4 bg-slate-50/50">
                         <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                            <input type="text" placeholder="Cari nama siswa..." value={searchQuery} onChange={e => {setSearchQuery(e.target.value); setCurrentPage(1);}} className="w-full pl-9 pr-3 md:pl-10 md:pr-4 py-2 md:py-2.5 rounded-lg md:rounded-xl border border-slate-200 text-xs md:text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"/>
                         </div>
                         <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 w-full md:w-auto justify-between sm:justify-end">
                            <div className="relative w-full sm:w-auto">
                              <select value={printConfig.filterClass} onChange={(e) => {setPrintConfig(p => ({...p, filterClass: e.target.value})); setCurrentPage(1);}} className="w-full bg-white border border-slate-200 rounded-lg md:rounded-xl pl-3 pr-8 md:pl-4 md:pr-8 py-2 md:py-2.5 text-[10px] md:text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-sm appearance-none transition-colors">
                                 <option value="Semua Kelas">Semua Kelas</option>
                                 {extractUniqueClasses().map(c => <option key={c} value={c}>Kelas {c}</option>)}
                              </select>
                              <ChevronDown className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400 pointer-events-none"/>
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                               <span className="text-[10px] md:text-xs font-bold text-slate-400 hidden sm:inline">Hal {currentPage} / {paginatedData.total || 1}</span>
                               <div className="flex gap-1">
                                 <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="p-1.5 md:p-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-md md:rounded-lg shadow-sm"><ChevronLeft className="w-3.5 h-3.5 md:w-4 md:h-4"/></button>
                                 <span className="text-[10px] font-bold text-slate-400 px-2 flex items-center sm:hidden">{currentPage}/{paginatedData.total || 1}</span>
                                 <button onClick={() => setCurrentPage(p => Math.min(paginatedData.total, p+1))} disabled={currentPage === paginatedData.total || paginatedData.total === 0} className="p-1.5 md:p-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-md md:rounded-lg shadow-sm"><ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4"/></button>
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left text-xs md:text-sm whitespace-nowrap md:whitespace-normal min-w-[700px]">
                          <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[9px] md:text-[10px] tracking-widest border-b">
                            <tr>
                              <th className="p-3 md:p-5 text-center w-10 md:w-12">No</th>
                              <th className="p-3 md:p-5">Nama Peserta</th>
                              <th className="p-3 md:p-5 text-center">Kelas</th>
                              <th className="p-3 md:p-5 text-center">Coba</th>
                              <th className="p-3 md:p-5 text-center text-blue-600">Objektif</th>
                              <th className="p-3 md:p-5 text-center text-amber-600">Esai</th>
                              <th className="p-3 md:p-5 text-center bg-emerald-50 text-emerald-700">Skala 100 (Max)</th>
                              <th className="p-3 md:p-5 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {paginatedData.data.length === 0 ? <tr><td colSpan={8} className="py-10 md:py-16 text-center text-slate-400 font-bold text-sm md:text-lg bg-slate-50">Data tidak ditemukan.</td></tr> : 
                            paginatedData.data.map((group, idx) => {
                               const highestAttempt = group.attempts.find(a => a.is_highest) || group.attempts[0];
                               return (
                                  <tr key={group.student_id} onClick={() => openReviewModal(group)} className="hover:bg-blue-50/50 cursor-pointer transition-colors group">
                                    <td className="p-3 md:p-5 text-center font-black text-slate-400 group-hover:text-blue-500">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                    <td className="p-3 md:p-5">
                                       <p className="font-bold text-slate-800 group-hover:text-blue-700 flex items-center gap-1.5 md:gap-2 truncate max-w-[150px] md:max-w-[250px]">{group.users?.full_name || 'Tanpa Nama'} <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"/></p>
                                       <p className="text-[9px] md:text-[10px] text-slate-400 mt-0.5">{group.users?.student_number || '-'}</p>
                                    </td>
                                    <td className="p-3 md:p-5 text-center font-medium">{group.users?.class_group || '-'}</td>
                                    <td className="p-3 md:p-5 text-center"><span className="bg-slate-100 px-1.5 md:px-2 py-0.5 md:py-1 rounded border font-bold text-slate-500 text-[10px] md:text-xs">{group.attempts.length}x</span></td>
                                    <td className="p-3 md:p-5 text-center font-black text-blue-600">{highestAttempt.obj_score}</td>
                                    <td className="p-3 md:p-5 text-center font-black text-amber-600">{highestAttempt.essay_score}</td>
                                    <td className="p-3 md:p-5 text-center font-black text-emerald-600 text-sm md:text-base bg-emerald-50/30">{Number(group.highest_percentage).toFixed(2)}</td>
                                    <td className="p-3 md:p-5 text-center">
                                      <span className={`px-2 md:px-3 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase border ${highestAttempt.is_passed ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                                        {highestAttempt.is_passed ? 'LULUS' : 'GAGAL'}
                                      </span>
                                    </td>
                                  </tr>
                               )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                 </div>
               )}

               {activeTab === 'esai' && (
                  <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
                     <div className="bg-amber-50 border border-amber-200 rounded-xl md:rounded-[2rem] p-4 sm:p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 shadow-sm">
                       <div className="flex items-start gap-3 md:gap-4">
                          <div className="p-2 md:p-3 bg-white rounded-lg md:rounded-xl shadow-sm border border-amber-100 shrink-0"><FileEdit className="w-6 h-6 md:w-8 md:h-8 text-amber-600"/></div>
                          <div>
                            <h2 className="text-lg md:text-xl font-black text-amber-900 leading-tight">Koreksi Jawaban Esai Siswa</h2>
                            <p className="text-xs md:text-sm font-medium text-amber-800 mt-1 leading-snug">Pilih nama siswa di bawah untuk mulai memberikan poin dan feedback.</p>
                          </div>
                       </div>
                       <div className="relative w-full md:w-72 mt-2 md:mt-0">
                          <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-amber-600/50" />
                          <input 
                            type="text" placeholder="Cari nama atau kelas..." 
                            value={essaySearchQuery} onChange={e => setEssaySearchQuery(e.target.value)}
                            className="w-full bg-white border border-amber-200 rounded-lg md:rounded-xl pl-9 md:pl-11 pr-3 md:pr-4 py-2.5 md:py-3.5 text-xs md:text-sm font-bold text-amber-900 placeholder-amber-600/50 focus:ring-2 focus:ring-amber-500 outline-none shadow-sm transition-all"
                          />
                       </div>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                        {essayStudentsGrouped.length === 0 ? <div className="col-span-full p-16 md:p-24 text-center bg-white border border-slate-200 rounded-2xl md:rounded-[2.5rem] text-slate-400 font-bold text-sm md:text-xl shadow-sm">Tidak ada jawaban esai ditemukan.</div> : 
                        essayStudentsGrouped.map((s, i) => {
                           const isFullyGraded = s.attempts.every(a => a.is_graded);
                           const totalGraded = s.attempts.reduce((acc, curr) => acc + curr.graded, 0);
                           const totalEssays = s.attempts.reduce((acc, curr) => acc + curr.total, 0);
                           
                           return (
                              <div key={i} onClick={() => { 
                                 setSelectedStudentForEssay(s.student_id); 
                                 setActiveEssaySessionId(s.attempts[0]?.session_id); 
                              }} className="bg-white border border-slate-200 p-4 md:p-6 rounded-xl md:rounded-[2rem] shadow-sm hover:border-amber-400 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between">
                                 <div>
                                    <div className="flex items-start justify-between mb-3 md:mb-4 gap-2">
                                       <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100 text-amber-600 rounded-lg md:rounded-2xl flex items-center justify-center font-black text-base md:text-lg shadow-inner border border-amber-200 group-hover:scale-110 transition-transform shrink-0">
                                          {s.name.charAt(0).toUpperCase()}
                                       </div>
                                       <div className="flex flex-col items-end gap-1.5 md:gap-2">
                                          <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-md text-[8px] md:text-[10px] font-black uppercase tracking-widest border text-right ${isFullyGraded ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'}`}>
                                             {isFullyGraded ? 'Semua Dinilai' : `Belum (${totalEssays - totalGraded})`}
                                          </span>
                                       </div>
                                    </div>
                                    <h3 className="font-black text-slate-800 text-base md:text-lg leading-tight group-hover:text-amber-700 transition-colors line-clamp-2">{s.name}</h3>
                                    <div className="flex items-center gap-1.5 md:gap-2 mt-1.5 md:mt-2">
                                       <span className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 px-1.5 md:px-2 py-0.5 rounded border border-slate-200 truncate max-w-[80px] md:max-w-none">{s.nis || '-'}</span>
                                       <span className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 px-1.5 md:px-2 py-0.5 rounded border border-slate-200 truncate max-w-[80px] md:max-w-none">{s.class_group || '-'}</span>
                                    </div>
                                 </div>
                                 <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-amber-600 transition-colors">
                                    <span>{s.attempts.length} Percobaan</span>
                                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5 shrink-0"/>
                                 </div>
                              </div>
                           )
                        })}
                     </div>
                  </div>
               )}

               {activeTab === 'analisis' && (
                  <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        {hardestQuestion && (
                           <div className="bg-rose-50 border border-rose-200 p-4 md:p-6 lg:p-8 rounded-xl md:rounded-[2rem] shadow-sm flex items-start gap-3 md:gap-5">
                              <div className="p-3 md:p-4 bg-white rounded-xl md:rounded-2xl shadow-sm border border-rose-100 shrink-0 mt-0.5 md:mt-0"><AlertTriangle className="w-6 h-6 md:w-8 md:h-8 text-rose-500"/></div>
                              <div className="min-w-0">
                                 <p className="text-[9px] md:text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1 md:mb-1.5">Soal Paling Sulit (HOTS)</p>
                                 <div className="text-sm md:text-base font-bold text-slate-800 line-clamp-2 prose prose-sm mb-2.5 md:mb-3 leading-snug break-words" dangerouslySetInnerHTML={{ __html: processHtmlMedia(hardestQuestion.text) }} />
                                 <span className="inline-flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs font-black text-rose-700 bg-rose-100 px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg border border-rose-200">
                                   <Users className="w-3 h-3 md:w-3.5 md:h-3.5"/> Hanya {Math.round((hardestQuestion.correct/hardestQuestion.total)*100)}% siswa benar
                                 </span>
                              </div>
                           </div>
                        )}
                        {easiestQuestion && (
                           <div className="bg-emerald-50 border border-emerald-200 p-4 md:p-6 lg:p-8 rounded-xl md:rounded-[2rem] shadow-sm flex items-start gap-3 md:gap-5">
                              <div className="p-3 md:p-4 bg-white rounded-xl md:rounded-2xl shadow-sm border border-emerald-100 shrink-0 mt-0.5 md:mt-0"><CheckCircle2 className="w-6 h-6 md:w-8 md:h-8 text-emerald-500"/></div>
                              <div className="min-w-0">
                                 <p className="text-[9px] md:text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 md:mb-1.5">Soal Paling Mudah (LOTS)</p>
                                 <div className="text-sm md:text-base font-bold text-slate-800 line-clamp-2 prose prose-sm mb-2.5 md:mb-3 leading-snug break-words" dangerouslySetInnerHTML={{ __html: processHtmlMedia(easiestQuestion.text) }} />
                                 <span className="inline-flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs font-black text-emerald-700 bg-emerald-100 px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg border border-emerald-200">
                                   <Check className="w-3 h-3 md:w-3.5 md:h-3.5"/> {Math.round((easiestQuestion.correct/easiestQuestion.total)*100)}% siswa benar
                                 </span>
                              </div>
                           </div>
                        )}
                     </div>

                     <div className="bg-white border border-slate-200 rounded-xl md:rounded-[2rem] p-4 md:p-6 lg:p-8 shadow-sm">
                       <div className="flex items-center gap-2 md:gap-3 mb-5 md:mb-8 border-b border-slate-100 pb-3 md:pb-5"><TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-indigo-500" /><h2 className="text-lg md:text-xl font-black text-slate-800">Analisis Tingkat Kesulitan Objektif</h2></div>
                       <div className="grid grid-cols-1 gap-4 md:gap-6">
                         {itemAnalysis.length === 0 ? <div className="text-center py-16 md:py-20 font-bold text-slate-400 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl md:rounded-[1.5rem] text-sm md:text-base px-4">Tidak ada data jawaban objektif untuk dianalisis.</div> : 
                         itemAnalysis.map((item, idx) => {
                           const correctPercent = Math.round((item.correct / item.total) * 100);
                           const isHard = correctPercent < 40;
                           return (
                             <div key={idx} className="border border-slate-200 p-4 md:p-6 lg:p-8 rounded-xl md:rounded-[2rem] hover:shadow-md transition-shadow bg-white shadow-sm flex flex-col justify-between">
                               <div className="flex flex-col md:flex-row justify-between gap-4 md:gap-6 lg:gap-10 mb-4 md:mb-6">
                                 <div className="flex-1 overflow-hidden min-w-0">
                                   <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                                     <span className="bg-slate-100 text-slate-600 px-2 md:px-2.5 py-0.5 md:py-1 rounded-md text-[8px] md:text-[10px] font-black border border-slate-200 uppercase tracking-widest">{item.type.replace('_', ' ')}</span>
                                     <span className={`px-2 md:px-2.5 py-0.5 md:py-1 rounded-md text-[8px] md:text-[10px] font-black border tracking-widest uppercase ${isHard ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                                       {isHard ? 'SULIT (HOTS)' : 'SEDANG/MUDAH'}
                                     </span>
                                   </div>
                                   <div className="text-sm md:text-lg font-bold text-slate-800 prose prose-sm md:prose-slate max-w-none mb-2 md:mb-3 leading-snug md:leading-relaxed break-words" dangerouslySetInnerHTML={{ __html: processHtmlMedia(item.text) }} />
                                   
                                   {item.imageUrl && <div className="mt-3 md:mt-4"><img src={getSafeImageUrl(item.imageUrl)} className="rounded-xl md:rounded-2xl max-h-48 md:max-h-64 object-contain border border-slate-200 shadow-sm" /></div>}
                                   {item.audioUrl && <div className="mt-3 md:mt-4 p-3 md:p-4 bg-blue-50 border border-blue-200 rounded-xl md:rounded-2xl max-w-xl shadow-sm"><span className="text-[9px] md:text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 md:mb-1.5 flex items-center gap-1.5">🎧 Audio Soal</span><audio src={getDriveMediaUrl(item.audioUrl)} controls className="w-full h-8 md:h-10 outline-none mt-1"/></div>}
                                   {item.videoUrl && <SmartMediaRenderer url={item.videoUrl} />}
                                 </div>

                                 <div className="text-center bg-slate-50 border border-slate-200 p-3 md:p-5 rounded-xl md:rounded-2xl h-fit shadow-inner shrink-0 w-full md:w-32 lg:w-40 flex flex-col justify-center">
                                     <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 md:mb-2">Partisipasi</p>
                                     <p className="text-2xl md:text-3xl font-black text-slate-800 leading-none">{item.total}</p>
                                     <p className="text-[10px] md:text-xs font-bold text-slate-500 mt-1">Siswa Menjawab</p>
                                 </div>
                               </div>

                               <div className="w-full bg-rose-50 border border-rose-100 h-5 md:h-6 rounded-full overflow-hidden flex shadow-inner relative">
                                 <div className="absolute inset-0 flex items-center justify-center z-10 text-[8px] md:text-[10px] font-black text-slate-700 uppercase tracking-widest mix-blend-overlay opacity-50">Grafik Akurasi Jawaban</div>
                                 <div className="h-full bg-emerald-500 rounded-full relative transition-all duration-1000 shadow-[2px_0_10px_rgba(0,0,0,0.1)]" style={{ width: `${correctPercent}%` }}>
                                     <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent w-full"></div>
                                 </div>
                               </div>
                               <div className="flex justify-between mt-2 md:mt-3 text-[10px] md:text-xs font-black uppercase tracking-widest">
                                 <span className="text-emerald-700 flex items-center gap-1 md:gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4"/> {item.correct} Benar ({correctPercent}%)</span>
                                 <span className="text-rose-600 flex items-center gap-1 md:gap-1.5">{item.total - item.correct} Salah ({100 - correctPercent}%) <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4"/></span>
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     </div>
                  </div>
                 )}
             </>
          )}
        </div>
      )}

      {/* ================= MODAL GLOBAL PRINT ================= */}
      {isGlobalPrintModalOpen && (
         <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-sm md:max-w-md rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200">
               <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div>
                    <h3 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2"><Printer className="w-5 h-5 md:w-6 md:h-6 text-blue-600"/> Cetak Hasil Keseluruhan</h3>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mt-1">Hanya mencakup laporan mata pelajaran Anda.</p>
                  </div>
                  <button onClick={() => setIsGlobalPrintModalOpen(false)} className="text-slate-400 hover:text-rose-500 bg-white rounded-full p-1.5 md:p-2 border border-slate-200 shadow-sm transition-colors"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
               </div>
               <div className="p-5 md:p-8 space-y-4 md:space-y-5">
                  <div className="space-y-2 md:space-y-3">
                     <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block">Pilih Format Unduhan</label>
                     <div className="grid grid-cols-2 gap-2 md:gap-3">
                        <button onClick={() => setGlobalPrintFormat('pdf')} className={`p-3 md:p-4 rounded-xl md:rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 md:gap-2 transition-all ${globalPrintFormat === 'pdf' ? 'border-rose-500 bg-rose-50 text-rose-600 shadow-sm' : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-rose-200 hover:text-rose-500'}`}><FileText className="w-6 h-6 md:w-8 md:h-8"/><span className="font-bold text-xs md:text-sm">PDF A4</span></button>
                        <button onClick={() => setGlobalPrintFormat('excel')} className={`p-3 md:p-4 rounded-xl md:rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 md:gap-2 transition-all ${globalPrintFormat === 'excel' ? 'border-emerald-500 bg-emerald-50 text-emerald-600 shadow-sm' : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-emerald-200 hover:text-emerald-500'}`}><FileSpreadsheet className="w-6 h-6 md:w-8 md:h-8"/><span className="font-bold text-xs md:text-sm">Excel (.xlsx)</span></button>
                     </div>
                  </div>
                  <button onClick={handleGlobalPrint} disabled={isPrintingGlobal} className="w-full flex items-center justify-center gap-2 py-3.5 md:py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-xs transition-all active:scale-95 shadow-md disabled:bg-slate-300 mt-3 md:mt-4">
                     {isPrintingGlobal ? <LoaderCircle className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
                     {isPrintingGlobal ? 'Memproses...' : 'Unduh Laporan'}
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* ================= MODAL DETAIL PRINT ================= */}
      {isPrintModalOpen && (
         <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200 max-h-[90vh]">
               <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                  <div>
                    <h3 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2"><Printer className="w-5 h-5 md:w-6 h-6 text-blue-600"/> Cetak Rekap Ujian</h3>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mt-0.5 md:mt-1 truncate max-w-[200px] sm:max-w-none">{activeExam?.subject}</p>
                  </div>
                  <button onClick={() => setIsPrintModalOpen(false)} className="text-slate-400 hover:text-rose-500 bg-white rounded-full p-1.5 md:p-2 border border-slate-200 shadow-sm transition-colors"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
               </div>
               <div className="p-4 md:p-6 overflow-y-auto space-y-4 md:space-y-6 custom-scrollbar">
                  <div className="space-y-2 md:space-y-3">
                     <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block flex items-center gap-1.5 md:gap-2"><Users className="w-3.5 h-3.5 md:w-4 md:h-4"/> Filter Kelas</label>
                     <select value={printConfig.filterClass} onChange={(e) => setPrintConfig({...printConfig, filterClass: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3.5 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
                        <option value="Semua Kelas">Semua Kelas / Gabungan</option>
                        {extractUniqueClasses().map(c => <option key={c} value={c}>Kelas {c}</option>)}
                     </select>
                  </div>
                  <div className="space-y-2 md:space-y-3">
                     <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block flex items-center gap-1.5 md:gap-2"><FileText className="w-3.5 h-3.5 md:w-4 md:h-4"/> Format Laporan</label>
                     <div className="flex gap-2 md:gap-3">
                        <button onClick={() => setPrintConfig({...printConfig, format: 'pdf'})} className={`flex-1 py-2.5 md:py-3 font-bold text-xs md:text-sm border-2 rounded-lg md:rounded-xl transition-colors ${printConfig.format === 'pdf' ? 'border-rose-500 bg-rose-50 text-rose-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>PDF A4</button>
                        <button onClick={() => setPrintConfig({...printConfig, format: 'excel'})} className={`flex-1 py-2.5 md:py-3 font-bold text-xs md:text-sm border-2 rounded-lg md:rounded-xl transition-colors ${printConfig.format === 'excel' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>Excel (.xlsx)</button>
                     </div>
                  </div>
                  <div className="space-y-2 md:space-y-3">
                     <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block flex items-center gap-1.5 md:gap-2"><SlidersHorizontal className="w-3.5 h-3.5 md:w-4 md:h-4"/> Kolom yang Ditampilkan</label>
                     <div className="grid grid-cols-2 gap-2 md:gap-3 bg-slate-50 p-3 md:p-4 rounded-lg md:rounded-xl border border-slate-200">
                        {Object.keys(printConfig.cols).map(k => (
                           <label key={k} className="flex items-center gap-2 md:gap-3 cursor-pointer">
                              <input type="checkbox" checked={(printConfig.cols as any)[k]} onChange={(e) => setPrintConfig({...printConfig, cols: {...printConfig.cols, [k]: e.target.checked}})} className="w-4 h-4 md:w-5 md:h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"/>
                              <span className="text-xs md:text-sm font-bold text-slate-700 capitalize">{k.replace('_', ' ')}</span>
                           </label>
                        ))}
                     </div>
                  </div>
               </div>
               <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50 shrink-0">
                  <button onClick={handlePrintOrExportDetail} disabled={isGeneratingPdf} className="w-full flex items-center justify-center gap-2 py-3 md:py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg md:rounded-xl font-black uppercase tracking-widest text-[10px] md:text-xs transition-all active:scale-95 shadow-md disabled:bg-slate-300">
                     {isGeneratingPdf ? <LoaderCircle className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin"/> : <Download className="w-3.5 h-3.5 md:w-4 md:h-4"/>}
                     {isGeneratingPdf ? 'Memproses...' : 'Unduh Laporan'}
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* ================= MODAL DETAIL REVIEW JAWABAN SISWA ================= */}
      {selectedStudentGroup && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
           <div className="bg-white w-full max-w-5xl rounded-2xl md:rounded-[2.5rem] shadow-2xl flex flex-col h-[95vh] md:h-[90vh] overflow-hidden animate-in zoom-in-95">
              <div className="p-4 md:p-6 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 gap-3 md:gap-4 shrink-0">
                 <div className="flex items-start gap-3 min-w-0 w-full sm:w-auto">
                    <UserCircle2 className="w-8 h-8 md:w-10 md:h-10 text-blue-600 shrink-0"/>
                    <div className="min-w-0">
                       <h3 className="text-lg md:text-xl font-black text-slate-800 truncate">{selectedStudentGroup.users.full_name}</h3>
                       <p className="text-[10px] md:text-xs font-bold text-slate-500 mt-0.5 truncate">Kelas {selectedStudentGroup.users.class_group} • Max: {selectedStudentGroup.highest_percentage.toFixed(2)}</p>
                    </div>
                 </div>
                 <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 custom-scrollbar hide-scroll-mobile shrink-0">
                    <div className="flex items-center gap-2">
                      {selectedStudentGroup.attempts.map(a => (
                        <button key={a.id} onClick={() => switchReviewAttemptTab(a)} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold border transition-all shrink-0 ${activeAttemptSessionId === a.id ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                           Coba {a.attempt_number} {a.is_highest && '⭐'}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setSelectedStudentGroup(null)} className="p-1.5 md:p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-full shrink-0 sm:ml-2 border border-transparent hover:border-rose-200 transition-colors"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 bg-slate-50/50 relative custom-scrollbar">
                 {loadingReview ? (
                   <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3 md:gap-4 text-slate-500 font-bold px-4 text-center">
                      <LoaderCircle className="w-8 h-8 md:w-10 md:h-10 animate-spin text-blue-500" />
                      <span className="text-xs md:text-sm">Memuat jawaban siswa dari server...</span>
                   </div>
                 ) : studentDetailedResponses.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-400 font-bold text-sm">Jawaban kosong pada percobaan ini.</div>
                 ) : studentDetailedResponses.map((r, i) => (
                    <div key={i} className={`bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border-2 shadow-sm ${r.is_correct ? 'border-emerald-100' : 'border-rose-100'}`}>
                       <div className="flex justify-between items-center mb-3 md:mb-4 border-b border-slate-100 pb-3 md:pb-4">
                         <span className="bg-slate-100 px-2 md:px-3 py-1 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-black uppercase text-slate-500 border">Soal {i+1}</span>
                         <span className={`px-2 md:px-3 py-1 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-black uppercase border whitespace-nowrap ${r.is_correct ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                           {r.points_given} / {r.max_points} Poin
                         </span>
                       </div>
                       <div className="font-bold text-slate-800 prose prose-sm max-w-none mb-4 md:mb-6 break-words text-sm leading-relaxed" dangerouslySetInnerHTML={{__html: processHtmlMedia(r.question_text)}} />
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                          <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl border ${r.is_correct ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'}`}>
                             <p className={`text-[9px] md:text-[10px] font-black uppercase mb-1.5 md:mb-2 ${r.is_correct ? 'text-emerald-600' : 'text-rose-600'}`}>Jawaban Siswa:</p>
                             {r.question_type === 'matching' ? (
                               <pre className="text-[10px] md:text-xs font-mono text-slate-700 bg-white p-2 md:p-3 rounded-lg md:rounded-xl border overflow-x-auto custom-scrollbar">{r.student_answer ? JSON.stringify(JSON.parse(r.student_answer), null, 2) : 'Kosong'}</pre>
                             ) : (
                               <div className="font-bold text-slate-700 text-xs md:text-sm break-words" dangerouslySetInnerHTML={{__html: processHtmlMedia(r.student_answer || '<i>Kosong</i>')}} />
                             )}
                          </div>
                          <div className="p-3 md:p-4 bg-slate-50 rounded-xl md:rounded-2xl border border-slate-200">
                             <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase mb-1.5 md:mb-2">Kunci Sistem:</p>
                             {r.question_type === 'essay' ? <p className="text-[10px] md:text-xs text-slate-400 italic font-bold">Esai manual</p> : 
                              r.question_type === 'matching' ? <pre className="text-[10px] md:text-xs font-mono text-slate-500 overflow-x-auto custom-scrollbar">{r.correct_answer ? JSON.stringify(r.correct_answer, null, 2) : '-'}</pre> :
                              <p className="font-bold text-slate-700 text-xs md:text-sm break-words">{String(r.correct_answer || '-')}</p>
                             }
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* ================= MODAL DETAIL KOREKSI ESAI ================= */}
      {selectedStudentForEssay && selectedStudentMeta && (
         <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-8 animate-in fade-in">
            <div className="bg-white w-full max-w-5xl rounded-2xl md:rounded-[2.5rem] shadow-2xl flex flex-col h-[95vh] max-h-[95vh] overflow-hidden animate-in zoom-in-95 border border-amber-200">
               <div className="bg-amber-50 border-b border-amber-100 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 shrink-0">
                  <div className="min-w-0">
                     <h3 className="text-lg md:text-xl font-black text-amber-900 flex items-center gap-2 truncate"><FileEdit className="w-4 h-4 md:w-5 md:h-5 text-amber-600 shrink-0"/> <span className="truncate">Koreksi Esai</span></h3>
                     <p className="text-xs md:text-sm font-bold text-amber-700 mt-0.5 md:mt-1 truncate">{selectedStudentMeta.name} <span className="text-[10px] md:text-xs text-amber-600/70 ml-1 md:ml-2 whitespace-nowrap">• {selectedStudentMeta.class_group}</span></p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 overflow-x-auto w-full sm:w-auto custom-scrollbar hide-scroll-mobile pb-1 sm:pb-0">
                     <div className="flex items-center gap-2">
                        {selectedStudentMeta.attempts.map(a => (
                           <button 
                              key={a.session_id} 
                              onClick={() => setActiveEssaySessionId(a.session_id)}
                              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold border transition-all shrink-0 ${activeEssaySessionId === a.session_id ? 'bg-amber-500 text-white border-amber-600 shadow-md' : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-100'}`}
                           >
                              Coba {a.attempt_number}
                           </button>
                        ))}
                     </div>
                     <button onClick={() => setSelectedStudentForEssay(null)} className="p-1.5 md:p-2 bg-white rounded-full hover:bg-rose-50 text-amber-600 hover:text-rose-500 shadow-sm sm:ml-2 border border-amber-200 hover:border-rose-200 transition-colors shrink-0"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 bg-slate-50/50 custom-scrollbar">
                  {selectedEssayStudentData ? selectedEssayStudentData.answers.map((ans, idx) => (
                     <div key={ans.id} className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] shadow-sm flex flex-col md:flex-row overflow-hidden hover:border-blue-200 transition-colors">
                       <div className="flex-1 p-4 sm:p-5 md:p-8 bg-white border-b md:border-b-0 md:border-r border-slate-100 min-w-0">
                         <div className="bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-4 md:p-6 mb-4 md:mb-6 shadow-inner">
                           <div className="flex justify-between items-center mb-2 md:mb-3">
                              <div className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 md:gap-2"><div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500"></div> Soal No {idx + 1}</div>
                              <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest px-2 md:px-3 py-0.5 md:py-1 rounded md:rounded-md border whitespace-nowrap ${ans.is_graded ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-500 border-rose-200'}`}>{ans.is_graded ? 'DINILAI' : 'BELUM'}</span>
                           </div>
                           <div className="text-sm md:text-base font-bold text-slate-800 prose prose-sm md:prose-slate max-w-none break-words leading-snug md:leading-relaxed" dangerouslySetInnerHTML={{ __html: processHtmlMedia(ans.questions?.question_text) }} />
                         </div>
                         <div className="bg-blue-50/50 border border-blue-100 rounded-xl md:rounded-[1.5rem] p-4 md:p-6 shadow-sm relative">
                           <div className="absolute top-0 left-0 w-1 md:w-1.5 h-full bg-blue-400 rounded-l-[1.5rem]"></div>
                           <p className="text-[9px] md:text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 md:mb-3 flex items-center gap-1.5"><FileText className="w-3 h-3 md:w-3.5 md:h-3.5"/> Jawaban Siswa:</p>
                           <div className="text-xs md:text-base font-medium text-slate-900 prose prose-sm md:prose-blue max-w-none [&>p]:m-0 leading-relaxed break-words" dangerouslySetInnerHTML={{ __html: processHtmlMedia(ans.answer_text) }} />
                         </div>
                       </div>
                       
                       <div className="w-full md:w-72 lg:w-80 p-4 sm:p-5 md:p-8 flex flex-col justify-between gap-4 md:gap-6 bg-slate-50 shrink-0 border-t md:border-t-0 border-slate-100">
                         <div className="space-y-4 md:space-y-5">
                           <div><label className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest block mb-1.5 md:mb-2">Skor Diberikan</label>
                             <div className="flex items-center gap-2 md:gap-3">
                               <input 
                                 type="number" min={0} max={ans.questions?.points || 0} step={0.1}
                                 value={ans.points_given !== null && ans.points_given !== undefined ? ans.points_given : ''} 
                                 onChange={(e) => {
                                    let val = parseFloat(e.target.value);
                                    if (isNaN(val)) { setEssayAnswers(prev => prev.map(a => a.id === ans.id ? { ...a, points_given: 0 } : a)); return; }
                                    const maxP = ans.questions?.points || 0;
                                    if (val < 0) val = 0; if (val > maxP) val = maxP;
                                    setEssayAnswers(prev => prev.map(a => a.id === ans.id ? { ...a, points_given: val } : a));
                                 }}
                                 className="w-full bg-white border-2 border-amber-200 rounded-lg md:rounded-xl p-3 md:p-4 text-2xl md:text-3xl font-black text-amber-700 text-center outline-none focus:border-amber-400 shadow-sm" 
                                 placeholder="0" 
                               />
                               <div className="bg-white px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center shrink-0">
                                 <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase leading-none mb-0.5 md:mb-1 tracking-widest">Maks</span>
                                 <span className="text-lg md:text-xl font-black text-slate-600 leading-tight">{ans.questions?.points}</span>
                               </div>
                             </div>
                           </div>
                           <div><label className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest block mb-1.5 md:mb-2">Catatan Evaluasi (Opsional)</label>
                             <textarea 
                               value={ans.teacher_notes || ''} 
                               onChange={(e) => setEssayAnswers(prev => prev.map(a => a.id === ans.id ? { ...a, teacher_notes: e.target.value } : a))}
                               className="w-full bg-white border border-slate-200 rounded-lg md:rounded-xl p-3 md:p-4 text-xs md:text-sm font-medium text-slate-900 h-20 md:h-28 focus:ring-2 focus:ring-blue-500 outline-none resize-none shadow-sm leading-relaxed placeholder-slate-400" 
                               placeholder="Feedback perbaikan untuk siswa..." 
                             />
                           </div>
                         </div>
                         <button onClick={() => saveEssayScore(ans.id, ans.student_id, ans.points_given, ans.teacher_notes)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 md:py-4 rounded-lg md:rounded-xl font-black text-xs md:text-sm shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-1.5 md:gap-2 mt-2 md:mt-0">
                           <Save className="w-4 h-4 md:w-5 md:h-5"/> Simpan Nilai
                         </button>
                       </div>
                     </div>
                  )) : (
                     <div className="text-center py-16 md:py-20 font-bold text-slate-400 bg-white border-2 border-dashed border-slate-200 rounded-2xl md:rounded-[2rem] text-sm md:text-base px-4">Siswa tidak memiliki jawaban esai pada percobaan ini.</div>
                  )}
               </div>
            </div>
         </div>
      )}

    </div>
  );
}