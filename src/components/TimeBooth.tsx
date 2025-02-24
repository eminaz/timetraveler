
import React, { useState, useRef } from 'react';
import { Phone, Rocket, ArrowLeft, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useTimeBooth } from '../hooks/useTimeBooth';
import { cn } from '../lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const TimeBooth: React.FC = () => {
  const {
    year,
    location,
    isRinging,
    isPickedUp,
    isListening,
    isSpeaking,
    message,
    persona,
    isConnecting,
    setYear,
    setLocation,
    pickupPhone,
    hangupPhone,
    speak,
    setPersona,
  } = useTimeBooth();

  const [isGeneratingScene, setIsGeneratingScene] = useState(false);
  const [isPreparingCall, setIsPreparingCall] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [hasStartedTimeTravel, setHasStartedTimeTravel] = useState(false);
  const [showPhoneButton, setShowPhoneButton] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startTimeTravel = async () => {
    try {
      setIsGeneratingScene(true);
      setHasStartedTimeTravel(true);
      
      if (!year || !location) {
        throw new Error('Year and location are required');
      }

      const { data, error } = await supabase.functions.invoke('generate-scene', {
        body: { 
          year: Number(year),
          location: location.trim(),
        }
      });

      if (error) {
        console.error('Scene generation error:', error);
        throw error;
      }

      console.log('Scene generation successful, got image URL:', data.image_url);
      setBackgroundImage(data.image_url);
      setIsGeneratingScene(false);
      setIsPreparingCall(true);
      setShowPhoneButton(true);

      // Create new audio element and store it in ref
      audioRef.current = new Audio('/phone-ring.mp3');
      audioRef.current.loop = true;
      try {
        await audioRef.current.play();
      } catch (error) {
        console.error('Failed to play audio:', error);
      }
    } catch (error) {
      console.error('Failed to generate scene:', error);
      toast.error('Failed to generate scene');
      setIsGeneratingScene(false);
      setHasStartedTimeTravel(false);
    }
  };

  const handlePickupPhone = () => {
    setShowPhoneButton(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    pickupPhone();
  };

  const exitTimeTravel = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    setHasStartedTimeTravel(false);
    setIsPreparingCall(false);
    setBackgroundImage(null);
    setIsGeneratingScene(false);
    setShowPhoneButton(false);
    
    if (isPickedUp) {
      hangupPhone();
    }
  };

  return (
    <div 
      className={cn(
        "min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 transition-all duration-1000",
        backgroundImage && "bg-none"
      )}
      style={backgroundImage ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      {hasStartedTimeTravel && (
        <Button
          variant="outline"
          onClick={exitTimeTravel}
          className="fixed top-4 right-4 bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Exit Time Travel
        </Button>
      )}

      {!hasStartedTimeTravel ? (
        // Initial UI for selecting year and location
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="phone-booth">
            <div className="phone-booth-window">
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                  <h1 className="text-2xl font-bold text-white">Time Booth</h1>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => setPersona(persona === 'japanese' ? 'newyork' : 'japanese')}
                      className="text-white"
                    >
                      {persona === 'japanese' ? '🇯🇵 Japanese' : '🗽 New York'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={startTimeTravel}
                      disabled={isGeneratingScene || !location || !year}
                      className={cn(
                        "bg-gold hover:bg-gold/90 text-black",
                        isGeneratingScene && "opacity-50"
                      )}
                    >
                      <Rocket className="w-4 h-4 mr-2" />
                      Start Time Travel
                    </Button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="glass-panel p-4">
                    <label className="block text-sm font-medium text-white mb-2">
                      Year
                    </label>
                    <input
                      type="range"
                      min="1800"
                      max="2024"
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="timeline-slider"
                    />
                    <span className="block text-center text-gold text-xl mt-2">
                      {year}
                    </span>
                  </div>

                  <div className="glass-panel p-4">
                    <label className="block text-sm font-medium text-white mb-2">
                      Location
                    </label>
                    <Input
                      type="text"
                      placeholder="Enter a location..."
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="bg-white bg-opacity-10 text-white placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Time travel experience UI
        <div className="min-h-screen relative">
          {isGeneratingScene && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center text-white space-y-4">
                <Loader2 className="w-12 h-12 animate-spin mx-auto" />
                <p className="text-xl">Generating your time travel destination...</p>
              </div>
            </div>
          )}

          {showPhoneButton && (
            <div className="absolute top-24 right-8">
              <div
                className={cn(
                  "phone flex items-center justify-center",
                  isRinging && "animate-ring"
                )}
                onClick={handlePickupPhone}
              >
                <Phone className="w-8 h-8 text-booth-dark" />
              </div>
            </div>
          )}

          {message && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
              <div className="glass-panel p-4 max-w-md mx-auto">
                <p className="text-white">{message}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimeBooth;
