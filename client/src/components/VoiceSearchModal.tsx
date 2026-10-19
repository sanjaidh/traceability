import React, { useState, useEffect } from 'react';
import { Mic, MicOff, X, Check } from 'lucide-react';

interface VoiceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchResult: (spokenText: string) => void;
}

export const VoiceSearchModal: React.FC<VoiceSearchModalProps> = ({
  isOpen,
  onClose,
  onSearchResult,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setSpeechSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setIsListening(false);
      setTranscript('');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const text = event.results[current][0].transcript;
      setTranscript(text);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (e) {}

    return () => {
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (transcript.trim()) {
      onSearchResult(transcript.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div 
        className="w-full max-w-md bg-[#1B1E23] border border-[#2A2E35] rounded-sm p-4 relative"
        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center justify-between pb-2 border-b border-[#2A2E35]">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#9AA0A8]">
            Voice Search (Web Speech API)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9AA0A8] hover:text-[#E7E9EC]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-sm mx-auto mb-3 flex items-center justify-center bg-[#14161A] border border-[#2A2E35]">
            {isListening ? (
              <Mic className="w-6 h-6 text-[#F2A900] alarm-pulsing" />
            ) : (
              <MicOff className="w-6 h-6 text-[#9AA0A8]" />
            )}
          </div>

          <div className="text-xs font-semibold text-[#E7E9EC]">
            {isListening ? 'Listening for speech input...' : 'Microphone idle'}
          </div>
          <div className="text-[11px] text-[#9AA0A8] mt-1 font-mono">
            e.g. "Find Pouch 458", "Where is Work Order 100458", "Show VMC-42"
          </div>

          <div className="mt-3 p-2 bg-[#14161A] border border-[#2A2E35] rounded-sm min-h-[44px] flex items-center justify-center font-mono text-xs text-[#F2A900]">
            {transcript || <span className="text-[#676D76] italic">Spoken transcript will appear here</span>}
          </div>
        </div>

        <div className="pt-2 border-t border-[#2A2E35] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs py-1 px-3"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!transcript.trim()}
            className="btn-primary text-xs py-1 px-3"
          >
            Search Now
          </button>
        </div>
      </div>
    </div>
  );
};
