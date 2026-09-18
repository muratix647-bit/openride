// deno-lint-ignore-file no-explicit-any
import { handleCors, error, json } from '../_shared/cors.ts';
import { HttpError, requireCaller } from '../_shared/auth.ts';

interface Body { vehicle_id?: string }

Deno.serve(async (req: Request) => {
  const pre = handleCors(req);
  if (pre) return pre;
  if (req.method !== 'POST') return error('Method not allowed', 405);

  try {
    const ctx = await requireCaller(req, ['driver']);
    const body = (await req.json()) as Body;

    const { data: driver, error: dErr } = await ctx.serviceClient
      .from('drivers')
      .select('id, approved, active, archived_at')
      .eq('auth_user_id', ctx.userId)
      .maybeSingle();

    if (dErr) return error(dErr.message, 500, 'db_error');
    if (!driver) return error('Föraren är inte kopplad till detta konto', 404, 'driver_not_linked');
    if (!driver.active || !driver.approved || driver.archived_at) {
      return error('Förarkontot är inte godkänt eller aktivt', 403, 'not_approved');
    }

    if (body.vehicle_id) {
      const { data: vehicle, error: vehicleErr } = await ctx.serviceClient
        .from('vehicles')
        .select('id, driver_id, active')
        .eq('id', body.vehicle_id)
        .eq('active', true)
        .maybeSingle();

      if (vehicleErr) return error(vehicleErr.message, 500, 'db_error');
      if (!vehicle) return error('Fordonet finns inte eller är inaktivt', 404, 'vehicle_not_available');
      if (vehicle.driver_id && vehicle.driver_id !== driver.id) {
        return error('Fordonet är tilldelat en annan förare', 403, 'vehicle_assigned_to_other_driver');
      }
    }

    const now = new Date().toISOString();
    const { error: uErr } = await ctx.serviceClient
      .from('drivers')
      .update({
        is_online: true,
        status: 'Tillgänglig',
        availability_status: 'available',
        updated_at: now,
      })
      .eq('id', driver.id);

    if (uErr) return error(uErr.message, 500, 'db_error');

    if (body.vehicle_id) {
      const { error: vehicleUpdateErr } = await ctx.serviceClient
        .from('vehicles')
        .update({ driver_id: driver.id, updated_at: now })
        .eq('id', body.vehicle_id)
        .eq('active', true);

      if (vehicleUpdateErr) return error(vehicleUpdateErr.message, 500, 'db_error');
    }

    return json({ ok: true, driver_id: driver.id });
  } catch (e) {
    if (e instanceof HttpError) return error(e.message, e.status, e.code);
    return error((e as Error).message, 500, 'unexpected');
  }
});
