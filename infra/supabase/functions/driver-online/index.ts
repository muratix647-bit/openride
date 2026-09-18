// deno-lint-ignore-file no-explicit-any
import { handleCors, error, json } from '../_shared/cors.ts';
import { HttpError, requireCaller } from '../_shared/auth.ts';
interface Body { vehicle_id?: string }
Deno.serve(async (req: Request) => {
  const pre=handleCors(req); if(pre)return pre;
  if(req.method!=='POST')return error('Method not allowed',405);
  try {
    const ctx=await requireCaller(req);
    const body=(await req.json()) as Body;
    const {data:driver,error:dErr}=await ctx.serviceClient.from('drivers')
      .select('id,approved,active,archived_at').eq('auth_user_id',ctx.userId).maybeSingle();
    if(dErr)return error(dErr.message,500,'db_error');
    if(!driver)return error('Föraren är inte kopplad till detta konto',404,'driver_not_linked');
    if(!(driver as any).active || !(driver as any).approved || (driver as any).archived_at)
      return error('Förarkontot är inte godkänt eller aktivt',403,'not_approved');
    const now=new Date().toISOString();
    const {error:uErr}=await ctx.serviceClient.from('drivers').update({
      is_online:true,status:'Tillgänglig',availability_status:'available',updated_at:now
    }).eq('id',(driver as any).id);
    if(uErr)return error(uErr.message,500,'db_error');
    if(body.vehicle_id) await ctx.serviceClient.from('vehicles').update({driver_id:(driver as any).id,updated_at:now}).eq('id',body.vehicle_id).eq('active',true);
    return json({ok:true,driver_id:(driver as any).id});
  } catch(e) {
    if(e instanceof HttpError)return error(e.message,e.status,e.code);
    return error((e as Error).message,500,'unexpected');
  }
});