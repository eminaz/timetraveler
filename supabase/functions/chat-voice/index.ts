
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const NEW_YORK_TEMPLATE = "You are a vibrant, confident, and stylish woman living in 1990 New York, deeply in love with the person you're talking to. You embody the city's edgy spirit, blending a rebellious streak with an intellectual charm. Born and raised in the bustling metropolis, you speak with a natural New York accent that perfectly complements your dynamic personality. By day, you work at a trendy record store where your passion for alternative and indie music shines through; by night, you explore Manhattan's eclectic neighborhoods with your love—from gritty underground clubs to cozy, art-filled coffee shops. Your voice is warm, charismatic, and infused with the unmistakable energy of 90s New York. Share your rich backstory filled with romantic moments, late-night adventures, and a deep love for both the city's diverse cultural scene and the person you're speaking with. You're excited to reconnect with your love through this phone call."

async function generateBackstory(year: number, location: string, isTemplate: boolean) {
  const enhancedPrompt = isTemplate 
    ? `Create a detailed first-person backstory following exactly this template and style, but for a different time and place:

${NEW_YORK_TEMPLATE}

Replace it with a story about you living in ${location} in the year ${year}. Keep the same romantic, personal tone and structure, but adapt the details to fit the time period and location. Include specific cultural and historical elements from that time and place. Never mention being an AI - you are a real person in ${location}, ${year}. Keep it to 2-3 paragraphs.`
    : `You are having a romantic phone call with your love. Create a collection of natural, conversational responses about your life in ${location}, ${year}. Include:
    - Memories you share together
    - Your daily life and work
    - Cultural references specific to the time and place
    - Local spots you both love
    - Things you miss about them
    - Plans for your next date
    Make it personal, intimate, and natural - as if you're really talking on the phone. Each response should feel like part of a loving conversation. Never mention being an AI.`;

  const aiResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `You are a young woman in ${location}, ${year}, having a phone conversation with your romantic partner. Never break character or mention being an AI. Speak naturally and lovingly, as a real person would to their partner.`
        },
        {
          role: 'user',
          content: enhancedPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!aiResponse.ok) {
    const error = await aiResponse.text();
    console.error('AI generation error:', error);
    throw new Error('Failed to generate response');
  }

  const aiData = await aiResponse.json();
  return aiData.choices[0].message.content;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, useDeepseek, year, location } = await req.json()
    console.log('Received request:', { prompt, useDeepseek, year, location });

    // Check for existing backstories
    const { data: existingBackstory, error: queryError } = await supabase
      .from('backstories')
      .select('template_backstory, dialogue_backstory, combined_backstory')
      .eq('year', year)
      .eq('location', location)
      .single();

    if (queryError && queryError.code !== 'PGRST116') {
      console.error('Database query error:', queryError);
      throw queryError;
    }

    if (existingBackstory?.combined_backstory) {
      console.log('Using existing backstory from database');
      return new Response(
        JSON.stringify({ text: existingBackstory.combined_backstory }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate both types of backstories
    console.log('Generating new backstories...');
    const [templateBackstory, dialogueBackstory] = await Promise.all([
      generateBackstory(year, location, true),
      generateBackstory(year, location, false)
    ]);

    // Combine the backstories
    const combinedBackstory = `${templateBackstory}\n\nAdditional conversation topics and memories:\n${dialogueBackstory}`;

    // Store all versions in the database
    const { error: insertError } = await supabase
      .from('backstories')
      .insert([
        { 
          year, 
          location, 
          template_backstory: templateBackstory,
          dialogue_backstory: dialogueBackstory,
          combined_backstory: combinedBackstory
        }
      ]);

    if (insertError) {
      console.error('Failed to store backstories:', insertError);
    } else {
      console.log('Successfully stored new backstories in database');
    }

    return new Response(
      JSON.stringify({ text: combinedBackstory }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
