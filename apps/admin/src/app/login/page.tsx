'use client';

import { useState } from 'react';

import { getSupabaseBrowser } from '@/lib/supabase-browser';

export default function LoginPage() {
  const [email, setE-post] = useState('');
  const [password, setLösenord] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithLösenord({ email, password });
      if (error) throw error;
      window.location.href = '/dashboard';
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white border rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-brand mb-4">Avenyn Taxi Dispatch</h1>
        <label className="block mb-3">
          <span className="block text-sm text-gray-600 mb-1">E-post</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setE-post(e.target.value)}
            className="w-full border rounded px-3 py-2"
            autoComplete="username"
            required
          />
        </label>
        <label className="block mb-4">
          <span className="block text-sm text-gray-600 mb-1">Lösenord</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setLösenord(e.target.value)}
            className="w-full border rounded px-3 py-2"
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-brand text-white rounded py-2 font-medium disabled:opacity-60"
        >
          {busy ? 'Loggar in…' : 'Logga in'}
        </button>
        <p className="text-xs text-gray-500 mt-3">
          Privat administrationssida för Avenyn Taxi.
        </p>
      </form>
    </main>
  );
}
