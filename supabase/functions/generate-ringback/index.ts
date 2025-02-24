
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { year } = await req.json();

    // Check if we already have a tone for this year range in the database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Round year to nearest 5 to reduce number of unique tones needed
    const baseYear = Math.floor(year / 5) * 5;
    
    const { data: existingTone } = await supabase
      .from('ringback_tones')
      .select('audio_url')
      .eq('year', baseYear)
      .single();

    if (existingTone?.audio_url) {
      return new Response(
        JSON.stringify({ audio_url: existingTone.audio_url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate new ringback tone using fal.ai REST API
    const response = await fetch('https://rest.fal.ai/api/v1/music/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('FAL_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'stable-audio',
        input: {
          prompt: `phone ringback tone from ${year}, old telephone style`,
          duration: 5,
          model_name: 'melody',
          seed: 42
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Fal.ai API error:', errorData);
      throw new Error(`Failed to generate audio: ${errorData}`);
    }

    const audioData = await response.json();
    const audioUrl = audioData.audio_url || audioData.output?.audio_url;

    if (!audioUrl) {
      throw new Error('No audio URL in response');
    }

    // Save the new tone to the database
    await supabase
      .from('ringback_tones')
      .insert([{ 
        year: baseYear,
        audio_url: audioUrl,
      }]);

    return new Response(
      JSON.stringify({ audio_url: audioUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-ringback function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
