
import { useState, useRef, useEffect } from 'react';
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
  
  const audioContextRef = useRef<AudioContext | null>(null);

  const setYear = (year: number) => {
    setState(prev => ({ ...prev, year }));
  };

  const setLocation = (location: string) => {
    setState(prev => ({ ...prev, location }));
  };

  const playAudio = async (audioData: Uint8Array) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    
    try {
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.buffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      setState(prev => ({ ...prev, isSpeaking: true }));
      
      source.onended = () => {
        setState(prev => ({ ...prev, isSpeaking: false }));
      };
      
      source.start(0);
    } catch (error) {
      console.error('Error playing audio:', error);
      setState(prev => ({ ...prev, isSpeaking: false }));
    }
  };

  const pickupPhone = () => {
    setState(prev => ({
      ...prev,
      isRinging: false,
      isPickedUp: true,
    }));
  };

  const hangupPhone = () => {
    setState(prev => ({
      ...prev,
      isRinging: true,
      isPickedUp: false,
      generatedImage: null,
      message: '',
    }));
  };

  const speak = async (text: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('chat-voice', {
        body: { 
          prompt: text,
          year: state.year,
          location: state.location
        }
      });

      if (error) throw error;

      if (data.text) {
        setState(prev => ({ ...prev, message: data.text }));
      }

      if (data.audioContent) {
        const binaryString = atob(data.audioContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        await playAudio(bytes);
      }
    } catch (error) {
      console.error('Error in speak:', error);
      toast.error('Failed to process speech');
    }
  };

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    setYear,
    setLocation,
    pickupPhone,
    hangupPhone,
    speak,
  };
};
