// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://bxtwhvvgykntbmpwtitx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4dHdodnZneWtudGJtcHd0aXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyOTE0NzEsImV4cCI6MjA1NTg2NzQ3MX0.WsGGph--HPaV9-0rxsQRsaAjs3RMoE19Qhb2b5jn6fY";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);