import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization') ?? '' },
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Для нашего случая (без пользователей) просто возвращаем токен
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';

  return Response.json(
    { token, powersync_url: Deno.env.get('POWERSYNC_URL') },
    { headers: CORS },
  );
});
