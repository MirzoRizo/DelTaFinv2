// supabase/functions/powersync-auth/index.ts
// Supabase Edge Function — выдаёт JWT токен для PowerSync
// Деплоится командой: supabase functions deploy powersync-auth

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { create } from "https://deno.land/x/djwt@v2.8/mod.ts";

const POWERSYNC_PRIVATE_KEY = Deno.env.get("POWERSYNC_PRIVATE_KEY")!;
const POWERSYNC_KEY_ID      = Deno.env.get("POWERSYNC_KEY_ID")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    // Можно добавить проверку пользователя из Supabase auth
    // const { data: { user } } = await supabaseClient.auth.getUser(token)

    const key = await crypto.subtle.importKey(
      "pkcs8",
      base64ToArrayBuffer(POWERSYNC_PRIVATE_KEY),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 час

    const token = await create(
      { alg: "RS256", kid: POWERSYNC_KEY_ID },
      { sub: "warehouse-app", exp: expiresAt, iat: Math.floor(Date.now() / 1000) },
      key
    );

    return Response.json(
      { token, expiresAt: expiresAt * 1000 },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const bin = atob(base64.replace(/-----[^-]+-----/g, "").replace(/\s/g, ""));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
