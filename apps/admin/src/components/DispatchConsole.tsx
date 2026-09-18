'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

interface BookingRow {
  id: string; booking_number: number | null; status: string; customer_name: string;
  customer_phone: string | null; pickup_address: string; dropoff_address: string | null;
  driver_id: string | null; fixed_price: number | null; estimated_price: number | null; created_at: string;
}
interface DriverRow {
  id: string; full_name: string; phone: string | null; registration_number: string | null;
  is_online: boolean; status: string | null;
}
const ACTIVE = ['Ny','Bekräftad','Tilldelad','På väg','arrived','Hämtad'];

export function DispatchConsole() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [bookings,setBookings]=useState<BookingRow[]>([]);
  const [drivers,setDrivers]=useState<DriverRow[]>([]);
  const [busy,setBusy]=useState<string|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);

  const load=useCallback(async()=>{
    const [b,d]=await Promise.all([
      supabase.from('bookings').select('id,booking_number,status,customer_name,customer_phone,pickup_address,dropoff_address,driver_id,fixed_price,estimated_price,created_at').in('status',ACTIVE).order('created_at',{ascending:true}),
      supabase.from('drivers').select('id,full_name,phone,registration_number,is_online,status').eq('active',true).is('archived_at',null).order('full_name')
    ]);
    setBookings((b.data as BookingRow[])??[]);
    setDrivers((d.data as DriverRow[])??[]);
  },[supabase]);

  useEffect(()=>{
    const initialLoad=setTimeout(()=>void load(),0);
    const reload=()=>{if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void load(),300)};
    const ch=supabase.channel('avenyn:dispatch');
    for(const table of ['bookings','drivers','driver_locations']) ch.on('postgres_changes',{event:'*',schema:'public',table},reload);
    ch.subscribe();
    return()=>{clearTimeout(initialLoad);if(timer.current)clearTimeout(timer.current);void supabase.removeChannel(ch)};
  },[supabase,load]);

  const assign=useCallback(async(bookingId:string,driverId:string)=>{
    setBusy(bookingId);
    const {error}=await supabase.from('bookings').update({driver_id:driverId,status:'Tilldelad',dispatched_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',bookingId).in('status',['Ny','Bekräftad']);
    if(error) alert(`Kunde inte tilldela: ${error.message}`);
    await load(); setBusy(null);
  },[supabase,load]);

  const online=drivers.filter(d=>d.is_online);
  return <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div className="lg:col-span-2">
      <h2 className="font-semibold mb-3">Aktiva bokningar ({bookings.length})</h2>
      {bookings.length===0?<p className="text-sm text-gray-500">Inga aktiva bokningar.</p>:
      <div className="space-y-2">{bookings.map(b=><div key={b.id} className="bg-white border rounded-lg p-3 text-sm">
        <div className="flex justify-between gap-3">
          <div><div className="font-semibold">#{b.booking_number??'—'} · {b.status}</div>
          <div className="mt-1">{b.pickup_address} → {b.dropoff_address}</div>
          <div className="text-gray-500">{b.customer_name}{b.customer_phone?` · ${b.customer_phone}`:''}{(b.fixed_price??b.estimated_price)!=null?` · ${b.fixed_price??b.estimated_price} kr`:''}</div></div>
          {['Ny','Bekräftad'].includes(b.status)?<select className="border rounded px-2 py-1 h-9" disabled={busy===b.id} defaultValue="" onChange={e=>{const id=e.target.value;e.currentTarget.value='';if(id)void assign(b.id,id)}}>
            <option value="">{busy===b.id?'Tilldelar…':'Tilldela förare…'}</option>
            {online.map(d=><option key={d.id} value={d.id}>{d.full_name}{d.registration_number?` (${d.registration_number})`:''}</option>)}
          </select>:null}
        </div></div>)}</div>}
    </div>
    <div><h2 className="font-semibold mb-3">Onlineförare ({online.length})</h2>
      {online.length===0?<p className="text-sm text-gray-500">Inga förare online.</p>:<div className="space-y-2">{online.map(d=><div key={d.id} className="bg-white border rounded-lg p-3 text-sm"><div className="font-medium">{d.full_name}</div><div className="text-gray-500">{d.registration_number??'Ingen registrering'} · {d.status??'Tillgänglig'}</div></div>)}</div>}
    </div>
  </div>;
}
