import React, { useState } from 'react';
import { Phone, Mic, PhoneOff, Rocket } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { useTimeBooth } from '../hooks/useTimeBooth';
import { cn } from '../lib/utils';
import { Loader2 } from 'lucide-react';

const TimeBooth: React.FC = () => {
  const {
    year,
    location,
    isRinging,
    isPickedUp,
    generatedImage,
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

  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = (e.target as HTMLFormElement).elements.namedItem('message') as HTMLInputElement;
    const text = input.value.trim();
    if (text) {
      await speak(text);
      input.value = '';
    }
  };

  const startTimeTravel = async () => {
    try {
      setIsGeneratingScene(true);
      setIsPreparingCall(true);

      console.log('Starting scene generation for:', { year, location });
      
      if (!year || !location) {
        throw new Error('Year and location are required');
      }

      const response = await fetch('/functions/v1/generate-scene', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          year: Number(year),
          location: location.trim(),
        }),
      });

      console.log('Scene generation response status:', response.status);
      
      const responseText = await response.text();
      console.log('Response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response:', responseText);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        console.error('Scene generation error:', data.error);
        throw new Error(`Failed to generate scene: ${data.error}`);
      }

      console.log('Scene generation successful, got image URL:', data.image_url);
      setBackgroundImage(data.image_url);

      const audio = new Audio('/phone-ring.mp3');
      audio.loop = true;
      audio.play();

      setIsGeneratingScene(false);
    } catch (error) {
      console.error('Failed to generate scene:', error);
      setIsGeneratingScene(false);
      setIsPreparingCall(false);
    }
  };

  return (
    <div 
      className={cn(
        "min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-6 flex items-center justify-center transition-all duration-500",
        backgroundImage && "bg-none"
      )}
      style={backgroundImage ? {
        backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
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
                  disabled={isListening || isSpeaking || isConnecting || isGeneratingScene}
                >
                  {persona === 'japanese' ? '🇯🇵 Japanese' : '🗽 New York'}
                </Button>
                {isPickedUp ? (
                  <Button
                    variant="destructive"
                    onClick={hangupPhone}
                    disabled={isConnecting}
                    className="flex items-center gap-2"
                  >
                    <PhoneOff className="w-4 h-4" />
                    Hang Up
                  </Button>
                ) : isPreparingCall ? (
                  <div
                    className={cn(
                      "phone flex items-center justify-center",
                      isRinging && "animate-ring",
                      (isConnecting || isPickedUp) && "opacity-50 cursor-not-allowed",
                      !isRinging && "cursor-pointer"
                    )}
                    onClick={pickupPhone}
                  >
                    <Phone className="w-8 h-8 text-booth-dark" />
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={startTimeTravel}
                    disabled={isGeneratingScene || !location || !year}
                    className={cn(
                      "bg-gold hover:bg-gold/90 text-black",
                      isGeneratingScene && "opacity-50"
                    )}
                  >
                    {isGeneratingScene ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4 mr-2" />
                        Start Time Travel
                      </>
                    )}
                  </Button>
                )}
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
                  disabled={isPickedUp || isGeneratingScene}
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
                  disabled={isPickedUp || isGeneratingScene}
                  className="bg-white bg-opacity-10 text-white placeholder:text-gray-400"
                />
              </div>
            </div>

            {isPickedUp && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-500 mt-6">
                <div className="glass-panel p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-white font-medium">Chat</h3>
                    <Button
                      disabled={isListening || isSpeaking}
                      className={cn(
                        "bg-gold hover:bg-gold/90",
                        (isListening || isSpeaking) && "opacity-50"
                      )}
                    >
                      <Mic className="w-4 h-4 mr-2" />
                      {isListening ? 'Listening...' : 'Speak'}
                    </Button>
                  </div>
                  
                  <form onSubmit={handleSubmitMessage} className="flex gap-2">
                    <Input
                      name="message"
                      placeholder="Type your message..."
                      className="bg-white bg-opacity-10 text-white placeholder:text-gray-400"
                      disabled={isListening || isSpeaking}
                    />
                    <Button 
                      type="submit"
                      disabled={isListening || isSpeaking}
                      className="bg-gold hover:bg-gold/90"
                    >
                      Send
                    </Button>
                  </form>
                </div>

                {message && (
                  <div className="glass-panel p-4">
                    <p className="text-white">{message}</p>
                  </div>
                )}

                {generatedImage && (
                  <div className="glass-panel p-4">
                    <img
                      src={generatedImage}
                      alt="Generated scene"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>
            )}

            {!isPickedUp && !isPreparingCall && (
              <div className="flex-1 flex items-center justify-center mt-6">
                <p className="text-white text-opacity-80 text-center">
                  {isGeneratingScene ? "Generating your scene..." : "Select a year and location to begin"}
                </p>
              </div>
            )}

            {!isPickedUp && isPreparingCall && (
              <div className="flex-1 flex items-center justify-center mt-6">
                <p className="text-white text-opacity-80 text-center animate-pulse">
                  {isRinging ? "Phone is ringing..." : "Pick up the phone to begin"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeBooth;
