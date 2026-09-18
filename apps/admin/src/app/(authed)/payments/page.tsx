import { getSupabaseServer } from '@/lib/supabase-server';

interface BookingPaymentRow {
  id: string;
  booking_number: number;
  customer_name: string;
  actual_price: number | null;
  fixed_price: number | null;
  estimated_price: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
}

export default async function PaymentsPage() {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('bookings')
    .select('id, booking_number, customer_name, actual_price, fixed_price, estimated_price, payment_method, payment_status, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return <p className="text-red-600">{error.message}</p>;
  const rows = (data as BookingPaymentRow[]) ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Betalningar</h1>
      <table className="min-w-full bg-white border rounded-lg overflow-hidden text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-4 py-2">Bokning</th>
            <th className="px-4 py-2">Kund</th>
            <th className="px-4 py-2">Belopp</th>
            <th className="px-4 py-2">Betalsätt</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const amount = p.actual_price ?? p.fixed_price ?? p.estimated_price;
            return (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">#{p.booking_number}</td>
                <td className="px-4 py-2">{p.customer_name}</td>
                <td className="px-4 py-2">{amount != null ? `${amount} kr` : '—'}</td>
                <td className="px-4 py-2">{p.payment_method ?? '—'}</td>
                <td className="px-4 py-2">{p.payment_status ?? '—'}</td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-gray-500">Inga betalningar ännu.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
