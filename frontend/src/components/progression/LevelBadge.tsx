import { useState, useEffect, useRef, useCallback } from 'react';
import { progressionApi, type LevelProgress } from '@/services/progression';

export function LevelBadge() {
  const [info, setInfo] = useState<LevelProgress | null>(null);
  const [animating, setAnimating] = useState(false);
  const prevLevel = useRef(1);

  const fetchLevel = useCallback(() => {
    progressionApi.getLevelProgress().then((data) => {
      if (data.level > prevLevel.current) {
        setAnimating(true);
        setTimeout(() => setAnimating(false), 2000);
      }
      prevLevel.current = data.level;
      setInfo(data);
    });
  }, []);

  useEffect(() => {
    fetchLevel();
    const handler = () => fetchLevel();
    window.addEventListener('xp-updated', handler);
    return () => window.removeEventListener('xp-updated', handler);
  }, [fetchLevel]);

  if (!info) {
    return (
      <div className="bg-[#1A1A2E] border border-gray-800 rounded-xl p-4 animate-pulse">
        <div className="h-8 w-32 bg-gray-700 rounded mb-2" />
        <div className="h-4 bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <div className={`relative bg-gradient-to-r from-[#1A1A2E] to-[#2A1A3E] border border-gray-800 rounded-xl p-5 transition-all duration-500 ${animating ? 'scale-105 border-gold shadow-lg shadow-gold/20' : ''}`}>
      {animating && (
        <div className="absolute inset-0 bg-gold/10 rounded-xl flex items-center justify-center z-10">
          <span className="text-2xl font-bold text-gold animate-bounce">Niveau Supérieur !</span>
        </div>
      )}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gold to-amber-600 flex items-center justify-center text-2xl font-bold text-black relative">
          {info.level}
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center text-[10px] font-bold text-white">
            XP
          </div>
        </div>
        <div className="flex-1">
          <div className="text-lg font-bold text-white">Niveau {info.level}</div>
          <div className="text-xs text-gray-400 mt-0.5">{info.xpInCurrentLevel.toLocaleString()} / {info.xpForNextLevel.toLocaleString()} XP</div>
          <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
            <div className="bg-gradient-to-r from-gold to-amber-500 h-2 rounded-full transition-all duration-500" style={{ width: `${info.progressPercent}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
