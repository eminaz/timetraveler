
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { year, location, customPrompt } = await req.json()

    if (!year || !location) {
      throw new Error('Year and location are required')
    }

    let prompt;
    if (customPrompt) {
      prompt = customPrompt;
    } else {
      // Default prompt for historical or near-future scenes
      prompt = `Create a vibrant, detailed photograph of ${location} in the year ${year}. Show the distinctive architecture, fashion, vehicles, and atmosphere of that specific time period. Make it photorealistic and historically accurate.`;
    }

    const response = await fetch("https://preview.fal.ai/fal-preview/sd-turbo", {
      method: "POST",
      headers: {
        "Authorization": `Key ${Deno.env.get("FAL_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        negative_prompt: "text, watermark, logo, signature, blurry, distorted, low quality, ugly, duplicate, morbid, mutilated, poorly drawn face, deformed, bad anatomy",
        num_inference_steps: 20,
        guidance_scale: 7.5,
      }),
    });

    const data = await response.json();
    return new Response(
      JSON.stringify({ image_url: data.images[0].url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
