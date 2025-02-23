
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

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this.audioContext = new AudioContext({
        sampleRate: 24000,
      });
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        this.onAudioData(new Float32Array(inputData));
      };
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
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
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
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

  const pickupPhone = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('chat-voice', {
        body: { action: 'get_signed_url' }
      });

      if (error) throw error;

      const ws = new WebSocket(data.signed_url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        // Configure the session
        ws.send(JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: `You are a Japanese girlfriend from the 1970s, living in Tokyo. You are sweet, caring, and sometimes mix Japanese words into your English. Current year: ${state.year}. Location: ${state.location}.`,
            voice: "alloy",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: {
              model: "whisper-1"
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000
            }
          }
        }));
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('Received message:', data);

        if (data.type === 'response.audio.delta') {
          const binaryString = atob(data.delta);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          await playAudio(bytes);
        } else if (data.type === 'response.audio_transcript.delta') {
          setState(prev => ({
            ...prev,
            message: prev.message + data.delta
          }));
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error('Connection error');
        hangupPhone();
      };

      setState(prev => ({
        ...prev,
        isRinging: false,
        isPickedUp: true,
      }));

      // Start recording audio
      audioRecorderRef.current = new AudioRecorder((audioData) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const encodedAudio = btoa(String.fromCharCode(...new Uint8Array(audioData.buffer)));
          wsRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: encodedAudio
          }));
        }
      });
      await audioRecorderRef.current.start();

    } catch (error) {
      console.error('Error in pickupPhone:', error);
      toast.error('Failed to start conversation');
      hangupPhone();
    }
  };

  const hangupPhone = () => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
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

  const speak = async (text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setState(prev => ({ ...prev, isSpeaking: true }));
      wsRef.current.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{
            type: 'input_text',
            text
          }]
        }
      }));
      wsRef.current.send(JSON.stringify({type: 'response.create'}));
    } else {
      toast.error('Not connected to conversation');
      setState(prev => ({ ...prev, isSpeaking: false }));
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRecorderRef.current) {
        audioRecorderRef.current.stop();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
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
    setGeneratedImage,
    speak,
  };
};
