'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVoiceInputReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

export function useVoiceInput(onResult?: (text: string) => void): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // Track whether the user WANTS to be listening (survives re-renders and onend callbacks)
  const wantListeningRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const createRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalChunk += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (finalChunk) {
        finalTranscriptRef.current += finalChunk;
      }
      const combined = (finalTranscriptRef.current + interim).trim();
      setTranscript(combined);
      onResultRef.current?.(combined);
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      // 'not-allowed' or 'service-not-allowed' means user denied mic — give up
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        wantListeningRef.current = false;
        setIsListening(false);
      }
      // 'no-speech', 'aborted', 'network' — let onend handle restart
    };

    recognition.onend = () => {
      // If user still wants to listen, restart after a brief delay
      if (wantListeningRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (wantListeningRef.current) {
            try {
              // Create a fresh instance (some browsers can't restart the same one)
              const fresh = createRecognition();
              if (fresh) {
                recognitionRef.current = fresh;
                fresh.start();
              } else {
                wantListeningRef.current = false;
                setIsListening(false);
              }
            } catch {
              wantListeningRef.current = false;
              setIsListening(false);
            }
          }
        }, 300);
      } else {
        setIsListening(false);
      }
    };

    return recognition;
  }, []);

  const startListening = useCallback(() => {
    // Stop any existing session
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    const recognition = createRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    finalTranscriptRef.current = '';
    setTranscript('');
    wantListeningRef.current = true;
    setIsListening(true);

    try {
      recognition.start();
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      wantListeningRef.current = false;
      setIsListening(false);
    }
  }, [createRecognition]);

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (wantListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  return { isListening, isSupported, transcript, startListening, stopListening, toggleListening };
}
