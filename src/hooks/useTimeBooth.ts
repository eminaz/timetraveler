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
  useRealtime: boolean;
  useElevenLabs: boolean;
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
    useRealtime: false,
    useElevenLabs: false,
  });
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);
  const conversationRef = useRef<any>(null);

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

  const connectWebRTC = async () => {
    if (state.useElevenLabs) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });

        conversationRef.current = await Conversation.startSession({
          agentId: 'T3V3l6ob4NjAgncL6RTX',
          onConnect: () => {
            console.log('ElevenLabs Connected');
            setState(prev => ({ ...prev, isListening: true }));
          },
          onDisconnect: () => {
            console.log('ElevenLabs Disconnected');
            setState(prev => ({ ...prev, isListening: false }));
          },
          onError: (error) => {
            console.error('ElevenLabs Error:', error);
            toast.error('ElevenLabs connection error');
          },
          onModeChange: (mode) => {
            setState(prev => ({ ...prev, isSpeaking: mode.mode === 'speaking' }));
          },
          onMessage: (message) => {
            console.log('ElevenLabs Message:', message);
            if (message.type === 'response.text.delta') {
              setState(prev => ({
                ...prev,
                message: prev.message + message.delta
              }));
            }
          },
        });
      } catch (error) {
        console.error('Failed to start ElevenLabs conversation:', error);
        toast.error('Failed to connect to ElevenLabs');
      }
      return;
    }

    try {
      const { data: tokenResponse, error: tokenError } = await supabase.functions.invoke('chat-voice-realtime', {
        body: { 
          year: state.year,
          location: state.location
        }
      });

      if (tokenError || !tokenResponse?.client_secret?.value) {
        throw new Error('Failed to get ephemeral token');
      }

      const EPHEMERAL_KEY = tokenResponse.client_secret.value;

      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      pc.addTransceiver('audio', {
        direction: 'sendrecv',
        streams: [new MediaStream()]
      });

      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.addEventListener('message', (e) => {
        const event = JSON.parse(e.data);
        console.log('Received event:', event);

        if (event.type === 'session.created') {
          const sessionConfig = {
            type: 'session.update',
            session: {
              modalities: ["text"],
              instructions: `You are a sweet and caring Japanese girlfriend from ${state.year}, living in ${state.location}. You occasionally mix Japanese words into your English responses. Be concise, warm, and authentic to the time period.`,
              tool_choice: "auto",
              temperature: 0.8,
              max_response_output_tokens: "inf"
            }
          };
          dc.send(JSON.stringify(sessionConfig));
        } else if (event.type === 'response.text.delta') {
          setState(prev => ({
            ...prev,
            message: prev.message + event.delta
          }));
        } else if (event.type === 'response.done') {
          if (event.response.status === 'failed') {
            console.error('Response failed:', event.response.status_details);
            toast.error('Failed to get response');
          }
        }
      });

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      await pc.setLocalDescription(offer);

      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-mini";
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp"
        },
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        console.error('OpenAI API error:', errorText);
        throw new Error(`OpenAI API error: ${errorText}`);
      }

      const answer = {
        type: "answer" as RTCSdpType,
        sdp: await sdpResponse.text(),
      };
      
      await pc.setRemoteDescription(answer);
      console.log("WebRTC connection established");

    } catch (error) {
      console.error('Error connecting to WebRTC:', error);
      toast.error('Failed to establish connection');
    }
  };

  const pickupPhone = async () => {
    setState(prev => ({
      ...prev,
      isRinging: false,
      isPickedUp: true,
    }));

    if (state.useRealtime || state.useElevenLabs) {
      await connectWebRTC();
    }
  };

  const hangupPhone = () => {
    if (state.useElevenLabs && conversationRef.current) {
      conversationRef.current.endSession();
      conversationRef.current = null;
    } else {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (dataChannelRef.current) {
        dataChannelRef.current.close();
        dataChannelRef.current = null;
      }
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
    if (state.useElevenLabs && conversationRef.current) {
      try {
        setState(prev => ({ ...prev, isSpeaking: true }));
        await conversationRef.current.textInput(text);
      } catch (error) {
        console.error('Failed to send message to ElevenLabs:', error);
        toast.error('Failed to send message');
        setState(prev => ({ ...prev, isSpeaking: false }));
      }
      return;
    }

    if (state.useRealtime && dataChannelRef.current?.readyState === 'open') {
      const event = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }]
        }
      };

      dataChannelRef.current.send(JSON.stringify(event));
      dataChannelRef.current.send(JSON.stringify({type: 'response.create'}));
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

  const setYear = (year: number) => {
    setState(prev => ({ ...prev, year }));
  };

  const setLocation = (location: string) => {
    setState(prev => ({ ...prev, location }));
  };

  const setUseRealtime = (useRealtime: boolean) => {
    setState(prev => ({ ...prev, useRealtime, useElevenLabs: useRealtime ? false : prev.useElevenLabs }));
  };

  const setUseElevenLabs = (useElevenLabs: boolean) => {
    setState(prev => ({ ...prev, useElevenLabs, useRealtime: useElevenLabs ? false : prev.useRealtime }));
  };

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (dataChannelRef.current) {
        dataChannelRef.current.close();
      }
      if (conversationRef.current) {
        conversationRef.current.endSession();
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
    setUseElevenLabs,
  };
};
