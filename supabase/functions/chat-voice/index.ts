
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

async function generateTemplateBackstory(year: number, location: string) {
  const templatePrompt = `Create a character backstory in exactly this style, but for ${location} in ${year}:

${NEW_YORK_TEMPLATE}

Important guidelines:
- Write in second person ("You are..." "You work at..." exactly like the example)
- Keep the same warm, personal tone as the example
- Include specific cultural and historical details from ${location} in ${year}
- Describe the character's personality, job, daily life, and interests
- Mention their love story and shared experiences with their partner
- Keep the same length and structure as the example
- Never mention AI or roleplay - this is describing a real person's life`;

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
          content: `You are writing a character description for ${location}, ${year}. Write in second person ("You are...") exactly like the example template.`
        },
        {
          role: 'user',
          content: templatePrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!aiResponse.ok) {
    const error = await aiResponse.text();
    console.error('AI generation error:', error);
    throw new Error('Failed to generate template backstory');
  }

  const aiData = await aiResponse.json();
  return aiData.choices[0].message.content;
}

async function generateDialogueBackstory(year: number, location: string) {
  const dialoguePrompt = `Create intimate, personal phone conversation responses for a woman in ${location}, ${year}, talking to her love. Include:

1. Sweet greetings and expressions of missing them
2. Stories about her day at work
3. Memories of special moments they've shared together
4. References to local places they both love
5. Cultural references specific to ${location} in ${year}
6. Future plans and date ideas
7. Intimate thoughts and feelings about their relationship

Guidelines:
- Write in first person ("I miss you..." "Remember when we...")
- Make responses feel natural and conversational
- Include specific details about locations and cultural elements from the time period
- Each response should feel warm and loving
- Never mention AI or roleplay`;

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
          content: `You are a young woman in ${location}, ${year}, having an intimate phone conversation with your love. Speak naturally and lovingly.`
        },
        {
          role: 'user',
          content: dialoguePrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!aiResponse.ok) {
    const error = await aiResponse.text();
    console.error('AI generation error:', error);
    throw new Error('Failed to generate dialogue responses');
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
      generateTemplateBackstory(year, location),
      generateDialogueBackstory(year, location)
    ]);

    // Combine the backstories
    const combinedBackstory = `${templateBackstory}\n\nPossible conversation responses and memories:\n${dialogueBackstory}`;

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
