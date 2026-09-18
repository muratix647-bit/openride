// deno-lint-ignore-file no-explicit-any
import { handleCors, error, json } from '../_shared/cors.ts';
import { HttpError, requireCaller } from '../_shared/auth.ts';

interface Body {
  type: 'now' | 'scheduled';
  pickup: { lat: number; lng: number };
  pickup_label: string;
  dropoff: { lat: number; lng: number };
  dropoff_label: string;
  vehicle_type: string;
  passenger_count?: number;
  scheduled_pickup_at?: string;
  notes?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
}

function stockholmParts(date: Date) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}:00` };
}

Deno.serve(async (req: Request) => {
  const pre = handleCors(req);
  if (pre) return pre;
  if (req.method !== 'POST') return error('Method not allowed', 405);

  try {
    const ctx = await requireCaller(req);
    const body = (await req.json()) as Body;
    if (!body?.type || !body?.pickup || !body?.dropoff || !body.pickup_label || !body.dropoff_label) {
      return error('Hämtadress och destination krävs');
    }
    if (body.type === 'scheduled' && !body.scheduled_pickup_at) {
      return error('Datum och tid krävs för förbokning');
    }

    const when = body.type === 'scheduled' ? new Date(body.scheduled_pickup_at!) : new Date();
    if (Number.isNaN(when.getTime())) return error('Ogiltigt datum eller tid');
    const local = stockholmParts(when);

    const { data: authUser } = await ctx.serviceClient.auth.admin.getUserById(ctx.userId);
    const user = authUser?.user;
    const customerName = body.customer_name?.trim() || user?.user_metadata?.full_name || user?.user_metadata?.name || 'Kund';

    const { data: booking, error: bookingErr } = await ctx.serviceClient
      .from('bookings')
      .insert({
        customer_name: customerName,
        customer_phone: body.customer_phone?.trim() || user?.phone || null,
        customer_email: body.customer_email?.trim() || user?.email || null,
        pickup_address: body.pickup_label,
        pickup_lat: body.pickup.lat,
        pickup_lng: body.pickup.lng,
        dropoff_address: body.dropoff_label,
        dropoff_lat: body.dropoff.lat,
        dropoff_lng: body.dropoff.lng,
        booking_date: local.date,
        pickup_time: local.time,
        passengers: body.passenger_count ?? 1,
        car_type: body.vehicle_type || 'Standard',
        status: 'Ny',
        source: 'OpenRide',
        notes: body.notes ?? null,
        booked_by: ctx.userId,
      })
      .select('id, booking_number, tracking_token, status')
      .single();

    if (bookingErr) return error(bookingErr.message, 500, 'db_error');
    return json({ booking_id: booking.id, booking_number: booking.booking_number, tracking_token: booking.tracking_token, status: booking.status });
  } catch (e) {
    if (e instanceof HttpError) return error(e.message, e.status, e.code);
    return error((e as Error).message, 500, 'unexpected');
  }
});
