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


async function sendBookingEmails(booking: any): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.warn('RESEND_API_KEY saknas; bokningen sparades men e-post skickades inte.');
    return;
  }

  const operatorEmail = Deno.env.get('BOOKING_NOTIFICATION_EMAIL') || 'info@avenyntaxi.se';
  const fromEmail = Deno.env.get('BOOKING_FROM_EMAIL') || 'Avenyn Taxi <bokning@avenyntaxi.se>';
  const number = booking.booking_number ?? booking.id;
  const price = booking.actual_price ?? booking.fixed_price ?? booking.estimated_price;
  const details = [
    `Bokningsnummer: ${number}`,
    `Namn: ${booking.customer_name}`,
    `Telefon: ${booking.customer_phone ?? '—'}`,
    `E-post: ${booking.customer_email ?? '—'}`,
    `Hämtas från: ${booking.pickup_address}`,
    `Destination: ${booking.dropoff_address ?? '—'}`,
    `Datum: ${booking.booking_date}`,
    `Tid: ${booking.pickup_time}`,
    `Passagerare: ${booking.passengers}`,
    `Biltyp: ${booking.car_type}`,
    `Pris: ${price != null ? `${price} kr` : '—'}`,
  ].join('\n');

  const messages = [
    ...(booking.customer_email ? [{
      from: fromEmail,
      to: [booking.customer_email],
      subject: `Bokningsbekräftelse #${number} – Avenyn Taxi`,
      text: `Tack för din bokning hos Avenyn Taxi.\n\n${details}\n\nVi ses snart!`,
    }] : []),
    {
      from: fromEmail,
      to: [operatorEmail],
      subject: `Ny bokning #${number} – Avenyn Taxi`,
      text: `En ny bokning har registrerats.\n\n${details}`,
    },
  ];

  for (const message of messages) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (!response.ok) console.error('Kunde inte skicka bokningsmejl:', response.status, await response.text());
  }
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
      .select('id, booking_number, tracking_token, status, customer_name, customer_phone, customer_email, pickup_address, dropoff_address, booking_date, pickup_time, passengers, car_type, estimated_price, fixed_price, actual_price')
      .single();

    if (bookingErr) return error(bookingErr.message, 500, 'db_error');
    await sendBookingEmails(booking);
    return json({ booking_id: booking.id, booking_number: booking.booking_number, tracking_token: booking.tracking_token, status: booking.status });
  } catch (e) {
    if (e instanceof HttpError) return error(e.message, e.status, e.code);
    return error((e as Error).message, 500, 'unexpected');
  }
});
