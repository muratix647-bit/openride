// deno-lint-ignore-file no-explicit-any
import { handleCors, error, json } from '../_shared/cors.ts';
import { HttpError, requireCaller } from '../_shared/auth.ts';
Deno.serve(async (req: Request) => {
  const pre=handleCors(req); if(pre)return pre;
  if(req.method!=='POST')return error('Method not allowed',405);
  try {
    const ctx=await requireCaller(req);
    const {data:driver,error:dErr}=await ctx.serviceClient.from('drivers').select('id').eq('auth_user_id',ctx.userId).maybeSingle();
    if(dErr)return error(dErr.message,500,'db_error');
    if(!driver)return error('Föraren är inte kopplad till detta konto',404,'driver_not_linked');
    const {error:uErr}=await ctx.serviceClient.from('drivers').update({
      is_online:false,status:'Offline',availability_status:'offline',updated_at:new Date().toISOString()
    }).eq('id',(driver as any).id);
    if(uErr)return error(uErr.message,500,'db_error');
    return json({ok:true});
  } catch(e) {
    if(e instanceof HttpError)return error(e.message,e.status,e.code);
    return error((e as Error).message,500,'unexpected');
  }
});