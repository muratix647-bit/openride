// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

export interface CallerContext {
  client: ReturnType<typeof createClient>;
  serviceClient: ReturnType<typeof createClient>;
  userId: string;
  role: string;
}

export async function requireCaller(req: Request, allowedRoles?: string[]): Promise<CallerContext> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    throw new HttpError(401, 'Missing bearer token');
  }
  const token = authHeader.slice('bearer '.length);

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) throw new HttpError(500, 'Server misconfigured');

  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const serviceClient = createClient(url, service, { auth: { persistSession: false } });

  const { data: userResult, error: userErr } = await client.auth.getUser();
  if (userErr || !userResult.user) throw new HttpError(401, 'Invalid token');

  const userId = userResult.user.id;
  let role = 'rider';

  const [{ data: admin }, { data: driver }] = await Promise.all([
    serviceClient
      .from('dispatch_admins')
      .select('role, active')
      .eq('auth_user_id', userId)
      .maybeSingle(),
    serviceClient
      .from('drivers')
      .select('active, approved, archived_at')
      .eq('auth_user_id', userId)
      .maybeSingle(),
  ]);

  if (admin?.active) role = admin.role === 'dispatcher' ? 'dispatcher' : 'admin';
  else if (driver?.active && driver?.approved && !driver?.archived_at) role = 'driver';

  if (allowedRoles && !allowedRoles.includes(role)) {
    throw new HttpError(403, `Role '${role}' not permitted`);
  }

  return { client, serviceClient, userId, role };
}

export class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: string) {
    super(message);
  }
}

/**
 * OpenRide used operator_id from public.users. Avenyn Taxi has no operator
 * ownership layer, so adapted functions should not depend on this helper.
 */
export async function operatorOf(_serviceClient: any, _userId: string): Promise<null> {
  return null;
}

/**
 * Avenyn Taxi does not currently have OpenRide's audit_logs table.
 * Keep this as a safe no-op until an Avenyn-specific activity log is introduced.
 */
export async function audit(
  _ctx: { serviceClient: any; userId: string; role: string },
  _action: string,
  _targetTable: string,
  _targetId: string,
  _before: unknown,
  _after: unknown,
): Promise<void> {
  return;
}
