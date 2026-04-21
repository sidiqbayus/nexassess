'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ChevronLeft, ChevronRight, Flag, Monitor, CheckCircle2, 
  AlertTriangle, LoaderCircle, Maximize, Clock, Bookmark, 
  UserCircle2, HelpCircle, Trash2, Headphones, MapPin, Globe, Lock, MessageSquare
} from 'lucide-react';
import dynamic from 'next/dynamic';

import katex from 'katex';
import 'katex/dist/katex.min.css';
import 'react-quill-new/dist/quill.snow.css';

if (typeof window !== 'undefined') {
  (window as any).katex = katex;
}

const ReactQuill = dynamic(() => import('react-quill-new'), { 
  ssr: false, 
  loading: () => <div className="h-32 bg-slate-50 border border-slate-200 rounded-[2rem] flex items-center justify-center text-slate-400 font-bold text-sm md:text-base">Memuat Editor Ujian...</div> 
});

const OptimizedQuillEditor = ({ initialValue, onChange, placeholder, minHeight, isEssay, allowMedia }: any) => {
  const debounceRef = useRef<any>(null);

  const handleChange = (content: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(content), 500); 
  };

  const modules = useMemo(() => {
    const baseToolbar = [
      ['bold', 'italic', 'underline', 'strike'], 
      [{ 'script': 'sub'}, { 'script': 'super' }], 
      ['formula']
    ];

    if (isEssay && allowMedia) {
       return {
         toolbar: [
           ...baseToolbar,
           ['link', 'image', 'video'], 
           [{ 'list': 'ordered'}, { 'list': 'bullet' }],
           ['clean']
         ]
       };
    } 
    else {
       return {
         toolbar: [
           ...baseToolbar,
           ...(isEssay ? [[{ 'list': 'ordered'}, { 'list': 'bullet' }]] : []), 
           ['clean']
         ]
       };
    }
  }, [isEssay, allowMedia]);

  return (
    <div className={`bg-white border-2 border-slate-200 rounded-[1.2rem] md:rounded-[1.5rem] overflow-hidden focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50 transition-all shadow-sm ${minHeight}`}>
      <ReactQuill 
        theme="snow" 
        modules={modules} 
        defaultValue={initialValue || ''} 
        onChange={handleChange} 
        placeholder={placeholder} 
        className="h-full border-none"
      />
    </div>
  );
};

const getDriveId = (url: string | undefined | null) => {
  if (!url) return null;
  const match = url.match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)|docs\.google\.com\/file\/d\/)([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

const getSafeImageUrl = (url: string | undefined | null) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  
  const driveId = getDriveId(url);
  if (driveId) {
     return `https://lh3.googleusercontent.com/d/${driveId}`;
  }
  return url; 
};

const getDriveMediaUrl = (url: string | undefined | null) => {
  const id = getDriveId(url);
  return id ? `https://docs.google.com/uc?export=open&id=${id}` : (url || '');
};

const getAvatarUrl = (url: string | undefined | null) => {
  if (!url) return '';
  const driveId = getDriveId(url);
  if (driveId) return `https://lh3.googleusercontent.com/d/${driveId}`;
  if (url.startsWith('data:') || url.startsWith('http')) return url;
  return '';
};

const LimitedAudioPlayer = ({ url, limit, questionId, studentId, onLimitReached }: { url: string, limit: number, questionId: string, studentId: string, onLimitReached: (msg:string)=>void }) => {
  const storageKey = `audio_plays_${studentId}_${questionId}`;
  const [playCount, setPlayCount] = useState<number>(0);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    const stored = localStorage.getItem(storageKey);
    if (stored) setPlayCount(parseInt(stored, 10));
  }, [storageKey]);

  const directUrl = getDriveMediaUrl(url); 
  const isUnlimited = !limit || limit <= 0;
  const canPlay = isUnlimited || playCount < limit;

  const handlePlay = (e: any) => {
    if (!canPlay) {
      e.preventDefault();
      e.target.pause();
      onLimitReached(`Batas pemutaran audio sudah habis (${limit} kali maksimal).`);
    }
  };

  const handleEnded = () => {
    if (!isUnlimited) {
      const newCount = playCount + 1;
      setPlayCount(newCount);
      localStorage.setItem(storageKey, newCount.toString());
    }
  };

  if (!hasMounted) return null;

  return (
    <div className={`mt-4 md:mt-5 flex flex-col gap-2 p-4 md:p-5 bg-slate-50 border rounded-xl md:rounded-2xl w-full max-w-2xl mx-auto transition-all ${canPlay ? 'border-slate-200' : 'border-rose-200 bg-rose-50/50'}`} onContextMenu={e => e.preventDefault()}>
      <div className="flex flex-wrap items-center justify-between px-1 md:px-2 gap-2">
        <span className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 md:gap-2">
          <Headphones className={`w-3.5 h-3.5 md:w-4 md:h-4 ${canPlay ? 'text-blue-500' : 'text-rose-400'}`} />
          Audio Ujian
        </span>
        {isUnlimited ? (
          <span className="text-[9px] md:text-[10px] font-black px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm uppercase tracking-widest">
            Putar Bebas
          </span>
        ) : (
          <span className={`text-[9px] md:text-[10px] font-black px-2.5 py-1 rounded-md shadow-sm uppercase tracking-widest ${canPlay ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
            Sisa Putar: {Math.max(0, limit - playCount)} / {limit}
          </span>
        )}
      </div>
      
      <audio 
        preload="auto"
        controls={canPlay} 
        controlsList="nodownload noremoteplayback noplaybackrate" 
        className={`w-full h-10 md:h-12 outline-none transition-all duration-500 mt-2 ${canPlay ? 'opacity-100 grayscale-0' : 'opacity-40 grayscale pointer-events-none'}`}
        onPlay={handlePlay}
        onEnded={handleEnded}
      >
        <source src={directUrl} type="audio/mpeg" />
      </audio>
      
      {!canPlay && (
        <div className="text-[9px] md:text-[10px] text-center text-rose-600 font-bold mt-2 uppercase tracking-widest bg-rose-50 py-2 rounded-lg border border-rose-100">
          Terkunci: Batas pemutaran maksimal tercapai.
        </div>
      )}
    </div>
  );
};

const TimerDisplay = ({ totalSeconds, sessionStartTime, onTimeUp }: { totalSeconds: number, sessionStartTime: number, onTimeUp: () => void }) => {
  const [timeLeft, setTimeLeft] = useState(() => {
    const durationMs = totalSeconds * 1000;
    const endTime = sessionStartTime + durationMs;
    let remaining = Math.floor((endTime - Date.now()) / 1000);
    return Math.max(0, Math.min(remaining, totalSeconds));
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const durationMs = totalSeconds * 1000;
      const endTime = sessionStartTime + durationMs;
      let remaining = Math.floor((endTime - Date.now()) / 1000);
      remaining = Math.max(0, Math.min(remaining, totalSeconds));
      
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        onTimeUp();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [totalSeconds, sessionStartTime, onTimeUp]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full text-center flex flex-row md:flex-col items-center justify-between md:justify-center">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest md:mb-2 flex items-center gap-1.5 md:hidden"><Clock className="w-3.5 h-3.5"/> Waktu</p>
      <div className={`text-2xl md:text-4xl font-black tracking-tight font-mono ${timeLeft < 300 ? 'text-rose-600 animate-pulse' : 'text-slate-800'}`}>
        {formatTime(timeLeft)}
      </div>
      <div className="w-1/3 md:w-full bg-slate-100 rounded-full h-1.5 md:h-2 mt-0 md:mt-4 overflow-hidden shadow-inner hidden md:block">
        <div className={`h-full rounded-full transition-all duration-1000 ${timeLeft < 300 ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: `${totalSeconds > 0 ? Math.max(0, Math.min(100, (timeLeft / totalSeconds) * 100)) : 0}%` }}></div>
      </div>
    </div>
  );
};

const safeOverlays = `
  <div class="absolute top-0 left-0 w-full h-[20%] z-10 cursor-not-allowed" title="Akses diblokir"></div>
  <div class="absolute bottom-0 left-0 w-full h-[20%] z-10 cursor-not-allowed" title="Akses diblokir"></div>
  <div class="absolute top-0 left-0 w-[15%] h-full z-10 cursor-not-allowed" title="Akses diblokir"></div>
  <div class="absolute top-0 right-0 w-[15%] h-full z-10 cursor-not-allowed" title="Akses diblokir"></div>
`;

const SmartMediaRenderer = ({ url, className = "" }: { url?: string, className?: string }) => {
  if (!url || typeof url !== 'string') return null;

  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  if (ytMatch) {
    return (
      <div className={`relative w-full max-w-3xl mx-auto aspect-video rounded-xl md:rounded-2xl overflow-hidden shadow-sm border border-slate-200 mt-4 md:mt-5 ${className}`} onContextMenu={(e) => e.preventDefault()}>
        <iframe src={`https://www.youtube.com/embed/${ytMatch[1]}?modestbranding=1&rel=0&controls=0&fs=0&disablekb=1&iv_load_policy=3`} className="w-full h-full border-0" allow="autoplay" />
        <div dangerouslySetInnerHTML={{ __html: safeOverlays }} />
      </div>
    );
  }

  const driveId = getDriveId(url);
  if (driveId) {
    return (
      <div className={`relative w-full max-w-3xl mx-auto aspect-video rounded-xl md:rounded-2xl overflow-hidden shadow-sm border border-slate-200 mt-4 md:mt-5 ${className}`} onContextMenu={(e) => e.preventDefault()}>
        <iframe src={`https://drive.google.com/file/d/${driveId}/preview`} className="w-full h-full border-0" allow="autoplay"></iframe>
        <div dangerouslySetInnerHTML={{ __html: safeOverlays }} />
      </div>
    );
  }

  if (url.match(/\.(mp4|webm|ogg)$/i)) {
    return (
      <div className={`relative w-full max-w-3xl mx-auto aspect-video rounded-xl md:rounded-2xl overflow-hidden shadow-sm border border-slate-200 mt-4 md:mt-5 bg-black ${className}`} onContextMenu={(e) => e.preventDefault()}>
        <video src={url} controls controlsList="nodownload nofullscreen noremoteplayback" disablePictureInPicture className="w-full h-full" />
        <div className="absolute top-0 left-0 w-full h-[15%] z-10 bg-transparent"></div>
        <div className="absolute bottom-0 right-0 w-[30%] h-[20%] z-10 bg-transparent cursor-not-allowed" title="Fullscreen dinonaktifkan"></div>
      </div>
    );
  }
  
  if (url.match(/\.(mp3|wav|m4a)$/i)) {
    return <audio src={url} controls controlsList="nodownload noremoteplayback" className={`w-full h-10 md:h-12 outline-none mt-4 md:mt-5 ${className}`} onContextMenu={(e) => e.preventDefault()} />;
  }
  
  return (
    <div className="mt-4 md:mt-5" onContextMenu={(e) => e.preventDefault()}>
      <img src={getSafeImageUrl(url)} alt="Media Ujian" referrerPolicy="no-referrer" className={`rounded-xl md:rounded-2xl max-h-[300px] md:max-h-[400px] object-contain border border-slate-200 shadow-sm ${className}`} />
    </div>
  );
};

const processHtmlMedia = (html: string) => {
  if (!html || typeof html !== 'string') return '';
  let p = html;
  p = p.replace(/allowfullscreen(="")?/gi, '');
  
  p = p.replace(/<img[^>]+src="([^"]+)"[^>]*>/gi, (match, src) => {
    const safeSrc = getSafeImageUrl(src);
    if (safeSrc !== src) {
      return match.replace(src, safeSrc).replace('<img', '<img referrerPolicy="no-referrer"');
    }
    return match;
  });

  p = p.replace(
    /<iframe[^>]*src="(?:https?:)?\/\/www\.youtube\.com\/embed\/([^"?]+)[^"]*"[^>]*><\/iframe>/gi,
    (match, videoId) => `<div class="relative w-full max-w-3xl mx-auto aspect-video rounded-xl md:rounded-2xl overflow-hidden shadow-sm border border-slate-200 my-4 md:my-5"><iframe src="https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&controls=0&fs=0&disablekb=1&iv_load_policy=3" class="w-full h-full border-0"></iframe>${safeOverlays}</div>`
  );
  p = p.replace(
    /(?:<a[^>]*href="|>|\s|^)(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s<]{11})[^<]*(?:<\/a>|<|\s|$)/g, 
    (match, videoId) => `<div class="relative w-full max-w-3xl mx-auto aspect-video rounded-xl md:rounded-2xl overflow-hidden shadow-sm border border-slate-200 my-4 md:my-5"><iframe src="https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&controls=0&fs=0&disablekb=1&iv_load_policy=3" class="w-full h-full border-0"></iframe>${safeOverlays}</div>`
  );
  p = p.replace(
    /<a[^>]*href="((?:https?:\/\/)?drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)([a-zA-Z0-9_-]+)[^"]*)"[^>]*>(.*?)<\/a>/gi, 
    (match, fullUrl, driveId, text) => {
      if (text.toUpperCase().includes('AUDIO') || text.toUpperCase().includes('MP3') || text.toUpperCase().includes('SUARA') || text.toUpperCase().includes('LISTENING')) {
          return `<div class="my-4 md:my-5 p-4 md:p-5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl w-full max-w-2xl mx-auto"><span class="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">🎧 Audio Sisipan</span><audio src="https://docs.google.com/uc?export=open&id=${driveId}" preload="auto" controls controlsList="nodownload noremoteplayback" class="w-full h-10 md:h-12 outline-none mt-2"></audio></div>`;
      }
      return `<div class="relative w-full max-w-3xl mx-auto aspect-video rounded-xl md:rounded-2xl overflow-hidden shadow-sm border border-slate-200 my-4 md:my-5"><iframe src="https://drive.google.com/file/d/${driveId}/preview" class="w-full h-full border-0"></iframe>${safeOverlays}</div>`;
    }
  );
  p = p.replace(/<a[^>]*href="([^"]+\.(?:mp3|wav|m4a))"[^>]*>.*?<\/a>/gi, '<div class="my-4 md:my-5 p-4 md:p-5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl w-full max-w-2xl mx-auto"><span class="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">🎧 Audio Sisipan</span><audio src="$1" preload="auto" controls controlsList="nodownload noremoteplayback" class="w-full h-10 md:h-12 outline-none mt-2"></audio></div>');
  p = p.replace(
    /(?:>|\s|^)(?:https?:\/\/)?drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)([a-zA-Z0-9_-]+)[^<]*(?:<|\s|$)/g, 
    (match, driveId) => `<div class="relative w-full max-w-3xl mx-auto aspect-video rounded-xl md:rounded-2xl overflow-hidden shadow-sm border border-slate-200 my-4 md:my-5"><iframe src="https://drive.google.com/file/d/${driveId}/preview" class="w-full h-full border-0"></iframe>${safeOverlays}</div>`
  );
  p = p.replace(/<a[^>]*href="([^"]+\.(?:mp4|webm|ogg))"[^>]*>.*?<\/a>/gi, `<div class="relative w-full max-w-3xl mx-auto aspect-video rounded-xl md:rounded-2xl overflow-hidden shadow-sm border border-slate-200 my-4 md:my-5 bg-black" oncontextmenu="return false;"><video src="$1" controls controlsList="nodownload nofullscreen noremoteplayback" disablePictureInPicture class="w-full h-full"></video><div class="absolute top-0 left-0 w-full h-[15%] z-10 bg-transparent"></div><div class="absolute bottom-0 right-0 w-[30%] h-[20%] z-10 bg-transparent cursor-not-allowed" title="Fullscreen dinonaktifkan"></div></div>`);
  return p;
};

const isValidStr = (val: any) => {
    if (val === null || val === undefined) return false;
    const clean = String(val).replace(/<[^>]*>?/gm, '').replace(/ /g, '').trim().toLowerCase();
    return clean !== '' && clean !== 'null';
};

const MatchingInteractiveUI = ({ currentQuestion, selectedAnswerJSON, onChange }: any) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  const [lines, setLines] = useState<Array<{x1: number, y1: number, x2: number, y2: number}>>([]);
  const [activePremis, setActivePremis] = useState<string | null>(null);

  const { premises, responses } = useMemo(() => {
    let pSet = new Set<string>();
    let rSet = new Set<string>();

    let opts = [];
    if (Array.isArray(currentQuestion?.options)) opts = currentQuestion.options;
    else if (typeof currentQuestion?.options === 'string') {
        try { opts = JSON.parse(currentQuestion.options); } catch (e) {}
    }

    let ansArr = [];
    if (Array.isArray(currentQuestion?.correct_answer)) ansArr = currentQuestion.correct_answer;
    else if (typeof currentQuestion?.correct_answer === 'string') {
        try { ansArr = JSON.parse(currentQuestion.correct_answer); } catch(e) {}
    }

    [...opts, ...ansArr].forEach((item: any) => {
        if (!item || typeof item !== 'object') return;
        
        const leftVal = item.left ?? item.premis ?? item.key;
        const rightVal = item.right ?? item.respons;

        if (leftVal !== undefined || rightVal !== undefined) {
            if (isValidStr(leftVal)) pSet.add(String(leftVal));
            if (isValidStr(rightVal)) rSet.add(String(rightVal));
        } else {
            const textVal = item.text ?? item.value ?? item.title;
            if (isValidStr(textVal)) {
                rSet.add(String(textVal)); 
            }
        }
    });

    let pList = Array.from(pSet).sort(() => Math.random() - 0.5);
    let rList = Array.from(rSet).sort(() => Math.random() - 0.5);

    return { premises: pList, responses: rList };
  }, [currentQuestion?.options, currentQuestion?.correct_answer]);

  const currentMap = useMemo(() => {
    try { return JSON.parse(selectedAnswerJSON || '{}'); } 
    catch (e) { return {}; }
  }, [selectedAnswerJSON]);

  const updateLines = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: any[] = [];
    
    Object.entries(currentMap).forEach(([premis, respons]) => {
      const lNode = leftRefs.current[premis];
      const rNode = rightRefs.current[respons as string];
      if (lNode && rNode) {
        const lRect = lNode.getBoundingClientRect();
        const rRect = rNode.getBoundingClientRect();
        newLines.push({
          x1: lRect.right - containerRect.left,
          y1: lRect.top + lRect.height / 2 - containerRect.top,
          x2: rRect.left - containerRect.left,
          y2: rRect.top + rRect.height / 2 - containerRect.top,
        });
      }
    });
    setLines(newLines);
  }, [currentMap]);

  useEffect(() => {
    const timeout = setTimeout(updateLines, 50); 
    window.addEventListener('resize', updateLines);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', updateLines);
    }
  }, [updateLines]);

  const handleLeftClick = (premis: string) => {
    if (activePremis === premis) setActivePremis(null);
    else setActivePremis(premis);
  };

  const handleRightClick = (respons: string) => {
    if (activePremis) {
      const newMap = { ...currentMap, [activePremis]: respons };
      onChange(JSON.stringify(newMap));
      setActivePremis(null);
    } else {
      const premisToClear = Object.keys(currentMap).find(k => currentMap[k] === respons);
      if (premisToClear) {
        const newMap = { ...currentMap };
        delete newMap[premisToClear];
        onChange(JSON.stringify(newMap));
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 mb-2 pl-1 md:pl-2">
        <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 md:gap-2">
          <HelpCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500"/> Hubungkan Kotak Kiri dan Kanan.
        </p>
        <button onClick={() => onChange('{}')} className="text-[9px] md:text-[10px] font-bold text-rose-500 hover:bg-rose-50 px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg transition-colors flex items-center gap-1.5 border border-rose-100 self-start sm:self-auto">
          <Trash2 className="w-3 h-3"/> Hapus Garis
        </button>
      </div>

      <div className="bg-white border-2 border-slate-200 p-4 md:p-10 rounded-2xl md:rounded-[2rem] shadow-sm relative overflow-hidden min-h-[250px] md:min-h-[300px]" ref={containerRef}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {lines.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" className="animate-in fade-in duration-300 drop-shadow-sm md:strokeWidth-[4] md:drop-shadow-md" />
          ))}
        </svg>

        <div className="flex flex-col md:flex-row justify-between gap-8 md:gap-24 relative z-10">
          {/* Kotak Kiri */}
          <div className="flex-1 flex flex-col gap-3 md:gap-4">
            {premises.map((p: string, idx: number) => {
               const isConnected = !!currentMap[p];
               return (
                 <div 
                   key={p} 
                   ref={el => { leftRefs.current[p] = el; }}
                   onClick={() => handleLeftClick(p)}
                   className={`p-3 md:p-5 rounded-xl md:rounded-2xl cursor-pointer transition-all border-2 flex items-center gap-3 md:gap-4 relative
                     ${activePremis === p ? 'bg-blue-50 border-blue-500 shadow-md scale-[1.02] z-20' : 
                       isConnected ? 'bg-slate-50 border-blue-300 opacity-90' : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-slate-50'}
                   `}
                 >
                   <div className={`w-6 h-6 md:w-8 md:h-8 shrink-0 rounded-lg md:rounded-xl flex items-center justify-center font-black text-[10px] md:text-xs transition-colors border ${activePremis === p || isConnected ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{idx + 1}</div>
                   <div className="font-bold text-slate-800 text-xs md:text-sm [&>p]:m-0 break-words" dangerouslySetInnerHTML={{ __html: processHtmlMedia(p) }} />
                   <div className={`absolute -right-2 top-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 rounded-full border-2 bg-white ${activePremis === p || isConnected ? 'border-blue-500' : 'border-slate-300'}`}></div>
                 </div>
               )
            })}
          </div>

          {/* Kotak Kanan */}
          <div className="flex-1 flex flex-col gap-3 md:gap-4">
            {responses.map((r: any) => {
               const isConnected = Object.values(currentMap).includes(r);
               return (
                 <div 
                   key={r} 
                   ref={el => { rightRefs.current[r] = el; }}
                   onClick={() => handleRightClick(r)}
                   className={`p-3 md:p-5 rounded-xl md:rounded-2xl cursor-pointer transition-all border-2 flex items-center justify-center text-center relative
                     ${isConnected ? 'bg-slate-50 border-blue-400 opacity-90' : 'bg-white border-slate-200 hover:border-amber-400 hover:bg-amber-50'}
                   `}
                 >
                   <div className={`absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 rounded-full border-2 bg-white ${isConnected ? 'border-blue-500' : 'border-slate-300'}`}></div>
                   <div className="font-bold text-slate-700 text-xs md:text-sm [&>p]:m-0 break-words" dangerouslySetInnerHTML={{ __html: processHtmlMedia(r) }} />
                 </div>
               )
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- INTERFACES ---
interface Question {
  id: string; question_text: string; question_type: string; subject_id?: string;
  image_url?: string; audio_url?: string; video_url?: string; file_url?: string; audio_duration?: number;
  audio_play_limit?: number; 
  options?: any; correct_answer?: any; question_order: number;
  points: number; package_name?: string; scoring_type?: string;
  allow_media_upload?: boolean;
}

interface Answer { question_id: string; selected_answer: string | null; flag_status: string; }
interface ExamSession { 
  id: string; exam_id: string; status: string; 
  current_question_index: number; student_id: string; 
  start_time?: string; started_at?: string; created_at?: string; submitted_at?: string;
  current_violation_count?: number; locked_device_id?: string; 
  security_overrides?: any; resume_token?: string;
  ip_address?: string; browser_info?: string; device_fingerprint?: string;
  total_score?: number; percentage_score?: number; is_passed?: boolean;
}
interface ExamInfo { 
  subject: string; grade_level: string; duration_seconds: number; start_time_ms: number;
  min_working_minutes: number; randomize_questions: boolean; randomize_options: boolean; show_results_after: boolean;
  passing_score: number; max_tab_switches: number;
}

export default function ExamLivePage() {
  const params = useParams();
  const examId = useMemo(() => {
    if (!params) return '';
    const idParam = params.id || params.examId;
    return Array.isArray(idParam) ? idParam[0] : idParam || '';
  }, [params]);

  const router = useRouter();

  const [appTimeZone, setAppTimeZone] = useState('Asia/Jakarta');
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean; type: 'alert' | 'confirm' | 'info' | 'success'; title: string; message: string;
    onConfirm?: () => void; onCancel?: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  const showDialog = useCallback((type: 'alert'|'confirm'|'info'|'success', title: string, message: string, onConfirm?: () => void, onCancel?: () => void) => {
    setDialogConfig({ isOpen: true, type, title, message, onConfirm, onCancel });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogConfig(prev => ({ ...prev, isOpen: false }));
  }, []);

  const [session, setSession] = useState<ExamSession | null>(null);
  const [studentName, setStudentName] = useState<string>('Siswa CBT'); 
  const [studentNIS, setStudentNIS] = useState<string>('-'); 
  const [studentRoom, setStudentRoom] = useState<string>(''); 
  const [studentAvatar, setStudentAvatar] = useState<string>(''); 

  const [examInfo, setExamInfo] = useState<ExamInfo>({ 
    subject: 'Memuat...', grade_level: '...', duration_seconds: 0, start_time_ms: 0, 
    min_working_minutes: 0, randomize_questions: false, randomize_options: false, show_results_after: false, passing_score: 0, max_tab_switches: 3
  });
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [resumeTokenInput, setResumeTokenInput] = useState('');
  const [isTokenPromptOpen, setIsTokenPromptOpen] = useState(false);

  const [securitySettings, setSecuritySettings] = useState<any>(null);
  const [isBlockedFullscreen, setIsBlockedFullscreen] = useState(false);
  const [isBlockedGeo, setIsBlockedGeo] = useState(false);
  const [geoErrorMsg, setGeoErrorMsg] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  const [tabViolationCount, setTabViolationCount] = useState(0);
  const tabViolationCountRef = useRef(0);
  const maxTabSwitchesRef = useRef(3); 

  const dirtyAnswersRef = useRef<Set<string>>(new Set());
  const sessionRef = useRef<ExamSession | null>(null);
  const latestAnswersRef = useRef<Record<string, Answer>>({});

  const isAnswerFilled = (text: string | null | undefined) => {
    if (!text) return false;
    if (text === '{}' || text === '[]') return false; 
    if (text.includes('<img') || text.includes('<iframe') || text.includes('<audio') || text.includes('<video')) return true;
    const plainText = text.replace(/<[^>]*>?/gm, '').replace(/ /g, '').replace(/\s/g, '').trim();
    return plainText.length > 0;
  };

  const currentQuestion = questions[currentIndex];
  const answeredQuestions = Object.values(answers).filter(a => isAnswerFilled(a.selected_answer)).length;

  const processedQuestionHtml = useMemo(() => {
    return currentQuestion ? processHtmlMedia(currentQuestion.question_text) : '';
  }, [currentQuestion?.question_text]);

  const parseExamConfig = useCallback((data: any) => {
      if (!data) return { isShowResult: false, passing_score: 0, minTime: 0, randQ: false, randOpt: false, maxTab: 3 };
      const checkTrue = (fields: any[]) => fields.some(val => val === true || val === 'true' || val === 1 || val === '1');
      return {
          isShowResult: checkTrue([data.show_result_after, data.show_results_after, data.show_results, data.tampilkan_hasil]),
          passing_score: Number(data.passing_score ?? data.kkm ?? data.nilai_kkm ?? 0),
          minTime: Number(data.min_working_minutes ?? 0),
          randQ: checkTrue([data.randomize_questions, data.acak_soal]),
          randOpt: checkTrue([data.randomize_options, data.acak_opsi]),
          maxTab: Number(data.max_tab_switches ?? 3)
      };
  }, []);

  const flushAutoSave = async (newIndex?: number) => {
    if (!sessionRef.current) return;
    const dirtyIds = Array.from(dirtyAnswersRef.current);
    dirtyAnswersRef.current.clear();

    const currentAnswers = latestAnswersRef.current;

    for (const qId of dirtyIds) {
      const ans = currentAnswers[qId];
      if (!ans) continue;
      
      try {
        const { data: existing } = await supabase.from('student_responses').select('id').eq('session_id', sessionRef.current.id).eq('question_id', qId).maybeSingle();

        if (existing) {
          await supabase.from('student_responses').update({ answer_text: ans.selected_answer, is_graded: ans.flag_status === 'marked_for_review' }).eq('id', existing.id);
        } else {
          await supabase.from('student_responses').insert({ exam_id: examId, student_id: sessionRef.current.student_id, session_id: sessionRef.current.id, question_id: qId, answer_text: ans.selected_answer, is_graded: ans.flag_status === 'marked_for_review' });
        }
      } catch (err) {
        dirtyAnswersRef.current.add(qId); 
      }
    }
    
    const targetIndex = newIndex !== undefined ? newIndex : currentIndex;
    try {
        await supabase.from('exam_sessions').update({ current_question_index: targetIndex }).eq('id', sessionRef.current.id);
    } catch(e) {}
  };

  const executeSubmit = async () => {
    setSubmitting(true);
    await flushAutoSave(); 

    try {
        const currentTime = new Date().toISOString();
        
        await supabase.from('exam_sessions').update({ 
            status: 'finished',
            submitted_at: currentTime
        }).eq('id', sessionRef.current?.id);

        const res = await fetch('/api/exam/submit-exam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                examId,
                studentId: sessionRef.current?.student_id,
                sessionId: sessionRef.current?.id,
                answers: latestAnswersRef.current,
                examInfo,
                submittedAt: currentTime
            })
        });

        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(`[Dari Server]: ${data.error || 'Terjadi kesalahan tidak dikenal'}`);
        }

        try {
            await supabase.from('exam_sessions').update({
                total_score: Number(data.score) || 0,
                percentage_score: Number(data.score) || 0,
                is_passed: Boolean(data.isPassed)
            }).eq('id', sessionRef.current?.id);
        } catch(e) { console.error("Gagal simpan skor ke DB", e); }

        if (examInfo?.show_results_after) {
           const statusText = data.isPassed ? "LULUS (Di atas KKM)" : "TIDAK LULUS (Di bawah KKM)";
           const statusIcon = data.isPassed ? "🎉" : "⚠️";
           const hasEssay = questions.some(q => q.question_type === 'essay');
           const essayNote = hasEssay ? "\n\n📝 Catatan: Ujian ini mengandung soal Esai yang menunggu dinilai oleh guru. Nilai akhir di atas masih bisa bertambah." : "";

           showDialog('info', `${statusIcon} Ujian Selesai!`, `Jawaban Anda telah berhasil dikumpulkan.\n\nNilai Sementara (Skala 100):\n⭐ ${Number(data.score).toFixed(2)}\n\nKriteria Ketuntasan Minimal (KKM): ${examInfo.passing_score}\nStatus Sementara: ${statusText}${essayNote}`, () => router.push(`/student/dashboard`));
        } else {
           showDialog('success', 'Ujian Selesai', 'Selamat, jawaban Anda berhasil dikumpulkan dengan aman ke server!', () => router.push(`/student/dashboard`));
        }
    } catch (err: any) {
        showDialog('alert', 'Gagal Menilai', err.message);
        setSubmitting(false);
    }
  };

  const handleForceSubmit = useCallback(async () => {
    if (!sessionRef.current) return;
    setSubmitting(true);
    await flushAutoSave();

    try {
        const currentTime = new Date().toISOString();
        const { error: dbError } = await supabase.from('exam_sessions')
          .update({ 
            status: 'finished',
            current_violation_count: tabViolationCountRef.current,
            submitted_at: currentTime
          })
          .eq('id', sessionRef.current.id);

        if (dbError) console.error("Fallback update failed:", dbError);

        const res = await fetch('/api/exam/submit-exam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                examId,
                studentId: sessionRef.current.student_id,
                sessionId: sessionRef.current.id,
                answers: latestAnswersRef.current,
                examInfo,
                submittedAt: currentTime
            })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(`[Dari Server]: ${data.error || 'Terjadi kesalahan tidak dikenal'}`);
        }

        try {
            await supabase.from('exam_sessions').update({
                total_score: Number(data.score) || 0,
                percentage_score: Number(data.score) || 0,
                is_passed: Boolean(data.isPassed)
            }).eq('id', sessionRef.current.id);
        } catch(e) { console.error("Gagal simpan skor ke DB", e); }

        if (examInfo?.show_results_after) {
           showDialog('alert', '⏰ Waktu Habis / Dibatalkan!', `Waktu Anda telah habis atau Anda terblokir sistem.\n\nNilai Sementara (Skala 100):\n⭐ ${Number(data.score).toFixed(2)}`, () => router.push(`/student/dashboard`));
        } else {
           showDialog('alert', '⏰ Waktu Habis / Dibatalkan!', 'Ujian Anda telah dihentikan paksa dan dikumpulkan oleh sistem keamanan.', () => router.push(`/student/dashboard`));
        }
    } catch (err: any) {
        showDialog('alert', 'Kesalahan Sistem', err.message);
        router.push(`/student/dashboard`);
    }
  }, [examId, examInfo, showDialog, router]);

  const triggerSubmit = () => {
    if (!session) return;
    
    if (questions.length === 0) {
       showDialog('confirm', 'Keluar Ujian', 'Ujian ini belum memiliki soal. Yakin ingin keluar?', () => router.push(`/student/dashboard`));
       return;
    }

    if (examInfo?.min_working_minutes) {
      const minSubmitTime = examInfo.start_time_ms + (examInfo.min_working_minutes * 60000);
      if (Date.now() < minSubmitTime) {
          const minutesLeft = Math.ceil((minSubmitTime - Date.now()) / 60000);
          showDialog('alert', 'Belum Bisa Mengumpulkan!', `Ujian ini memiliki persyaratan batas minimal waktu pengerjaan.\n\nSisa waktu tunggu Anda: ${minutesLeft} menit lagi.`);
          return;
      }
    }

    const doubtfulCount = Object.values(latestAnswersRef.current).filter(a => a.flag_status === 'marked_for_review').length;
    const unansweredCount = questions.length - answeredQuestions;

    let warningMsg = '';
    if (unansweredCount > 0) warningMsg += `• Terdapat ${unansweredCount} soal yang belum dijawab.\n`;
    if (doubtfulCount > 0) warningMsg += `• Terdapat ${doubtfulCount} soal yang ditandai ragu-ragu.\n`;

    if (warningMsg !== '') {
      showDialog('confirm', 'Konfirmasi Pengumpulan', `Peringatan:\n${warningMsg}\nApakah Anda benar-benar yakin ingin mengumpulkan ujian sekarang?`, executeSubmit);
    } else {
      showDialog('confirm', 'Konfirmasi Pengumpulan', 'Semua soal telah terjawab. Apakah Anda yakin sudah selesai dan ingin mengumpulkan jawaban?', executeSubmit);
    }
  };

  useEffect(() => {
    if (!examId) return;
    const initExam = async () => {
      try {
        setLoading(true);
        
        const { data: settingData } = await supabase.from('pengaturan_aplikasi').select('zona_waktu').eq('id', 1).single();
        if (settingData?.zona_waktu) {
           if (settingData.zona_waktu.includes('WITA') || settingData.zona_waktu.includes('Makassar')) setAppTimeZone('Asia/Makassar');
           else if (settingData.zona_waktu.includes('WIT') || settingData.zona_waktu.includes('Jayapura')) setAppTimeZone('Asia/Jayapura');
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { 
            showDialog('alert', 'Akses Ditolak', 'Silakan login kembali untuk mengakses ujian.', () => router.push('/login'));
            setLoading(false); return; 
        }

        const { data: userProfile } = await supabase.from('users').select('full_name, student_number, avatar_url, class_group').eq('id', user.id).single();
        if (userProfile) {
          setStudentName(userProfile.full_name || 'Siswa CBT');
          setStudentNIS(userProfile.student_number || '-');
          setStudentRoom(userProfile.class_group || '');
          setStudentAvatar(userProfile.avatar_url || ''); 
        }

        const { data: examData, error: examError } = await supabase.from('exams').select('*').eq('id', examId).limit(1).single();
        if (examError || !examData || !examData.duration_minutes) {
          showDialog('alert', 'Error Data', 'Data ujian ini tidak ditemukan di database atau terdapat kesalahan.', () => router.push('/student/dashboard'));
          setLoading(false); return;
        }

        const maxAttempts = examData.max_attempts || 1;

        const { data: secData } = await supabase.from('exam_security_settings').select('*').eq('exam_id', examId).single();
        if (secData) setSecuritySettings(secData);

        const { data: sessionDataArray } = await supabase.from('exam_sessions').select('*').eq('exam_id', examId).eq('student_id', user.id);

        let sessionData = null;
        if (sessionDataArray && sessionDataArray.length > 0) {
           sessionData = sessionDataArray.find(s => s.status === 'ongoing');
           
           if (!sessionData) {
              const finishedCount = sessionDataArray.filter(s => s.status === 'finished').length;
              if (finishedCount >= maxAttempts) {
                  showDialog('alert', 'Batas Habis', 'Anda sudah mencapai batas maksimal pengerjaan ujian ini.', () => router.push('/student/dashboard'));
                  setLoading(false); return;
              }
           }
        }

        let userIp = "Unknown";
        try {
           const ipRes = await fetch('https://api.ipify.org?format=json');
           const ipData = await ipRes.json();
           userIp = ipData.ip;
        } catch(e) {}
        
        const browserInfo = navigator.userAgent;
        const currentDeviceInfo = `${browserInfo} | IP: ${userIp}`;
        
        let deviceFingerprint = "Unknown";
        if (typeof window !== 'undefined') {
            deviceFingerprint = btoa(`${browserInfo}-${window.screen.width}x${window.screen.height}`).substring(0, 50);
        }
        
        if (!sessionData) {
          const { data: newSession, error: createError } = await supabase
            .from('exam_sessions')
            .insert([{ 
                exam_id: examId, 
                student_id: user.id, 
                status: 'ongoing', 
                current_question_index: 0,
                device_info: currentDeviceInfo,
                locked_device_id: currentDeviceInfo,
                ip_address: userIp,
                browser_info: browserInfo,
                device_fingerprint: deviceFingerprint,
                current_violation_count: 0
            }]) 
            .select().single();

          if (createError) {
             showDialog('alert', 'Gagal Masuk', 'Gagal masuk sesi ujian. Hubungi Admin.', () => router.push('/student/dashboard'));
             setLoading(false); return;
          }
          sessionData = newSession;
        } else {
            if (sessionData.locked_device_id && sessionData.locked_device_id !== currentDeviceInfo) {
                showDialog('alert', 'Perangkat Diblokir!', 'Anda terdeteksi menggunakan perangkat yang berbeda dari saat ujian dimulai. Silakan melapor ke pengawas/guru untuk mereset sesi Anda.', () => router.push('/student/dashboard'));
                setLoading(false); return;
            }

            await supabase.from('exam_sessions').update({ 
               device_info: currentDeviceInfo,
               locked_device_id: sessionData.locked_device_id || currentDeviceInfo,
               ip_address: userIp,
               browser_info: browserInfo,
               device_fingerprint: deviceFingerprint
            }).eq('id', sessionData.id);
            
            sessionData.device_info = currentDeviceInfo;
        }

        if (sessionData.resume_token) {
            setSession(sessionData);
            setIsTokenPromptOpen(true);
            setLoading(false);
            return; 
        }

        setSession(sessionData); sessionRef.current = sessionData;
        setCurrentIndex(sessionData.current_question_index || 0);
        
        if (sessionData.current_violation_count !== undefined) {
           setTabViolationCount(sessionData.current_violation_count);
           tabViolationCountRef.current = sessionData.current_violation_count;
        }

        const totalSeconds = Number(examData.duration_minutes) * 60;
        const rawStartTime = sessionData.start_time || sessionData.started_at || sessionData.created_at;
        let sessionStartTime = Date.now();
        if (rawStartTime) {
          let safeTimeStr = rawStartTime.replace(' ', 'T');
          if (!safeTimeStr.endsWith('Z') && !safeTimeStr.match(/[+-]\d{2}:?\d{2}$/)) safeTimeStr += 'Z';
          let parsedTime = new Date(safeTimeStr).getTime();
          let elapsed = Date.now() - parsedTime;
          if (elapsed < 0 || elapsed > 12 * 60 * 60 * 1000) {
              const fallbackTime = new Date(rawStartTime.replace(' ', 'T')).getTime();
              const fallbackElapsed = Date.now() - fallbackTime;
              if (fallbackElapsed >= 0 && fallbackElapsed <= 12 * 60 * 60 * 1000) parsedTime = fallbackTime;
          }
          sessionStartTime = parsedTime;
        }

        const config = parseExamConfig(examData);
        setExamInfo({ 
            subject: examData.subject || 'Ujian Aktif', 
            grade_level: examData.grade_level || 'Umum', 
            duration_seconds: totalSeconds,
            start_time_ms: sessionStartTime,
            min_working_minutes: config.minTime,
            randomize_questions: config.randQ,
            randomize_options: config.randOpt,
            show_results_after: config.isShowResult,
            passing_score: config.passing_score,
            max_tab_switches: config.maxTab
        });
        
        let allQuestions: Question[] = [];
        let targetSubjectId = examData.subject_id;

        if (targetSubjectId) {
            const { data: qBySubjectId, error: err1 } = await supabase.from('questions').select('*').eq('subject_id', targetSubjectId).order('question_order', { ascending: true });
            if (err1) console.error("Error Q1 (Subject ID):", err1);
            if (qBySubjectId && qBySubjectId.length > 0) allQuestions = qBySubjectId as Question[];
        }

        if (allQuestions.length === 0 && examData.subject) {
            const { data: qBySubjectName, error: err2 } = await supabase.from('questions').select('*').eq('subject', examData.subject).order('question_order', { ascending: true });
            if (err2) console.error("Error Q2 (Subject Name):", err2);
            if (qBySubjectName && qBySubjectName.length > 0) allQuestions = qBySubjectName as Question[];
        }

        if (allQuestions.length === 0) {
             const { data: qByExam, error: err3 } = await supabase.from('questions').select('*').eq('exam_id', examId).order('question_order', { ascending: true });
             if (err3) console.error("Error Q3 (Exam ID):", err3);
             if (qByExam && qByExam.length > 0) allQuestions = qByExam as Question[];
        }

        const { data: savedAnswers } = await supabase.from('student_responses').select('id, question_id, answer_text, is_graded').eq('session_id', sessionData.id);

        if (allQuestions.length > 0 && sessionData) {
            const availablePackages = Array.from(new Set(allQuestions.map(q => q.package_name || 'Paket 1')));
            let assignedPackage = localStorage.getItem(`session_${sessionData.id}_package`);
            
            if (!assignedPackage && savedAnswers && savedAnswers.length > 0) {
                const firstAnswered = allQuestions.find(q => q.id === savedAnswers[0].question_id);
                if (firstAnswered) assignedPackage = firstAnswered.package_name || 'Paket 1';
            }
            if (!assignedPackage) {
                assignedPackage = availablePackages[Math.floor(Math.random() * availablePackages.length)] || 'Paket 1';
                localStorage.setItem(`session_${sessionData.id}_package`, assignedPackage);
            }
            let filteredQuestions = allQuestions.filter(q => (q.package_name || 'Paket 1') === assignedPackage);
            if (filteredQuestions.length === 0 && allQuestions.length > 0) filteredQuestions = allQuestions;

            if (config.randQ && filteredQuestions.length > 0) {
                const savedOrder = localStorage.getItem(`session_${sessionData.id}_qOrder`);
                if (savedOrder) {
                    const orderIds = JSON.parse(savedOrder);
                    filteredQuestions.sort((a, b) => {
                        const idxA = orderIds.indexOf(a.id);
                        const idxB = orderIds.indexOf(b.id);
                        return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
                    });
                } else {
                    filteredQuestions.sort(() => Math.random() - 0.5);
                    localStorage.setItem(`session_${sessionData.id}_qOrder`, JSON.stringify(filteredQuestions.map(q => q.id)));
                }
            }

            if (config.randOpt && filteredQuestions.length > 0) {
                 const savedOptOrder = localStorage.getItem(`session_${sessionData.id}_optOrder`);
                 let optOrderMap = savedOptOrder ? JSON.parse(savedOptOrder) : {};
                 let needSave = false;

                 filteredQuestions = filteredQuestions.map(q => {
                     if (['multiple_choice', 'complex_multiple_choice', 'true_false'].includes(q.question_type) && Array.isArray(q.options)) {
                         let validOptions = q.options.filter(opt => {
                             const text = opt.text || opt.value || opt.right || '';
                             return text && text.trim() !== '' && text.trim().toLowerCase() !== 'null';
                         });

                         if (optOrderMap[q.id]) {
                             const order = optOrderMap[q.id];
                             validOptions = [...validOptions].sort((a:any, b:any) => order.indexOf(a.key) - order.indexOf(b.key));
                         } else {
                             const shuffled = [...validOptions].sort(() => Math.random() - 0.5);
                             validOptions = shuffled;
                             optOrderMap[q.id] = shuffled.map((o:any) => o.key);
                             needSave = true;
                         }
                         q.options = validOptions;
                     }
                     return q;
                 });
                 if (needSave) localStorage.setItem(`session_${sessionData.id}_optOrder`, JSON.stringify(optOrderMap));
            }
            setQuestions(filteredQuestions);
        }

        const answersMap: Record<string, Answer> = {};
        if (savedAnswers) {
          savedAnswers.forEach((a: any) => { 
            if (isAnswerFilled(a.answer_text)) {
              answersMap[a.question_id] = { question_id: a.question_id, selected_answer: a.answer_text, flag_status: a.is_graded ? 'marked_for_review' : 'answered' }; 
            } else if (a.is_graded) {
              answersMap[a.question_id] = { question_id: a.question_id, selected_answer: null, flag_status: 'marked_for_review' };
            }
          });
        }
        setAnswers(answersMap);
        latestAnswersRef.current = answersMap; 

      } catch (err: any) {
        showDialog('alert', 'Error Sistem', 'Terjadi kesalahan teknis memuat ujian.', () => router.push('/student/dashboard'));
      } finally {
        setLoading(false);
      }
    };
    initExam();
  }, [examId, router, showDialog, parseExamConfig]);

  useEffect(() => {
     if (!examId || !sessionRef.current) return;
     const studentId = sessionRef.current.student_id;
     const currentSessionId = sessionRef.current.id;

     const channel = supabase.channel(`exam_room_${examId}_${studentId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'exam_announcements', filter: `exam_id=eq.${examId}` }, (payload) => {
            const ann = payload.new;
            if (ann.target_type === 'all' || 
               (ann.target_type === 'student' && ann.target_id === studentId) ||
               (ann.target_type === 'room' && ann.target_id === studentRoom)) { 
               showDialog('info', 'PENGUMUMAN DARI PENGAWAS', ann.message);
            }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'exam_sessions', filter: `id=eq.${currentSessionId}` }, (payload) => {
            if (payload.new.status === 'finished') {
               showDialog('alert', 'Ujian Ditutup Pengawas', 'Ujian Anda telah ditarik paksa dan ditutup oleh pengawas ruangan.', () => {
                   router.push('/student/dashboard');
               });
            }
        })
        .subscribe();

     return () => { supabase.removeChannel(channel); };
  }, [examId, studentRoom, showDialog, router]);

  const trackLocationSilently = () => {
     if (sessionRef.current?.security_overrides?.disable_gps) return;

     if (navigator.geolocation) {
         navigator.geolocation.getCurrentPosition(async (pos) => {
             if (sessionRef.current) {
                try {
                  await supabase.from('exam_proctoring_logs').insert({
                      exam_id: examId,
                      student_id: sessionRef.current.student_id,
                      session_id: sessionRef.current.id,
                      snapshot_url: `${pos.coords.latitude},${pos.coords.longitude}`,
                      log_type: 'location'
                  });
                } catch(e) {}
             }
         }, () => {}, { enableHighAccuracy: true });
     }
  };

  const checkGeolocation = (): Promise<boolean> => {
    return new Promise((resolve) => {
        if (sessionRef.current?.security_overrides?.disable_gps) return resolve(true);

        if (!navigator.geolocation) {
            setGeoErrorMsg("Browser Anda tidak mendukung GPS.");
            setIsBlockedGeo(true);
            return resolve(false);
        }
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat1 = pos.coords.latitude;
                const lon1 = pos.coords.longitude;
                const lat2 = securitySettings?.school_latitude;
                const lon2 = securitySettings?.school_longitude;

                if (!lat2 || !lon2) return resolve(true);

                const R = 6371e3; 
                const p1 = lat1 * Math.PI/180;
                const p2 = lat2 * Math.PI/180;
                const dp = (lat2-lat1) * Math.PI/180;
                const dl = (lon2-lon1) * Math.PI/180;

                const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const d = R * c; 

                if (d > securitySettings.allowed_radius_meters) {
                    setGeoErrorMsg(`Anda berada ${Math.round(d)} meter dari pusat ujian. Maksimal radius adalah ${securitySettings.allowed_radius_meters} meter.`);
                    setIsBlockedGeo(true);
                    resolve(false);
                } else {
                    setIsBlockedGeo(false);
                    resolve(true);
                }
            },
            (err) => {
                setGeoErrorMsg("Sistem gagal mendapatkan lokasi Anda. Pastikan GPS HP/Laptop menyala dan izinkan browser mengakses lokasi.");
                setIsBlockedGeo(true);
                resolve(false);
            },
            { enableHighAccuracy: true }
        );
    });
  };

  useEffect(() => {
    if (session?.security_overrides?.disable_fullscreen) {
        setIsBlockedFullscreen(false);
        return;
    }

    if (!securitySettings?.enable_fullscreen || !isReady) return;
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setIsBlockedFullscreen(true);
      else setIsBlockedFullscreen(false);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [securitySettings, isReady, session?.security_overrides]);

  useEffect(() => {
     maxTabSwitchesRef.current = examInfo.max_tab_switches;
  }, [examInfo.max_tab_switches]);

  useEffect(() => {
    if (!isReady) return;

    let isCooldown = false;

    const triggerViolation = async (reason: string) => {
      if (isCooldown) return;
      if (sessionRef.current?.security_overrides?.disable_tab_lock) return;

      isCooldown = true;
      setTimeout(() => { isCooldown = false; }, 2000); 

      tabViolationCountRef.current += 1;
      setTabViolationCount(tabViolationCountRef.current);
      
      if (sessionRef.current) {
         try {
            await supabase.from('exam_sessions').update({ current_violation_count: tabViolationCountRef.current }).eq('id', sessionRef.current.id);
            await supabase.from('exam_proctoring_logs').insert({
               exam_id: examId,
               student_id: sessionRef.current.student_id,
               session_id: sessionRef.current.id,
               snapshot_url: reason, 
               log_type: 'violation'
            });
         } catch(e) {}
      }

      const maxLimit = maxTabSwitchesRef.current;
      if (maxLimit > 0 && tabViolationCountRef.current > maxLimit) {
          showDialog('alert', 'UJIAN DIBATALKAN!', `Anda telah melanggar batas peringatan sebanyak ${tabViolationCountRef.current} kali. Ujian Anda dihentikan paksa dan akan langsung dikumpulkan.`, handleForceSubmit);
          return;
      }

      const sisa = maxLimit - tabViolationCountRef.current;
      const sisaText = maxLimit > 0 ? `\n\nSisa toleransi pelanggaran: ${Math.max(0, sisa)} kali.` : '';

      showDialog('alert', 'PELANGGARAN KEAMANAN!', `Sistem mendeteksi aktivitas mencurigakan:\n\n👉 ${reason}\n\nTindakan ini dicatat sebagai pelanggaran ke-${tabViolationCountRef.current}. Jangan ulangi!${sisaText}`);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) triggerViolation('Berpindah tab atau menyembunyikan browser');
    };

    const handleInteraction = () => {
        (window as any).mediaClickGracePeriod = true;
        setTimeout(() => { (window as any).mediaClickGracePeriod = false; }, 1000);
    };

    const handleBlur = () => {
      setTimeout(() => {
         if ((window as any).mediaClickGracePeriod) return; 
         
         const activeEl = document.activeElement;
         if (activeEl && ['IFRAME', 'VIDEO', 'AUDIO'].includes(activeEl.tagName.toUpperCase())) {
             return; 
         }
         
         if (document.hasFocus && !document.hasFocus()) {
             triggerViolation('Fokus layar hilang (Membuka menu sistem, aplikasi lain, atau berpindah Tab)');
         }
      }, 150);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
          e.preventDefault();
          try { navigator.clipboard.writeText('Dilarang mengambil screenshot selama ujian berlangsung!'); } catch(err) {}
          triggerViolation('Mencoba mengambil tangkapan layar (Screenshot)');
      }
      if (e.key === 'Meta' || e.key === 'OS' || e.key === 'Alt') {
          e.preventDefault();
          triggerViolation('Menekan tombol terlarang (Windows / Command / Alt)');
      }
      if (e.key === 'F12' || (e.ctrlKey && e.key.toLowerCase() === 'p') || (e.ctrlKey && e.shiftKey && (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'c'))) {
          e.preventDefault();
          triggerViolation('Akses pintasan sistem (F12/Print/Inspect) dilarang');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
       if (e.key === 'PrintScreen') {
          e.preventDefault();
          try { navigator.clipboard.writeText('Dilarang mengambil screenshot selama ujian berlangsung!'); } catch(err) {}
          triggerViolation('Mencoba mengambil tangkapan layar (Screenshot)');
       }
    };

    document.addEventListener('pointerdown', handleInteraction);
    document.addEventListener('mousedown', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('pointerdown', handleInteraction);
      document.removeEventListener('mousedown', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isReady, showDialog, examId, handleForceSubmit]); 

  const forceTakePhoto = async () => {
      if (sessionRef.current?.security_overrides?.disable_camera) return;

      const video = videoRef.current;
      if (!video || !sessionRef.current) return;
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
          try {
            await supabase.from('exam_proctoring_logs').insert({
                exam_id: examId,
                student_id: sessionRef.current.student_id,
                session_id: sessionRef.current.id,
                snapshot_url: dataUrl,
                log_type: 'snapshot'
            });
          } catch (e) { }
      }
  };

  useEffect(() => {
    if (session?.security_overrides?.disable_camera) return;

    if (!isReady || !securitySettings?.enable_camera_proctoring) return;
    const interval = setInterval(() => {
        forceTakePhoto(); 
    }, 60000); 
    return () => clearInterval(interval);
  }, [isReady, securitySettings, examId, session?.security_overrides]);

  const handleStartExamScreen = async () => {
    if (securitySettings?.enable_camera_proctoring && !session?.security_overrides?.disable_camera) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) videoRef.current.srcObject = stream;
            setTimeout(() => { forceTakePhoto(); }, 1500);
        } catch (e) {
            showDialog('alert', 'Akses Kamera Ditolak', 'Fitur pengawas kamera diaktifkan. Anda harus mengizinkan akses kamera browser untuk memulai ujian.');
            return;
        }
    }

    if (navigator.geolocation && !session?.security_overrides?.disable_gps) {
        if (securitySettings?.enable_geolocation) {
            const geoOk = await checkGeolocation();
            if (!geoOk) return; 
        } 
        trackLocationSilently();
    }

    if (!session?.security_overrides?.disable_fullscreen) {
        const el = document.documentElement;
        if (el.requestFullscreen) { 
            el.requestFullscreen().catch(() => console.log('Fullscreen diblokir browser')); 
        }
    }
    setIsReady(true);
  };

  const handleResumeTokenSubmit = async () => {
      if (!session || !resumeTokenInput) return;
      if (resumeTokenInput === session.resume_token) {
          await supabase.from('exam_sessions').update({ resume_token: null }).eq('id', session.id);
          setIsTokenPromptOpen(false);
          showDialog('success', 'Akses Terbuka', 'Token Valid! Sesi berhasil dibuka kembali.', () => window.location.reload());
      } else {
          showDialog('alert', 'Akses Ditolak', 'Token tidak valid! Pastikan Anda memasukkan kode yang tepat dari pengawas.');
      }
  };

  const blockCopyPaste = (e: any) => {
     if (securitySettings?.enable_copy_paste === false) {
        e.preventDefault();
     }
  };

  const changeQuestion = async (newIndex: number) => {
    if (questions.length === 0) return;
    await flushAutoSave(newIndex); 
    setCurrentIndex(newIndex);
  };

  const handleAnswerChange = useCallback((questionId: string, selectedAnswer: string) => {
    setAnswers(prev => {
      const currentFlag = prev[questionId]?.flag_status;
      const isFilled = isAnswerFilled(selectedAnswer);
      let newFlag = currentFlag;
      if (currentFlag !== 'marked_for_review') newFlag = isFilled ? 'answered' : 'unanswered';
      
      const newState = { ...prev, [questionId]: { question_id: questionId, selected_answer: selectedAnswer, flag_status: newFlag } };
      latestAnswersRef.current = newState; 
      return newState;
    });
    dirtyAnswersRef.current.add(questionId);
  }, []);

  const handleToggleFlag = useCallback((questionId: string) => {
    if (!questionId) return;
    setAnswers(prev => {
      const current = prev[questionId];
      const isCurrentlyDoubt = current?.flag_status === 'marked_for_review';
      const isFilled = isAnswerFilled(current?.selected_answer);
      const newFlag = isCurrentlyDoubt ? (isFilled ? 'answered' : 'unanswered') : 'marked_for_review';
      
      const newState = { ...prev, [questionId]: { ...current, question_id: questionId, flag_status: newFlag } };
      latestAnswersRef.current = newState; 
      return newState;
    });
    dirtyAnswersRef.current.add(questionId);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => flushAutoSave(), 2500);
    return () => clearInterval(interval);
  }, [currentIndex, examId]);

  return (
    <>
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />

      {isTokenPromptOpen && (
         <div className="fixed inset-0 z-[99999] bg-slate-100/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 text-center animate-in fade-in">
             <div className="bg-white p-6 sm:p-8 md:p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-slate-200">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-50 border border-blue-100 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center mx-auto mb-5 md:mb-6 shadow-inner">
                    <Lock className="w-8 h-8 md:w-10 md:h-10 text-blue-600" />
                </div>
                <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-2">Token Lanjutan</h2>
                <p className="text-slate-500 text-xs md:text-sm mb-6 md:mb-8 font-medium">Ujian Anda telah dibuka kembali oleh pengawas. Silakan masukkan 6 digit token untuk melanjutkan.</p>
                <input 
                   type="text" 
                   value={resumeTokenInput} 
                   onChange={(e) => setResumeTokenInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                   placeholder="XXXXXX" 
                   className="w-full bg-slate-50 border-2 border-slate-200 rounded-[1.2rem] px-4 md:px-6 py-3 md:py-4 text-2xl md:text-3xl font-black text-center tracking-[0.3em] md:tracking-[0.5em] text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none mb-5 md:mb-6 transition-all" 
                />
                <button onClick={handleResumeTokenSubmit} disabled={resumeTokenInput.length < 6} className="w-full py-3 md:py-4 bg-blue-600 text-white font-black rounded-[1.2rem] hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50 active:scale-95 uppercase tracking-widest text-[10px] md:text-xs">Lanjutkan Ujian</button>
             </div>
         </div>
      )}

      {isBlockedFullscreen && securitySettings?.enable_fullscreen && (
         <div className="fixed inset-0 z-[99990] bg-slate-50/95 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 text-center animate-in fade-in duration-300">
             <div className="w-20 h-20 md:w-24 md:h-24 bg-rose-50 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center border border-rose-100 shadow-xl shadow-rose-200/50 mb-6 md:mb-8 animate-bounce">
                <AlertTriangle className="w-10 h-10 md:w-12 md:h-12 text-rose-600" />
             </div>
             <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 mb-3 md:mb-4 tracking-tight">PELANGGARAN LAYAR!</h2>
             <p className="text-slate-600 font-medium mb-8 md:mb-10 max-w-lg leading-relaxed text-sm md:text-lg">Anda telah keluar dari mode Layar Penuh (Fullscreen). Ujian dijeda sementara untuk alasan keamanan. Silakan kembali ke mode Layar Penuh untuk melanjutkan.</p>
             <button onClick={() => {
                 document.documentElement.requestFullscreen().catch(() => {});
             }} className="px-6 md:px-10 py-3 md:py-4 bg-blue-600 hover:bg-blue-700 text-white text-[10px] md:text-sm uppercase tracking-widest font-black rounded-[1.2rem] shadow-xl shadow-blue-600/30 transition-all active:scale-95 flex items-center gap-2 md:gap-3">
                 <Maximize className="w-4 h-4 md:w-5 md:h-5"/> Kembali ke Ujian
             </button>
         </div>
      )}

      {isBlockedGeo && (
         <div className="fixed inset-0 z-[99990] bg-slate-50/95 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 text-center animate-in fade-in duration-300">
             <div className="w-20 h-20 md:w-24 md:h-24 bg-emerald-50 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center border border-emerald-100 shadow-xl shadow-emerald-200/50 mb-6 md:mb-8 animate-bounce">
                <MapPin className="w-10 h-10 md:w-12 md:h-12 text-emerald-600" />
             </div>
             <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 mb-3 md:mb-4 tracking-tight">LOKASI DI LUAR JANGKAUAN</h2>
             <p className="text-slate-600 font-medium mb-8 md:mb-10 max-w-lg leading-relaxed text-sm md:text-lg">{geoErrorMsg}</p>
             <button onClick={() => {
                 window.location.reload();
             }} className="px-6 md:px-10 py-3 md:py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] md:text-sm uppercase tracking-widest font-black rounded-[1.2rem] shadow-xl shadow-emerald-600/30 transition-all active:scale-95 flex items-center gap-2 md:gap-3">
                 <Globe className="w-4 h-4 md:w-5 md:h-5"/> Cek Ulang Lokasi
             </button>
         </div>
      )}

      {isReady && securitySettings?.enable_watermark && (
        <div className="fixed inset-0 z-[999] pointer-events-none overflow-hidden opacity-[0.03] flex flex-wrap gap-12 items-center justify-center -rotate-12 select-none mix-blend-multiply">
           {Array.from({ length: 60 }).map((_, i) => (
              <span key={i} className="text-2xl md:text-3xl font-black whitespace-nowrap">{studentName} - {studentNIS}</span>
           ))}
        </div>
      )}

      {dialogConfig.isOpen && (
        <div className="fixed inset-0 z-[99995] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
            <div className="p-6 md:p-8 flex flex-col items-center text-center">
               <div className={`w-16 h-16 md:w-20 md:h-20 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center mb-5 md:mb-6 shadow-inner border 
                  ${dialogConfig.type === 'confirm' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                    dialogConfig.type === 'success' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 
                    dialogConfig.type === 'info' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 
                    'bg-rose-50 text-rose-600 border-rose-100'}`}>
                  {dialogConfig.type === 'confirm' ? <HelpCircle className="w-8 h-8 md:w-10 md:h-10" /> : 
                   dialogConfig.type === 'success' ? <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10" /> :
                   dialogConfig.type === 'info' ? <MessageSquare className="w-8 h-8 md:w-10 md:h-10" /> :
                   <AlertTriangle className="w-8 h-8 md:w-10 md:h-10" />}
               </div>
               <h3 className="text-xl md:text-2xl font-black text-slate-800 mb-2 md:mb-3">{dialogConfig.title}</h3>
               <p className="text-slate-500 font-medium text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{dialogConfig.message}</p>
            </div>
            <div className="p-3 md:p-4 bg-slate-50/80 border-t border-slate-100 flex gap-2 md:gap-3 justify-center">
               {dialogConfig.type === 'confirm' && (
                 <button onClick={() => { closeDialog(); if(dialogConfig.onCancel) dialogConfig.onCancel(); }} className="px-4 md:px-6 py-3 md:py-3.5 rounded-[1rem] md:rounded-2xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors w-full shadow-sm text-sm">Batal</button>
               )}
               <button onClick={() => { closeDialog(); if(dialogConfig.onConfirm) dialogConfig.onConfirm(); }} className={`px-4 md:px-6 py-3 md:py-3.5 rounded-[1rem] md:rounded-2xl font-bold text-white transition-all shadow-md active:scale-95 w-full text-sm ${dialogConfig.type === 'alert' && dialogConfig.title === 'PELANGGARAN KEAMANAN!' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : dialogConfig.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}>Mengerti</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
          <LoaderCircle className="w-10 h-10 md:w-12 md:h-12 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-bold tracking-widest uppercase text-xs md:text-sm animate-pulse">Menyiapkan Lembar Ujian...</p>
        </div>
      ) : !isReady && !isTokenPromptOpen ? (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-blue-200">
          <div className="bg-white p-6 sm:p-8 md:p-12 rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-slate-200 max-w-lg w-full text-center relative overflow-hidden animate-in zoom-in-95">
            <div className="absolute top-0 left-0 w-full h-1.5 md:h-2 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
            <div className="w-16 h-16 md:w-24 md:h-24 bg-blue-50 text-blue-600 rounded-[1.2rem] md:rounded-[2rem] flex items-center justify-center mx-auto mb-6 md:mb-8 border border-blue-100 shadow-inner rotate-3">
              <Monitor className="w-8 h-8 md:w-12 md:h-12 -rotate-3" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-3 md:mb-4 tracking-tight">Siap Memulai?</h2>
            
            <div className="mb-8 md:mb-10 text-xs md:text-sm space-y-3 md:space-y-4 bg-slate-50 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 shadow-inner text-slate-600">
              <div className="flex items-start gap-3 md:gap-4 text-left">
                  <div className="bg-emerald-100 p-1.5 md:p-2 rounded-lg md:rounded-xl shrink-0"><CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-600"/></div>
                  <p className="pt-0.5 leading-relaxed">Ujian ini berjalan dalam mode <b className="text-slate-800">Layar Penuh (Fullscreen)</b>.</p>
              </div>
              <div className="flex items-start gap-3 md:gap-4 text-left">
                  <div className="bg-amber-100 p-1.5 md:p-2 rounded-lg md:rounded-xl shrink-0"><AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-amber-600"/></div>
                  <p className="pt-0.5 leading-relaxed">Dilarang menekan tombol <b className="text-slate-800">Windows/Command, Alt</b>, meminimalkan browser, atau membagi fokus layar.</p>
              </div>
              <div className="flex items-start gap-3 md:gap-4 text-left">
                  <div className="bg-blue-100 p-1.5 md:p-2 rounded-lg md:rounded-xl shrink-0"><Clock className="w-4 h-4 md:w-5 md:h-5 text-blue-600"/></div>
                  <p className="pt-0.5 leading-relaxed">Waktu akan terus berjalan meskipun Anda keluar dari aplikasi ujian.</p>
              </div>
              {securitySettings?.enable_geolocation && (
                  <div className="flex items-start gap-3 md:gap-4 text-left">
                    <div className="bg-emerald-100 p-1.5 md:p-2 rounded-lg md:rounded-xl shrink-0"><MapPin className="w-4 h-4 md:w-5 md:h-5 text-emerald-600"/></div>
                    <p className="pt-0.5 leading-relaxed">Sistem melacak koordinat lokasi GPS Anda untuk validasi kehadiran.</p>
                  </div>
              )}
            </div>

            <button onClick={handleStartExamScreen} className="w-full py-3 md:py-4 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs md:text-sm rounded-[1.2rem] md:rounded-2xl transition-all shadow-lg shadow-blue-600/30 active:scale-95 flex items-center justify-center gap-2 md:gap-3">
              <Maximize className="w-4 h-4 md:w-5 md:h-5"/> Masuk Mode Ujian
            </button>
          </div>
        </div>
      ) : isReady && (
        <div 
           className={`h-[100dvh] w-screen bg-slate-50 text-slate-800 overflow-hidden font-sans flex flex-col md:flex-row ${securitySettings?.enable_copy_paste === false ? 'select-none' : ''}`}
           onCopy={blockCopyPaste}
           onPaste={blockCopyPaste}
           onCut={blockCopyPaste}
           onContextMenu={blockCopyPaste}
        >
          
          <aside className="w-full md:w-[340px] h-[35dvh] sm:h-[40dvh] md:h-[100dvh] bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 shrink-0 overflow-hidden">
            
            <div className="p-3 md:p-6 border-b border-slate-100 bg-white flex items-center gap-3 md:gap-4 relative shrink-0">
              {studentAvatar ? (
                 <img src={getAvatarUrl(studentAvatar)} alt="Profil" className="w-10 h-10 md:w-14 md:h-14 rounded-full object-cover border-2 border-blue-100 shadow-sm shrink-0 hidden sm:block md:block" referrerPolicy="no-referrer" />
              ) : (
                 <div className="w-10 h-10 md:w-14 md:h-14 bg-blue-50 rounded-full flex items-center justify-center border-2 border-blue-100 shadow-sm shrink-0 hidden sm:flex md:flex">
                   <UserCircle2 className="w-6 h-6 md:w-8 md:h-8 text-blue-600" strokeWidth={1.5} />
                 </div>
              )}
              <div className="overflow-hidden w-full flex flex-col justify-center">
                <h1 className="font-black text-slate-800 text-sm md:text-base truncate leading-tight tracking-tight" title={studentName}>{studentName}</h1>
                <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 md:mt-1">
                   <span className="text-[8px] md:text-[9px] font-black text-blue-700 bg-blue-50 px-1.5 md:px-2 py-0.5 rounded border border-blue-200 uppercase tracking-widest">NIS</span>
                   <span className="text-[10px] md:text-[11px] font-bold text-slate-500 truncate">{studentNIS}</span>
                </div>
              </div>
              
              {tabViolationCount > 0 && (
                 <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-rose-50 text-rose-600 text-[9px] md:text-[10px] font-black px-1.5 py-0.5 md:px-2 md:py-1 rounded-md border border-rose-200 animate-pulse flex items-center gap-1" title="Jumlah Pelanggaran Keamanan">
                    <AlertTriangle className="w-3 h-3 md:w-3.5 md:h-3.5" /> {tabViolationCount}
                 </div>
              )}
            </div>

            <div className="p-3 md:p-6 border-b border-slate-100 bg-white flex flex-col items-center justify-center shrink-0">
               <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-2 items-center gap-1.5 hidden md:flex"><Clock className="w-3.5 h-3.5"/> Sisa Waktu Ujian</p>
               
               {examInfo && examInfo.duration_seconds > 0 && examInfo.start_time_ms > 0 && (
                  <TimerDisplay 
                     totalSeconds={examInfo.duration_seconds} 
                     sessionStartTime={examInfo.start_time_ms} 
                     onTimeUp={handleForceSubmit} 
                  />
               )}
            </div>

            <div className="px-3 py-2 md:px-6 md:py-4 border-b border-slate-100 flex justify-between text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50/80 shrink-0">
              <span className="flex items-center gap-1 md:gap-1.5"><div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-[4px] md:rounded-md bg-blue-600 shadow-sm relative overflow-hidden"><div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-400 rotate-45"></div></div> <span className="hidden sm:inline">Dijawab</span></span>
              <span className="flex items-center gap-1 md:gap-1.5"><div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-[4px] md:rounded-md bg-amber-400 shadow-sm relative overflow-hidden"><div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white/50 rotate-45"></div></div> <span className="hidden sm:inline">Ragu</span></span>
              <span className="flex items-center gap-1 md:gap-1.5"><div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-[4px] md:rounded-md bg-white border border-slate-200" /> <span className="hidden sm:inline">Kosong</span></span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-slate-50/30 custom-scrollbar">
              <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-5 gap-1.5 sm:gap-2 md:gap-3">
                {questions.map((q, idx) => {
                  const ans = answers[q.id];
                  const isAnswered = isAnswerFilled(ans?.selected_answer);
                  const isDoubt = ans?.flag_status === 'marked_for_review';
                  const isActive = currentIndex === idx;

                  let btnClass = "w-full aspect-square rounded-lg md:rounded-[0.8rem] text-xs md:text-sm font-black flex items-center justify-center transition-all border-2 relative overflow-hidden ";
                  
                  if (isActive) {
                    btnClass += "ring-2 md:ring-4 ring-blue-100 border-blue-600 z-10 scale-110 shadow-lg ";
                    btnClass += isDoubt ? "bg-amber-400 text-amber-900 " : (isAnswered ? "bg-blue-600 text-white " : "bg-white text-blue-700 ");
                  } else if (isDoubt) {
                    btnClass += "bg-amber-400 border-amber-500 text-amber-900 shadow-sm hover:bg-amber-500 hover:scale-105 ";
                  } else if (isAnswered) {
                    btnClass += "bg-blue-600 border-blue-700 text-white shadow-sm hover:bg-blue-700 hover:scale-105 ";
                  } else {
                    btnClass += "bg-white border-slate-200 text-slate-500 hover:border-blue-400 hover:bg-blue-50 shadow-sm hover:scale-105 ";
                  }

                  return (
                    <button key={q.id} onClick={() => changeQuestion(idx)} className={btnClass}>
                      <span className="relative z-10">{idx + 1}</span>
                      {isDoubt && <div className="absolute -top-2 -right-2 md:-top-3 md:-right-3 w-4 h-4 md:w-6 md:h-6 bg-white/40 rotate-45 z-0"></div>}
                      {!isDoubt && isAnswered && <div className="absolute -top-2 -right-2 md:-top-3 md:-right-3 w-4 h-4 md:w-6 md:h-6 bg-blue-400 rotate-45 z-0"></div>}
                      {isDoubt && isAnswered && <div className="absolute bottom-1 right-1 w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-blue-700 border border-white shadow-sm z-10"></div>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 md:p-6 border-t border-slate-200 bg-white mt-auto shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
              <div className="flex justify-between items-center mb-2 md:mb-3 text-[9px] md:text-[11px] font-black uppercase tracking-widest text-slate-500">
                <span className="hidden sm:inline">Progres Menjawab:</span>
                <span className={answeredQuestions === questions.length && questions.length > 0 ? 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 ml-auto' : 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 ml-auto'}>{answeredQuestions} / {questions.length > 0 ? questions.length : 0} Soal</span>
              </div>
              <button onClick={triggerSubmit} disabled={submitting} className="w-full py-2.5 md:py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white disabled:text-slate-500 font-black uppercase tracking-widest text-[10px] md:text-xs rounded-xl md:rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 md:gap-2">
                {submitting ? <LoaderCircle className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />}
                {submitting ? 'Mengumpulkan...' : 'Kumpulkan'}
              </button>
            </div>
          </aside>

          <main className="flex-1 min-h-0 bg-slate-50 flex flex-col relative scroll-smooth">
            
            <div className="h-1.5 w-full bg-slate-200 shrink-0 z-20">
              <div className="h-full bg-blue-500 transition-all duration-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: questions.length > 0 ? `${((currentIndex + 1) / questions.length) * 100}%` : '0%' }}></div>
            </div>

            <div className="flex-1 overflow-y-auto relative flex flex-col p-4 sm:p-6 md:p-10 custom-scrollbar">
               {questions.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 text-center">
                      <div className="w-20 h-20 md:w-24 md:h-24 bg-amber-50 text-amber-500 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center mb-4 md:mb-6 shadow-inner rotate-3 border border-amber-100">
                         <AlertTriangle className="w-10 h-10 md:w-12 md:h-12 -rotate-3" />
                      </div>
                      <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-3 md:mb-4 tracking-tight">Soal Belum Tersedia</h2>
                      <p className="text-slate-500 font-medium max-w-md leading-relaxed text-sm md:text-base">Admin atau guru pembuat ujian belum memasukkan soal ke dalam sistem untuk jadwal ini. Silakan lapor kepada pengawas ruangan Anda.</p>
                  </div>
               ) : currentQuestion ? (
                 <div className="max-w-4xl mx-auto w-full flex flex-col flex-1">
                   
                   <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-slate-200 mb-6 md:mb-8 overflow-hidden flex flex-col z-20">
                     <div className="p-4 md:p-6 md:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4">
                       <div className="flex items-center gap-3 md:gap-5 w-full sm:w-auto">
                         <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-600 text-white rounded-[1rem] md:rounded-[1.2rem] flex flex-col items-center justify-center shadow-lg shadow-blue-600/30 shrink-0">
                           <span className="text-lg md:text-xl font-black leading-none">{currentIndex + 1}</span>
                           <div className="w-5 md:w-6 h-[2px] bg-blue-400/50 my-0.5 rounded-full"></div>
                           <span className="text-[9px] md:text-[10px] font-bold text-blue-200">{questions.length}</span>
                         </div>
                         <div className="flex flex-col justify-center flex-1 min-w-0">
                           <h3 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-tight truncate">{examInfo?.subject}</h3>
                           <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mt-1 md:mt-2">
                              <span className="text-[8px] md:text-[9px] font-black text-blue-700 uppercase tracking-widest bg-blue-50 px-2 md:px-2.5 py-0.5 md:py-1 rounded-md border border-blue-100">Kls {examInfo?.grade_level}</span>
                              <span className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2 md:px-2.5 py-0.5 md:py-1 rounded-md border border-slate-200">{currentQuestion.question_type.replace(/_/g, ' ')}</span>
                           </div>
                         </div>
                       </div>
                       <div className="flex items-center gap-1.5 md:gap-2 bg-amber-50 px-3 md:px-4 py-2 md:py-2.5 rounded-xl md:rounded-[1rem] border border-amber-100 shrink-0 shadow-inner self-start sm:self-auto">
                         <Bookmark className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500" />
                         <span className="text-[10px] md:text-xs font-black text-amber-700 uppercase tracking-widest">{currentQuestion.points} Poin</span>
                       </div>
                     </div>
                   </div>

                   <div className="bg-white p-5 sm:p-8 md:p-10 rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm border border-slate-200 mb-6 md:mb-8 font-serif z-20 relative">
                     <div 
                       className="prose prose-sm md:prose-lg prose-slate max-w-none text-slate-800 leading-relaxed font-medium [&>p]:m-0 relative z-20 break-words"
                       dangerouslySetInnerHTML={{ __html: processedQuestionHtml }} 
                     />
                     
                     {currentQuestion.image_url && (
                       <div className="mt-4 md:mt-5 relative z-20" onContextMenu={e => e.preventDefault()}>
                         <img src={getSafeImageUrl(currentQuestion.image_url)} alt="Gambar Soal" className="rounded-xl md:rounded-2xl max-h-[300px] md:max-h-[400px] object-contain border border-slate-200 shadow-sm pointer-events-none" referrerPolicy="no-referrer" />
                       </div>
                     )}
                     
                     {currentQuestion.audio_url && (
                       <div className="relative z-20">
                         <LimitedAudioPlayer 
                           url={currentQuestion.audio_url} 
                           limit={Number(currentQuestion.audio_duration) || Number(currentQuestion.audio_play_limit) || 0} 
                           questionId={currentQuestion.id} 
                           studentId={sessionRef.current?.student_id || 'guest'} 
                           onLimitReached={(msg) => showDialog('alert', 'Batas Audio', msg)}
                         />
                       </div>
                     )}

                     <div className="relative z-20">
                       <SmartMediaRenderer url={(currentQuestion as any).video_url} />
                       <SmartMediaRenderer url={(currentQuestion as any).file_url} />
                     </div>
                   </div>

                   <div className="mb-auto z-20">
                     
                     {['multiple_choice', 'complex_multiple_choice', 'true_false'].includes(currentQuestion.question_type) && (
                       <div className="space-y-3 md:space-y-4">
                         <p className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 md:mb-3 pl-1 md:pl-2">
                           {currentQuestion.question_type === 'complex_multiple_choice' ? 'Pilih Semua Jawaban yang Benar (Bisa > 1):' : 'Pilih Salah Satu Jawaban:'}
                         </p>
                         <div className="grid grid-cols-1 gap-2.5 md:gap-3">
                           {currentQuestion.options?.filter((opt: any) => {
                               const text = opt.text || opt.value || opt.right || '';
                               return text && text.trim() !== '' && text.trim().toLowerCase() !== 'null';
                           }).map((opt: any, i: number) => {
                             let isSelected = false;
                             if (currentQuestion.question_type === 'complex_multiple_choice') {
                               const currentArr = answers[currentQuestion.id]?.selected_answer?.split(',') || [];
                               isSelected = currentArr.includes(opt.key);
                             } else {
                               isSelected = answers[currentQuestion.id]?.selected_answer === opt.key;
                             }

                             const displayKey = currentQuestion.question_type === 'true_false' ? (i === 0 ? 'A' : 'B') : String.fromCharCode(65 + i);

                             const handleOptionClick = () => {
                               if (currentQuestion.question_type === 'complex_multiple_choice') {
                                 const currentArr = answers[currentQuestion.id]?.selected_answer?.split(',') || [];
                                 const newArr = isSelected ? currentArr.filter(k => k !== opt.key) : [...currentArr, opt.key];
                                 handleAnswerChange(currentQuestion.id, newArr.sort().join(','));
                               } else {
                                 handleAnswerChange(currentQuestion.id, opt.key);
                               }
                             };

                             return (
                               <div 
                                 key={opt.key} 
                                 onClick={handleOptionClick}
                                 className={`group relative flex items-start gap-3 md:gap-4 p-4 md:p-5 rounded-[1.2rem] md:rounded-[1.5rem] border-2 cursor-pointer transition-all duration-200
                                   ${isSelected 
                                     ? 'bg-blue-50 border-blue-500 shadow-md scale-[1.01] z-10' 
                                     : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-slate-50 shadow-sm hover:scale-[1.01]'
                                   }`}
                               >
                                 <div className={`shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-[0.8rem] flex items-center justify-center font-black text-xs md:text-sm transition-colors border
                                   ${isSelected ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-slate-100 text-slate-500 border-slate-200 group-hover:bg-blue-100 group-hover:text-blue-600'}
                                 `}>
                                   {displayKey}
                                 </div>
                                 
                                 <div className="flex-1 pt-0.5 md:pt-1 overflow-hidden">
                                   {opt.text && opt.text !== '' && (
                                     <div className={`font-medium text-sm md:text-base leading-relaxed break-words [&>p]:m-0 ${isSelected ? 'text-blue-900 font-bold' : 'text-slate-700'}`} dangerouslySetInnerHTML={{ __html: processHtmlMedia(opt.text || opt.value || '') }} />
                                   )}
                                   
                                   {opt.image_url && (
                                     <div className="mt-3 md:mt-4" onContextMenu={e => e.preventDefault()}>
                                       <img src={getSafeImageUrl(opt.image_url)} alt="Gambar Opsi" className="rounded-xl max-h-32 md:max-h-40 object-contain border border-slate-200 shadow-sm pointer-events-none" referrerPolicy="no-referrer" />
                                     </div>
                                   )}
                                 </div>

                                 <div className={`shrink-0 flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full border-2 transition-all mt-1 md:mt-2
                                   ${isSelected ? 'bg-blue-600 border-blue-600 scale-100 opacity-100 shadow-sm' : 'border-slate-300 scale-75 opacity-50 group-hover:border-blue-300'}
                                 `}>
                                   {isSelected && <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />}
                                 </div>
                               </div>
                             );
                           })}
                         </div>
                       </div>
                     )}

                     {['short_answer', 'essay'].includes(currentQuestion.question_type) && (
                       <div className="space-y-3 md:space-y-4">
                         <div className="flex items-center justify-between">
                            <p className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 md:mb-3 pl-1 md:pl-2">Ketik Jawaban Anda di Kotak Berikut:</p>
                            {currentQuestion.question_type === 'essay' && currentQuestion.allow_media_upload && (
                               <span className="text-[8px] md:text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 md:px-2 py-1 rounded flex items-center gap-1 md:gap-1.5"><Globe className="w-3 h-3"/> Izinkan Link/Media</span>
                            )}
                         </div>
                         
                         <OptimizedQuillEditor 
                           key={currentQuestion.id}
                           initialValue={answers[currentQuestion.id]?.selected_answer || ''}
                           onChange={(content: string) => handleAnswerChange(currentQuestion.id, content)}
                           placeholder={currentQuestion.question_type === 'essay' ? "Jelaskan jawaban Anda secara detail (Bisa unggah media/rumus)..." : "Ketik jawaban / angka di sini..."}
                           minHeight={currentQuestion.question_type === 'essay' ? 'h-48 md:h-72' : 'h-24 md:h-32'}
                           isEssay={currentQuestion.question_type === 'essay'}
                           allowMedia={currentQuestion.allow_media_upload === true}
                         />

                         {currentQuestion.question_type === 'essay' && (
                           <div className="flex justify-end"><span className="text-[8px] md:text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2.5 md:px-3 py-1 md:py-1.5 rounded-md border border-emerald-100 shadow-sm">Sistem menyimpan otomatis</span></div>
                         )}
                       </div>
                     )}

                     {currentQuestion.question_type === 'matching' && (
                       <MatchingInteractiveUI 
                         currentQuestion={currentQuestion} 
                         selectedAnswerJSON={answers[currentQuestion.id]?.selected_answer} 
                         onChange={(jsonStr: string) => handleAnswerChange(currentQuestion.id, jsonStr)}
                       />
                     )}
                   </div>

                   <div className="h-24 md:h-32 w-full shrink-0"></div>

                 </div>
               ) : null}
            </div>

            <div className="shrink-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200 p-3 sm:p-4 md:px-10 md:py-6 flex items-center justify-between z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
              <button 
                onClick={() => changeQuestion(Math.max(0, currentIndex - 1))} 
                disabled={currentIndex === 0 || questions.length === 0}
                className="flex items-center gap-1 md:gap-2 px-4 py-3 md:px-6 md:py-4 bg-slate-50 hover:bg-slate-100 disabled:bg-slate-50/50 text-slate-600 disabled:text-slate-300 text-xs md:text-sm font-black uppercase tracking-widest rounded-xl md:rounded-2xl transition-all active:scale-95 border border-slate-200 disabled:border-slate-100"
              >
                <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" /> <span className="hidden sm:inline">Kembali</span>
              </button>

              <button 
                onClick={() => handleToggleFlag(currentQuestion?.id)}
                disabled={questions.length === 0}
                className={`flex items-center gap-1 md:gap-2 px-4 py-3 md:px-6 md:py-4 text-xs md:text-sm font-black uppercase tracking-widest rounded-xl md:rounded-2xl transition-all active:scale-95 border-2 shadow-sm
                  ${answers[currentQuestion?.id]?.flag_status === 'marked_for_review' 
                    ? 'bg-amber-400 border-amber-500 text-amber-900 shadow-amber-200/50' 
                    : 'bg-white border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-300 disabled:opacity-50'
                  }`}
              >
                <Flag className={`w-4 h-4 md:w-5 md:h-5 ${answers[currentQuestion?.id]?.flag_status === 'marked_for_review' ? 'fill-amber-900' : ''}`} /> 
                <span>Ragu</span>
              </button>

              <button 
                onClick={() => {
                  if (currentIndex === questions.length - 1 || questions.length === 0) triggerSubmit();
                  else changeQuestion(Math.min(questions.length - 1, currentIndex + 1));
                }}
                className="flex items-center gap-1 md:gap-2 px-4 py-3 md:px-6 md:py-4 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-black uppercase tracking-widest rounded-xl md:rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-600/30 border border-blue-500"
              >
                <span className="hidden sm:inline">{(currentIndex === questions.length - 1 || questions.length === 0) ? 'Kumpul' : 'Lanjut'}</span> <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>

          </main>
        </div>
      )}
    </>
  );
}