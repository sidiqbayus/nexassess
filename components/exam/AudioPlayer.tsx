'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, AlertCircle } from 'lucide-react';

interface AudioPlayerProps { 
  src: string; 
  duration?: number;
  playLimit?: number; // Prop baru untuk batas putaran
}

export default function AudioPlayer({ src, duration, playLimit = 0 }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration ?? 0);
  const [playCount, setPlayCount] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setTotalDuration(audio.duration);
    
    const handleEnded = () => {
      setPlaying(false);
      setPlayCount(prev => prev + 1); // Tambah hitungan putaran saat selesai
      audio.currentTime = 0; // Reset ke awal
    };

    // Mencegah Fast-Forward (Mencegah user mengklik progress bar)
    const handleSeeking = () => {
      if (audio.currentTime > currentTime + 1) { // Jika melompat jauh ke depan
        audio.currentTime = currentTime; // Kembalikan ke waktu terakhir yang sah
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('seeking', handleSeeking);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('seeking', handleSeeking);
    };
  }, [currentTime]);

  const isLimitReached = playLimit > 0 && playCount >= playLimit;

  const togglePlay = () => {
    if (isLimitReached) return;
    
    const audio = audioRef.current;
    if (!audio) return;
    
    if (playing) { 
      audio.pause(); 
    } else { 
      audio.play(); 
    }
    setPlaying(!playing);
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(Math.floor(s % 60)).padStart(2,'0')}`;

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="bg-slate-900 p-4 rounded-xl border border-white/10">
      <div className="flex items-center gap-4">
        <audio ref={audioRef} src={src} preload="metadata" />

        <button
          onClick={togglePlay}
          disabled={isLimitReached}
          className={`w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center transition-all ${
            isLimitReached 
              ? 'bg-slate-700 cursor-not-allowed' 
              : 'bg-amber-500 hover:bg-amber-400'
          }`}
        >
          {playing ? (
            <Pause className="w-5 h-5 text-black" />
          ) : (
            <Play className={`w-5 h-5 ml-1 ${isLimitReached ? 'text-slate-400' : 'text-black fill-black'}`} />
          )}
        </button>

        <div className="flex-1">
          {/* Progress bar diubah menjadi non-clickable (pointer-events-none) */}
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden pointer-events-none">
            <div className="h-full bg-amber-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
        </div>
      </div>

      {playLimit > 0 && (
        <div className={`mt-3 flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg ${
          isLimitReached ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        }`}>
          <AlertCircle className="w-4 h-4" />
          {isLimitReached 
            ? `Batas putar habis (${playCount}/${playLimit})` 
            : `Sisa putaran: ${playLimit - playCount} dari ${playLimit} kali (Tidak bisa di-percepat)`
          }
        </div>
      )}
    </div>
  );
}