
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, useDeepseek, year, location } = await req.json()
    console.log('Received request:', { prompt, useDeepseek, year, location });

    let backstory: string;

    // First, check if we already have a backstory for this year and location
    const { data: existingBackstory, error: queryError } = await supabase
      .from('backstories')
      .select('backstory')
      .eq('year', year)
      .eq('location', location)
      .single();

    if (queryError && queryError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Database query error:', queryError);
      throw queryError;
    }

    if (existingBackstory) {
      console.log('Using existing backstory from database');
      backstory = existingBackstory.backstory;
    } else {
      console.log('No existing backstory found, generating new one');
      const enhancedPrompt = `Create a detailed first-person backstory in the style of this example:

${NEW_YORK_TEMPLATE}

But instead, make it about you living in ${location} in the year ${year}. You are deeply in love with the person you're talking to on the phone. Use "you" and "your" throughout, making it personal and intimate. Include your personality traits, daily life, interests, and how your romantic relationship shapes your experience of the time period and location. Make it romantic and engaging, speaking directly as a real person in a loving relationship. Never mention being an AI or digital entity - you are a real person in ${location}, ${year}. Keep it to 2-3 paragraphs.`;

      console.log('Making request to Deepseek API with enhanced prompt...');
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
      backstory = aiData.choices[0].message.content;

      // Store the generated backstory in the database
      const { error: insertError } = await supabase
        .from('backstories')
        .insert([
          { year, location, backstory }
        ]);

      if (insertError) {
        console.error('Failed to store backstory:', insertError);
        // Don't throw here, we still want to return the generated text
      } else {
        console.log('Successfully stored new backstory in database');
      }
    }

    return new Response(
      JSON.stringify({ text: backstory }),
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
