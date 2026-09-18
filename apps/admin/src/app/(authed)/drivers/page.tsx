import Link from 'next/link';

import { getSupabaseServer } from '@/lib/supabase-server';

export default async function DriversPage() {
  const supabase = await getSupabaseServer();
  const { data: drivers, error } = await supabase
    .from('drivers')
    .select('id, full_name, phone, status, is_online, active, approved, vehicle_number, registration_number')
    .order('full_name', { ascending: true });

  if (error) return <p className="text-red-600">{error.message}</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Förare</h1>
      <table className="min-w-full bg-white border rounded-lg overflow-hidden">
        <thead className="bg-gray-50 text-sm text-left">
          <tr>
            <th className="px-4 py-2">Namn</th>
            <th className="px-4 py-2">Telefon</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Fordon</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {(drivers ?? []).map((d: Record<string, unknown>) => (
            <tr key={String(d.id)} className="border-t hover:bg-gray-50">
              <td className="px-4 py-2">
                <Link href={`/drivers/${String(d.id)}`} className="text-brand hover:underline">
                  {String(d.full_name ?? '—')}
                </Link>
              </td>
              <td className="px-4 py-2">{String(d.phone ?? '—')}</td>
              <td className="px-4 py-2">{d.is_online ? 'Online' : String(d.status ?? 'Offline')}</td>
              <td className="px-4 py-2">{String(d.registration_number ?? d.vehicle_number ?? '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
