
import { useState } from 'react';
import { toast } from 'sonner';

interface TimeBoothState {
  year: number;
  location: string;
  isRinging: boolean;
  isPickedUp: boolean;
  generatedImage: string | null;
}

export const useTimeBooth = () => {
  const [state, setState] = useState<TimeBoothState>({
    year: 1950,
    location: '',
    isRinging: true,
    isPickedUp: false,
    generatedImage: null,
  });

  const setYear = (year: number) => {
    setState(prev => ({ ...prev, year }));
  };

  const setLocation = (location: string) => {
    setState(prev => ({ ...prev, location }));
  };

  const pickupPhone = () => {
    setState(prev => ({
      ...prev,
      isRinging: false,
      isPickedUp: true,
    }));
    toast.success("Connected to the time stream...");
  };

  const hangupPhone = () => {
    setState(prev => ({
      ...prev,
      isRinging: true,
      isPickedUp: false,
      generatedImage: null,
    }));
  };

  const setGeneratedImage = (image: string) => {
    setState(prev => ({ ...prev, generatedImage: image }));
  };

  return {
    ...state,
    setYear,
    setLocation,
    pickupPhone,
    hangupPhone,
    setGeneratedImage,
  };
};
