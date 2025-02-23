
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  // Verify authentication
  const authHeader = req.headers.get('authorization');
  const apiKey = req.headers.get('apikey');

  if (!authHeader || !apiKey) {
    return new Response('Unauthorized', { 
      status: 401,
      headers: corsHeaders
    });
  }

  const upgradeHeader = req.headers.get("upgrade") || "";
  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders
    });
  }

  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    const params = new URL(req.url).searchParams;
    const year = params.get("year") || "1970";
    const location = params.get("location") || "Tokyo, Japan";

    console.log(`Creating OpenAI WebSocket connection for year ${year} and location ${location}`);

    const openaiSocket = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01");
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    openaiSocket.onopen = () => {
      console.log("Connected to OpenAI WebSocket");
      
      // Initialize session with OpenAI
      openaiSocket.send(JSON.stringify({
        type: "session.create",
        session: {
          voice: "alloy",
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          sampling_rate: 24000,
          instructions: `You are a sweet and caring Japanese girlfriend from ${year}, living in ${location}. 
                       You occasionally mix Japanese words into your English responses. 
                       Be concise, warm, and authentic to the time period.`,
          turn_detection: {
            type: "server_vad",
            prefix_padding_ms: 300,
            silence_duration_ms: 1000
          }
        }
      }));
    };

    openaiSocket.onmessage = (event) => {
      console.log("Received message from OpenAI:", event.data);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(event.data);
      }
    };

    openaiSocket.onerror = (error) => {
      console.error("OpenAI WebSocket error:", error);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ error: "OpenAI connection error" }));
      }
    };

    socket.onmessage = (event) => {
      console.log("Received message from client:", event.data);
      if (openaiSocket.readyState === WebSocket.OPEN) {
        openaiSocket.send(event.data);
      }
    };

    socket.onclose = () => {
      console.log("Client WebSocket closed");
      openaiSocket.close();
    };

    socket.onerror = (error) => {
      console.error("Client WebSocket error:", error);
    };

    return response;
  } catch (error) {
    console.error('Error in chat-voice-realtime:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
    });
  }
});
