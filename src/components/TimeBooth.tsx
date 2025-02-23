import React from 'react';
import { Phone, Mic } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { useTimeBooth } from '../hooks/useTimeBooth';
import { cn } from '../lib/utils';

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
    setYear,
    setLocation,
    pickupPhone,
    hangupPhone,
    speak,
    setPersona,
  } = useTimeBooth();

  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = (e.target as HTMLFormElement).elements.namedItem('message') as HTMLInputElement;
    const text = input.value.trim();
    if (text) {
      await speak(text);
      input.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-6 flex items-center justify-center">
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
                  disabled={isListening || isSpeaking}
                >
                  {persona === 'japanese' ? '🇯🇵 Japanese' : '🗽 New York'}
                </Button>
                <div
                  className={cn(
                    "phone flex items-center justify-center",
                    isRinging && "animate-ring",
                    isPickedUp && "scale-90"
                  )}
                  onClick={isPickedUp ? hangupPhone : pickupPhone}
                >
                  <Phone className="w-8 h-8 text-booth-dark" />
                </div>
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
                  disabled={isPickedUp}
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
                  disabled={isPickedUp}
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

            {!isPickedUp && (
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
