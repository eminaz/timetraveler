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
  useRealtime: boolean;
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
    useRealtime: false,
  });
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);

  class AudioQueue {
    private queue: Uint8Array[] = [];
    private isPlaying = false;
    private audioContext: AudioContext;

    constructor(audioContext: AudioContext) {
      this.audioContext = audioContext;
    }

    async addToQueue(audioData: Uint8Array) {
      this.queue.push(audioData);
      if (!this.isPlaying) {
        await this.playNext();
      }
    }

    private async playNext() {
      if (this.queue.length === 0) {
        this.isPlaying = false;
        return;
      }

      this.isPlaying = true;
      const audioData = this.queue.shift()!;

      try {
        const audioBuffer = await this.audioContext.decodeAudioData(audioData.buffer);
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        
        source.onended = () => this.playNext();
        source.start(0);
      } catch (error) {
        console.error('Error playing audio:', error);
        this.playNext();
      }
    }
  }

  const setUseRealtime = (useRealtime: boolean) => {
    setState(prev => ({ ...prev, useRealtime }));
  };

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
    
    if (!audioQueueRef.current) {
      audioQueueRef.current = new AudioQueue(audioContextRef.current);
    }

    try {
      await audioQueueRef.current.addToQueue(audioData);
      setState(prev => ({ ...prev, isSpeaking: true }));
    } catch (error) {
      console.error('Error playing audio:', error);
      setState(prev => ({ ...prev, isSpeaking: false }));
    }
  };

  const connectWebSocket = () => {
    if (websocketRef.current) {
      websocketRef.current.close();
    }

    const url = new URL(`wss://bxtwhvvgykntbmpwtitx.functions.supabase.co/functions/v1/chat-voice-realtime`);
    url.searchParams.append('year', state.year.toString());
    url.searchParams.append('location', state.location);
    url.searchParams.append('apikey', supabase.supabaseClient.auth.session()?.access_token || '');

    const ws = new WebSocket(url);

    console.log('Connecting to WebSocket...', url.toString());

    ws.onopen = () => {
      console.log('WebSocket connection established');
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log('Received WebSocket message:', data);
      
      if (data.type === 'response.audio.delta') {
        const binaryString = atob(data.delta);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        await playAudio(bytes);
      } else if (data.type === 'response.text.delta') {
        setState(prev => ({
          ...prev,
          message: prev.message + data.delta
        }));
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast.error('Connection error');
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    websocketRef.current = ws;
  };

  const pickupPhone = () => {
    setState(prev => ({
      ...prev,
      isRinging: false,
      isPickedUp: true,
    }));

    if (state.useRealtime) {
      connectWebSocket();
    }
  };

  const hangupPhone = () => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isRinging: true,
      isPickedUp: false,
      generatedImage: null,
      message: '',
    }));
  };

  const speak = async (text: string) => {
    if (state.useRealtime && websocketRef.current) {
      websocketRef.current.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }]
        }
      }));
      return;
    }

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
      if (websocketRef.current) {
        websocketRef.current.close();
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
    setUseRealtime,
  };
};
