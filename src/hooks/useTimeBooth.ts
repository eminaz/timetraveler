
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";

interface TimeBoothState {
  year: number;
  location: string;
  isRinging: boolean;
  isPickedUp: boolean;
  generatedImage: string | null;
  isListening: boolean;
  isSpeaking: boolean;
  message: string;
}

export const useTimeBooth = () => {
  const [state, setState] = useState<TimeBoothState>({
    year: 1970,
    location: 'Tokyo, Japan',
    isRinging: true,
    isPickedUp: false,
    generatedImage: null,
    isListening: false,
    isSpeaking: false,
    message: '',
  });
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const setYear = (year: number) => {
    setState(prev => ({ ...prev, year }));
  };

  const setLocation = (location: string) => {
    setState(prev => ({ ...prev, location }));
  };

  const pickupPhone = () => {
    setState(prev => ({
      ...prev,
      isRinging: false,
      isPickedUp: true,
    }));
    speak("こんにちは! I'm so happy to hear from you! How are you today?");
  };

  const hangupPhone = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setState(prev => ({
      ...prev,
      isRinging: true,
      isPickedUp: false,
      generatedImage: null,
      isListening: false,
      isSpeaking: false,
      message: '',
    }));
  };

  const setGeneratedImage = (image: string) => {
    setState(prev => ({ ...prev, generatedImage: image }));
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      toast.error('Speech recognition is not supported in your browser');
      return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setState(prev => ({ ...prev, isListening: true }));
      toast.info('Listening...');
    };

    recognition.onresult = async (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setState(prev => ({ ...prev, message: transcript }));
      await speak(transcript);
    };

    recognition.onerror = (event: SpeechRecognitionError) => {
      console.error('Speech recognition error:', event.error);
      setState(prev => ({ ...prev, isListening: false }));
      toast.error('Error while listening');
    };

    recognition.onend = () => {
      setState(prev => ({ ...prev, isListening: false }));
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const speak = async (text: string) => {
    try {
      setState(prev => ({ ...prev, isSpeaking: true }));

      const { data, error } = await supabase.functions.invoke('chat-voice', {
        body: { text }
      });

      if (error) throw error;

      if (data.audioContent) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        audioRef.current = audio;
        
        audio.onended = () => {
          setState(prev => ({ ...prev, isSpeaking: false }));
        };

        await audio.play();
      }
    } catch (error) {
      console.error('Error generating speech:', error);
      toast.error('Error generating speech');
      setState(prev => ({ ...prev, isSpeaking: false }));
    }
  };

  return {
    ...state,
    setYear,
    setLocation,
    pickupPhone,
    hangupPhone,
    setGeneratedImage,
    startListening,
    speak,
  };
};
