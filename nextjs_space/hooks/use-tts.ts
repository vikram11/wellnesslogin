'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseTtsReturn {
  isSpeaking: boolean;
  isSupported: boolean;
  speak: (text: string) => void;
  stop: () => void;
}

export function useTts(): UseTtsReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsSupported('speechSynthesis' in window);
  }, []);

  const stop = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // Stop any current speech
    window.speechSynthesis.cancel();

    // Clean markdown/HTML from text for natural speech
    const cleaned = text
      .replace(/```[\s\S]*?```/g, '') // remove code blocks
      .replace(/`[^`]*`/g, '')        // remove inline code
      .replace(/\*\*([^*]+)\*\*/g, '$1') // bold → plain
      .replace(/\*([^*]+)\*/g, '$1')     // italic → plain
      .replace(/#{1,6}\s*/g, '')         // headings
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text
      .replace(/<[^>]+>/g, '')           // HTML tags
      .replace(/\|[^|\n]+/g, '')         // table rows
      .replace(/[-–—]{3,}/g, '')         // horizontal rules
      .replace(/\n{2,}/g, '. ')          // multiple newlines → pause
      .replace(/\n/g, ' ')               // single newlines → space
      .trim();

    if (!cleaned) return;

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.rate = 0.95;
    utterance.pitch = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { isSpeaking, isSupported, speak, stop };
}
