import React, { useState, useRef } from 'react';
import { Phone, Rocket, ArrowLeft, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useTimeBooth } from '../hooks/useTimeBooth';
import { cn } from '../lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Scene = {
  id: string;
  year: number;
  location: string;
  image_url: string;
  created_at: string;
};

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
    hasBackstory,
    setYear,
    setLocation,
    callGirlfriend,
    hangupPhone,
    speak,
    setPersona,
    generateBackstory,
    generateRingbackTone,
  } = useTimeBooth();

  const [isGeneratingScene, setIsGeneratingScene] = useState(false);
  const [isPreparingCall, setIsPreparingCall] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [hasStartedTimeTravel, setHasStartedTimeTravel] = useState(false);
  const [showPhoneButton, setShowPhoneButton] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const checkExistingScene = async () => {
    try {
      const { data, error } = await supabase
        .from('scenes')
        .select('image_url')
        .eq('year', year)
        .eq('location', location.trim())
        .maybeSingle();

      if (error) throw error;
      return data?.image_url as string | null;
    } catch (error) {
      console.error('Error checking existing scene:', error);
      return null;
    }
  };

  const saveScene = async (imageUrl: string) => {
    try {
      const sceneData = {
        year: year,
        location: location.trim(),
        image_url: imageUrl
      };

      const { error } = await supabase
        .from('scenes')
        .insert([sceneData])
        .maybeSingle();

      if (error) throw error;
    } catch (error) {
      console.error('Error saving scene:', error);
      // Don't show error to user as this is not critical
    }
  };

  const startTimeTravel = async () => {
    try {
      setIsGeneratingScene(true);
      setHasStartedTimeTravel(true);
      
      if (!year || !location) {
        throw new Error('Year and location are required');
      }

      const [existingImageUrl, backstoryPromise] = await Promise.all([
        checkExistingScene(),
        generateBackstory(),
      ]);

      generateRingbackTone().catch(error => {
        console.error('Failed to generate ringback tone:', error);
      });
      
      let imageUrl;
      if (existingImageUrl) {
        console.log('Using existing scene from database');
        imageUrl = existingImageUrl;
      } else {
        console.log('Generating new scene');
        const { data, error } = await supabase.functions.invoke('generate-scene', {
          body: { 
            year: Number(year),
            location: location.trim(),
          }
        });

        if (error) throw error;

        imageUrl = data.image_url;
        await saveScene(imageUrl);
      }

      setBackgroundImage(imageUrl);
      setIsGeneratingScene(false);
      setIsPreparingCall(true);
    } catch (error) {
      console.error('Failed to generate scene:', error);
      toast.error('Failed to generate scene');
      setIsGeneratingScene(false);
      setHasStartedTimeTravel(false);
    }
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

  React.useEffect(() => {
    if (isPreparingCall && !isConnecting && !isPickedUp && hasBackstory) {
      setShowPhoneButton(true);
    } else {
      setShowPhoneButton(false);
    }
  }, [isPreparingCall, isConnecting, isPickedUp, hasBackstory]);

  return (
    <div 
      className={cn(
        "min-h-screen bg-cover bg-center transition-all duration-1000",
        hasStartedTimeTravel ? "" : "bg-[url('https://v3.fal.media/files/monkey/20k3w3XhPbUn0tk0NxFaB.png')]"
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
          className="fixed top-4 right-4 bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm z-50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Exit Time Travel
        </Button>
      )}

      {!hasStartedTimeTravel && (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-md glass-panel p-8">
            <div className="flex flex-col space-y-6">
              <h1 className="text-3xl font-bold text-white text-center mb-6">Time Travel Portal</h1>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Year
                  </label>
                  <input
                    type="range"
                    min="1990"
                    max="3000"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="timeline-slider"
                  />
                  <span className="block text-center text-gold text-xl mt-2">
                    {year}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Location
                  </label>
                  <Input
                    type="text"
                    placeholder="Enter a location..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="bg-white/10 text-white placeholder:text-gray-400"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={startTimeTravel}
                    disabled={isGeneratingScene || !location || !year}
                    className="bg-[#9b87f5] hover:bg-[#7E69AB] text-white w-full"
                  >
                    <Rocket className="w-4 h-4 mr-2" />
                    Start Time Travel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {(showPhoneButton || isPickedUp) && (
        <div className="fixed top-24 right-8 z-40">
          <div
            className={cn(
              "phone flex items-center justify-center cursor-pointer",
              isRinging && "animate-ring"
            )}
            onClick={isPickedUp ? hangupPhone : callGirlfriend}
          >
            <Phone className="w-8 h-8 text-booth-dark" />
          </div>
        </div>
      )}

      {message && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-md">
          <div className="glass-panel p-4 mx-4">
            <p className="text-white">{message}</p>
          </div>
        </div>
      )}

      {isGeneratingScene && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="text-center text-white space-y-4">
            <Loader2 className="w-12 h-12 animate-spin mx-auto" />
            <p className="text-xl">Generating your time travel destination...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeBooth;
