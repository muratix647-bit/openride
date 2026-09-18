import { createBrowserClient } from '@openride/db';
import type { SupabaseClient } from '@supabase/supabase-js';

import { secureStorage } from './secure-storage';

// Expo inlines EXPO_PUBLIC_* env vars into the bundle at build time.
// Set them in apps/driver/.env.local (see .env.example), then restart
// the bundler with `expo start --clear` so the new values are picked up.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy apps/driver/.env.example to .env.local and restart with `expo start --clear`.',
  );
}

// SecureStore-backed session storage so the driver stays signed in across
// launches. Passed at construction — GoTrue reads it when the client is built.
// Avenyn Taxi uses the existing production schema, which intentionally differs
// from OpenRide's generated database types while the adaptation is in progress.
// Runtime access remains protected by Supabase Auth + RLS.
type AvenynSchema = Record<string, unknown>;

export const supabase = createBrowserClient({
  url,
  anonKey,
  storage: secureStorage,
}) as unknown as SupabaseClient<AvenynSchema>;
