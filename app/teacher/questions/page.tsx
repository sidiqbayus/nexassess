'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import dynamic from 'next/dynamic';
import { 
  Database, Search, Plus, Trash2, Edit3, Image as ImageIcon, Video, 
  FolderOpen, ArrowLeft, BookOpen, Users, LayoutList, FileUp, LoaderCircle, X,
  ArrowRight, MinusCircle, LayoutTemplate, Calculator, Check, UploadCloud, 
  FileSpreadsheet, AlertCircle, CheckCircle2, Save, Award, Info, FileText,
  Package, Layers, KeyRound, HelpCircle, AlertTriangle, ChevronDown, UserCircle2, 
  Globe, Lock, ShieldCheck, Headphones,
  Settings, Sparkles, ChevronRight, Download as DownloadIcon // PERBAIKAN: Menggunakan alias agar tidak bentrok dengan DOM
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
  loading: () => <div className="h-20 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 font-medium">Memuat Editor...</div> 
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
    if (value !== localValue) setLocalValue(value);
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
  package_name?: string; allow_media_upload?: boolean;
}
interface TeacherProfile { id: string; full_name: string; taught_subjects?: string[]; }

export default function TeacherQuestionsBankPage() {
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
  const [myProfile, setMyProfile] = useState<TeacherProfile | null>(null); // Profil Guru Login

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
    setToast({ message, type }); setTimeout(() => setToast(null), 3500); 
  };
  const showDialog = useCallback((type: 'alert'|'confirm'|'info'|'success', title: string, message: string, onConfirm?: () => void, onCancel?: () => void) => {
    setDialogConfig({ isOpen: true, type, title, message, onConfirm, onCancel });
  }, []);
  const closeDialog = useCallback(() => setDialogConfig(prev => ({ ...prev, isOpen: false })), []);

  useEffect(() => { fetchSubjects(); }, []);

  const fetchSubjects = async () => {
    setGlobalLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
         const { data: profile } = await supabase.from('users').select('id, full_name, taught_subjects').eq('id', user.id).single();
         setMyProfile(profile as TeacherProfile);
      }

      const { data: subjectsData, error } = await supabase.from('subjects').select('id, name, grade_level').order('name', { ascending: true });
      if (error) throw error;

      const { data: teachersData } = await supabase.from('users').select('id, full_name, taught_subjects').eq('role', 'teacher');
      
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

  // HELPER PENTING: Mengecek apakah guru ini pengampu mapel tersebut
  const checkIsMySubject = (subjectId: string | undefined) => {
      if (!subjectId || !myProfile?.taught_subjects) return false;
      return myProfile.taught_subjects.includes(subjectId);
  };
  // Ambil state kepemilikan untuk folder yang sedang dibuka
  const isMyActiveSubject = checkIsMySubject(activeSubject?.id);

  // Daftar mapel yang KHUSUS DIMILIKI GURU INI (untuk dropdown modal)
  const myOwnedSubjects = subjects.filter(s => checkIsMySubject(s.id));

  const goToPackagesView = (subject: Subject) => {
    setActiveSubject(subject); setSearchQuery(''); fetchQuestionsForSubject(subject.id); setActiveView('packages');
  };
  const goToQuestionsView = (pkgName: string) => {
    setActivePackage(pkgName); setSearchQuery(''); setActiveView('questions');
  };
  const goToFolders = () => {
    setActiveSubject(null); setActivePackage(null); setSearchQuery(''); fetchSubjects(); setActiveView('folders');
  };

  const openImportModal = () => {
    setImportFile(null); setPreviewData([]); setImportError(null); setImportSuccess(null); 
    setImportSelectedSubject(isMyActiveSubject ? (activeSubject?.id || '') : ''); 
    setIsImportModalOpen(true);
  };

  const handleDirectMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string, optionIndex?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast("Ukuran file terlalu besar! Maksimal 5MB.", "error"); return; }

    setIsUploadingMedia(true); showToast("Sedang mengunggah audio ke server...", "info");
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `audio/${fileName}`;
      const { error } = await supabase.storage.from('exam_media').upload(filePath, file);
      if (error) throw error;
      const { data } = supabase.storage.from('exam_media').getPublicUrl(filePath);

      if (optionIndex !== undefined) handleOptionChange(optionIndex, field, data.publicUrl);
      else setFormData(prev => ({ ...prev, [field]: data.publicUrl }));
      
      showToast("Audio berhasil diunggah!", "success");
    } catch (err: any) { showToast("Gagal unggah: " + err.message, "error"); } finally { setIsUploadingMedia(false); }
  };

  const resetFormState = (subjectContext?: Subject | null, pkgName?: string) => {
    setFormError(null); setEditingId(null);
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
    setFormError(null); setEditingId(q.id);
    setFormData({
      subject: (q.tags && q.tags[0]) || activeSubject?.name || '', question_type: q.question_type, question_text: q.question_text || '',
      image_url: q.image_url || '', audio_url: q.audio_url || '', video_url: q.video_url || '', audio_play_limit: q.audio_duration || 0,
      correct_answer: q.correct_answer || 'A', points: q.points || 1.0, difficulty: q.difficulty || 3,
      is_active: q.is_active, scoring_type: q.scoring_type || 'all_or_nothing',
      package_name: q.package_name || 'Paket 1', allow_media_upload: q.allow_media_upload || false
    });

    if (q.options && Array.isArray(q.options)) {
      if (q.question_type === 'multiple_choice' || q.question_type === 'complex_multiple_choice') {
        setOptions(q.options.map((opt: any) => ({ ...opt, showMedia: !!(opt.image_url || opt.audio_url || opt.video_url) })));
      } else if (q.question_type === 'matching') {
        let pList: any[] = []; let rList: any[] = []; let mKeys: Record<string, string> = {};
        const allLefts = q.options.map((o:any) => o.left || o.key).filter(Boolean);
        const allRights = q.options.map((o:any) => o.right || o.text).filter(Boolean);

        allLefts.forEach((l: string, i: number) => pList.push({ id: `p${i+1}`, text: l }));
        allRights.forEach((r: string, i: number) => rList.push({ id: `r${i+1}`, text: r }));

        let correctArr: any[] = [];
        try { correctArr = typeof q.correct_answer === 'string' ? JSON.parse(q.correct_answer) : q.correct_answer; } catch(e){}
        if (Array.isArray(correctArr)) {
            correctArr.forEach((c: any) => {
                const p = pList.find(x => x.text === (c.left || c.key));
                const r = rList.find(x => x.text === (c.right || c.text));
                if (p && r) mKeys[p.id] = r.id;
            });
        }
        if(pList.length === 0) pList = [{id: 'p1', text: ''}];
        if(rList.length === 0) rList = [{id: 'r1', text: ''}];
        setMatchingPremises(pList); setMatchingResponses(rList); setMatchingKeys(mKeys);
      }
    }
    if (q.question_type === 'complex_multiple_choice' && q.correct_answer) setComplexAnswers(q.correct_answer.split(','));
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
    const newOptions: any = [...options]; newOptions[index][field] = value; setOptions(newOptions);
  };
  
  const addOption = () => setOptions([...options, { key: String.fromCharCode(65 + options.length), text: '', image_url: '', audio_url: '', video_url: '', showMedia: false }]);
  const removeOption = (indexToRemove: number) => {
    if (options.length <= 2) { showToast("Minimal harus ada 2 opsi jawaban!", "error"); return; }
    const newOptions = options.filter((_, idx) => idx !== indexToRemove).map((opt, idx) => ({ ...opt, key: String.fromCharCode(65 + idx) }));
    setOptions(newOptions);
    if (formData.correct_answer === options[indexToRemove].key) setFormData(prev => ({ ...prev, correct_answer: 'A' }));
  };

  const handleComplexAnswerToggle = (key: string) => setComplexAnswers(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  const copyToClipboard = (code: string) => { navigator.clipboard.writeText(code); setCopiedSnippet(code); setTimeout(() => setCopiedSnippet(null), 1500); };

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
           ...rest, is_correct: rest.key === finalCorrectAnswer 
        }));
        if (finalOptions.length < 2) throw new Error("Minimal harus ada 2 opsi jawaban.");
      } else if (qType === 'complex_multiple_choice') {
        finalOptions = options.filter(opt => opt.text.replace(/<[^>]*>?/gm, '').trim() !== '' || opt.image_url !== '').map(({showMedia, ...rest}:any) => ({
           ...rest, is_correct: complexAnswers.includes(rest.key) 
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
            finalOptions.push({ left: matchingPremises[i]?.text || null, right: matchingResponses[i]?.text || null });
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
        finalCorrectAnswer = finalCorrectAnswer.trim(); finalOptions = null;
      } else if (qType === 'essay') {
        finalOptions = null; finalCorrectAnswer = null; 
      }

      // Ambil subjectId dari activeSubject jika edit dari dalam mapel. Atau dari import dropdown.
      const targetSubjectId = activeSubject?.id || importSelectedSubject; 
      if(!targetSubjectId) throw new Error("Target Mata Pelajaran tidak ditemukan.");

      const payload = {
        subject_id: targetSubjectId, question_text: formData.question_text, question_type: qType,
        options: finalOptions, correct_answer: finalCorrectAnswer, points: formData.points, 
        difficulty: formData.difficulty, is_active: formData.is_active, image_url: formData.image_url || null, 
        audio_url: formData.audio_url || null, video_url: formData.video_url || null, audio_duration: formData.audio_play_limit, 
        tags: formData.subject ? [formData.subject] : [], scoring_type: formData.scoring_type,
        package_name: formData.package_name || 'Paket 1', allow_media_upload: qType === 'essay' ? formData.allow_media_upload : false,
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
      setFormError(err.message); showToast("Gagal menyimpan: " + err.message, "error");
    } finally { setIsSubmittingForm(false); }
  };

  const handleQuestionDelete = (questionId: string) => {
    showDialog('confirm', 'Hapus Soal Permanen', 'Apakah Anda yakin ingin menghapus soal ini secara permanen?', async () => {
      try {
        const { error } = await supabase.from('questions').delete().eq('id', questionId);
        if (error) throw error;
        setQuestions(prev => prev.filter(q => q.id !== questionId));
        showToast("Soal berhasil dihapus.", "success");
      } catch (err: any) { showToast("Gagal menghapus soal: " + err.message, "error"); }
    });
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        Jenis_Soal: 'Panduan (JANGAN DIHAPUS)', Teks_Soal: 'Pilihan: PG, PG_KOMPLEKS, BS, ISIAN, ESSAY, MATCHING', Media_Utama: 'URL Gambar/Audio/Video (Opsional)',
        Kunci_Jawaban: 'A / A,C / Benar / (Teks Isian)', Bobot_Poin: 'Angka (cth: 2.5)', Sistem_Penilaian: 'Mutlak / Proporsional',
        Tingkat_Kesulitan: '1 - 5', Opsi_A: 'Teks / Premis|Respons', Media_A: 'URL Media A', Opsi_B: 'Teks B', Media_B: 'URL Media B',
        Opsi_C: 'Teks C', Media_C: 'URL Media C', Opsi_D: 'Teks D', Media_D: '', Opsi_E: 'Teks E', Media_E: '', Paket_Soal: 'Nama Paket'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{wch: 15}, {wch: 40}, {wch: 25}, {wch: 15}, {wch: 12}, {wch: 15}, {wch: 15}, {wch: 25}, {wch: 20}, {wch: 25}, {wch: 20}, {wch: 25}, {wch: 15}];
    const range = XLSX.utils.decode_range(ws['!ref'] || "A1:M1");
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ c: C, r: 0 });
      if (ws[address]) ws[address].s = { font: { bold: true } }; 
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
             let pList: string[] = []; let rList: string[] = []; let correctArr: any[] = [];
             ['A', 'B', 'C', 'D', 'E'].forEach(k => {
               if (row[`Opsi_${k}`] && String(row[`Opsi_${k}`]).includes('|')) {
                 const [premis, pasangan] = String(row[`Opsi_${k}`]).split('|');
                 if (premis.trim()) pList.push(premis.trim());
                 if (pasangan.trim()) rList.push(pasangan.trim());
                 if (premis.trim() && pasangan.trim()) correctArr.push({ left: premis.trim(), right: pasangan.trim() });
               }
             });

             const maxLen = Math.max(pList.length, rList.length);
             for(let i=0; i<maxLen; i++) options.push({ left: pList[i] || null, right: rList[i] || null });
             try { kunci = JSON.stringify(correctArr); } catch(e){}
             
             return {
                question_type: qType, question_text: row.Teks_Soal || '(Soal Kosong)',
                image_url: row.Media_Utama || null, options: options.length > 0 ? options : null,
                correct_answer: kunci, points: parseFloat(row.Bobot_Poin) || 1.0, difficulty: parseInt(row.Tingkat_Kesulitan) || 3, scoring_type: scoringType,
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
            package_name: row.Paket_Soal || 'Paket 1', allow_media_upload: false, is_active: true, _rawKunci: finalKunciImport 
          };
        });
        setPreviewData(parsedQuestions);
      } catch (err: any) { 
        setImportError(`Gagal membaca file Excel.`); showToast("Gagal membaca file Excel.", "error");
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleUploadData = async () => {
    if (!importSelectedSubject) { showToast("Silakan pilih Target Mata Pelajaran.", "warning"); return; }
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
      
      if (activeView === 'packages' || activeView === 'questions') fetchQuestionsForSubject(importSelectedSubject);
      else fetchSubjects(); 
    } catch (err: any) { 
      setImportError(err.message); showToast(err.message, "error");
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 max-w-7xl mx-auto text-slate-900 relative pb-24">
      
      {/* TOAST NOTIFIKASI */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-10 fade-in duration-300">
          <div className={`px-6 py-3.5 rounded-[1.5rem] shadow-2xl border flex items-center gap-3 backdrop-blur-md ${
            toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
            toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 
            toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' :
            'bg-blue-50 border-blue-200 text-blue-700'
          }`}>
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />}
            {toast.type === 'info' && <Info className="w-5 h-5 shrink-0 text-blue-500" />}
            <p className="font-bold text-sm tracking-wide">{toast.message}</p>
          </div>
        </div>
      )}

      {/* CUSTOM DIALOG MODAL (TEMA LIGHT) */}
      {dialogConfig.isOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/50">
            <div className="p-8 flex flex-col items-center text-center">
               <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-inner border 
                  ${dialogConfig.type === 'confirm' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                    dialogConfig.type === 'success' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 
                    'bg-rose-50 text-rose-600 border-rose-100'}`}>
                  {dialogConfig.type === 'confirm' ? <HelpCircle className="w-10 h-10" /> : 
                   dialogConfig.type === 'success' ? <CheckCircle2 className="w-10 h-10" /> :
                   <AlertTriangle className="w-10 h-10" />}
               </div>
               <h3 className="text-2xl font-black text-slate-800 mb-3">{dialogConfig.title}</h3>
               <p className="text-slate-500 font-medium text-sm leading-relaxed whitespace-pre-wrap">{dialogConfig.message}</p>
            </div>
            <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex gap-3 justify-center">
               {dialogConfig.type === 'confirm' && (
                 <button onClick={() => { closeDialog(); if(dialogConfig.onCancel) dialogConfig.onCancel(); }} className="px-6 py-3.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors w-full shadow-sm">Batal</button>
               )}
               <button onClick={() => { closeDialog(); if(dialogConfig.onConfirm) dialogConfig.onConfirm(); }} className={`px-6 py-3.5 rounded-xl font-bold text-white transition-all shadow-md active:scale-95 w-full ${dialogConfig.type === 'alert' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : dialogConfig.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}>Mengerti</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW 1: DAFTAR MAPEL / FOLDER ================= */}
      {activeView === 'folders' && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:px-8 md:py-6 rounded-[2rem] border border-blue-100 shadow-sm">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-3"><Database className="w-8 h-8 text-blue-600" /> Bank Soal</h1>
              <p className="text-slate-500 text-sm mt-1 font-medium ml-11">Pilih Folder Mapel. Anda hanya bisa mengelola mapel yang Anda ampu.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {myOwnedSubjects.length > 0 && (
                 <button onClick={openImportModal} className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-6 py-3 rounded-xl font-bold text-sm shadow-sm transition-colors w-full md:w-auto"><FileUp className="w-5 h-5 text-emerald-500" /> Import Massal</button>
              )}
              {myOwnedSubjects.length > 0 && (
                 <button onClick={() => setIsSelectMapelModalOpen(true)} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all w-full md:w-auto"><Plus className="w-5 h-5" /> Buat Soal Baru</button>
              )}
            </div>
          </div>

          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" placeholder="Cari berdasarkan nama mata pelajaran..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-[1.5rem] pl-12 pr-4 py-3.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all placeholder-slate-400" />
          </div>

          {globalLoading ? (
            <div className="py-20 flex justify-center"><LoaderCircle className="w-10 h-10 text-blue-500 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subjects.filter(subj => subj.name.toLowerCase().includes(searchQuery.toLowerCase())).map((subject) => {
                const isMine = checkIsMySubject(subject.id);
                return (
                  <div key={subject.id} onClick={() => goToPackagesView(subject)} className={`bg-white border ${isMine ? 'border-blue-300' : 'border-slate-200'} rounded-[2rem] p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 ${isMine ? 'hover:border-blue-500' : 'hover:border-slate-300'} transition-all duration-300 cursor-pointer group flex flex-col justify-between relative overflow-hidden`}>
                    
                    {/* BAGIAN ATAS: BADGE KEPEMILIKAN MAPEL */}
                    <div className="absolute top-0 right-0 rounded-bl-[1.5rem] px-4 py-1.5 font-bold text-[10px] uppercase tracking-widest border-b border-l shadow-sm">
                        {isMine ? (
                            <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border-emerald-100"><ShieldCheck className="w-3.5 h-3.5" /> Mapel Anda</span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-slate-400 bg-slate-50 border-slate-100"><Lock className="w-3 h-3" /> Hanya Lihat</span>
                        )}
                    </div>

                    <div>
                      <div className={`w-14 h-14 ${isMine ? 'bg-blue-50 border-blue-100 group-hover:bg-blue-600' : 'bg-slate-50 border-slate-200 group-hover:bg-slate-200'} rounded-[1.2rem] flex items-center justify-center mb-5 group-hover:scale-110 transition-all duration-300 shadow-inner`}>
                         <FolderOpen className={`w-7 h-7 ${isMine ? 'text-blue-600 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                      </div>
                      <h3 className={`font-black text-2xl text-slate-800 line-clamp-1 ${isMine ? 'group-hover:text-blue-700' : 'group-hover:text-slate-600'} transition-colors`} title={subject.name}>{subject.name}</h3>
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase">
                        {subject.grade_level && <span className="bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-md border border-indigo-100">{subject.grade_level}</span>}
                        <span className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 flex items-center gap-1 truncate max-w-[150px]"><Users className="w-3 h-3 text-amber-500" /> {subject.teacherNames}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {subjects.filter(subj => subj.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                 <div className="col-span-full py-10 text-center text-slate-400 font-bold">Mata Pelajaran tidak ditemukan.</div>
              )}
            </div>
          )}
        </>
      )}

      {/* ================= VIEW 1.5: DAFTAR PAKET SOAL DALAM MAPEL ================= */}
      {activeView === 'packages' && activeSubject && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <button onClick={goToFolders} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 bg-white border border-slate-200 px-5 py-2.5 rounded-xl transition-all shadow-sm w-fit">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Mapel
          </button>

          {/* HEADER MAPEL */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 border border-blue-800 rounded-[2.5rem] p-8 md:p-10 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>

             <div className="flex items-start gap-5 relative z-10 w-full md:w-auto">
              <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 shrink-0"><BookOpen className="w-8 h-8" /></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-500/50 border border-blue-400/50 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg">
                    {activeSubject.grade_level || 'UMUM'}
                  </span>
                  <span className="bg-amber-500/50 border border-amber-400/50 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <UserCircle2 className="w-3 h-3"/> {activeSubject.teacherNames || 'Guru Pengampu'}
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">{activeSubject.name}</h1>
                <p className="text-sm font-medium text-blue-100 flex items-center gap-1.5">
                  <Database className="w-4 h-4"/> Folder Bank Soal Master
                </p>
              </div>
            </div>
            {/* HANYA TAMPILKAN TOMBOL JIKA GURU INI MENGAMPU MAPEL INI */}
            {isMyActiveSubject && (
                <div className="flex flex-col sm:flex-row gap-3 relative z-10 w-full md:w-auto shrink-0">
                   <button onClick={openImportModal} className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-sm transition-all w-full md:w-auto backdrop-blur-md">
                     <FileUp className="w-5 h-5" /> Import Excel
                   </button>
                   <button onClick={() => openCreateForm(activeSubject, 'Paket 1')} className="flex items-center justify-center gap-2 bg-white text-blue-700 hover:bg-blue-50 px-6 py-3 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all w-full md:w-auto">
                     <Plus className="w-5 h-5" /> Buat Paket / Soal
                   </button>
                </div>
            )}
          </div>

          {/* DAFTAR PAKET (LIST STYLE) */}
          {globalLoading ? (
            <div className="py-20 flex justify-center"><LoaderCircle className="w-10 h-10 text-blue-500 animate-spin" /></div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                <h2 className="font-black text-slate-800 text-xl flex items-center gap-2"><Layers className="w-6 h-6 text-blue-500"/> Daftar Paket Soal</h2>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">{uniquePackages.length} Paket Ditemukan</span>
              </div>

              <div className="p-6 flex flex-col gap-4 bg-slate-50/30">
                {uniquePackages.length === 0 ? (
                  isMyActiveSubject ? (
                      <div onClick={() => openCreateForm(activeSubject, 'Paket 1')} className="border-2 border-dashed border-slate-300 rounded-[1.5rem] p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all bg-white group">
                        <Package className="w-12 h-12 text-slate-300 mb-3 group-hover:scale-110 transition-transform duration-300" />
                        <p className="font-black text-slate-600 text-xl">Belum ada paket soal</p>
                        <p className="text-sm font-medium text-slate-500 mt-1">Klik di sini untuk mulai menyusun Paket 1</p>
                      </div>
                  ) : (
                      <div className="border-2 border-dashed border-slate-200 rounded-[1.5rem] p-10 flex flex-col items-center justify-center text-center bg-slate-50">
                        <Package className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="font-black text-slate-500 text-lg">Belum ada paket soal di mapel ini.</p>
                      </div>
                  )
                ) : (
                  uniquePackages.map(pkg => (
                    <div key={pkg} onClick={() => goToQuestionsView(pkg)} className="group flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white border border-slate-200 p-5 rounded-[1.5rem] hover:border-blue-400 hover:shadow-md hover:bg-blue-50/30 transition-all cursor-pointer gap-4">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-slate-50 border border-slate-100 group-hover:bg-blue-100 rounded-xl flex items-center justify-center transition-colors shrink-0 shadow-inner">
                          <Package className="w-7 h-7 text-slate-400 group-hover:text-blue-600 transition-colors" />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-800 text-xl group-hover:text-blue-700 transition-colors">{pkg}</h3>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                               <FileText className="w-3 h-3"/> Terdiri dari
                             </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                        <div className="flex items-center gap-1.5 text-xs font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                          <LayoutList className="w-4 h-4" /> {questions.filter(q => (q.package_name || 'Paket 1') === pkg).length} Soal
                        </div>
                        <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
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
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <button onClick={() => { setActiveView('packages'); setSearchQuery(''); }} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-cyan-600 bg-white border border-slate-200 hover:border-cyan-200 px-5 py-2.5 rounded-xl transition-colors shadow-sm w-fit"><ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Paket</button>

          <div className="bg-gradient-to-br from-cyan-600 to-blue-700 border border-cyan-800 rounded-[2.5rem] p-8 md:p-10 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
            
            <div className="flex items-center gap-5 relative z-10">
              <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20"><Package className="w-8 h-8" /></div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">{activePackage}</h1>
                <div className="flex flex-wrap gap-2 mt-2 text-sm font-bold text-cyan-100">
                  <span className="bg-white/20 px-3 py-1 rounded-lg border border-white/10 flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> {activeSubject.name}</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-4 relative z-10 w-full md:w-auto">
               <div className="flex-1 md:w-32 text-center bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-sm flex flex-col justify-center items-center">
                 <p className="text-3xl font-black text-white">{questions.filter(q => (q.package_name || 'Paket 1') === activePackage).length}</p>
                 <p className="text-[10px] font-bold text-cyan-100 uppercase tracking-widest mt-1">Total Soal</p>
               </div>
               
               <div className="flex-1 md:w-32 text-center bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-sm flex flex-col justify-center items-center relative">
                 <p className="text-3xl font-black text-white">
                    {questions.filter(q => (q.package_name || 'Paket 1') === activePackage).reduce((s, q) => s + (Number(q.points)||0), 0)}
                 </p>
                 <p className="text-[10px] font-bold text-cyan-100 uppercase tracking-widest mt-1 flex items-center justify-center gap-1">
                    <Award className="w-3 h-3 text-amber-300" /> Poin Maks
                 </p>
                 {questions.some(q => q.question_type === 'essay' && (q.package_name || 'Paket 1') === activePackage) && (
                    <span className="absolute -bottom-3 whitespace-nowrap text-[9px] text-amber-100 font-bold bg-amber-600 border border-amber-500 px-2 py-0.5 rounded-md shadow-md z-20">
                       *Termasuk Esai
                    </span>
                 )}
               </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" placeholder={`Cari soal di ${activePackage}...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-[1.5rem] pl-12 pr-4 py-3.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-sm transition-all placeholder-slate-400" />
            </div>
            {/* TOMBOL HANYA MUNCUL JIKA GURU MEMILIKI AKSES */}
            {isMyActiveSubject && (
               <button onClick={() => openCreateForm(activeSubject, activePackage)} className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3.5 rounded-[1.5rem] font-bold text-sm shadow-md active:scale-95 transition-all shrink-0"><Plus className="w-5 h-5" /> Tambah Soal Manual</button>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden z-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr><th className="px-8 py-5 w-12 text-center">No</th><th className="px-8 py-5">Pertanyaan</th><th className="px-8 py-5 text-center">Tipe</th><th className="px-8 py-5 text-center">Bobot</th><th className="px-8 py-5 text-center">Status</th>{isMyActiveSubject && <th className="px-8 py-5 text-right">Aksi</th>}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {globalLoading ? (
                    <tr><td colSpan={isMyActiveSubject ? 6 : 5} className="text-center py-24"><LoaderCircle className="w-10 h-10 text-cyan-500 animate-spin mx-auto mb-3" /><p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Memuat butir soal...</p></td></tr>
                  ) : questions.filter(q => (q.package_name || 'Paket 1') === activePackage).length === 0 ? (
                    <tr><td colSpan={isMyActiveSubject ? 6 : 5} className="text-center py-24 px-4"><div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200"><AlertCircle className="w-10 h-10 text-slate-400" /></div><p className="text-slate-700 font-bold text-xl mb-1">Belum ada soal</p><p className="text-slate-500 font-medium text-sm">{isMyActiveSubject ? 'Klik tombol "Tambah Soal Manual" untuk menyusun paket ini.' : 'Paket ini masih kosong.'}</p></td></tr>
                  ) : (
                    questions
                      .filter(q => (q.package_name || 'Paket 1') === activePackage)
                      .filter(q => q.question_text.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((q, index) => (
                      <tr key={q.id} className="hover:bg-cyan-50/30 transition-colors group">
                        <td className="px-8 py-5 text-center font-black text-slate-400">{index + 1}</td>
                        <td className="px-8 py-5"><div className="text-slate-800 font-medium line-clamp-2 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: q.question_text }} /></td>
                        <td className="px-8 py-5 text-center"><span className={`border px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${getTypeColorBadge(q.question_type)}`}>{getQuestionTypeLabel(q.question_type)}</span></td>
                        <td className="px-8 py-5 text-center"><span className="font-black text-slate-700">{q.points} Poin</span></td>
                        <td className="px-8 py-5 text-center">{q.is_active ? <span className="inline-flex items-center gap-1.5 text-emerald-600 text-[10px] font-black uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100"><CheckCircle2 className="w-3.5 h-3.5" /> Aktif</span> : <span className="inline-flex items-center gap-1.5 text-slate-500 text-[10px] font-black uppercase tracking-widest bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200"><AlertCircle className="w-3.5 h-3.5" /> Draft</span>}</td>
                        {isMyActiveSubject && (
                            <td className="px-8 py-5 text-right">
                              <div className="flex items-center justify-end gap-2 transition-opacity">
                                <button onClick={() => openEditForm(q)} className="flex items-center justify-center p-2.5 bg-white text-slate-400 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 hover:border-blue-200 rounded-full transition-all shadow-sm" title="Edit Soal"><Edit3 className="w-4 h-4" /></button>
                                <button onClick={() => handleQuestionDelete(q.id)} className="flex items-center justify-center p-2.5 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-full transition-all shadow-sm" title="Hapus Soal"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW 4: MODAL FULLSCREEN (CREATE / EDIT FORM) ================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
            <div className="bg-white w-full max-w-6xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[95vh] my-auto border border-slate-200">
              
              {/* HEADER FORM */}
              <div className="bg-slate-50 border-b border-slate-100 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 z-10 sticky top-0">
                <div>
                  <button onClick={() => setIsFormModalOpen(false)} className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 flex items-center gap-2 mb-2 transition-colors"><ArrowLeft className="w-4 h-4"/> Batal & Tutup</button>
                  <h1 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-3">
                     {editingId ? <Edit3 className="w-7 h-7 text-blue-600"/> : <Plus className="w-7 h-7 text-blue-600"/>}
                     {editingId ? 'Edit Soal HOTS' : 'Menyusun Soal HOTS'}
                  </h1>
                </div>
                <div className="flex gap-3">
                   <button onClick={() => setIsFormModalOpen(false)} className="flex items-center justify-center p-3.5 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-500 text-slate-400 rounded-full transition-all shadow-sm"><X className="w-5 h-5"/></button>
                   <button onClick={handleFormSubmit} disabled={isSubmittingForm} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-8 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-md active:scale-95 disabled:opacity-70 transition-all text-sm hidden sm:flex">
                     {isSubmittingForm ? <LoaderCircle className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5"/>} Simpan ke Database
                   </button>
                </div>
              </div>

              {/* AREA KONTEN FORM */}
              <div className="p-6 md:p-8 overflow-y-auto bg-slate-50/50 flex-1 custom-scrollbar">
                {formError && <div className="bg-rose-50 border border-rose-200 text-rose-700 p-5 rounded-2xl mb-6 font-bold flex items-start gap-3 shadow-sm"><AlertCircle className="w-5 h-5 shrink-0 mt-0.5"/>{formError}</div>}

                <form className="space-y-6 pb-20">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm space-y-5 h-fit">
                      
                      <div className="p-5 bg-cyan-50/50 border border-cyan-100 rounded-2xl mb-6 shadow-sm">
                        <label className="text-xs font-black text-cyan-700 uppercase tracking-widest flex items-center gap-2 mb-2"><Package className="w-4 h-4" /> Grup Paket Soal</label>
                        <p className="text-[10px] font-bold text-slate-500 mb-3 leading-tight">Gunakan nama yang sama untuk menggabungkan soal dalam 1 paket.</p>
                        <input 
                          type="text" 
                          name="package_name" 
                          value={formData.package_name} 
                          onChange={handleFormChange} 
                          placeholder="Paket 1" 
                          className="w-full bg-white border border-cyan-200 rounded-xl px-4 py-3 text-sm font-bold text-cyan-800 outline-none focus:ring-2 focus:ring-cyan-500 transition-all shadow-sm"
                        />
                      </div>

                      <div className="space-y-2">
                         <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">Tipe Soal *</label>
                         <select disabled={!!editingId} name="question_type" value={formData.question_type} onChange={handleFormChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer disabled:opacity-60 shadow-sm">
                           <option value="multiple_choice">Pilihan Ganda Tunggal</option><option value="complex_multiple_choice">PG Kompleks (Banyak Jawaban)</option>
                           <option value="matching">Menjodohkan (Matching)</option><option value="true_false">Benar / Salah</option>
                           <option value="short_answer">Isian Singkat</option><option value="essay">Esai / Uraian</option>
                         </select>
                      </div>

                      {/* --- FITUR IZIN MEDIA UNTUK ESAI --- */}
                      {formData.question_type === 'essay' && (
                         <div className="mt-4 p-4 bg-blue-50/50 border border-blue-200 rounded-2xl shadow-sm">
                            <label className="flex items-center gap-4 cursor-pointer">
                               <input 
                                  type="checkbox" 
                                  checked={formData.allow_media_upload || false} 
                                  onChange={(e) => setFormData({ ...formData, allow_media_upload: e.target.checked })}
                                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shadow-sm"
                               />
                               <div>
                                  <span className="font-black text-sm text-blue-900 block mb-0.5 flex items-center gap-1.5"><Globe className="w-4 h-4"/> Izinkan Media/Link Jawaban</span>
                                  <span className="text-[10px] font-bold text-blue-700/80 leading-tight block">Siswa dapat mengunggah gambar/link di jawaban.</span>
                               </div>
                            </label>
                         </div>
                      )}
                    </div>
                    
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm grid grid-cols-2 gap-5 h-fit">
                       <div className="space-y-2"><label className="text-xs font-black text-slate-500 flex items-center gap-2 uppercase tracking-widest"><ImageIcon className="w-4 h-4 text-emerald-500"/> URL Gambar Utama</label><input type="url" name="image_url" value={formData.image_url} onChange={handleFormChange} placeholder="Masukkan link/URL gambar (Opsional)..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 shadow-sm" /></div>
                       <div className="space-y-2"><label className="text-xs font-black text-slate-500 flex items-center gap-2 uppercase tracking-widest"><Video className="w-4 h-4 text-rose-500"/> URL Video Utama</label><input type="url" name="video_url" value={formData.video_url} onChange={handleFormChange} placeholder="Masukkan link/URL video MP4 (Opsional)..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 shadow-sm" /></div>
                       
                       <div className="space-y-2 col-span-2 md:col-span-1">
                          <label className="text-xs font-black text-slate-500 flex items-center gap-2 uppercase tracking-widest"><Headphones className="w-4 h-4 text-blue-500"/> URL Audio Utama</label>
                          <div className="flex gap-2">
                             <input type="url" name="audio_url" value={formData.audio_url} onChange={handleFormChange} placeholder="Masukkan link/URL audio MP3..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 shadow-sm" />
                             <label className={`shrink-0 flex items-center justify-center px-4 rounded-xl cursor-pointer transition-all shadow-sm ${isUploadingMedia ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-100'}`} title="Upload Audio Langsung ke Supabase">
                                {isUploadingMedia ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                                <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleDirectMediaUpload(e, 'audio_url')} disabled={isUploadingMedia} />
                             </label>
                          </div>
                       </div>
                       <div className="space-y-2"><label className="text-xs font-black text-slate-500 uppercase tracking-widest block">Limit Putar Audio</label><input type="number" name="audio_play_limit" value={formData.audio_play_limit} onChange={handleFormChange} placeholder="0 = Putar Tak Terbatas" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 shadow-sm" /></div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-10 shadow-sm">
                    <div className="flex justify-between items-center mb-6 pb-6 border-b border-slate-100">
                      <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><FileText className="text-blue-500 w-6 h-6"/> Teks Pertanyaan Utama</h2>
                      <button type="button" onClick={() => setShowMathGuide(!showMathGuide)} className="text-xs font-black uppercase tracking-widest bg-amber-50 text-amber-600 px-4 py-2.5 rounded-xl flex items-center gap-2 border border-amber-200 hover:bg-amber-100 transition-colors shadow-sm"><Calculator className="w-4 h-4"/> Bantuan Simbol Eksakta</button>
                    </div>
                    {showMathGuide && (
                      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-5 p-6 bg-amber-50/50 rounded-[1.5rem] border border-amber-200 animate-in slide-in-from-top-2">
                        {[{ group: 'Matematika Dasar', items: [{ label: 'Pecahan', code: '\\frac{a}{b}' }, { label: 'Pangkat', code: 'x^2' }, { label: 'Akar', code: '\\sqrt{x}' }]}, { group: 'Fisika & Kalkulus', items: [{ label: 'Derajat (°)', code: '^\\circ' }, { label: 'Delta', code: '\\Delta' }, { label: 'Vektor', code: '\\vec{v}' }]}, { group: 'Kimia Reaksi', items: [{ label: 'Rumus Senyawa', code: '\\ce{H2O}' }, { label: 'Panah Reaksi', code: '\\ce{->}' }, { label: 'Isotop/Massa', code: '\\ce{^{227}_{90}Th}' }]}].map(g => (
                          <div key={g.group}>
                            <p className="text-[10px] font-black text-amber-700 uppercase mb-3 tracking-widest flex items-center gap-2"><div className="w-1 h-1 bg-amber-400 rounded-full"></div>{g.group}</p>
                            <div className="flex flex-col gap-2">
                              {g.items.map(i => <button key={i.label} type="button" onClick={() => copyToClipboard(i.code)} className="text-xs bg-white border border-amber-200 p-2.5 rounded-xl hover:bg-amber-100 font-bold text-left flex justify-between items-center transition-colors shadow-sm"><span>{i.label}</span> {copiedSnippet === i.code ? <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3"/> Disalin</span> : <code className="text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{i.code}</code>}</button>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                      <OptimizedQuillEditor modules={quillModulesFull} value={formData.question_text} onChange={handleQuillChange} placeholder="Ketik teks pertanyaan atau sisipkan rumus/media di sini..." className="h-72 mb-12 text-slate-900" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm">
                      <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><Sparkles className="text-amber-500 w-6 h-6"/> Respons & Jawaban</h2>

                      {/* FORMAT MENJODOHKAN */}
                      {formData.question_type === 'matching' && (
                        <div className="space-y-6">
                          <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 shadow-sm flex items-start gap-4">
                             <Info className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
                             <div>
                               <p className="text-sm font-bold text-blue-900">Format Menjodohkan Tingkat Lanjut</p>
                               <p className="text-xs text-blue-800/80 mt-1 font-medium leading-relaxed">Anda dapat membuat jumlah Respons Kanan lebih banyak sebagai Opsi Pengecoh.</p>
                             </div>
                          </div>

                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 relative z-10">
                            
                            {/* KOLOM PREMIS KIRI */}
                            <div className="space-y-4">
                               <h3 className="font-black text-blue-600 uppercase tracking-widest text-xs flex items-center gap-2 mb-4"><LayoutList className="w-4 h-4"/> Daftar Premis (Kiri)</h3>
                               {matchingPremises.map((p, idx) => (
                                  <div key={p.id} className="bg-slate-50 border border-blue-200 rounded-[1.5rem] p-5 shadow-sm flex items-start gap-4 transition-all">
                                     <div className="flex flex-col items-center gap-3 mt-1 shrink-0">
                                         <div className="w-8 h-8 bg-blue-600 text-white font-black rounded-xl flex items-center justify-center text-sm shadow-md">{idx + 1}</div>
                                         {matchingPremises.length > 1 && (
                                            <button type="button" onClick={() => {
                                               setMatchingPremises(prev => prev.filter(x => x.id !== p.id));
                                               setMatchingKeys(prev => { const n = {...prev}; delete n[p.id]; return n; });
                                            }} className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors" title="Hapus Premis"><Trash2 className="w-4 h-4"/></button>
                                         )}
                                     </div>
                                     <div className="flex-1 w-full overflow-hidden bg-white rounded-xl border border-slate-200">
                                        <OptimizedQuillEditor modules={quillModulesFull} value={p.text} onChange={(val:string) => {
                                           setMatchingPremises(prev => prev.map(x => x.id === p.id ? {...x, text: val} : x));
                                        }} placeholder={`Ketik premis ke-${idx+1}...`} className="h-32 mb-12" />
                                     </div>
                                  </div>
                               ))}
                               <button type="button" onClick={() => setMatchingPremises(prev => [...prev, {id: `p${Date.now()}`, text: ''}])} className="w-full py-4 bg-white text-blue-600 font-bold text-sm rounded-xl border-2 border-blue-200 border-dashed hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"><Plus className="w-5 h-5"/> Tambah Premis Kiri</button>
                            </div>

                            {/* KOLOM RESPONS KANAN (BISA JADI PENGECOH) */}
                            <div className="space-y-4">
                               <h3 className="font-black text-amber-600 uppercase tracking-widest text-xs flex items-center gap-2 mb-4"><LayoutList className="w-4 h-4"/> Daftar Respons (Kanan)</h3>
                               {matchingResponses.map((r, idx) => (
                                  <div key={r.id} className="bg-slate-50 border border-amber-200 rounded-[1.5rem] p-5 shadow-sm flex items-start gap-4 transition-all">
                                     <div className="flex flex-col items-center gap-3 mt-1 shrink-0">
                                         <div className="w-8 h-8 bg-amber-500 text-white font-black rounded-xl flex items-center justify-center text-sm shadow-md">{String.fromCharCode(65 + idx)}</div>
                                         {matchingResponses.length > 1 && (
                                            <button type="button" onClick={() => {
                                               setMatchingResponses(prev => prev.filter(x => x.id !== r.id));
                                               setMatchingKeys(prev => { 
                                                   const n = {...prev}; 
                                                   Object.keys(n).forEach(k => { if(n[k] === r.id) delete n[k]; }); 
                                                   return n; 
                                               });
                                            }} className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors" title="Hapus Respons"><Trash2 className="w-4 h-4"/></button>
                                         )}
                                     </div>
                                     <div className="flex-1 w-full overflow-hidden bg-white rounded-xl border border-slate-200">
                                        <OptimizedQuillEditor modules={quillModulesFull} value={r.text} onChange={(val:string) => {
                                           setMatchingResponses(prev => prev.map(x => x.id === r.id ? {...x, text: val} : x));
                                        }} placeholder={`Ketik respons ke-${String.fromCharCode(65 + idx)}...`} className="h-32 mb-12" />
                                     </div>
                                  </div>
                               ))}
                               <button type="button" onClick={() => setMatchingResponses(prev => [...prev, {id: `r${Date.now()}`, text: ''}])} className="w-full py-4 bg-white text-amber-600 font-bold text-sm rounded-xl border-2 border-amber-200 border-dashed hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"><Plus className="w-5 h-5"/> Tambah Respons Pengecoh</button>
                            </div>

                          </div>
                        </div>
                      )}

                      {(formData.question_type === 'multiple_choice' || formData.question_type === 'complex_multiple_choice') && (
                        <div className="space-y-5">
                          {options.map((item, index) => (
                            <div key={item.key} className={`flex flex-col p-5 rounded-[1.5rem] border shadow-sm transition-all gap-4 ${formData.question_type === 'complex_multiple_choice' && complexAnswers.includes(item.key) ? 'bg-emerald-50/30 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                              <div className="flex items-start gap-4">
                                {formData.question_type === 'complex_multiple_choice' && (
                                   <div className="mt-4">
                                     <input type="checkbox" checked={complexAnswers.includes(item.key)} onChange={() => handleComplexAnswerToggle(item.key)} className="w-6 h-6 rounded border-slate-300 text-emerald-500 cursor-pointer focus:ring-emerald-500 shadow-sm" title="Tandai sebagai jawaban benar" />
                                   </div>
                                )}
                                <div className={`w-12 h-12 mt-1 shrink-0 font-black text-lg rounded-2xl flex items-center justify-center shadow-inner border ${formData.question_type === 'complex_multiple_choice' && complexAnswers.includes(item.key) ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200'}`}>{item.key}</div>
                                <div className="flex-1 bg-white rounded-[1.2rem] border border-slate-200 overflow-hidden flex gap-2 shadow-sm">
                                  <div className="flex-1"><OptimizedQuillEditor modules={quillModulesFull} value={item.text} onChange={(content: string) => handleOptionChange(index, 'text', content)} placeholder={`Ketik teks opsi jawaban ${item.key} di sini...`} className="h-32 mb-12 text-slate-900" /></div>
                                  {options.length > 2 && <button type="button" onClick={() => removeOption(index)} className="mt-3 mr-3 p-2.5 h-fit text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Hapus Opsi"><MinusCircle className="w-5 h-5"/></button>}
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-200/60">
                                 <button type="button" onClick={() => handleOptionChange(index, 'showMedia', !item.showMedia)} className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm ${item.showMedia ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}><LayoutTemplate className="w-4 h-4"/> Lampirkan Media Tambahan</button>
                              </div>
                              
                              {item.showMedia && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-white border border-slate-200 rounded-[1.2rem] mt-2 animate-in fade-in slide-in-from-top-2">
                                  <div>
                                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">URL Gambar Opsi</label>
                                     <input type="url" value={item.image_url} onChange={(e) => handleOptionChange(index, 'image_url', e.target.value)} placeholder="Masukkan link/URL gambar..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" />
                                  </div>
                                  <div>
                                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">URL Audio Opsi</label>
                                     <div className="flex gap-2">
                                        <input type="url" value={item.audio_url} onChange={(e) => handleOptionChange(index, 'audio_url', e.target.value)} placeholder="Masukkan link/URL audio..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" />
                                        <label className={`shrink-0 flex items-center justify-center px-3.5 rounded-xl cursor-pointer transition-all shadow-sm ${isUploadingMedia ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-100'}`} title="Upload Audio Opsi">
                                           {isUploadingMedia ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                                           <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleDirectMediaUpload(e, 'audio_url', index)} disabled={isUploadingMedia} />
                                        </label>
                                     </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          <button type="button" onClick={addOption} className="mt-6 flex items-center gap-2 text-sm font-bold text-slate-500 bg-slate-50 px-4 py-4 rounded-2xl border-2 border-dashed border-slate-300 w-full justify-center hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all"><Plus className="w-5 h-5"/> Tambah Opsi Baru</button>
                        </div>
                      )}

                      {formData.question_type === 'short_answer' && (
                        <div className="space-y-3"><label className="text-sm font-bold text-slate-700">Kunci Jawaban Eksak *</label><input type="text" required name="correct_answer" value={formData.correct_answer} onChange={handleFormChange} placeholder="Ketik teks jawaban eksak yang benar di sini..." className="w-full p-5 bg-emerald-50 border-2 border-emerald-200 rounded-[1.2rem] text-emerald-900 font-black outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all shadow-sm text-lg" /></div>
                      )}

                      {(formData.question_type === 'true_false' || formData.question_type === 'essay') && (
                        <div className="p-10 bg-slate-50 border border-slate-200 rounded-[2rem] text-center text-slate-500 font-bold shadow-inner">
                           {formData.question_type === 'essay' ? 
                             <><FileText className="w-16 h-16 text-blue-300 mx-auto mb-4" /><p className="text-blue-900 font-black text-2xl">Format Esai Terbuka</p><p className="text-sm mt-2 font-medium text-slate-600">Siswa akan diberikan area teks yang luas untuk menyusun jawaban mereka secara bebas.</p></> : 
                             <><CheckCircle2 className="w-16 h-16 text-emerald-300 mx-auto mb-4" /><p className="text-emerald-900 font-black text-2xl">Sistem Benar/Salah</p><p className="text-sm mt-2 font-medium text-slate-600">Pilih kunci jawaban (Pernyataan Benar atau Salah) di panel atribut sebelah kanan.</p></>
                           }
                        </div>
                      )}
                    </div>

                    {/* PANEL KANAN ATRIBUT */}
                    <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm space-y-6 h-fit relative z-30">
                      <h2 className="text-xl font-black text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-2"><Settings className="w-6 h-6 text-slate-400"/> Atribut Penilaian</h2>

                      {(formData.question_type === 'multiple_choice' || formData.question_type === 'true_false') && (
                        <div className="space-y-3"><label className="text-xs font-black text-emerald-600 uppercase tracking-widest block">Kunci Jawaban Benar *</label>
                          <div className="relative">
                             <select name="correct_answer" value={formData.correct_answer} onChange={handleFormChange} className="w-full p-4 bg-emerald-50 border-2 border-emerald-200 text-emerald-800 font-black rounded-xl outline-none focus:ring-2 focus:ring-emerald-50 cursor-pointer appearance-none shadow-sm text-base">
                               {formData.question_type === 'multiple_choice' ? options.map(o => <option key={o.key} value={o.key}>Opsi {o.key}</option>) : <><option value="True">Pernyataan Benar</option><option value="False">Pernyataan Salah</option></>}
                             </select>
                             <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 pointer-events-none"/>
                          </div>
                        </div>
                      )}

                      {formData.question_type === 'complex_multiple_choice' && (
                        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm"><p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Kunci Jawaban Kompleks:</p><p className="text-2xl font-black text-emerald-600 mt-1">{complexAnswers.length > 0 ? complexAnswers.sort().join(', ') : 'Belum Dipilih'}</p></div>
                      )}

                      {/* Kunci Jawaban Menjodohkan Terstruktur di Atribut Penilaian */}
                      {formData.question_type === 'matching' && (
                         <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-[1.5rem] space-y-4 relative z-30 shadow-sm">
                            <p className="text-xs font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2 border-b border-emerald-200/60 pb-3"><KeyRound className="w-4 h-4"/> Kunci Menjodohkan</p>
                            {matchingPremises.map((p, idx) => (
                               <div key={p.id} className="flex items-center gap-3">
                                  <div className="w-8 h-8 shrink-0 bg-white border border-emerald-200 text-emerald-700 font-black text-xs rounded-xl flex items-center justify-center shadow-sm">{idx + 1}</div>
                                  <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0"/>
                                  <div className="relative flex-1">
                                     <select 
                                        value={matchingKeys[p.id] || ''} 
                                        onChange={(e) => setMatchingKeys(prev => ({...prev, [p.id]: e.target.value}))} 
                                        className="w-full bg-white border border-emerald-200 text-emerald-700 text-sm font-bold rounded-xl p-2.5 outline-none cursor-pointer focus:ring-2 focus:ring-emerald-400 appearance-none shadow-sm"
                                     >
                                        <option value="" disabled>Pilih Pasangan Kanan...</option>
                                        {matchingResponses.map((r, rIdx) => (
                                           <option key={r.id} value={r.id}>Kanan {String.fromCharCode(65 + rIdx)}</option>
                                        ))}
                                     </select>
                                     <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none"/>
                                  </div>
                               </div>
                            ))}
                         </div>
                      )}

                      <div className="space-y-3"><label className="text-xs font-black text-slate-500 uppercase tracking-widest block">Bobot Poin Soal</label><input type="number" step="0.1" name="points" value={formData.points} onChange={handleFormChange} placeholder="Misal: 1.5" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-base font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 shadow-sm" /></div>
                      
                      {(formData.question_type === 'complex_multiple_choice' || formData.question_type === 'matching') && (
                        <div className="space-y-3 pt-5 border-t border-slate-100">
                           <label className="text-xs font-black text-indigo-600 uppercase tracking-widest block">Sistem Penilaian *</label>
                           <div className="relative">
                              <select name="scoring_type" value={formData.scoring_type} onChange={handleFormChange} className="w-full p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm cursor-pointer appearance-none shadow-sm">
                                <option value="all_or_nothing">Mutlak (1 Salah = Poin 0)</option>
                                <option value="partial">Proporsional (Dihitung per opsi benar)</option>
                              </select>
                              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-600 pointer-events-none"/>
                           </div>
                        </div>
                      )}

                      <div className="space-y-3"><label className="text-xs font-black text-slate-500 uppercase tracking-widest block">Tingkat Kesulitan Soal</label>
                         <div className="relative">
                           <select name="difficulty" value={formData.difficulty} onChange={handleFormChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer appearance-none shadow-sm">
                             <option value={1}>1 - Sangat Mudah (C1)</option><option value={2}>2 - Mudah (C2)</option><option value={3}>3 - Sedang (C3)</option><option value={4}>4 - Sulit (C4)</option><option value={5}>5 - Sangat Sulit (HOTS/C5-C6)</option>
                           </select>
                           <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none"/>
                         </div>
                      </div>
                      
                      <div className="pt-6 border-t border-slate-100">
                         <label className="flex items-center gap-4 cursor-pointer p-4 border border-slate-200 rounded-2xl bg-slate-50 hover:bg-blue-50 transition-colors shadow-sm">
                            <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleFormChange} className="w-6 h-6 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer shadow-sm" />
                            <span className="text-sm font-black text-slate-800 select-none">Aktifkan Soal Ini</span>
                         </label>
                      </div>
                      
                      <button onClick={handleFormSubmit} disabled={isSubmittingForm} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-70 transition-all w-full mt-6 sm:hidden">
                        {isSubmittingForm ? <LoaderCircle className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5"/>} Simpan Soal
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MINI: MUNCUL JIKA KLIK 'BUAT SOAL' DARI HALAMAN DEPAN */}
      {isSelectMapelModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[90] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 border border-slate-100 flex flex-col">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
               <h2 className="text-xl font-black text-slate-800">Pilih Target Mapel</h2>
               <button onClick={() => setIsSelectMapelModalOpen(false)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-rose-500 rounded-full shadow-sm transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-4">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Mata Pelajaran (Hanya yang Diampu)</label>
              <div className="relative">
                 {myOwnedSubjects.length > 0 ? (
                     <select value={importSelectedSubject} onChange={(e) => setImportSelectedSubject(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer appearance-none shadow-sm">
                        <option value="" disabled>-- Pilih Mapel --</option>
                        {myOwnedSubjects.map(subj => <option key={subj.id} value={subj.id}>{subj.name} - {subj.grade_level}</option>)}
                     </select>
                 ) : (
                     <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-sm font-bold text-center">Anda belum ditetapkan sebagai pengampu mata pelajaran apapun.</div>
                 )}
                 <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="p-8 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
               <button onClick={() => setIsSelectMapelModalOpen(false)} className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 shadow-sm transition-colors">Batal</button>
               {myOwnedSubjects.length > 0 && (
                 <button onClick={() => { if(!importSelectedSubject) { showToast("Pilih Mapel dulu!", "warning"); return; } setIsSelectMapelModalOpen(false); openCreateForm(subjects.find(s => s.id === importSelectedSubject)); }} className="flex-1 py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2">Lanjut <ArrowRight className="w-4 h-4"/></button>
               )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT EXCEL (POPUP STYLE) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm overflow-y-auto flex items-center justify-center p-4 md:p-8">
          <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300 overflow-hidden border border-slate-200">
            
            {/* HEADER MODAL */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 sticky top-0 z-20">
              <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <FileUp className="w-7 h-7 text-emerald-500"/> Import Massal Soal
                </h2>
                <p className="text-sm text-slate-500 font-medium mt-1">Unggah file Excel untuk menambahkan soal ke dalam Bank Soal secara cepat.</p>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="p-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-full transition-all shadow-sm">
                <X className="w-5 h-5"/>
              </button>
            </div>

            {/* AREA KONTEN MODAL */}
            <div className="p-6 md:p-8 overflow-y-auto bg-slate-50/50 flex-1 space-y-8">
              {importError && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-6 py-5 rounded-2xl flex items-start gap-4 shadow-sm"><div className="p-2 bg-rose-100 rounded-full shrink-0"><AlertCircle className="w-6 h-6" /></div><p className="text-sm font-bold mt-1.5">{importError}</p></div>}
              {importSuccess && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-6 py-5 rounded-3xl flex items-start gap-4 shadow-sm"><div className="p-3 bg-emerald-100 rounded-full shrink-0"><CheckCircle2 className="w-6 h-6 text-emerald-600" /></div><div><p className="font-black text-lg mb-1">{importSuccess}</p><p className="text-sm font-medium text-emerald-700/80">Semua soal beserta medianya telah berhasil masuk ke database dan siap digunakan.</p></div></div>}

              <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm">
                 <div className="bg-blue-50 border border-blue-100 rounded-[1.5rem] p-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                       <div className="p-2 bg-blue-100 text-blue-600 rounded-full shrink-0 mt-1"><Info className="w-6 h-6" /></div>
                       <div>
                          <h3 className="font-bold text-blue-900 text-lg mb-1">Panduan Import & Validasi</h3>
                          <p className="text-sm text-blue-700/80 font-medium">Unduh template, isi soal sesuai panduan pada baris pertama, lalu unggah kembali file Excel tersebut ke dalam kotak di bawah ini.</p>
                       </div>
                    </div>
                    <button type="button" onClick={downloadTemplate} className="shrink-0 bg-white border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 font-bold px-6 py-3 rounded-xl shadow-sm transition-all flex items-center gap-2">
                       <DownloadIcon className="w-4 h-4"/> Unduh Template Excel
                    </button>
                 </div>

                 {/* PILIH TARGET MATA PELAJARAN (HANYA YANG DIAMPU) */}
                 <div className="mb-8">
                   <label className="font-black text-slate-800 mb-3 block text-lg flex items-center gap-2"><BookOpen className="w-5 h-5 text-slate-400"/> Pilih Target Mata Pelajaran</label>
                   <div className="relative max-w-2xl">
                     <select value={importSelectedSubject} onChange={(e) => setImportSelectedSubject(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-base font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm appearance-none">
                       <option value="" disabled>-- Klik untuk memilih mata pelajaran --</option>
                       {myOwnedSubjects.map(subj => <option key={subj.id} value={subj.id}>{subj.name} - {subj.grade_level}</option>)}
                     </select>
                     <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                   </div>
                 </div>
                 
                 {/* AREA DROP EXCEL */}
                 <label className={`border-2 border-dashed rounded-[2rem] p-12 md:p-16 flex flex-col items-center justify-center text-center cursor-pointer transition-all group ${importFile ? 'border-emerald-400 bg-emerald-50/50' : 'border-blue-300 bg-blue-50/30 hover:border-blue-500 hover:bg-blue-50'}`}>
                   <div className="p-5 bg-white rounded-full shadow-sm border border-slate-200 mb-4 group-hover:scale-110 transition-all duration-300">
                      {importFile ? <FileSpreadsheet className="w-10 h-10 text-emerald-500" /> : <FileUp className="w-10 h-10 text-blue-600" />}
                   </div>
                   <span className="text-xl font-black text-slate-700 mb-1">{importFile ? importFile.name : 'Pilih File Excel (.xlsx)'}</span>
                   {!importFile && <span className="text-sm font-medium text-slate-500">Klik di sini untuk menelusuri file dari komputer Anda</span>}
                   <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportFileChange} />
                 </label>
              </div>
              
              {/* TABEL PREVIEW MUNCUL DI BAWAH JIKA ADA DATA */}
              {previewData.length > 0 && (
                 <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden flex flex-col animate-in slide-in-from-bottom-4">
                   <div className="px-6 md:px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/80">
                     <h2 className="font-black text-slate-800 flex items-center gap-3 text-lg">Preview Data Soal <span className="bg-emerald-100 text-emerald-700 text-xs px-3 py-1.5 rounded-lg font-black tracking-widest uppercase">{previewData.length} Baris Siap</span></h2>
                     <button onClick={handleUploadData} disabled={isImporting} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-md shadow-blue-200 active:scale-95 w-full md:w-auto">
                        {isImporting ? <LoaderCircle className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} 
                        {isImporting ? 'Menyimpan...' : 'Simpan Semua ke Database'}
                     </button>
                   </div>
                   <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                     <table className="w-full text-sm text-left whitespace-nowrap">
                       <thead className="bg-white text-slate-500 text-xs font-black uppercase tracking-widest border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                          <tr><th className="px-8 py-4">Paket</th><th className="px-8 py-4">Tipe Soal</th><th className="px-8 py-4">Cuplikan Pertanyaan</th><th className="px-8 py-4 text-center">Bobot</th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {previewData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                               <td className="px-8 py-5 font-bold text-cyan-600">{row.package_name}</td>
                               <td className="px-8 py-5"><span className="bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border border-slate-200">{row.question_type.replace(/_/g, ' ')}</span></td>
                               <td className="px-8 py-5 text-slate-800 font-medium max-w-[400px] truncate">{row.question_text}</td>
                               <td className="px-8 py-5 text-center font-black text-emerald-600">{row.points}</td>
                            </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}