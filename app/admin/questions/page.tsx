'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import dynamic from 'next/dynamic';
import { 
  Database, Search, Plus, Trash2, Edit3, Image as ImageIcon, Music, Video, 
  FolderOpen, ArrowLeft, BookOpen, Users, LayoutList, FileUp, LoaderCircle, X,
  ArrowRight, MinusCircle, LayoutTemplate, Calculator, Check, UploadCloud, 
  FileSpreadsheet, AlertCircle, CheckCircle2, Save, Award, Info, FileEdit,
  Sparkles, Headphones, FileText, Settings, Package, Layers, KeyRound, 
  HelpCircle, AlertTriangle, ChevronDown, UserCircle2, ChevronRight, Download, Globe
} from 'lucide-react';

// --- INJEKSI KATEX & MHCHEM UNTUK MATEMATIKA, FISIKA, DAN KIMIA ---
import katex from 'katex';
import 'katex/dist/katex.min.css';
import 'react-quill-new/dist/quill.snow.css';

if (typeof window !== 'undefined') {
  (window as any).katex = katex;
  try {
    require('katex/dist/contrib/mhchem.min.js');
  } catch (e) {
    console.warn("Ekstensi Kimia (mhchem) bawaan KaTeX belum tersedia.");
  }
}

const ReactQuill = dynamic(() => import('react-quill-new'), { 
  ssr: false, 
  loading: () => <div className="h-20 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 font-medium text-xs md:text-sm">Memuat Editor...</div> 
});

const quillModulesFull = {
  toolbar: [ 
    [{ 'header': [1, 2, 3, false] }], 
    ['bold', 'italic', 'underline', 'strike'], 
    [{ 'color': [] }, { 'background': [] }], 
    [{ 'script': 'sub'}, { 'script': 'super' }], 
    [{ 'align': [] }], 
    [{ 'list': 'ordered'}, { 'list': 'bullet' }], 
    ['formula', 'image', 'video'], 
    ['clean'] 
  ],
};

const OptimizedQuillEditor = ({ value, onChange, placeholder, className, modules }: any) => {
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value);
    }
  }, [value]);

  const handleChange = (content: string) => {
    setLocalValue(content); 
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(content); 
    }, 400); 
  };

  return (
    <ReactQuill 
      theme="snow" 
      modules={modules} 
      value={localValue || ''} 
      onChange={handleChange} 
      placeholder={placeholder} 
      className={className} 
    />
  );
};

interface Subject { id: string; name: string; grade_level: string; teacherNames?: string; }
interface Question {
  id: string; subject_id: string; question_text: string; question_type: string;
  image_url: string | null; audio_url: string | null; video_url: string | null;
  points: number; difficulty: number; is_active: boolean; scoring_type?: string;
  options: any; correct_answer: any; audio_duration?: number; tags?: string[];
  package_name?: string; allow_media_upload?: boolean; // Tambahan interface izin media
}

export default function UnifiedQuestionsBankPage() {
  const [activeView, setActiveView] = useState<'folders' | 'packages' | 'questions'>('folders');
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [activePackage, setActivePackage] = useState<string | null>(null);
  
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isSelectMapelModalOpen, setIsSelectMapelModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [dialogConfig, setDialogConfig] = useState<{
      isOpen: boolean; type: 'alert' | 'confirm' | 'info' | 'success'; title: string; message: string;
      onConfirm?: () => void; onCancel?: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [globalLoading, setGlobalLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(''); 

  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importSelectedSubject, setImportSelectedSubject] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showMathGuide, setShowMathGuide] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // STATE FORM DIPERBARUI DENGAN allow_media_upload
  const [formData, setFormData] = useState({
    subject: '', question_type: 'multiple_choice', question_text: '',
    image_url: '', audio_url: '', video_url: '', audio_play_limit: 0,
    correct_answer: 'A', points: 1.0, difficulty: 3, is_active: true, scoring_type: 'all_or_nothing',
    package_name: 'Paket 1', allow_media_upload: false
  });

  const [options, setOptions] = useState<any[]>([
    { key: 'A', text: '', image_url: '', audio_url: '', video_url: '', showMedia: false }, 
    { key: 'B', text: '', image_url: '', audio_url: '', video_url: '', showMedia: false }, 
    { key: 'C', text: '', image_url: '', audio_url: '', video_url: '', showMedia: false }, 
    { key: 'D', text: '', image_url: '', audio_url: '', video_url: '', showMedia: false }, 
    { key: 'E', text: '', image_url: '', audio_url: '', video_url: '', showMedia: false },
  ]);
  const [complexAnswers, setComplexAnswers] = useState<string[]>([]);
  
  const [matchingPremises, setMatchingPremises] = useState([{ id: 'p1', text: '' }, { id: 'p2', text: '' }]);
  const [matchingResponses, setMatchingResponses] = useState([{ id: 'r1', text: '' }, { id: 'r2', text: '' }]);
  const [matchingKeys, setMatchingKeys] = useState<Record<string, string>>({ p1: 'r1', p2: 'r2' }); 

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500); 
  };

  const showDialog = useCallback((type: 'alert'|'confirm'|'info'|'success', title: string, message: string, onConfirm?: () => void, onCancel?: () => void) => {
    setDialogConfig({ isOpen: true, type, title, message, onConfirm, onCancel });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogConfig(prev => ({ ...prev, isOpen: false }));
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setGlobalLoading(true);
    try {
      const { data: subjectsData, error } = await supabase.from('subjects').select('id, name, grade_level').order('name', { ascending: true });
      if (error) throw error;

      const { data: teachersData } = await supabase.from('users').select('id, full_name, taught_subjects').eq('role', 'proctor');
      
      let finalSubjects: Subject[] = [];
      if (subjectsData) {
         finalSubjects = subjectsData.map(subj => {
            const tNames = teachersData?.filter(t => t.taught_subjects && t.taught_subjects.includes(subj.id)).map(t => t.full_name).join(', ');
            return { ...subj, teacherNames: tNames || 'Belum ada pengampu' };
         });
         setSubjects(finalSubjects);
      }

      const { data: questionsData } = await supabase.from('questions').select('id, subject_id, package_name');
      if (questionsData) setQuestions(questionsData as any[]);
    } catch (error) { console.error(error); } finally { setGlobalLoading(false); }
  };

  const fetchQuestionsForSubject = async (subjectId: string) => {
    setGlobalLoading(true);
    try {
      const { data } = await supabase.from('questions').select('*').eq('subject_id', subjectId).order('created_at', { ascending: false });
      if (data) setQuestions(data);
    } catch (error) { console.error(error); } finally { setGlobalLoading(false); }
  };

  const goToPackagesView = (subject: Subject) => {
    setActiveSubject(subject);
    setSearchQuery('');
    fetchQuestionsForSubject(subject.id);
    setActiveView('packages');
  };

  const goToQuestionsView = (pkgName: string) => {
    setActivePackage(pkgName);
    setSearchQuery('');
    setActiveView('questions');
  };

  const goToFolders = () => {
    setActiveSubject(null);
    setActivePackage(null);
    setSearchQuery('');
    fetchSubjects(); 
    setActiveView('folders');
  };

  const openImportModal = () => {
    setImportFile(null); 
    setPreviewData([]); 
    setImportError(null); 
    setImportSuccess(null); 
    setImportSelectedSubject(activeSubject?.id || ''); 
    setIsImportModalOpen(true);
  };

  const handleDirectMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string, optionIndex?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { 
      showToast("Ukuran file terlalu besar! Maksimal 5MB untuk menghemat ruang penyimpanan Anda.", "error");
      return;
    }

    setIsUploadingMedia(true);
    showToast("Sedang mengunggah audio ke server...", "info");

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `audio/${fileName}`;

      const { error } = await supabase.storage.from('exam_media').upload(filePath, file);
      if (error) throw error;

      const { data } = supabase.storage.from('exam_media').getPublicUrl(filePath);

      if (optionIndex !== undefined) {
        handleOptionChange(optionIndex, field, data.publicUrl);
      } else {
        setFormData(prev => ({ ...prev, [field]: data.publicUrl }));
      }
      showToast("Audio berhasil diunggah!", "success");
    } catch (err: any) {
      showToast("Gagal unggah: " + err.message, "error");
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const resetFormState = (subjectContext?: Subject | null, pkgName?: string) => {
    setFormError(null);
    setEditingId(null);
    setFormData({
      subject: subjectContext?.name || '', question_type: 'multiple_choice', question_text: '',
      image_url: '', audio_url: '', video_url: '', audio_play_limit: 0,
      correct_answer: 'A', points: 1.0, difficulty: 3, is_active: true, scoring_type: 'all_or_nothing',
      package_name: pkgName || 'Paket 1', allow_media_upload: false
    });
    setOptions([
      { key: 'A', text: '', image_url: '', audio_url: '', video_url: '', showMedia: false }, 
      { key: 'B', text: '', image_url: '', audio_url: '', video_url: '', showMedia: false }, 
      { key: 'C', text: '', image_url: '', audio_url: '', video_url: '', showMedia: false }, 
      { key: 'D', text: '', image_url: '', audio_url: '', video_url: '', showMedia: false }, 
      { key: 'E', text: '', image_url: '', audio_url: '', video_url: '', showMedia: false },
    ]);
    setComplexAnswers([]);
    
    setMatchingPremises([{ id: 'p1', text: '' }, { id: 'p2', text: '' }, { id: 'p3', text: '' }]);
    setMatchingResponses([{ id: 'r1', text: '' }, { id: 'r2', text: '' }, { id: 'r3', text: '' }]);
    setMatchingKeys({ p1: 'r1', p2: 'r2', p3: 'r3' });
  };

  const openCreateForm = (subjectContext?: Subject | null, pkgName?: string) => {
    resetFormState(subjectContext || activeSubject, pkgName || activePackage || 'Paket 1');
    setIsFormModalOpen(true);
  };

  const openEditForm = (q: Question) => {
    setFormError(null);
    setEditingId(q.id);
    setFormData({
      subject: (q.tags && q.tags[0]) || activeSubject?.name || '', question_type: q.question_type, question_text: q.question_text || '',
      image_url: q.image_url || '', audio_url: q.audio_url || '', video_url: q.video_url || '', audio_play_limit: q.audio_duration || 0,
      correct_answer: q.correct_answer || 'A', 
      points: q.points || 1.0, difficulty: q.difficulty || 3,
      is_active: q.is_active, scoring_type: q.scoring_type || 'all_or_nothing',
      package_name: q.package_name || 'Paket 1',
      allow_media_upload: q.allow_media_upload || false // Set status izin media
    });

    if (q.options && Array.isArray(q.options)) {
      if (q.question_type === 'multiple_choice' || q.question_type === 'complex_multiple_choice') {
        setOptions(q.options.map((opt: any) => ({ ...opt, showMedia: !!(opt.image_url || opt.audio_url || opt.video_url) })));
      } else if (q.question_type === 'matching') {
        let pList: any[] = [];
        let rList: any[] = [];
        let mKeys: Record<string, string> = {};

        const allLefts = q.options.map((o:any) => o.left || o.key).filter(Boolean);
        const allRights = q.options.map((o:any) => o.right || o.text).filter(Boolean);

        allLefts.forEach((l: string, i: number) => pList.push({ id: `p${i+1}`, text: l }));
        allRights.forEach((r: string, i: number) => rList.push({ id: `r${i+1}`, text: r }));

        let correctArr: any[] = [];
        try { correctArr = typeof q.correct_answer === 'string' ? JSON.parse(q.correct_answer) : q.correct_answer; } catch(e){}
        
        if (Array.isArray(correctArr)) {
            correctArr.forEach((c: any) => {
                const leftText = c.left || c.key;
                const rightText = c.right || c.text;
                const p = pList.find(x => x.text === leftText);
                const r = rList.find(x => x.text === rightText);
                if (p && r) mKeys[p.id] = r.id;
            });
        }
        
        if(pList.length === 0) pList = [{id: 'p1', text: ''}];
        if(rList.length === 0) rList = [{id: 'r1', text: ''}];
        
        setMatchingPremises(pList);
        setMatchingResponses(rList);
        setMatchingKeys(mKeys);
      }
    }
    if (q.question_type === 'complex_multiple_choice' && q.correct_answer) {
      setComplexAnswers(q.correct_answer.split(','));
    }
    setIsFormModalOpen(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => {
       const newData = { ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : (name === 'points' || name === 'difficulty' || name === 'audio_play_limit' ? Number(value) : value) };
       if (name === 'question_type') {
          if (value === 'true_false') newData.correct_answer = 'True';
          else if (value === 'multiple_choice') newData.correct_answer = 'A';
          else if (value === 'short_answer' || value === 'essay' || value === 'matching') newData.correct_answer = '';
       }
       return newData;
    });
  };

  const handleQuillChange = (content: string) => setFormData(prev => ({ ...prev, question_text: content }));

  const handleOptionChange = (index: number, field: string, value: any) => {
    const newOptions: any = [...options];
    newOptions[index][field] = value;
    setOptions(newOptions);
  };
  
  const addOption = () => setOptions([...options, { key: String.fromCharCode(65 + options.length), text: '', image_url: '', audio_url: '', video_url: '', showMedia: false }]);
  
  const removeOption = (indexToRemove: number) => {
    if (options.length <= 2) {
      showToast("Minimal harus ada 2 opsi jawaban!", "error");
      return;
    }
    const newOptions = options.filter((_, idx) => idx !== indexToRemove).map((opt, idx) => ({ ...opt, key: String.fromCharCode(65 + idx) }));
    setOptions(newOptions);
    if (formData.correct_answer === options[indexToRemove].key) setFormData(prev => ({ ...prev, correct_answer: 'A' }));
  };

  const handleComplexAnswerToggle = (key: string) => setComplexAnswers(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(code);
    setTimeout(() => setCopiedSnippet(null), 1500);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingForm(true); setFormError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Sesi tidak valid, silakan login ulang.");
      
      const cleanText = formData.question_text.replace(/<[^>]*>?/gm, '').trim();
      if (!cleanText) throw new Error("Teks pertanyaan tidak boleh kosong.");

      let finalCorrectAnswer: string | null = formData.correct_answer;
      let finalOptions: any = null;
      const qType = formData.question_type;

      if (qType === 'multiple_choice') {
        finalOptions = options.filter(opt => opt.text.replace(/<[^>]*>?/gm, '').trim() !== '' || opt.image_url !== '').map(({showMedia, ...rest}:any) => ({
           ...rest,
           is_correct: rest.key === finalCorrectAnswer 
        }));
        if (finalOptions.length < 2) throw new Error("Minimal harus ada 2 opsi jawaban.");
      } else if (qType === 'complex_multiple_choice') {
        finalOptions = options.filter(opt => opt.text.replace(/<[^>]*>?/gm, '').trim() !== '' || opt.image_url !== '').map(({showMedia, ...rest}:any) => ({
           ...rest,
           is_correct: complexAnswers.includes(rest.key) 
        }));
        if (finalOptions.length < 2) throw new Error("Minimal harus ada 2 opsi jawaban.");
        if (complexAnswers.length === 0) throw new Error("Pilih setidaknya satu kunci jawaban.");
        finalCorrectAnswer = complexAnswers.sort().join(','); 
      } else if (qType === 'true_false') {
        finalOptions = [ 
           { key: 'True', text: 'Benar', is_correct: finalCorrectAnswer === 'True' }, 
           { key: 'False', text: 'Salah', is_correct: finalCorrectAnswer === 'False' } 
        ];
      } else if (qType === 'matching') {
        const isValidP = matchingPremises.every(p => p.text.replace(/<[^>]*>?/gm, '').trim() !== '');
        const isValidR = matchingResponses.every(r => r.text.replace(/<[^>]*>?/gm, '').trim() !== '');
        if (!isValidP || !isValidR) throw new Error("Semua kotak Editor Premis dan Respons tidak boleh kosong teksnya.");
        if (Object.keys(matchingKeys).length === 0) throw new Error("Tentukan minimal 1 Kunci Jawaban di Panel Atribut.");

        const maxLength = Math.max(matchingPremises.length, matchingResponses.length);
        finalOptions = [];
        for(let i=0; i<maxLength; i++) {
            finalOptions.push({
                left: matchingPremises[i]?.text || null,
                right: matchingResponses[i]?.text || null
            });
        }

        const correctArr = [];
        for (const [pId, rId] of Object.entries(matchingKeys)) {
            const p = matchingPremises.find(x => x.id === pId);
            const r = matchingResponses.find(x => x.id === rId);
            if (p && r && rId !== '') correctArr.push({ left: p.text, right: r.text });
        }
        finalCorrectAnswer = JSON.stringify(correctArr);

      } else if (qType === 'short_answer') {
        if (!(finalCorrectAnswer || '').trim()) throw new Error("Kunci jawaban eksak wajib diisi.");
        finalCorrectAnswer = finalCorrectAnswer.trim();
        finalOptions = null;
      } else if (qType === 'essay') {
        finalOptions = null; finalCorrectAnswer = null; 
      }

      const targetSubjectId = activeSubject?.id || importSelectedSubject; 
      if(!targetSubjectId) throw new Error("Target Mata Pelajaran tidak ditemukan.");

      const payload = {
        subject_id: targetSubjectId, 
        question_text: formData.question_text, 
        question_type: qType,
        options: finalOptions, 
        correct_answer: finalCorrectAnswer, 
        points: formData.points, 
        difficulty: formData.difficulty,
        is_active: formData.is_active, 
        image_url: formData.image_url || null, 
        audio_url: formData.audio_url || null, 
        video_url: formData.video_url || null, 
        audio_duration: formData.audio_play_limit, 
        tags: formData.subject ? [formData.subject] : [], 
        scoring_type: formData.scoring_type,
        package_name: formData.package_name || 'Paket 1', 
        allow_media_upload: qType === 'essay' ? formData.allow_media_upload : false, 
        updated_at: new Date().toISOString()
      };

      if (editingId) {
        const { error } = await supabase.from('questions').update(payload).eq('id', editingId);
        if (error) throw error;
        showToast("Soal berhasil diperbarui!", "success");
      } else {
        const { error } = await supabase.from('questions').insert([{ ...payload, created_by: session.user.id }]);
        if (error) throw error;
        showToast("Soal berhasil ditambahkan!", "success");
      }

      setIsFormModalOpen(false);
      
      if (activeView === 'questions' && activeSubject) fetchQuestionsForSubject(activeSubject.id);
      else fetchSubjects(); 

    } catch (err: any) { 
      setFormError(err.message); 
      showToast("Gagal menyimpan: " + err.message, "error");
    } finally { setIsSubmittingForm(false); }
  };

  const handleQuestionDelete = (questionId: string) => {
    showDialog('confirm', 'Hapus Soal Permanen', 'Apakah Anda yakin ingin menghapus soal ini secara permanen? Tindakan ini tidak bisa dibatalkan.', async () => {
      try {
        const { error } = await supabase.from('questions').delete().eq('id', questionId);
        if (error) throw error;
        setQuestions(prev => prev.filter(q => q.id !== questionId));
        showToast("Soal berhasil dihapus.", "success");
      } catch (err: any) { 
        showToast("Gagal menghapus soal: " + err.message, "error"); 
      }
    });
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        Jenis_Soal: 'Panduan (JANGAN DIHAPUS)', Teks_Soal: 'Pilihan: PG, PG_KOMPLEKS, BS, ISIAN, ESSAY, MATCHING', Media_Utama: 'URL Gambar/Audio/Video (Opsional)',
        Kunci_Jawaban: 'A / A,C / Benar / (Teks Isian)', Bobot_Poin: 'Angka (cth: 2.5)', Sistem_Penilaian: 'Mutlak / Proporsional',
        Tingkat_Kesulitan: '1 - 5', Opsi_A: 'Teks / Premis|Respons', Media_A: 'URL Media A', Opsi_B: 'Teks B', Media_B: 'URL Media B',
        Opsi_C: 'Teks C', Media_C: 'URL Media C', Opsi_D: 'Teks D', Media_D: '', Opsi_E: 'Teks E', Media_E: '', Paket_Soal: 'Nama Paket'
      },
      {
        Jenis_Soal: 'PG', Teks_Soal: 'Siapakah Presiden pertama Indonesia?', Media_Utama: '', Kunci_Jawaban: 'A', Bobot_Poin: 1, Sistem_Penilaian: 'Mutlak', Tingkat_Kesulitan: 2,
        Opsi_A: 'Soekarno', Media_A: '', Opsi_B: 'Soeharto', Media_B: '', Opsi_C: 'B.J. Habibie', Media_C: '', Opsi_D: 'Jokowi', Media_D: '', Opsi_E: '', Media_E: '', Paket_Soal: 'Paket 1'
      },
      {
        Jenis_Soal: 'PG_KOMPLEKS', Teks_Soal: 'Manakah dari hewan berikut yang berkembang biak dengan bertelur? (Pilih lebih dari satu)', Media_Utama: '', Kunci_Jawaban: 'A,C', Bobot_Poin: 2, Sistem_Penilaian: 'Proporsional', Tingkat_Kesulitan: 3,
        Opsi_A: 'Ayam', Media_A: '', Opsi_B: 'Kucing', Media_B: '', Opsi_C: 'Burung Elang', Media_C: '', Opsi_D: 'Sapi', Media_D: '', Opsi_E: '', Media_E: '', Paket_Soal: 'Paket 1'
      },
      {
        Jenis_Soal: 'BS', Teks_Soal: 'Ibukota negara Jepang adalah Tokyo.', Media_Utama: '', Kunci_Jawaban: 'Benar', Bobot_Poin: 1, Sistem_Penilaian: 'Mutlak', Tingkat_Kesulitan: 1,
        Opsi_A: '', Media_A: '', Opsi_B: '', Media_B: '', Opsi_C: '', Media_C: '', Opsi_D: '', Media_D: '', Opsi_E: '', Media_E: '', Paket_Soal: 'Paket 1'
      },
      {
        Jenis_Soal: 'MATCHING', Teks_Soal: 'Jodohkanlah negara berikut dengan benuanya.', Media_Utama: '', Kunci_Jawaban: '', Bobot_Poin: 3, Sistem_Penilaian: 'Proporsional', Tingkat_Kesulitan: 2,
        Opsi_A: 'Indonesia | Asia', Media_A: '', Opsi_B: 'Inggris | Asia', Media_B: '', Opsi_C: 'Jerman | Eropa', Media_C: '', Opsi_D: '| Afrika (Pengecoh)', Media_D: '', Opsi_E: '', Media_E: '', Paket_Soal: 'Paket 1'
      },
      {
        Jenis_Soal: 'ISIAN', Teks_Soal: '10 ditambah 15 sama dengan ...', Media_Utama: '', Kunci_Jawaban: '25', Bobot_Poin: 1, Sistem_Penilaian: 'Mutlak', Tingkat_Kesulitan: 1,
        Opsi_A: '', Media_A: '', Opsi_B: '', Media_B: '', Opsi_C: '', Media_C: '', Opsi_D: '', Media_D: '', Opsi_E: '', Media_E: '', Paket_Soal: 'Paket 1'
      },
      {
        Jenis_Soal: 'ESSAY', Teks_Soal: 'Jelaskan proses terjadinya hujan secara singkat!', Media_Utama: '', Kunci_Jawaban: '', Bobot_Poin: 5, Sistem_Penilaian: 'Mutlak', Tingkat_Kesulitan: 4,
        Opsi_A: '', Media_A: '', Opsi_B: '', Media_B: '', Opsi_C: '', Media_C: '', Opsi_D: '', Media_D: '', Opsi_E: '', Media_E: '', Paket_Soal: 'Paket 1'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{wch: 15}, {wch: 40}, {wch: 25}, {wch: 15}, {wch: 12}, {wch: 15}, {wch: 15}, {wch: 25}, {wch: 20}, {wch: 25}, {wch: 20}, {wch: 25}, {wch: 15}];
    const range = XLSX.utils.decode_range(ws['!ref'] || "A1:M1");
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ c: C, r: 0 });
      if (!ws[address]) continue;
      ws[address].s = { font: { bold: true } }; 
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Soal");
    XLSX.writeFile(wb, "Template_Import_Soal_Lengkap.xlsx");
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null); setImportSuccess(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setImportFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const rawRows = data.slice(1);
        if (rawRows.length === 0) throw new Error("File Excel kosong.");

        const parsedQuestions = rawRows.map((row: any) => {
          const rawType = String(row.Jenis_Soal || '').toUpperCase().trim();
          let qType = 'multiple_choice';
          if (rawType === 'PG_KOMPLEKS') qType = 'complex_multiple_choice';
          else if (rawType === 'BS') qType = 'true_false';
          else if (rawType === 'ISIAN') qType = 'short_answer';
          else if (rawType === 'ESSAY') qType = 'essay';
          else if (rawType === 'MATCHING') qType = 'matching';

          let scoringType = String(row.Sistem_Penilaian || '').toLowerCase().includes('proporsional') ? 'partial' : 'all_or_nothing';
          let options: any[] = [];
          let kunci = String(row.Kunci_Jawaban || '').trim();
          const kunciArray = kunci.split(',').map(k => k.trim().toUpperCase());

          if (['multiple_choice', 'complex_multiple_choice', 'true_false'].includes(qType)) {
            ['A', 'B', 'C', 'D', 'E'].forEach(k => {
              if (row[`Opsi_${k}`]) {
                options.push({
                  key: qType === 'true_false' ? row[`Opsi_${k}`] : k, text: String(row[`Opsi_${k}`]),
                  image_url: row[`Media_${k}`] || null, is_correct: qType === 'true_false' ? (String(row[`Opsi_${k}`]).toUpperCase() === kunci.toUpperCase()) : kunciArray.includes(k)
                });
              }
            });
          } else if (qType === 'matching') {
             let pList: string[] = [];
             let rList: string[] = [];
             let correctArr: any[] = [];

             ['A', 'B', 'C', 'D', 'E'].forEach(k => {
               if (row[`Opsi_${k}`] && String(row[`Opsi_${k}`]).includes('|')) {
                 const [premis, pasangan] = String(row[`Opsi_${k}`]).split('|');
                 const pText = premis.trim();
                 const rText = pasangan.trim();
                 
                 if (pText) pList.push(pText);
                 if (rText) rList.push(rText);
                 if (pText && rText) correctArr.push({ left: pText, right: rText });
               }
             });

             const maxLen = Math.max(pList.length, rList.length);
             for(let i=0; i<maxLen; i++) {
                options.push({
                   left: pList[i] || null,
                   right: rList[i] || null
                });
             }
             try { kunci = JSON.stringify(correctArr); } catch(e){}
             
             return {
                question_type: qType, question_text: row.Teks_Soal || '(Soal Kosong)',
                image_url: row.Media_Utama || null, options: options.length > 0 ? options : null,
                correct_answer: kunci,
                points: parseFloat(row.Bobot_Poin) || 1.0, difficulty: parseInt(row.Tingkat_Kesulitan) || 3, scoring_type: scoringType,
                package_name: row.Paket_Soal || 'Paket 1', is_active: true, _rawKunci: kunci 
             };
          } else if (qType === 'short_answer') options.push({ key: 'ans', text: kunci, is_correct: true });

          let finalKunciImport = kunci;
          if (qType === 'true_false') finalKunciImport = kunci.toLowerCase() === 'benar' ? 'True' : 'False';

          return {
            question_type: qType, question_text: row.Teks_Soal || '(Soal Kosong)',
            image_url: row.Media_Utama || null, options: options.length > 0 ? options : null,
            correct_answer: qType === 'essay' ? null : finalKunciImport,
            points: parseFloat(row.Bobot_Poin) || 1.0, difficulty: parseInt(row.Tingkat_Kesulitan) || 3, scoring_type: scoringType,
            package_name: row.Paket_Soal || 'Paket 1', 
            allow_media_upload: false, 
            is_active: true, _rawKunci: finalKunciImport 
          };
        });
        setPreviewData(parsedQuestions);
      } catch (err: any) { 
        setImportError(`Gagal membaca file Excel.`);
        showToast("Gagal membaca file Excel.", "error");
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleUploadData = async () => {
    if (!importSelectedSubject) {
      showToast("Silakan pilih Target Mata Pelajaran.", "warning");
      return;
    }
    if (previewData.length === 0) return;
    
    setIsImporting(true); setImportError(null);
    try {
      const payloadQuestions = previewData.map(({ _rawKunci, ...rest }) => rest);
      
      const response = await fetch('/api/admin/import/questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_id: importSelectedSubject, questions: payloadQuestions }),
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal mengunggah data');

      setImportSuccess(`Berhasil mengimpor ${result.count} soal.`);
      showToast(`Berhasil mengimpor ${result.count} soal!`, "success");
      setPreviewData([]); setImportFile(null);
      
      if (activeView === 'packages' || activeView === 'questions') {
         fetchQuestionsForSubject(importSelectedSubject);
      } else {
         fetchSubjects(); 
      }
      
    } catch (err: any) { 
      setImportError(err.message); 
      showToast(err.message, "error");
    } finally { setIsImporting(false); }
  };

  const getQuestionTypeLabel = (type: string) => {
    const types: Record<string, string> = { multiple_choice: 'Pilihan Ganda', complex_multiple_choice: 'PG Kompleks', true_false: 'Benar / Salah', matching: 'Menjodohkan', short_answer: 'Isian Singkat', essay: 'Esai / Uraian' };
    return types[type] || type;
  };

  const getTypeColorBadge = (type: string) => {
    switch(type) {
      case 'multiple_choice': return 'bg-blue-100 text-blue-700 border-blue-200'; case 'complex_multiple_choice': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'essay': return 'bg-purple-100 text-purple-700 border-purple-200'; case 'matching': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'true_false': return 'bg-rose-100 text-rose-700 border-rose-200'; case 'short_answer': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const uniquePackages = useMemo<string[]>(() => {
    const pkgs = questions.map(q => q.package_name || 'Paket 1');
    return Array.from(new Set(pkgs)).filter(p => p.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [questions, searchQuery]);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 max-w-7xl mx-auto text-slate-900 relative pb-24 md:pb-20">
      
      {/* TOAST NOTIFIKASI */}
      {toast && (
        <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[200] w-[90%] sm:w-auto animate-in slide-in-from-top-10 fade-in duration-300">
          <div className={`px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] shadow-2xl border flex items-center gap-2 md:gap-3 backdrop-blur-md ${
            toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
            toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 
            toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' :
            'bg-blue-50 border-blue-200 text-blue-700'
          }`}>
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 shrink-0 text-emerald-500" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 md:w-5 md:h-5 shrink-0 text-rose-500" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 shrink-0 text-amber-500" />}
            {toast.type === 'info' && <Info className="w-4 h-4 md:w-5 md:h-5 shrink-0 text-blue-500" />}
            <p className="font-bold text-xs md:text-sm tracking-wide leading-snug">{toast.message}</p>
          </div>
        </div>
      )}

      {/* CUSTOM DIALOG MODAL (TEMA LIGHT) */}
      {dialogConfig.isOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm md:max-w-md rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/50">
            <div className="p-6 md:p-8 flex flex-col items-center text-center">
               <div className={`w-16 h-16 md:w-20 md:h-20 rounded-xl md:rounded-[1.5rem] flex items-center justify-center mb-4 md:mb-6 shadow-inner border 
                  ${dialogConfig.type === 'confirm' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                    dialogConfig.type === 'success' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 
                    'bg-rose-50 text-rose-600 border-rose-100'}`}>
                  {dialogConfig.type === 'confirm' ? <HelpCircle className="w-8 h-8 md:w-10 md:h-10" /> : 
                   dialogConfig.type === 'success' ? <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10" /> :
                   <AlertTriangle className="w-8 h-8 md:w-10 md:h-10" />}
               </div>
               <h3 className="text-xl md:text-2xl font-black text-slate-800 mb-2 md:mb-3">{dialogConfig.title}</h3>
               <p className="text-slate-500 font-medium text-xs md:text-sm leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">{dialogConfig.message}</p>
            </div>
            <div className="p-3 md:p-4 bg-slate-50/80 border-t border-slate-100 flex gap-2 md:gap-3 justify-center">
               {dialogConfig.type === 'confirm' && (
                 <button onClick={() => { closeDialog(); if(dialogConfig.onCancel) dialogConfig.onCancel(); }} className="px-4 md:px-6 py-3 md:py-3.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors w-full shadow-sm text-xs md:text-sm">Batal</button>
               )}
               <button onClick={() => { closeDialog(); if(dialogConfig.onConfirm) dialogConfig.onConfirm(); }} className={`px-4 md:px-6 py-3 md:py-3.5 rounded-xl font-bold text-white transition-all shadow-md active:scale-95 w-full text-xs md:text-sm ${dialogConfig.type === 'alert' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : dialogConfig.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}>Mengerti</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW 1: DAFTAR MAPEL / FOLDER ================= */}
      {activeView === 'folders' && (
        <div className="space-y-4 md:space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 bg-white p-4 md:p-5 lg:p-6 lg:px-8 rounded-2xl md:rounded-[2rem] border border-blue-100 shadow-sm">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2 md:gap-3"><Database className="w-6 h-6 md:w-8 md:h-8 text-blue-600" /> Bank Soal</h1>
              <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium sm:ml-8 md:ml-11">Kelola kumpulan soal berdasarkan mata pelajaran dan kesulitan.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 md:gap-3 w-full sm:w-auto mt-2 sm:mt-0">
              <button onClick={openImportModal} className="flex items-center justify-center gap-1.5 md:gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-sm shadow-sm transition-colors w-full sm:w-auto"><FileUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" /> Import Massal</button>
              <button onClick={() => setIsSelectMapelModalOpen(true)} className="flex items-center justify-center gap-1.5 md:gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-sm shadow-md active:scale-95 transition-all w-full sm:w-auto"><Plus className="w-4 h-4 md:w-5 md:h-5" /> Buat Soal Baru</button>
            </div>
          </div>

          <div className="relative w-full max-w-xl">
            <Search className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
            <input type="text" placeholder="Cari berdasarkan nama mata pelajaran..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] pl-10 md:pl-12 pr-4 py-3 md:py-3.5 text-xs md:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all placeholder-slate-400" />
          </div>

          {globalLoading ? (
            <div className="py-16 md:py-20 flex justify-center"><LoaderCircle className="w-8 h-8 md:w-10 md:h-10 text-blue-500 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {subjects.filter(subj => subj.name.toLowerCase().includes(searchQuery.toLowerCase())).map((subject) => (
                <div key={subject.id} onClick={() => goToPackagesView(subject)} className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] p-4 sm:p-5 md:p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-blue-300 transition-all duration-300 cursor-pointer group flex flex-col justify-between relative overflow-hidden">
                  <div>
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-50 border border-blue-100 rounded-xl md:rounded-[1.2rem] flex items-center justify-center mb-4 md:mb-5 group-hover:scale-110 group-hover:bg-blue-600 transition-all duration-300 shadow-inner">
                       <FolderOpen className="w-6 h-6 md:w-7 md:h-7 text-blue-600 group-hover:text-white" />
                    </div>
                    <h3 className="font-black text-xl md:text-2xl text-slate-800 line-clamp-1 group-hover:text-blue-700 transition-colors" title={subject.name}>{subject.name}</h3>
                  </div>
                  <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-slate-100 flex flex-col gap-2 md:gap-2.5">
                    <div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-[9px] md:text-[10px] font-bold text-slate-500 uppercase">
                      {subject.grade_level && <span className="bg-indigo-50 text-indigo-600 px-2 md:px-2.5 py-0.5 md:py-1 rounded-md border border-indigo-100">{subject.grade_level}</span>}
                      <span className="bg-slate-50 px-2 md:px-2.5 py-0.5 md:py-1 rounded-md border border-slate-200 flex items-center gap-1 truncate max-w-[150px]"><Users className="w-3 h-3 text-amber-500 shrink-0" /> <span className="truncate">{subject.teacherNames}</span></span>
                    </div>
                  </div>
                </div>
              ))}
              {subjects.filter(subj => subj.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                 <div className="col-span-full py-8 md:py-10 text-center text-slate-400 font-bold text-sm">Mata Pelajaran tidak ditemukan. Silakan tambahkan di menu "Mata Pelajaran".</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= VIEW 1.5: DAFTAR PAKET SOAL DALAM MAPEL ================= */}
      {activeView === 'packages' && activeSubject && (
        <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <button onClick={goToFolders} className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-bold text-slate-500 hover:text-blue-600 bg-white border border-slate-200 px-4 md:px-5 py-2 md:py-2.5 rounded-lg md:rounded-xl transition-all shadow-sm w-fit">
            <ArrowLeft className="w-3.5 h-3.5 md:w-4 md:h-4" /> Kembali <span className="hidden sm:inline">ke Daftar Mapel</span>
          </button>

          {/* HEADER MAPEL */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 border border-blue-800 rounded-2xl md:rounded-[2.5rem] p-5 sm:p-6 md:p-8 lg:p-10 shadow-lg flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-6 text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 md:w-40 md:h-40 bg-white opacity-10 rounded-full blur-3xl"></div>

             <div className="flex items-start gap-3 md:gap-5 relative z-10 w-full lg:w-auto">
              <div className="p-3 md:p-4 bg-white/20 backdrop-blur-md rounded-xl md:rounded-2xl border border-white/20 shrink-0"><BookOpen className="w-6 h-6 md:w-8 md:h-8" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                  <span className="bg-blue-500/50 border border-blue-400/50 text-white text-[8px] md:text-[10px] font-black uppercase tracking-widest px-2 md:px-2.5 py-0.5 md:py-1 rounded-md md:rounded-lg whitespace-nowrap">
                    {activeSubject.grade_level || 'UMUM'}
                  </span>
                  <span className="bg-amber-500/50 border border-amber-400/50 text-white text-[8px] md:text-[10px] font-black uppercase tracking-widest px-2 md:px-2.5 py-0.5 md:py-1 rounded-md md:rounded-lg flex items-center gap-1 truncate max-w-[150px] sm:max-w-none">
                    <UserCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 shrink-0"/> <span className="truncate">{activeSubject.teacherNames || 'Guru Pengampu'}</span>
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight mb-1 truncate leading-tight">{activeSubject.name}</h1>
                <p className="text-xs md:text-sm font-medium text-blue-100 flex items-center gap-1 md:gap-1.5">
                  <Database className="w-3.5 h-3.5 md:w-4 md:h-4"/> Bank Soal
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2.5 md:gap-3 relative z-10 w-full lg:w-auto shrink-0 mt-2 lg:mt-0">
               <button onClick={openImportModal} className="flex items-center justify-center gap-1.5 md:gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm shadow-sm transition-all w-full sm:w-auto backdrop-blur-md">
                 <FileUp className="w-4 h-4 md:w-5 md:h-5" /> Import Excel
               </button>
               <button onClick={() => openCreateForm(activeSubject, 'Paket 1')} className="flex items-center justify-center gap-1.5 md:gap-2 bg-white text-blue-700 hover:bg-blue-50 px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm shadow-md active:scale-95 transition-all w-full sm:w-auto">
                 <Plus className="w-4 h-4 md:w-5 md:h-5" /> Buat Paket / Soal
               </button>
            </div>
          </div>

          {/* DAFTAR PAKET (LIST STYLE) */}
          {globalLoading ? (
            <div className="py-16 md:py-20 flex justify-center"><LoaderCircle className="w-8 h-8 md:w-10 md:h-10 text-blue-500 animate-spin" /></div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 md:px-8 py-4 md:py-6 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="font-black text-slate-800 text-lg md:text-xl flex items-center gap-2"><Layers className="w-5 h-5 md:w-6 md:h-6 text-blue-500"/> Daftar Paket Soal</h2>
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white border border-slate-200 px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg shadow-sm w-fit">{uniquePackages.length} Paket Ditemukan</span>
              </div>

              <div className="p-4 sm:p-5 md:p-6 flex flex-col gap-3 md:gap-4 bg-slate-50/30">
                {uniquePackages.length === 0 ? (
                  <div onClick={() => openCreateForm(activeSubject, 'Paket 1')} className="border-2 border-dashed border-slate-300 rounded-2xl md:rounded-[1.5rem] p-8 md:p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all bg-white group">
                    <Package className="w-10 h-10 md:w-12 md:h-12 text-slate-300 mb-2 md:mb-3 group-hover:scale-110 transition-transform duration-300" />
                    <p className="font-black text-slate-600 text-lg md:text-xl">Belum ada paket soal</p>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mt-1">Klik di sini untuk mulai menyusun Paket 1</p>
                  </div>
                ) : (
                  uniquePackages.map(pkg => (
                    <div key={pkg} onClick={() => goToQuestionsView(pkg)} className="group flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white border border-slate-200 p-4 md:p-5 rounded-xl md:rounded-[1.5rem] hover:border-blue-400 hover:shadow-md hover:bg-blue-50/30 transition-all cursor-pointer gap-3 md:gap-4">
                      <div className="flex items-center gap-3 md:gap-5 w-full sm:w-auto min-w-0">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-50 border border-slate-100 group-hover:bg-blue-100 rounded-xl flex items-center justify-center transition-colors shrink-0 shadow-inner">
                          <Package className="w-6 h-6 md:w-7 md:h-7 text-slate-400 group-hover:text-blue-600 transition-colors" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-black text-slate-800 text-lg md:text-xl group-hover:text-blue-700 transition-colors truncate">{pkg}</h3>
                          <div className="flex items-center gap-2 mt-0.5 md:mt-1">
                             <span className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                               <FileText className="w-3 h-3"/> Terdiri dari
                             </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-3 md:gap-4 w-full sm:w-auto border-t border-slate-100 sm:border-0 pt-3 sm:pt-0">
                        <div className="flex items-center gap-1.5 text-[11px] md:text-xs font-black text-blue-600 bg-blue-50 px-2.5 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg border border-blue-100">
                          <LayoutList className="w-3.5 h-3.5 md:w-4 md:h-4" /> {questions.filter(q => (q.package_name || 'Paket 1') === pkg).length} Soal
                        </div>
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-50 border border-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors shrink-0">
                          <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-slate-400 group-hover:text-blue-600" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= VIEW 2: DAFTAR SOAL DALAM PAKET TERTENTU ================= */}
      {activeView === 'questions' && activeSubject && activePackage && (
        <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <button onClick={() => { setActiveView('packages'); setSearchQuery(''); }} className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-bold text-slate-500 hover:text-cyan-600 bg-white border border-slate-200 hover:border-cyan-200 px-4 md:px-5 py-2 md:py-2.5 rounded-lg md:rounded-xl transition-colors shadow-sm w-fit"><ArrowLeft className="w-3.5 h-3.5 md:w-4 md:h-4" /> Kembali <span className="hidden sm:inline">ke Daftar Paket</span></button>

          <div className="bg-gradient-to-br from-cyan-600 to-blue-700 border border-cyan-800 rounded-2xl md:rounded-[2.5rem] p-5 sm:p-6 md:p-8 lg:p-10 shadow-lg flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 md:w-40 md:h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
            
            <div className="flex items-center gap-3 md:gap-5 relative z-10 min-w-0">
              <div className="p-3 md:p-4 bg-white/20 backdrop-blur-md rounded-xl md:rounded-2xl border border-white/20 shrink-0"><Package className="w-6 h-6 md:w-8 md:h-8" /></div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight truncate leading-tight mb-1">{activePackage}</h1>
                <div className="flex flex-wrap gap-2 mt-1 md:mt-2 text-xs md:text-sm font-bold text-cyan-100">
                  <span className="bg-white/20 px-2 md:px-3 py-0.5 md:py-1 rounded-md md:rounded-lg border border-white/10 flex items-center gap-1.5 truncate max-w-[200px] sm:max-w-none"><BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> <span className="truncate">{activeSubject.name}</span></span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 md:gap-4 relative z-10 w-full lg:w-auto mt-2 lg:mt-0">
               <div className="flex-1 lg:w-32 text-center bg-white/10 backdrop-blur-md rounded-xl md:rounded-2xl p-3 md:p-4 border border-white/20 shadow-sm flex flex-col justify-center items-center">
                 <p className="text-2xl md:text-3xl font-black text-white leading-none">{questions.filter(q => (q.package_name || 'Paket 1') === activePackage).length}</p>
                 <p className="text-[9px] md:text-[10px] font-bold text-cyan-100 uppercase tracking-widest mt-1 md:mt-1.5 leading-none">Total Soal</p>
               </div>
               
               <div className="flex-1 lg:w-32 text-center bg-white/10 backdrop-blur-md rounded-xl md:rounded-2xl p-3 md:p-4 border border-white/20 shadow-sm flex flex-col justify-center items-center relative">
                 <p className="text-2xl md:text-3xl font-black text-white leading-none">
                    {questions.filter(q => (q.package_name || 'Paket 1') === activePackage).reduce((s, q) => s + (Number(q.points)||0), 0)}
                 </p>
                 <p className="text-[9px] md:text-[10px] font-bold text-cyan-100 uppercase tracking-widest mt-1 md:mt-1.5 flex items-center justify-center gap-1 leading-none">
                    <Award className="w-2.5 h-2.5 md:w-3 md:h-3 text-amber-300" /> Poin Maks
                 </p>
                 {questions.some(q => q.question_type === 'essay' && (q.package_name || 'Paket 1') === activePackage) && (
                    <span className="absolute -bottom-2 md:-bottom-3 whitespace-nowrap text-[8px] md:text-[9px] text-amber-100 font-bold bg-amber-600 border border-amber-500 px-1.5 md:px-2 py-0.5 rounded shadow-md z-20">
                       *Trmsk Esai
                    </span>
                 )}
               </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-3 md:gap-4">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
              <input type="text" placeholder={`Cari soal di ${activePackage}...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl md:rounded-[1.5rem] pl-10 md:pl-12 pr-4 py-3 md:py-3.5 text-xs md:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-sm transition-all placeholder-slate-400" />
            </div>
            <button onClick={() => openCreateForm(activeSubject, activePackage)} className="flex items-center justify-center gap-1.5 md:gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] font-bold text-xs md:text-sm shadow-md active:scale-95 transition-all shrink-0 w-full sm:w-auto"><Plus className="w-4 h-4 md:w-5 md:h-5" /> Tambah Soal Manual</button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] shadow-sm overflow-hidden z-0">
            <div className="overflow-x-auto custom-scrollbar">
              {/* Gunakan class hidden md:table untuk menyembunyikan table asli di layar kecil */}
              <table className="w-full text-sm text-left hidden md:table">
                <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr><th className="px-6 lg:px-8 py-4 md:py-5 w-12 text-center">No</th><th className="px-6 lg:px-8 py-4 md:py-5">Pertanyaan</th><th className="px-6 lg:px-8 py-4 md:py-5 text-center">Tipe</th><th className="px-6 lg:px-8 py-4 md:py-5 text-center">Bobot</th><th className="px-6 lg:px-8 py-4 md:py-5 text-center">Status</th><th className="px-6 lg:px-8 py-4 md:py-5 text-right">Aksi</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {globalLoading ? (
                    <tr><td colSpan={6} className="text-center py-20 md:py-24"><LoaderCircle className="w-8 h-8 md:w-10 md:h-10 text-cyan-500 animate-spin mx-auto mb-3" /><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] md:text-xs">Memuat butir soal...</p></td></tr>
                  ) : questions.filter(q => (q.package_name || 'Paket 1') === activePackage).length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-20 md:py-24 px-4"><div className="bg-slate-50 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4 border border-slate-200"><AlertCircle className="w-8 h-8 md:w-10 md:h-10 text-slate-400" /></div><p className="text-slate-700 font-bold text-lg md:text-xl mb-1">Belum ada soal</p><p className="text-slate-500 font-medium text-xs md:text-sm">Klik tombol "Tambah Soal Manual" untuk menyusun paket ini.</p></td></tr>
                  ) : (
                    questions
                      .filter(q => (q.package_name || 'Paket 1') === activePackage)
                      .filter(q => q.question_text.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((q, index) => (
                      <tr key={q.id} className="hover:bg-cyan-50/30 transition-colors group">
                        <td className="px-6 lg:px-8 py-4 md:py-5 text-center font-black text-slate-400">{index + 1}</td>
                        <td className="px-6 lg:px-8 py-4 md:py-5"><div className="text-slate-800 font-medium line-clamp-2 prose prose-sm max-w-none break-words" dangerouslySetInnerHTML={{ __html: q.question_text }} /></td>
                        <td className="px-6 lg:px-8 py-4 md:py-5 text-center"><span className={`border px-2 md:px-2.5 py-1 rounded-md text-[9px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${getTypeColorBadge(q.question_type)}`}>{getQuestionTypeLabel(q.question_type)}</span></td>
                        <td className="px-6 lg:px-8 py-4 md:py-5 text-center"><span className="font-black text-slate-700 whitespace-nowrap">{q.points} Poin</span></td>
                        <td className="px-6 lg:px-8 py-4 md:py-5 text-center">{q.is_active ? <span className="inline-flex items-center gap-1 md:gap-1.5 text-emerald-600 text-[9px] md:text-[10px] font-black uppercase tracking-widest bg-emerald-50 px-2 md:px-2.5 py-1 rounded-md md:rounded-lg border border-emerald-100 whitespace-nowrap"><CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5" /> Aktif</span> : <span className="inline-flex items-center gap-1 md:gap-1.5 text-slate-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest bg-slate-100 px-2 md:px-2.5 py-1 rounded-md md:rounded-lg border border-slate-200 whitespace-nowrap"><AlertCircle className="w-3 h-3 md:w-3.5 md:h-3.5" /> Draft</span>}</td>
                        <td className="px-6 lg:px-8 py-4 md:py-5 text-right">
                          <div className="flex items-center justify-end gap-1.5 md:gap-2 transition-opacity">
                            <button onClick={() => openEditForm(q)} className="flex items-center justify-center p-2 md:p-2.5 bg-white text-slate-400 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 hover:border-blue-200 rounded-full transition-all shadow-sm shrink-0" title="Edit Soal"><Edit3 className="w-3.5 h-3.5 md:w-4 md:h-4" /></button>
                            <button onClick={() => handleQuestionDelete(q.id)} className="flex items-center justify-center p-2 md:p-2.5 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-full transition-all shadow-sm shrink-0" title="Hapus Soal"><Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* CARD VIEW UNTUK MOBILE */}
              <div className="md:hidden flex flex-col divide-y divide-slate-100">
                 {globalLoading ? (
                    <div className="text-center py-16 px-4">
                       <LoaderCircle className="w-8 h-8 text-cyan-500 animate-spin mx-auto mb-3" />
                       <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Memuat butir soal...</p>
                    </div>
                 ) : questions.filter(q => (q.package_name || 'Paket 1') === activePackage).length === 0 ? (
                    <div className="text-center py-16 px-4">
                       <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-200"><AlertCircle className="w-8 h-8 text-slate-400" /></div>
                       <p className="text-slate-700 font-bold text-lg mb-1">Belum ada soal</p>
                       <p className="text-slate-500 font-medium text-xs">Klik tombol "Tambah Soal Manual" untuk menyusun paket ini.</p>
                    </div>
                 ) : (
                    questions
                      .filter(q => (q.package_name || 'Paket 1') === activePackage)
                      .filter(q => q.question_text.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((q, index) => (
                         <div key={q.id} className="p-4 hover:bg-cyan-50/30 transition-colors flex flex-col gap-3">
                            <div className="flex items-start gap-3">
                               <span className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200 text-slate-500 font-black text-xs flex items-center justify-center shrink-0">{index + 1}</span>
                               <div className="min-w-0 flex-1">
                                  <div className="text-slate-800 font-medium line-clamp-3 prose prose-sm max-w-none break-words text-sm leading-snug" dangerouslySetInnerHTML={{ __html: q.question_text }} />
                               </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2 mt-1 pl-9">
                               <span className={`border px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${getTypeColorBadge(q.question_type)}`}>{getQuestionTypeLabel(q.question_type)}</span>
                               <span className="font-black text-slate-600 text-[10px] whitespace-nowrap bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{q.points} Poin</span>
                               {q.is_active ? <span className="inline-flex items-center gap-1 text-emerald-600 text-[8px] font-black uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 whitespace-nowrap"><CheckCircle2 className="w-3 h-3" /> Aktif</span> : <span className="inline-flex items-center gap-1 text-slate-500 text-[8px] font-black uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap"><AlertCircle className="w-3 h-3" /> Draft</span>}
                            </div>

                            <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-slate-100/60">
                              <button onClick={() => openEditForm(q)} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-slate-500 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 hover:border-blue-200 rounded-lg transition-all shadow-sm text-[10px] font-bold uppercase tracking-widest"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
                              <button onClick={() => handleQuestionDelete(q.id)} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-rose-500 hover:bg-rose-50 hover:text-rose-600 border border-rose-200 hover:border-rose-300 rounded-lg transition-all shadow-sm text-[10px] font-bold uppercase tracking-widest"><Trash2 className="w-3.5 h-3.5" /> Hapus</button>
                            </div>
                         </div>
                      ))
                 )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW 4: MODAL FULLSCREEN (CREATE / EDIT FORM) ================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-screen p-2 sm:p-4 md:p-8 flex items-center justify-center">
            <div className="bg-white w-[95%] md:w-full max-w-6xl rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[95vh] my-auto border border-slate-200">
              
              {/* HEADER FORM */}
              <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 shrink-0 z-10 sticky top-0">
                <div>
                  <button onClick={() => setIsFormModalOpen(false)} className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2 transition-colors"><ArrowLeft className="w-3.5 h-3.5 md:w-4 md:h-4"/> Batal & Tutup</button>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2 md:gap-3 leading-tight">
                     {editingId ? <Edit3 className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-blue-600"/> : <Plus className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-blue-600"/>}
                     {editingId ? 'Edit Soal HOTS' : 'Menyusun Soal HOTS'}
                  </h1>
                </div>
                <div className="flex gap-2.5 md:gap-3 self-end md:self-auto w-full md:w-auto mt-2 md:mt-0">
                   <button onClick={() => setIsFormModalOpen(false)} className="flex items-center justify-center p-3 sm:p-3.5 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-500 text-slate-400 rounded-xl md:rounded-full transition-all shadow-sm shrink-0"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
                   <button onClick={handleFormSubmit} disabled={isSubmittingForm} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 md:px-8 py-3 sm:py-3.5 rounded-xl md:rounded-2xl font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-70 transition-all text-xs md:text-sm">
                     {isSubmittingForm ? <LoaderCircle className="animate-spin w-4 h-4 md:w-5 md:h-5" /> : <Save className="w-4 h-4 md:w-5 md:h-5"/>} <span className="hidden sm:inline">Simpan ke Database</span><span className="sm:hidden">Simpan</span>
                   </button>
                </div>
              </div>

              {/* AREA KONTEN FORM */}
              <div className="p-4 sm:p-6 md:p-8 overflow-y-auto bg-slate-50/50 flex-1 custom-scrollbar">
                {formError && <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 md:p-5 rounded-xl md:rounded-2xl mb-4 md:mb-6 font-bold flex items-start gap-2.5 md:gap-3 shadow-sm text-xs md:text-sm"><AlertCircle className="w-4 h-4 md:w-5 md:h-5 shrink-0 mt-0.5"/>{formError}</div>}

                <form className="space-y-4 md:space-y-6 pb-20">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                    <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] p-4 sm:p-6 md:p-8 shadow-sm space-y-4 md:space-y-5 h-fit">
                      
                      <div className="p-4 md:p-5 bg-cyan-50/50 border border-cyan-100 rounded-xl md:rounded-2xl mb-4 md:mb-6 shadow-sm">
                        <label className="text-[10px] md:text-xs font-black text-cyan-700 uppercase tracking-widest flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2"><Package className="w-3.5 h-3.5 md:w-4 md:h-4" /> Grup Paket Soal</label>
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-500 mb-2 md:mb-3 leading-tight">Gunakan nama yang sama untuk menggabungkan soal dalam 1 paket (Contoh: "Paket A").</p>
                        <input 
                          type="text" 
                          name="package_name" 
                          value={formData.package_name} 
                          onChange={handleFormChange} 
                          placeholder="Paket 1" 
                          className="w-full bg-white border border-cyan-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-bold text-cyan-800 outline-none focus:ring-2 focus:ring-cyan-500 transition-all shadow-sm"
                        />
                      </div>

                      <div className="space-y-1.5 md:space-y-2">
                         <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block">Tipe Soal *</label>
                         <select disabled={!!editingId} name="question_type" value={formData.question_type} onChange={handleFormChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl p-2.5 md:p-3 text-xs md:text-sm font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer disabled:opacity-60 shadow-sm">
                           <option value="multiple_choice">Pilihan Ganda Tunggal</option><option value="complex_multiple_choice">PG Kompleks (Banyak Jawaban)</option>
                           <option value="matching">Menjodohkan (Matching)</option><option value="true_false">Benar / Salah</option>
                           <option value="short_answer">Isian Singkat</option><option value="essay">Esai / Uraian</option>
                         </select>
                      </div>
                      
                      <div className="space-y-1.5 md:space-y-2">
                         <label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest mt-2 md:mt-4 block">Tag Materi Pelajaran</label>
                         <input type="text" name="subject" value={formData.subject} onChange={handleFormChange} placeholder="Ketik topik materi di sini..." className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl p-2.5 md:p-3 text-xs md:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 shadow-sm" />
                      </div>

                      {/* --- FITUR BARU: IZIN MEDIA UNTUK ESAI --- */}
                      {formData.question_type === 'essay' && (
                         <div className="mt-3 md:mt-4 p-3 md:p-4 bg-blue-50/50 border border-blue-200 rounded-xl md:rounded-2xl shadow-sm">
                            <label className="flex items-center gap-3 md:gap-4 cursor-pointer">
                               <input 
                                  type="checkbox" 
                                  checked={formData.allow_media_upload || false} 
                                  onChange={(e) => setFormData({ ...formData, allow_media_upload: e.target.checked })}
                                  className="w-4 h-4 md:w-5 md:h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shadow-sm shrink-0"
                               />
                               <div>
                                  <span className="font-black text-xs md:text-sm text-blue-900 block mb-0.5 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 md:w-4 md:h-4"/> Izinkan Media/Link Jawaban</span>
                                  <span className="text-[9px] md:text-[10px] font-bold text-blue-700/80 leading-tight block">Bila dicentang, siswa dapat mengunggah gambar atau menautkan link di editor jawaban mereka.</span>
                               </div>
                            </label>
                         </div>
                      )}
                    </div>
                    
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] p-4 sm:p-6 md:p-8 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 h-fit">
                       <div className="space-y-1.5 md:space-y-2"><label className="text-[10px] md:text-xs font-black text-slate-500 flex items-center gap-1.5 md:gap-2 uppercase tracking-widest"><ImageIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500"/> URL Gambar Utama</label><input type="url" name="image_url" value={formData.image_url} onChange={handleFormChange} placeholder="Masukkan link/URL gambar (Opsional)..." className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl p-2.5 md:p-3 text-xs md:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 shadow-sm" /></div>
                       <div className="space-y-1.5 md:space-y-2"><label className="text-[10px] md:text-xs font-black text-slate-500 flex items-center gap-1.5 md:gap-2 uppercase tracking-widest"><Video className="w-3.5 h-3.5 md:w-4 md:h-4 text-rose-500"/> URL Video Utama</label><input type="url" name="video_url" value={formData.video_url} onChange={handleFormChange} placeholder="Masukkan link/URL video MP4 (Opsional)..." className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl p-2.5 md:p-3 text-xs md:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 shadow-sm" /></div>
                       
                       <div className="space-y-1.5 md:space-y-2 col-span-1 sm:col-span-2 md:col-span-1">
                          <label className="text-[10px] md:text-xs font-black text-slate-500 flex items-center gap-1.5 md:gap-2 uppercase tracking-widest"><Headphones className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-500"/> URL Audio Utama</label>
                          <div className="flex gap-2">
                             <input type="url" name="audio_url" value={formData.audio_url} onChange={handleFormChange} placeholder="Masukkan link/URL audio MP3..." className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl p-2.5 md:p-3 text-xs md:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 shadow-sm" />
                             <label className={`shrink-0 flex items-center justify-center px-3 md:px-4 rounded-lg md:rounded-xl cursor-pointer transition-all shadow-sm ${isUploadingMedia ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-100'}`} title="Upload Audio Langsung ke Supabase">
                                {isUploadingMedia ? <LoaderCircle className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <UploadCloud className="w-4 h-4 md:w-5 md:h-5" />}
                                <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleDirectMediaUpload(e, 'audio_url')} disabled={isUploadingMedia} />
                             </label>
                          </div>
                       </div>
                       <div className="space-y-1.5 md:space-y-2"><label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block">Limit Putar Audio</label><input type="number" name="audio_play_limit" value={formData.audio_play_limit} onChange={handleFormChange} placeholder="0 = Putar Tak Terbatas" className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl p-2.5 md:p-3 text-xs md:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 shadow-sm" /></div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] p-4 sm:p-6 md:p-10 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 md:mb-6 pb-4 md:pb-6 border-b border-slate-100">
                      <h2 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2"><FileText className="text-blue-500 w-5 h-5 md:w-6 md:h-6"/> Teks Pertanyaan Utama</h2>
                      <button type="button" onClick={() => setShowMathGuide(!showMathGuide)} className="text-[10px] md:text-xs font-black uppercase tracking-widest bg-amber-50 text-amber-600 px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl flex items-center justify-center gap-1.5 md:gap-2 border border-amber-200 hover:bg-amber-100 transition-colors shadow-sm w-full sm:w-auto"><Calculator className="w-3.5 h-3.5 md:w-4 md:h-4"/> Bantuan Simbol</button>
                    </div>
                    {showMathGuide && (
                      <div className="mb-4 md:mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5 p-4 md:p-6 bg-amber-50/50 rounded-xl md:rounded-[1.5rem] border border-amber-200 animate-in slide-in-from-top-2">
                        {[{ group: 'Matematika Dasar', items: [{ label: 'Pecahan', code: '\\frac{a}{b}' }, { label: 'Pangkat', code: 'x^2' }, { label: 'Akar', code: '\\sqrt{x}' }]}, { group: 'Fisika & Kalkulus', items: [{ label: 'Derajat (°)', code: '^\\circ' }, { label: 'Delta', code: '\\Delta' }, { label: 'Vektor', code: '\\vec{v}' }]}, { group: 'Kimia Reaksi', items: [{ label: 'Rumus Senyawa', code: '\\ce{H2O}' }, { label: 'Panah Reaksi', code: '\\ce{->}' }, { label: 'Isotop/Massa', code: '\\ce{^{227}_{90}Th}' }]}].map(g => (
                          <div key={g.group}>
                            <p className="text-[9px] md:text-[10px] font-black text-amber-700 uppercase mb-2 md:mb-3 tracking-widest flex items-center gap-1.5 md:gap-2"><div className="w-1 h-1 bg-amber-400 rounded-full"></div>{g.group}</p>
                            <div className="flex flex-col gap-1.5 md:gap-2">
                              {g.items.map(i => <button key={i.label} type="button" onClick={() => copyToClipboard(i.code)} className="text-[10px] md:text-xs bg-white border border-amber-200 p-2 md:p-2.5 rounded-lg md:rounded-xl hover:bg-amber-100 font-bold text-left flex justify-between items-center transition-colors shadow-sm"><span>{i.label}</span> {copiedSnippet === i.code ? <span className="text-[9px] md:text-[10px] font-black text-emerald-600 flex items-center gap-1"><Check className="w-2.5 h-2.5 md:w-3 md:h-3"/> Disalin</span> : <code className="text-slate-500 font-mono bg-slate-50 px-1 md:px-1.5 py-0.5 rounded border border-slate-100">{i.code}</code>}</button>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="bg-white rounded-xl md:rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                      <OptimizedQuillEditor modules={quillModulesFull} value={formData.question_text} onChange={handleQuillChange} placeholder="Ketik teks pertanyaan atau sisipkan rumus/media di sini..." className="h-48 md:h-72 mb-10 md:mb-12 text-slate-900" />
                    </div>
                  </div>

                  {/* BAGIAN BAWAH: RESPONS / OPSI JAWABAN */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 flex-col-reverse lg:flex-row">
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] p-4 sm:p-6 md:p-8 shadow-sm">
                      <h2 className="text-lg md:text-xl font-black text-slate-800 mb-4 md:mb-6 flex items-center gap-2"><Sparkles className="text-amber-500 w-5 h-5 md:w-6 md:h-6"/> Respons & Jawaban</h2>

                      {/* FORMAT MENJODOHKAN */}
                      {formData.question_type === 'matching' && (
                        <div className="space-y-4 md:space-y-6">
                          <div className="bg-blue-50/50 p-4 md:p-5 rounded-xl md:rounded-2xl border border-blue-100 shadow-sm flex items-start gap-3 md:gap-4">
                             <Info className="w-5 h-5 md:w-6 md:h-6 text-blue-500 shrink-0 mt-0.5" />
                             <div>
                               <p className="text-xs md:text-sm font-bold text-blue-900">Format Menjodohkan Tingkat Lanjut</p>
                               <p className="text-[10px] md:text-xs text-blue-800/80 mt-1 font-medium leading-relaxed">Anda dapat menambahkan Premis dan Respons menggunakan Editor Teks penuh. Anda juga bisa membuat jumlah Respons Kanan lebih banyak sebagai Opsi Pengecoh.</p>
                             </div>
                          </div>

                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8 relative z-10">
                            
                            {/* KOLOM PREMIS KIRI */}
                            <div className="space-y-3 md:space-y-4">
                               <h3 className="font-black text-blue-600 uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-1.5 md:gap-2 mb-3 md:mb-4"><LayoutList className="w-3.5 h-3.5 md:w-4 md:h-4"/> Daftar Premis (Kiri)</h3>
                               {matchingPremises.map((p, idx) => (
                                  <div key={p.id} className="bg-slate-50 border border-blue-200 rounded-xl md:rounded-[1.5rem] p-3 sm:p-4 md:p-5 shadow-sm flex flex-col sm:flex-row items-start gap-3 md:gap-4 transition-all">
                                     <div className="flex sm:flex-col items-center gap-2 md:gap-3 mt-0 sm:mt-1 shrink-0 w-full sm:w-auto justify-between sm:justify-start">
                                         <div className="w-6 h-6 md:w-8 md:h-8 bg-blue-600 text-white font-black rounded-lg md:rounded-xl flex items-center justify-center text-xs md:text-sm shadow-md">{idx + 1}</div>
                                         {matchingPremises.length > 1 && (
                                            <button type="button" onClick={() => {
                                               setMatchingPremises(prev => prev.filter(x => x.id !== p.id));
                                               setMatchingKeys(prev => { const n = {...prev}; delete n[p.id]; return n; });
                                            }} className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 md:p-2 rounded-lg transition-colors border border-transparent hover:border-rose-100" title="Hapus Premis"><Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4"/></button>
                                         )}
                                     </div>
                                     <div className="flex-1 w-full overflow-hidden bg-white rounded-lg md:rounded-xl border border-slate-200">
                                        <OptimizedQuillEditor modules={quillModulesFull} value={p.text} onChange={(val:string) => {
                                           setMatchingPremises(prev => prev.map(x => x.id === p.id ? {...x, text: val} : x));
                                        }} placeholder={`Ketik premis ke-${idx+1}...`} className="h-24 md:h-32 mb-10 md:mb-12 text-xs md:text-sm" />
                                     </div>
                                  </div>
                               ))}
                               <button type="button" onClick={() => setMatchingPremises(prev => [...prev, {id: `p${Date.now()}`, text: ''}])} className="w-full py-3 md:py-4 bg-white text-blue-600 font-bold text-xs md:text-sm rounded-xl border-2 border-blue-200 border-dashed hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"><Plus className="w-4 h-4 md:w-5 md:h-5"/> Tambah Premis Kiri</button>
                            </div>

                            {/* KOLOM RESPONS KANAN (BISA JADI PENGECOH) */}
                            <div className="space-y-3 md:space-y-4">
                               <h3 className="font-black text-amber-600 uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-1.5 md:gap-2 mb-3 md:mb-4"><LayoutList className="w-3.5 h-3.5 md:w-4 md:h-4"/> Daftar Respons (Kanan)</h3>
                               {matchingResponses.map((r, idx) => (
                                  <div key={r.id} className="bg-slate-50 border border-amber-200 rounded-xl md:rounded-[1.5rem] p-3 sm:p-4 md:p-5 shadow-sm flex flex-col sm:flex-row items-start gap-3 md:gap-4 transition-all">
                                     <div className="flex sm:flex-col items-center gap-2 md:gap-3 mt-0 sm:mt-1 shrink-0 w-full sm:w-auto justify-between sm:justify-start">
                                         <div className="w-6 h-6 md:w-8 md:h-8 bg-amber-500 text-white font-black rounded-lg md:rounded-xl flex items-center justify-center text-xs md:text-sm shadow-md">{String.fromCharCode(65 + idx)}</div>
                                         {matchingResponses.length > 1 && (
                                            <button type="button" onClick={() => {
                                               setMatchingResponses(prev => prev.filter(x => x.id !== r.id));
                                               setMatchingKeys(prev => { 
                                                   const n = {...prev}; 
                                                   Object.keys(n).forEach(k => { if(n[k] === r.id) delete n[k]; }); 
                                                   return n; 
                                               });
                                            }} className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 md:p-2 rounded-lg transition-colors border border-transparent hover:border-rose-100" title="Hapus Respons"><Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4"/></button>
                                         )}
                                     </div>
                                     <div className="flex-1 w-full overflow-hidden bg-white rounded-lg md:rounded-xl border border-slate-200">
                                        <OptimizedQuillEditor modules={quillModulesFull} value={r.text} onChange={(val:string) => {
                                           setMatchingResponses(prev => prev.map(x => x.id === r.id ? {...x, text: val} : x));
                                        }} placeholder={`Ketik respons ke-${String.fromCharCode(65 + idx)}...`} className="h-24 md:h-32 mb-10 md:mb-12 text-xs md:text-sm" />
                                     </div>
                                  </div>
                               ))}
                               <button type="button" onClick={() => setMatchingResponses(prev => [...prev, {id: `r${Date.now()}`, text: ''}])} className="w-full py-3 md:py-4 bg-white text-amber-600 font-bold text-xs md:text-sm rounded-xl border-2 border-amber-200 border-dashed hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"><Plus className="w-4 h-4 md:w-5 md:h-5"/> Tambah Respons Pengecoh</button>
                            </div>

                          </div>
                        </div>
                      )}

                      {(formData.question_type === 'multiple_choice' || formData.question_type === 'complex_multiple_choice') && (
                        <div className="space-y-4 md:space-y-5">
                          {options.map((item, index) => (
                            <div key={item.key} className={`flex flex-col p-3 sm:p-4 md:p-5 rounded-xl md:rounded-[1.5rem] border shadow-sm transition-all gap-3 md:gap-4 ${formData.question_type === 'complex_multiple_choice' && complexAnswers.includes(item.key) ? 'bg-emerald-50/30 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                              <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4">
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    {formData.question_type === 'complex_multiple_choice' && (
                                       <div>
                                         <input type="checkbox" checked={complexAnswers.includes(item.key)} onChange={() => handleComplexAnswerToggle(item.key)} className="w-5 h-5 md:w-6 md:h-6 rounded border-slate-300 text-emerald-500 cursor-pointer focus:ring-emerald-500 shadow-sm" title="Tandai sebagai jawaban benar" />
                                       </div>
                                    )}
                                    <div className={`w-8 h-8 md:w-12 md:h-12 shrink-0 font-black text-sm md:text-lg rounded-lg md:rounded-2xl flex items-center justify-center shadow-inner border ${formData.question_type === 'complex_multiple_choice' && complexAnswers.includes(item.key) ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200'}`}>{item.key}</div>
                                    
                                    {/* Tombol Hapus Opsi di HP pindah ke atas dekat huruf */}
                                    {options.length > 2 && <button type="button" onClick={() => removeOption(index)} className="ml-auto sm:hidden p-1.5 bg-white border border-rose-100 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Hapus Opsi"><Trash2 className="w-4 h-4"/></button>}
                                </div>
                                <div className="flex-1 w-full bg-white rounded-lg md:rounded-[1.2rem] border border-slate-200 overflow-hidden flex gap-2 shadow-sm">
                                  <div className="flex-1 min-w-0"><OptimizedQuillEditor modules={quillModulesFull} value={item.text} onChange={(content: string) => handleOptionChange(index, 'text', content)} placeholder={`Ketik teks opsi jawaban ${item.key} di sini...`} className="h-24 md:h-32 mb-10 md:mb-12 text-slate-900 text-xs md:text-sm" /></div>
                                  
                                  {/* Tombol Hapus Opsi di Desktop tetap di samping Editor */}
                                  {options.length > 2 && <button type="button" onClick={() => removeOption(index)} className="hidden sm:block mt-2 mr-2 p-2 h-fit text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Hapus Opsi"><MinusCircle className="w-4 h-4 md:w-5 md:h-5"/></button>}
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between mt-1 md:mt-2 pt-3 md:pt-4 border-t border-slate-200/60">
                                 <button type="button" onClick={() => handleOptionChange(index, 'showMedia', !item.showMedia)} className={`flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl transition-all shadow-sm ${item.showMedia ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}><LayoutTemplate className="w-3.5 h-3.5 md:w-4 md:h-4"/> Lampirkan Media Tambahan</button>
                              </div>
                              
                              {item.showMedia && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 p-3 md:p-5 bg-white border border-slate-200 rounded-lg md:rounded-[1.2rem] mt-1 md:mt-2 animate-in fade-in slide-in-from-top-2">
                                  <div>
                                     <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 md:mb-2 block">URL Gambar Opsi</label>
                                     <input type="url" value={item.image_url} onChange={(e) => handleOptionChange(index, 'image_url', e.target.value)} placeholder="Masukkan link/URL gambar..." className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl p-2.5 md:p-3 text-xs md:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" />
                                  </div>
                                  <div>
                                     <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 md:mb-2 block">URL Audio Opsi</label>
                                     <div className="flex gap-2">
                                        <input type="url" value={item.audio_url} onChange={(e) => handleOptionChange(index, 'audio_url', e.target.value)} placeholder="Masukkan link/URL audio..." className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl p-2.5 md:p-3 text-xs md:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" />
                                        <label className={`shrink-0 flex items-center justify-center px-3 md:px-3.5 rounded-lg md:rounded-xl cursor-pointer transition-all shadow-sm ${isUploadingMedia ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-100'}`} title="Upload Audio Opsi">
                                           {isUploadingMedia ? <LoaderCircle className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <UploadCloud className="w-4 h-4 md:w-5 md:h-5" />}
                                           <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleDirectMediaUpload(e, 'audio_url', index)} disabled={isUploadingMedia} />
                                        </label>
                                     </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          <button type="button" onClick={addOption} className="mt-4 md:mt-6 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-bold text-slate-500 bg-slate-50 px-4 py-3 md:py-4 rounded-xl md:rounded-2xl border-2 border-dashed border-slate-300 w-full justify-center hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all"><Plus className="w-4 h-4 md:w-5 md:h-5"/> Tambah Opsi Baru</button>
                        </div>
                      )}

                      {formData.question_type === 'short_answer' && (
                        <div className="space-y-2 md:space-y-3"><label className="text-xs md:text-sm font-bold text-slate-700">Kunci Jawaban Eksak *</label><input type="text" required name="correct_answer" value={formData.correct_answer} onChange={handleFormChange} placeholder="Ketik teks jawaban eksak yang benar di sini..." className="w-full p-4 md:p-5 bg-emerald-50 border-2 border-emerald-200 rounded-xl md:rounded-[1.2rem] text-emerald-900 font-black outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all shadow-sm text-base md:text-lg" /></div>
                      )}

                      {(formData.question_type === 'true_false' || formData.question_type === 'essay') && (
                        <div className="p-6 md:p-10 bg-slate-50 border border-slate-200 rounded-2xl md:rounded-[2rem] text-center text-slate-500 font-bold shadow-inner">
                           {formData.question_type === 'essay' ? 
                             <><FileText className="w-12 h-12 md:w-16 md:h-16 text-blue-300 mx-auto mb-3 md:mb-4" /><p className="text-blue-900 font-black text-xl md:text-2xl">Format Esai Terbuka</p><p className="text-xs md:text-sm mt-1.5 md:mt-2 font-medium text-slate-600">Siswa akan diberikan area teks yang luas untuk menyusun jawaban mereka secara bebas.</p></> : 
                             <><CheckCircle2 className="w-12 h-12 md:w-16 md:h-16 text-emerald-300 mx-auto mb-3 md:mb-4" /><p className="text-emerald-900 font-black text-xl md:text-2xl">Sistem Benar/Salah</p><p className="text-xs md:text-sm mt-1.5 md:mt-2 font-medium text-slate-600">Pilih kunci jawaban (Pernyataan Benar atau Salah) di panel atribut di bawah/samping.</p></>
                           }
                        </div>
                      )}
                    </div>

                    {/* PANEL KANAN ATRIBUT (Pindah ke bawah pada Mobile) */}
                    <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] p-4 sm:p-6 md:p-8 shadow-sm space-y-4 md:space-y-6 h-fit relative z-30">
                      <h2 className="text-lg md:text-xl font-black text-slate-800 border-b border-slate-100 pb-3 md:pb-4 flex items-center gap-2"><Settings className="w-5 h-5 md:w-6 md:h-6 text-slate-400"/> Atribut Penilaian</h2>

                      {(formData.question_type === 'multiple_choice' || formData.question_type === 'true_false') && (
                        <div className="space-y-2 md:space-y-3"><label className="text-[10px] md:text-xs font-black text-emerald-600 uppercase tracking-widest block">Kunci Jawaban Benar *</label>
                          <div className="relative">
                             <select name="correct_answer" value={formData.correct_answer} onChange={handleFormChange} className="w-full p-3 md:p-4 bg-emerald-50 border-2 border-emerald-200 text-emerald-800 font-black rounded-lg md:rounded-xl outline-none focus:ring-2 focus:ring-emerald-50 cursor-pointer appearance-none shadow-sm text-sm md:text-base">
                               {formData.question_type === 'multiple_choice' ? options.map(o => <option key={o.key} value={o.key}>Opsi {o.key}</option>) : <><option value="True">Pernyataan Benar</option><option value="False">Pernyataan Salah</option></>}
                             </select>
                             <ChevronDown className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-emerald-600 pointer-events-none"/>
                          </div>
                        </div>
                      )}

                      {formData.question_type === 'complex_multiple_choice' && (
                        <div className="p-4 md:p-5 bg-emerald-50 border border-emerald-200 rounded-xl md:rounded-2xl shadow-sm"><p className="text-[9px] md:text-[10px] font-black text-emerald-700 uppercase tracking-widest">Kunci Jawaban Kompleks:</p><p className="text-xl md:text-2xl font-black text-emerald-600 mt-1">{complexAnswers.length > 0 ? complexAnswers.sort().join(', ') : 'Belum Dipilih'}</p></div>
                      )}

                      {/* Kunci Jawaban Menjodohkan Terstruktur di Atribut Penilaian */}
                      {formData.question_type === 'matching' && (
                         <div className="p-4 md:p-5 bg-emerald-50 border border-emerald-200 rounded-xl md:rounded-[1.5rem] space-y-3 md:space-y-4 relative z-30 shadow-sm">
                            <p className="text-[10px] md:text-xs font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1.5 md:gap-2 border-b border-emerald-200/60 pb-2 md:pb-3"><KeyRound className="w-3.5 h-3.5 md:w-4 md:h-4"/> Kunci Menjodohkan</p>
                            {matchingPremises.map((p, idx) => (
                               <div key={p.id} className="flex items-center gap-2 md:gap-3">
                                  <div className="w-6 h-6 md:w-8 md:h-8 shrink-0 bg-white border border-emerald-200 text-emerald-700 font-black text-[10px] md:text-xs rounded-lg md:rounded-xl flex items-center justify-center shadow-sm">{idx + 1}</div>
                                  <ArrowRight className="w-3 h-3 md:w-4 md:h-4 text-emerald-400 shrink-0"/>
                                  <div className="relative flex-1">
                                     <select 
                                        value={matchingKeys[p.id] || ''} 
                                        onChange={(e) => setMatchingKeys(prev => ({...prev, [p.id]: e.target.value}))} 
                                        className="w-full bg-white border border-emerald-200 text-emerald-700 text-xs md:text-sm font-bold rounded-lg md:rounded-xl p-2 md:p-2.5 outline-none cursor-pointer focus:ring-2 focus:ring-emerald-400 appearance-none shadow-sm truncate pr-8"
                                     >
                                        <option value="" disabled>Pilih Pasangan Kanan...</option>
                                        {matchingResponses.map((r, rIdx) => (
                                           <option key={r.id} value={r.id}>Kanan {String.fromCharCode(65 + rIdx)}</option>
                                        ))}
                                     </select>
                                     <ChevronDown className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500 pointer-events-none"/>
                                  </div>
                               </div>
                            ))}
                         </div>
                      )}

                      <div className="space-y-2 md:space-y-3"><label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block">Bobot Poin Soal</label><input type="number" step="0.1" name="points" value={formData.points} onChange={handleFormChange} placeholder="Misal: 1.5" className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl p-3 md:p-4 text-sm md:text-base font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 shadow-sm" /></div>
                      
                      {(formData.question_type === 'complex_multiple_choice' || formData.question_type === 'matching') && (
                        <div className="space-y-2 md:space-y-3 pt-4 md:pt-5 border-t border-slate-100">
                           <label className="text-[10px] md:text-xs font-black text-indigo-600 uppercase tracking-widest block">Sistem Penilaian *</label>
                           <div className="relative">
                              <select name="scoring_type" value={formData.scoring_type} onChange={handleFormChange} className="w-full p-3 md:p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold rounded-lg md:rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs md:text-sm cursor-pointer appearance-none shadow-sm">
                                <option value="all_or_nothing">Mutlak (1 Salah = Poin 0)</option>
                                <option value="partial">Proporsional (Dihitung per opsi benar)</option>
                              </select>
                              <ChevronDown className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-indigo-600 pointer-events-none"/>
                           </div>
                        </div>
                      )}

                      <div className="space-y-2 md:space-y-3"><label className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest block">Tingkat Kesulitan Soal</label>
                         <div className="relative">
                           <select name="difficulty" value={formData.difficulty} onChange={handleFormChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl p-3 md:p-4 text-xs md:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer appearance-none shadow-sm">
                             <option value={1}>1 - Sangat Mudah (C1)</option><option value={2}>2 - Mudah (C2)</option><option value={3}>3 - Sedang (C3)</option><option value={4}>4 - Sulit (C4)</option><option value={5}>5 - Sangat Sulit (HOTS/C5-C6)</option>
                           </select>
                           <ChevronDown className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-500 pointer-events-none"/>
                         </div>
                      </div>
                      
                      <div className="pt-4 md:pt-6 border-t border-slate-100">
                         <label className="flex items-center gap-3 md:gap-4 cursor-pointer p-3 md:p-4 border border-slate-200 rounded-xl md:rounded-2xl bg-slate-50 hover:bg-blue-50 transition-colors shadow-sm">
                            <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleFormChange} className="w-5 h-5 md:w-6 md:h-6 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer shadow-sm shrink-0" />
                            <span className="text-xs md:text-sm font-black text-slate-800 select-none">Aktifkan Soal Ini</span>
                         </label>
                      </div>
                      
                      <button type="button" onClick={handleFormSubmit} disabled={isSubmittingForm} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-70 transition-all w-full mt-4 sm:hidden text-sm">
                        {isSubmittingForm ? <LoaderCircle className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4"/>} Simpan Soal
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}