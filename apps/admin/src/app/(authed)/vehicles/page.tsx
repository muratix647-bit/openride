import { getSupabaseServer } from '@/lib/supabase-server';

export default async function VehiclesPage() {
  const supabase = await getSupabaseServer();
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, registration_number, reg, make, model, vehicle_class, status, active')
    .order('status', { ascending: true });

  if (error) return <p className="text-red-600">{error.message}</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Vehicles</h1>
      <table className="min-w-full bg-white border rounded-lg overflow-hidden">
        <thead className="bg-gray-50 text-sm text-left">
          <tr>
            <th className="px-4 py-2">Registrering</th>
            <th className="px-4 py-2">Märke / modell</th>
            <th className="px-4 py-2">Typ</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {(vehicles ?? []).map((v: Record<string, unknown>) => (
            <tr key={String(v.id)} className="border-t">
              <td className="px-4 py-2">{String(v.registration_number ?? v.reg ?? '—')}</td>
              <td className="px-4 py-2">{String(v.make)} {String(v.model)}</td>
              <td className="px-4 py-2">{String(v.vehicle_class ?? 'Standard')}</td>
              <td className="px-4 py-2">{String(v.status ?? (v.active ? 'Aktiv' : 'Inaktiv'))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
