import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Square, Loader2, Sparkles, AlertCircle } from 'lucide-react';

interface VoiceSpeechInputProps {
  onTranscriptReady: (transcript: string, autoSend?: boolean) => void;
  disabled?: boolean;
  className?: string;
  buttonLabel?: string;
  variant?: 'compact' | 'prominent';
}

// Check for Web Speech API availability
const getSpeechRecognition = (): any => {
  if (typeof window === 'undefined') return null;
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return SpeechRecognition ? new SpeechRecognition() : null;
};

export const VoiceSpeechInput: React.FC<VoiceSpeechInputProps> = ({
  onTranscriptReady,
  disabled = false,
  className = '',
  buttonLabel,
  variant = 'compact',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isRecordingMedia, setIsRecordingMedia] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [interimText, setInterimText] = useState('');
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize or cleanup
  useEffect(() => {
    return () => {
      stopAllListening();
    };
  }, []);

  const stopAllListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsListening(false);
    setIsRecordingMedia(false);
    setInterimText('');
    setRecordingSeconds(0);
  };

  // Start Web Speech API Recognition
  const startSpeechRecognition = () => {
    setPermissionError(null);
    const recognition = getSpeechRecognition();

    if (!recognition) {
      // Fallback to MediaRecorder + Gemini AI transcription
      startMediaRecorder();
      return;
    }

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalAcc = '';

    recognition.onstart = () => {
      setIsListening(true);
      setInterimText('Listening... speak into your microphone');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalAcc += (finalAcc ? ' ' : '') + transcriptPart.trim();
        } else {
          interim += transcriptPart;
        }
      }
      setInterimText(interim || finalAcc || 'Listening...');
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition event error:', event.error);
      if (event.error === 'not-allowed') {
        setPermissionError('Microphone access was denied. Please allow microphone permissions in your browser.');
        stopAllListening();
      } else if (event.error === 'no-speech') {
        // Keep active or ignore quiet gaps
      } else {
        // Fallback to MediaRecorder audio recording
        stopAllListening();
        startMediaRecorder();
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalAcc.trim()) {
        onTranscriptReady(finalAcc.trim());
      }
      setInterimText('');
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e: any) {
      console.warn('Failed to start Web Speech recognition, falling back to MediaRecorder:', e);
      startMediaRecorder();
    }
  };

  // Stop Web Speech API Recognition
  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  };

  // Start MediaRecorder (Records actual audio file and sends to Gemini Transcribe API)
  const startMediaRecorder = async () => {
    setPermissionError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        if (audioBlob.size > 0) {
          await transcribeWithGemini(audioBlob);
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        setIsRecordingMedia(false);
        setRecordingSeconds(0);
      };

      mediaRecorder.start(250);
      setIsRecordingMedia(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      setPermissionError(
        err.name === 'NotAllowedError'
          ? 'Microphone access was denied. Please allow microphone permissions in your browser URL bar.'
          : 'Could not access device microphone. Please verify your audio input settings.'
      );
      setIsRecordingMedia(false);
    }
  };

  const stopMediaRecorder = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Send audio to Gemini transcription backend
  const transcribeWithGemini = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);

      const audioBase64 = await base64Promise;

      const res = await fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: audioBlob.type || 'audio/webm',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to transcribe audio.');
      }

      const data = await res.json();
      if (data.text) {
        onTranscriptReady(data.text);
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      setPermissionError('Could not transcribe voice note. Please try speaking again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Toggle button handler
  const handleToggleVoice = () => {
    if (isListening) {
      stopSpeechRecognition();
    } else if (isRecordingMedia) {
      stopMediaRecorder();
    } else {
      startSpeechRecognition();
    }
  };

  const isActive = isListening || isRecordingMedia;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (variant === 'prominent') {
    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={handleToggleVoice}
          disabled={disabled || isTranscribing}
          className={`px-4 py-3 rounded-xl border flex items-center justify-center gap-2.5 text-xs font-medium transition active:scale-95 shadow-sm ${
            isActive
              ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse ring-2 ring-rose-500/30'
              : 'bg-neutral-900/90 hover:bg-neutral-800 border-neutral-700/80 hover:border-amber-500/40 text-neutral-200'
          }`}
          title={isActive ? 'Click to stop speaking' : 'Speak into microphone'}
        >
          {isTranscribing ? (
            <>
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
              <span>Transcribing voice note...</span>
            </>
          ) : isActive ? (
            <>
              <Square className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
              <span className="font-semibold text-rose-300">
                Listening {isRecordingMedia ? `(${formatTime(recordingSeconds)})` : '...'} Click to stop
              </span>
              <span className="flex gap-0.5 items-end h-3">
                <span className="w-1 bg-rose-400 rounded-full animate-bounce h-2" style={{ animationDelay: '0ms' }} />
                <span className="w-1 bg-rose-400 rounded-full animate-bounce h-3" style={{ animationDelay: '150ms' }} />
                <span className="w-1 bg-rose-400 rounded-full animate-bounce h-1.5" style={{ animationDelay: '300ms' }} />
              </span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 text-amber-400" />
              <span>{buttonLabel || 'Speak Your Reflection'}</span>
            </>
          )}
        </button>

        {permissionError && (
          <div className="mt-2 text-[11px] text-rose-300 bg-rose-950/60 border border-rose-800/60 rounded-lg p-2 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-400" />
            <span>{permissionError}</span>
          </div>
        )}
      </div>
    );
  }

  // Default compact layout for input bar
  return (
    <div className={`relative flex items-center ${className}`}>
      <button
        id="voice-microphone-button"
        type="button"
        onClick={handleToggleVoice}
        disabled={disabled || isTranscribing}
        className={`h-[50px] w-[50px] rounded-xl border flex items-center justify-center transition active:scale-95 flex-shrink-0 ${
          isActive
            ? 'bg-rose-500/20 border-rose-500 text-rose-300 ring-2 ring-rose-500/40'
            : 'bg-neutral-900/90 hover:bg-neutral-800 border-neutral-800 hover:border-amber-500/40 text-neutral-300 hover:text-amber-300'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
        title={
          isActive
            ? 'Stop microphone'
            : 'Speak into microphone (Voice entry)'
        }
      >
        {isTranscribing ? (
          <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
        ) : isActive ? (
          <div className="relative flex items-center justify-center">
            <span className="absolute w-7 h-7 rounded-full bg-rose-500/30 animate-ping" />
            <Square className="w-4 h-4 text-rose-400 fill-rose-400 z-10" />
          </div>
        ) : (
          <Mic className="w-5 h-5 text-amber-400/90 group-hover:text-amber-400" />
        )}
      </button>

      {/* Floating active voice notification pill */}
      {isActive && (
        <div className="absolute bottom-full mb-3 left-0 sm:left-auto right-0 sm:right-auto sm:min-w-[280px] bg-neutral-900 border border-rose-500/50 rounded-xl p-2.5 shadow-xl text-xs text-neutral-200 z-30 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <div className="flex flex-col">
              <span className="font-semibold text-rose-300 text-[11px]">
                {isRecordingMedia ? `Recording audio (${formatTime(recordingSeconds)})` : 'Microphone Live'}
              </span>
              <span className="text-[10px] text-neutral-400 truncate max-w-[180px]">
                {interimText || 'Speak your reflection freely...'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleVoice}
            className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-medium border border-rose-500/40 whitespace-nowrap transition"
          >
            Done
          </button>
        </div>
      )}

      {/* Error alert toast */}
      {permissionError && (
        <div className="absolute bottom-full mb-3 left-0 bg-rose-950 border border-rose-800 rounded-xl p-2.5 shadow-xl text-xs text-rose-200 z-30 flex items-start gap-2 max-w-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-[11px] leading-relaxed">
            {permissionError}
          </div>
          <button
            type="button"
            onClick={() => setPermissionError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs px-1"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
