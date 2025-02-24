import { useState, useRef } from 'react';
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
  persona: 'girlfriend' | 'homie';
  generatedPrompt: string | null;
  isConnecting: boolean;
  hasBackstory: boolean;
  ringbackToneUrl: string | null;
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
    isRinging: false,
    isPickedUp: false,
    generatedImage: null,
    isListening: false,
    isSpeaking: false,
    message: '',
    persona: 'girlfriend',
    generatedPrompt: null,
    isConnecting: false,
    hasBackstory: false,
    ringbackToneUrl: null
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);
  const conversationRef = useRef<any>(null);
  const ringbackAudioRef = useRef<HTMLAudioElement | null>(null);

  const generateRingbackTone = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-ringback', {
        body: { year: state.year }
      });

      if (error) throw error;

      if (data.audio_url) {
        ringbackAudioRef.current = new Audio(data.audio_url);
        ringbackAudioRef.current.volume = 0.1;
        ringbackAudioRef.current.load();
      }

      setState(prev => ({ ...prev, ringbackToneUrl: data.audio_url }));
      return data.audio_url;
    } catch (error) {
      console.error('Failed to generate ringback tone:', error);
      toast.error('Failed to generate ringback tone');
      return null;
    }
  };

  const generateBackstory = async () => {
    console.log('Generating backstory for:', { year: state.year, location: state.location, persona: state.persona });
    try {
      setState(prev => ({ ...prev, hasBackstory: false }));
      
      const { data: existingBackstory } = await supabase
        .from('backstories')
        .select('combined_backstory')
        .eq('year', state.year)
        .eq('location', state.location.trim())
        .eq('persona', state.persona)
        .maybeSingle();

      if (existingBackstory?.combined_backstory) {
        console.log('Using existing backstory');
        setState(prev => ({ 
          ...prev, 
          generatedPrompt: existingBackstory.combined_backstory,
          hasBackstory: true
        }));
        return existingBackstory.combined_backstory;
      }

      const { data, error } = await supabase.functions.invoke('chat-voice', {
        body: { 
          prompt: 'generate backstory',
          year: state.year,
          location: state.location.trim(),
          useDeepseek: true,
          persona: state.persona
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      console.log('Generated backstory:', data.text);
      
      const { error: saveError } = await supabase
        .from('backstories')
        .insert([{
          year: state.year,
          location: state.location.trim(),
          combined_backstory: data.text,
          persona: state.persona
        }]);

      if (saveError) {
        console.error('Error saving backstory:', saveError);
      }

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

  const connectWebRTC = async (selectedPersona: 'girlfriend' | 'homie') => {
    try {
      setState(prev => ({ ...prev, isConnecting: true }));
      
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.pause();
        ringbackAudioRef.current = null;
      }

      const { data: existingBackstory } = await supabase
        .from('backstories')
        .select('combined_backstory')
        .eq('year', state.year)
        .eq('location', state.location.trim())
        .eq('persona', selectedPersona)
        .maybeSingle();

      const backstory = existingBackstory?.combined_backstory || state.generatedPrompt;
      
      if (!backstory) {
        throw new Error('No backstory available');
      }

      console.log('Requesting microphone access...');
      await navigator.mediaDevices.getUserMedia({ audio: true });

      console.log('Initializing ElevenLabs session with persona:', selectedPersona);
      const agentId = selectedPersona === 'girlfriend' ? 
        'T3V3l6ob4NjAgncL6RTX' : 
        'XWcySB7eGEOQPmqtfR3a';

      if (conversationRef.current) {
        console.log('Cleaning up existing conversation before starting new one');
        conversationRef.current.endSession();
        conversationRef.current = null;
      }

      conversationRef.current = await Conversation.startSession({
        agentId: agentId,
        onConnect: () => {
          console.log('ElevenLabs Connected');
          setState(prev => ({ ...prev, isListening: true, isConnecting: false }));
        },
        onDisconnect: () => {
          console.log('ElevenLabs Disconnected');
          cleanupConnection();
        },
        onError: (error) => {
          console.error('ElevenLabs Error:', error);
          toast.error('Connection error');
          cleanupConnection();
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
            firstMessage: selectedPersona === 'girlfriend' ? 
              "Hey sweetheart! I was just thinking about you!" : 
              "Yo! What's good? Just the person I wanted to hear from!",
            language: 'en',
          },
        },
      });

    } catch (error) {
      console.error('Failed to start conversation:', error);
      toast.error('Failed to start conversation');
      cleanupConnection();
    }
  };

  const callGirlfriend = async (selectedPersona: 'girlfriend' | 'homie') => {
    if (state.isConnecting || state.isPickedUp) return;
    
    cleanupConnection();
    
    setState(prev => ({
      ...prev,
      isRinging: true,
      persona: selectedPersona,
    }));

    if (state.ringbackToneUrl) {
      if (!ringbackAudioRef.current) {
        ringbackAudioRef.current = new Audio(state.ringbackToneUrl);
        ringbackAudioRef.current.volume = 0.1;
      }
      ringbackAudioRef.current.loop = true;
      try {
        await ringbackAudioRef.current.play();
        console.log('Playing ringback tone:', state.ringbackToneUrl);
      } catch (error) {
        console.error('Failed to play ringback tone:', error);
      }
    }

    const delay = Math.floor(Math.random() * 4000) + 1000;
    console.log(`Will pick up in ${delay}ms with persona:`, selectedPersona);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    console.log('Starting call with persona:', selectedPersona);
    
    setState(prev => ({ ...prev, isPickedUp: true }));
    await connectWebRTC(selectedPersona);
  };

  const hangupPhone = () => {
    cleanupConnection();
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

  const setPersona = (persona: 'girlfriend' | 'homie') => {
    console.log('Setting persona to:', persona);
    cleanupConnection();
    
    return new Promise<void>((resolve) => {
      setState(prev => ({ ...prev, persona }));
      setTimeout(resolve, 50);
    });
  };

  const cleanupConnection = () => {
    if (conversationRef.current) {
      conversationRef.current.endSession();
      conversationRef.current = null;
    }

    if (ringbackAudioRef.current) {
      ringbackAudioRef.current.pause();
      ringbackAudioRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isRinging: false,
      isPickedUp: false,
      generatedImage: null,
      message: '',
      isListening: false,
      isSpeaking: false,
      isConnecting: false,
      hasBackstory: false
    }));
  };

  return {
    ...state,
    setYear,
    setLocation,
    callGirlfriend,
    hangupPhone,
    speak,
    setPersona,
    generateBackstory,
    generateRingbackTone,
  };
};
