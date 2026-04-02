'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

const MAX_TAB_SWITCHES = 3; 

interface ViolationEvent {
  type: 'tab_switch' | 'fullscreen_exit' | 'right_click' | 'keyboard_shortcut' | 'copy_paste';
  timestamp: string;
  detail?: string;
  count?: number;
}

interface AntiCheatOptions {
  sessionId: string;
  onWarning: (message: string, count: number) => void;
  onForceSubmit: (reason: string) => void;
  maxTabSwitches?: number;
}

interface AntiCheatState {
  tabSwitchCount: number;
  isFullscreen: boolean;
  violations: ViolationEvent[];
}

export function useAntiCheat({
  sessionId,
  onWarning,
  onForceSubmit,
  maxTabSwitches = MAX_TAB_SWITCHES,
}: AntiCheatOptions) {
  
  const tabSwitchRef = useRef<number>(0);
  const violationsRef = useRef<ViolationEvent[]>([]);
  const [state, setState] = useState<AntiCheatState>({
    tabSwitchCount: 0,
    isFullscreen: false,
    violations: [],
  });

  const reportViolation = useCallback(async (violation: ViolationEvent) => {
    violationsRef.current.push(violation);
    try {
      if (sessionId) {
        await supabase
          .from('exam_sessions')
          .update({
            tab_switch_count: tabSwitchRef.current,
            violation_log: violationsRef.current as any,
          })
          .eq('id', sessionId);
      }
    } catch (err) {
      console.error('Gagal melaporkan pelanggaran:', err);
    }
  }, [sessionId]);

  const triggerForceSubmit = useCallback(async (reason: string) => {
    try {
      if (sessionId) {
        await supabase
          .from('exam_sessions')
          .update({
            status: 'force_submitted',
            submitted_at: new Date().toISOString(),
            violation_log: violationsRef.current as any,
            tab_switch_count: tabSwitchRef.current,
          })
          .eq('id', sessionId);
      }
    } catch (err) {
      console.error('Gagal force submit:', err);
    }
    onForceSubmit(reason);
  }, [sessionId, onForceSubmit]);

  const requestFullscreen = useCallback(() => {
    const elem = document.documentElement as any;
    // Kita gunakan .catch agar jika gagal tidak membuat aplikasi crash/runtime error
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {
          console.warn("Fullscreen request failed. Needs user interaction.");
      });
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    const doc = document as any;
    if (doc.exitFullscreen) {
      doc.exitFullscreen().catch(() => {});
    } else if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      doc.mozCancelFullScreen();
    }
  }, []);

  // 1. Deteksi pindah tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchRef.current += 1;
        const count = tabSwitchRef.current;
        const violation: ViolationEvent = {
          type: 'tab_switch',
          timestamp: new Date().toISOString(),
          count,
          detail: `Siswa keluar dari tab ujian (kejadian ke-${count})`,
        };
        reportViolation(violation);
        setState(prev => ({ ...prev, tabSwitchCount: count, violations: [...prev.violations, violation] }));

        if (count >= maxTabSwitches) {
          triggerForceSubmit(`Ujian dikumpulkan otomatis karena berpindah tab sebanyak ${count} kali.`);
        } else {
          onWarning(`⚠️ PERINGATAN ${count}/${maxTabSwitches}: Anda terdeteksi berpindah tab!`, count);
        }
      } else {
        setState(prev => ({ ...prev, isFullscreen: !!document.fullscreenElement }));
        // HAPUS: setTimeout(requestFullscreen, 300) - INI PENYEBAB ERROR
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [maxTabSwitches, onWarning, reportViolation, requestFullscreen, triggerForceSubmit]);

  // 2. Deteksi keluar fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setState(prev => ({ ...prev, isFullscreen: isNowFullscreen }));
      
      if (!isNowFullscreen) {
        const violation: ViolationEvent = { 
            type: 'fullscreen_exit', 
            timestamp: new Date().toISOString(), 
            detail: 'Keluar dari mode fullscreen' 
        };
        reportViolation(violation);
        onWarning('🖥️ Harap tetap dalam mode fullscreen selama ujian berlangsung!', 0);
        // HAPUS: setTimeout(requestFullscreen, 1000) - INI PENYEBAB ERROR
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [onWarning, reportViolation, requestFullscreen]);

  // 3. Blokir Fitur Browser Lainnya (Tetap Aman)
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
        const blocked = [
            e.key === 'F12',
            e.ctrlKey && e.key === 'u',
            e.ctrlKey && e.shiftKey && e.key === 'I',
            e.key === 'PrintScreen',
            e.altKey && e.key === 'Tab'
        ];
        if (blocked.some(condition => condition)) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);

  return { 
    tabSwitchCount: state.tabSwitchCount, 
    isFullscreen: state.isFullscreen, 
    violations: state.violations, 
    requestFullscreen, 
    exitFullscreen 
  };
}