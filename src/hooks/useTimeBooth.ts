
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";
import { Conversation } from '@11labs/client';

interface TimeBoothState {
  year: number;
  location: string;
  isRinging: boolean;
  isPickedUp: boolean;
  generatedImage: string | null;
  isListening: boolean;
  isSpeaking: boolean;
  message: string;
  persona: 'japanese' | 'newyork';
  generatedPrompt: string | null;
  isConnecting: boolean;
  hasBackstory: boolean;
}

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
    persona: 'japanese',
    generatedPrompt: null,
    isConnecting: false,
    hasBackstory: false
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);
  const conversationRef = useRef<any>(null);

  const generateBackstory = async () => {
    console.log('Generating backstory for:', { year: state.year, location: state.location });
    try {
      setState(prev => ({ ...prev, hasBackstory: false }));
      
      const { data, error } = await supabase.functions.invoke('chat-voice', {
        body: { 
          prompt: 'generate backstory',
          year: state.year,
          location: state.location,
          useDeepseek: true
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      console.log('Generated backstory:', data.text);
      setState(prev => ({ 
        ...prev, 
        generatedPrompt: data.text,
        hasBackstory: true
      }));
      return data.text;
    } catch (error) {
      console.error('Failed to generate backstory:', error);
      toast.error('Failed to generate character backstory');
      setState(prev => ({ ...prev, hasBackstory: false }));
      return null;
    }
  };

  const connectWebRTC = async () => {
    try {
      setState(prev => ({ ...prev, isConnecting: true }));
      
      console.log('Starting conversation...');
      const backstory = await generateBackstory();
      if (!backstory) {
        throw new Error('Failed to generate backstory');
      }

      console.log('Requesting microphone access...');
      await navigator.mediaDevices.getUserMedia({ audio: true });

      console.log('Initializing ElevenLabs session...');
      conversationRef.current = await Conversation.startSession({
        agentId: 'T3V3l6ob4NjAgncL6RTX',
        onConnect: () => {
          console.log('ElevenLabs Connected');
          setState(prev => ({ ...prev, isListening: true, isConnecting: false }));
        },
        onDisconnect: () => {
          console.log('ElevenLabs Disconnected');
          setState(prev => ({ 
            ...prev, 
            isListening: false, 
            isPickedUp: false,
            isRinging: true,
            message: '',
            isConnecting: false,
            hasBackstory: false
          }));
        },
        onError: (error) => {
          console.error('ElevenLabs Error:', error);
          toast.error('Connection error');
          setState(prev => ({ ...prev, isConnecting: false }));
        },
        onModeChange: (mode) => {
          console.log('Mode changed:', mode);
          setState(prev => ({ ...prev, isSpeaking: mode.mode === 'speaking' }));
        },
        onMessage: (message: { message: string; source: string }) => {
          console.log('ElevenLabs Message:', message);
          if (message.source === 'agent') {
            setState(prev => ({
              ...prev,
              message: prev.message + message.message
            }));
          }
        },
        overrides: {
          agent: {
            prompt: {
              prompt: backstory,
            },
            firstMessage: "I know you would pick it up. I've been waiting for you...",
            language: 'en',
          },
        },
      });

    } catch (error) {
      console.error('Failed to start conversation:', error);
      toast.error('Failed to start conversation');
      setState(prev => ({ 
        ...prev, 
        isConnecting: false,
        isPickedUp: false,
        isRinging: true,
        hasBackstory: false
      }));
    }
  };

  const pickupPhone = async () => {
    if (state.isConnecting || state.isPickedUp) return;
    
    setState(prev => ({
      ...prev,
      isRinging: false,
      isPickedUp: true,
    }));

    await connectWebRTC();
  };

  const hangupPhone = () => {
    if (conversationRef.current) {
      conversationRef.current.endSession();
      conversationRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isRinging: true,
      isPickedUp: false,
      generatedImage: null,
      message: '',
      isListening: false,
      isSpeaking: false,
      isConnecting: false,
      hasBackstory: false
    }));
  };

  const speak = async (text: string) => {
    if (conversationRef.current) {
      try {
        setState(prev => ({ ...prev, isSpeaking: true }));
        await conversationRef.current.textInput(text);
      } catch (error) {
        console.error('Failed to send message:', error);
        toast.error('Failed to send message');
        setState(prev => ({ ...prev, isSpeaking: false }));
      }
    }
  };

  const setYear = (year: number) => {
    setState(prev => ({ ...prev, year }));
  };

  const setLocation = (location: string) => {
    setState(prev => ({ ...prev, location }));
  };

  const setPersona = (persona: 'japanese' | 'newyork') => {
    setState(prev => {
      const newState = { ...prev, persona };
      
      if (persona === 'japanese') {
        newState.year = 1970;
        newState.location = 'Tokyo, Japan';
      } else {
        newState.year = 1990;
        newState.location = 'New York, USA';
      }
      
      return newState;
    });

    if (state.isPickedUp) {
      hangupPhone();
      setTimeout(() => pickupPhone(), 500);
    }
  };

  return {
    ...state,
    setYear,
    setLocation,
    pickupPhone,
    hangupPhone,
    speak,
    setPersona,
    generateBackstory, // Expose the generateBackstory function
  };
};
