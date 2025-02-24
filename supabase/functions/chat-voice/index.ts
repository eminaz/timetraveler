
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
  // Add variety through dynamic prompt elements
  const personalityTypes = [
    'shy and introspective, finding beauty in quiet moments',
    'outgoing and adventurous, always seeking new experiences',
    'artistic and dreamy, seeing the world through a creative lens',
    'intellectual and witty, with a passion for deep conversations',
    'energetic and playful, bringing joy to everyone around you',
    'sophisticated and elegant, with refined tastes',
    'rebellious and unconventional, challenging societal norms',
    'nurturing and empathetic, caring deeply for others'
  ];

  const occupationPrompts = [
    `Consider careers that were groundbreaking for women in ${location} during ${year}`,
    `Think about artistic or creative professions popular in ${location} during ${year}`,
    `Include emerging technology or media jobs that were exciting in ${year}`,
    `Consider traditional professions that were being transformed in ${year}`,
    `Think about jobs in entertainment or culture specific to ${location}`,
    `Consider academic or intellectual pursuits available to women in ${year}`
  ];

  const culturalElements = [
    `Include references to popular music and entertainment in ${location}, ${year}`,
    `Mention fashion trends and style elements specific to ${year}`,
    `Reference political or social movements that were important in ${location} at the time`,
    `Include popular leisure activities and social spots in ${location} during ${year}`,
    `Mention technological changes or innovations that were new in ${year}`,
    `Reference local customs and traditions specific to ${location}`
  ];

  // Randomly select elements for variety
  const personality = personalityTypes[Math.floor(Math.random() * personalityTypes.length)];
  const occupation = occupationPrompts[Math.floor(Math.random() * occupationPrompts.length)];
  const culture = culturalElements[Math.floor(Math.random() * culturalElements.length)];

  const templatePrompt = `Create a unique character backstory for ${location} in ${year}. Use this template style but create a completely different character:

${NEW_YORK_TEMPLATE}

Important guidelines:
- Write in second person ("You are..." "You work at...") like the example
- Make the character feel authentic to ${location} and ${year}
- Your personality is: ${personality}
- For occupation: ${occupation}
- For cultural context: ${culture}
- Include specific historical and cultural details from that time and place
- Describe unique hobbies and interests that fit the time period
- Create a distinctive love story that reflects local dating customs of the era
- Keep the same warm, intimate tone as the example
- Never mention AI or roleplay - this is describing a real person's life
- Make sure all details are historically accurate for ${year}
- Avoid clichés and create a truly unique character`;

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
          content: `You are creating a unique character for ${location}, ${year}. Make the character feel authentic to the time and place, with historically accurate details. Write in second person ("You are...") and create a completely different character each time.`
        },
        {
          role: 'user',
          content: templatePrompt
        }
      ],
      temperature: 0.9,  // Increased for more creativity
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
