'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getSupabaseBrowser } from '@/lib/supabase-browser';

export function DriverStatusControl({ driverId, status }: { driverId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(approved: boolean): Promise<void> {
    setBusy(true);
    try {
      const { error } = await getSupabaseBrowser()
        .from('drivers')
        .update({ approved, active: approved, status: approved ? 'Offline' : 'Pausad', is_online: false, updated_at: new Date().toISOString() })
        .eq('id', driverId);
      if (error) throw error;
      router.refresh();
    } catch (e) {
      alert(`Kunde inte uppdatera: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      {status !== 'Godkänd' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setStatus(true)}
          className="bg-green-600 text-white text-sm rounded px-3 py-1.5 disabled:opacity-60"
        >
          Approve
        </button>
      ) : null}
      {status !== 'Pausad' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setStatus(false)}
          className="bg-red-600 text-white text-sm rounded px-3 py-1.5 disabled:opacity-60"
        >
          Suspend
        </button>
      ) : null}
    </div>
  );
}
