import { getSupabaseServer } from '@/lib/supabase-server';

interface PriceZone {
  id: string;
  name: string;
  region: string;
  fixed_price: number;
  active: boolean;
}

export default async function FaresPage() {
  const supabase = await getSupabaseServer();
  const [{ data: settings, error: settingsError }, { data: zones, error: zonesError }] = await Promise.all([
    supabase.from('fare_settings').select('child_seat_surcharge, large_vehicle_surcharge').maybeSingle(),
    supabase.from('price_zones').select('id, name, region, fixed_price, active').order('name'),
  ]);

  const error = settingsError ?? zonesError;
  if (error) return <p className="text-red-600">{error.message}</p>;

  const rows = (zones as PriceZone[]) ?? [];

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold mb-2">Priser</h1>
      <p className="text-sm text-gray-500 mb-6">Avenyn Taxis befintliga prisinställningar och fasta priszoner.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <PriceCard label="Barnstol" value={settings?.child_seat_surcharge} />
        <PriceCard label="Storbil" value={settings?.large_vehicle_surcharge} />
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">Område</th>
              <th className="px-4 py-2">Region</th>
              <th className="px-4 py-2">Fastpris</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((z) => (
              <tr key={z.id} className="border-t">
                <td className="px-4 py-2 font-medium">{z.name}</td>
                <td className="px-4 py-2">{z.region}</td>
                <td className="px-4 py-2">{z.fixed_price} kr</td>
                <td className="px-4 py-2">{z.active ? 'Aktiv' : 'Inaktiv'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PriceCard({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value ?? 0} kr</div>
    </div>
  );
}
