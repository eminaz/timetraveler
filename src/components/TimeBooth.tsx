
import React from 'react';
import { Phone } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useTimeBooth } from '../hooks/useTimeBooth';
import { cn } from '../lib/utils';

const TimeBooth: React.FC = () => {
  const {
    year,
    location,
    isRinging,
    isPickedUp,
    generatedImage,
    setYear,
    setLocation,
    pickupPhone,
    hangupPhone,
  } = useTimeBooth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-6 flex items-center justify-center">
      <div className="phone-booth">
        <div className="phone-booth-window">
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-white">Time Booth</h1>
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

            {isPickedUp && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-500">
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

                {generatedImage && (
                  <div className="glass-panel p-4">
                    <img
                      src={generatedImage}
                      alt="Generated scene"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}

                <Button
                  className="w-full bg-gold hover:bg-gold/90 text-booth-dark font-medium"
                  onClick={() => {/* Will implement time travel logic */}}
                >
                  Begin Time Travel
                </Button>
              </div>
            )}

            {!isPickedUp && (
              <div className="flex-1 flex items-center justify-center">
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
