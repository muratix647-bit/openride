import Link from 'next/link';

import { DriverStatusControl } from '@/components/DriverStatusControl';
import { getSupabaseServer } from '@/lib/supabase-server';

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const [{ data: driver }, { data: vehicles }] = await Promise.all([
    supabase
      .from('drivers')
      .select('id, full_name, phone, email, status, is_online, active, approved, vehicle_number, registration_number, vehicle_model')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('vehicles')
      .select('id, registration_number, reg, make, model, status, active')
      .eq('driver_id', id),
  ]);

  if (!driver) {
    return (
      <div>
        <BackLink />
        <p className="text-red-600">Föraren hittades inte.</p>
      </div>
    );
  }

  const d = driver as Record<string, unknown>;

  return (
    <div className="max-w-3xl">
      <BackLink />
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{String(d.full_name ?? id.slice(0, 8))}</h1>
          <p className="text-gray-500 text-sm">
            {String(d.phone ?? '—')} · {d.is_online ? 'Online' : String(d.status ?? 'Offline')}
          </p>
          {d.email ? <p className="text-gray-500 text-sm">{String(d.email)}</p> : null}
        </div>
        <DriverStatusControl driverId={id} status={String(d.status ?? 'Offline')} />
      </div>

      <Section title="Förarkonto">
        <Field label="Aktiv" value={d.active ? 'Ja' : 'Nej'} />
        <Field label="Godkänd" value={d.approved ? 'Ja' : 'Nej'} />
        <Field label="Bilnummer" value={String(d.vehicle_number ?? '—')} />
        <Field label="Registrering" value={String(d.registration_number ?? '—')} />
        <Field label="Bilmodell" value={String(d.vehicle_model ?? '—')} />
      </Section>

      <Section title="Fordon">
        {(vehicles ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">Inget fordon är tilldelat.</p>
        ) : (
          (vehicles as Record<string, unknown>[]).map((v) => (
            <div key={String(v.id)} className="text-sm">
              {String(v.registration_number ?? v.reg ?? '—')} — {String(v.make ?? '')} {String(v.model ?? '')} ({String(v.status ?? (v.active ? 'Aktiv' : 'Inaktiv'))})
            </div>
          ))
        )}
      </Section>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/drivers" className="text-sm text-brand hover:underline">
      ← Förare
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg p-4 mb-4">
      <h2 className="font-semibold mb-2">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex text-sm py-0.5">
      <span className="w-40 text-gray-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}
