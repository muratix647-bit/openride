import { channels } from '@openride/realtime';
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

import { api } from './api';
import { startLocationStreaming, stopLocationStreaming } from './location';
import { supabase } from './supabase';

export interface Vehicle {
  id: string;
  rego: string;
  make: string;
  model: string;
  vehicle_type: string;
}

export interface ActiveTrip {
  id: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  customer_phone: string | null;
  estimated_fare_cents: number | null;
  final_fare_cents: number | null;
}

export interface PendingOffer {
  id: string;
  trip_id: string;
  responds_by: string;
  pickup_eta_s: number | null;
  distance_to_pickup_m: number | null;
  trips: { pickup_address: string; dropoff_address: string; estimated_fare_cents: number | null } | null;
}

export interface DriverState {
  loading: boolean;
  online: boolean;
  vehicleId: string | null;
  driverId: string | null;
  activeTrip: ActiveTrip | null;
  refresh: () => Promise<void>;
  goOnline: (vehicleId: string) => Promise<void>;
  goOffline: () => Promise<void>;
  tripEvent: (event: 'en-route' | 'arrived' | 'start' | 'complete' | 'cancel') => Promise<void>;
}

export function useDriverState(session: Session | null): DriverState {
  const authUserId = session?.user.id ?? null;
  const [driverId, setDriverId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);

  const refresh = useCallback(async () => {
    if (!authUserId) return;
    const { data: linkedDriver } = await supabase.from('drivers').select('id').eq('auth_user_id', authUserId).maybeSingle();
    const resolvedDriverId = (linkedDriver as { id?: string } | null)?.id ?? null;
    setDriverId(resolvedDriverId);
    if (!resolvedDriverId) { setOnline(false); setActiveTrip(null); setLoading(false); return; }
    const [statusRes, tripRes] = await Promise.all([
      supabase
        .from('drivers')
        .select('id, is_online, status')
        .eq('id', resolvedDriverId)
        .maybeSingle(),
      supabase
        .from('bookings')
        .select('id, status, pickup_address, dropoff_address, customer_phone, estimated_price, fixed_price, actual_price')
        .eq('driver_id', resolvedDriverId)
        .in('status', ['Tilldelad', 'På väg', 'arrived', 'Hämtad'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    const status = statusRes.data as { id?: string; is_online?: boolean; status?: string } | null;
    setOnline(Boolean(status?.is_online));
    setVehicleId(null);
    const b = tripRes.data as any;
    setActiveTrip(b ? {
      id: b.id,
      status: b.status === 'Tilldelad' ? 'assigned' : b.status === 'På väg' ? 'driver_en_route' : b.status === 'arrived' ? 'arrived_at_pickup' : 'in_progress',
      pickup_address: b.pickup_address,
      dropoff_address: b.dropoff_address,
      customer_phone: b.customer_phone ?? null,
      estimated_fare_cents: b.fixed_price != null ? Math.round(Number(b.fixed_price) * 100) : b.estimated_price != null ? Math.round(Number(b.estimated_price) * 100) : null,
      final_fare_cents: b.actual_price != null ? Math.round(Number(b.actual_price) * 100) : null,
    } : null);
    setLoading(false);
  }, [authUserId]);

  // Initial load + realtime subscription on the driver's own rows.
  useEffect(() => {
    if (!authUserId) return;
    void refresh();
    const channel = supabase.channel(channels.driver(authUserId));
    for (const table of ['drivers', 'bookings']) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => void refresh(),
      );
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authUserId, refresh]);

  // Stream location while online; stop when offline or signed out.
  useEffect(() => {
    if (online && driverId) {
      void startLocationStreaming(driverId).catch(() => {});
      return () => stopLocationStreaming();
    }
    stopLocationStreaming();
    return undefined;
  }, [online, driverId]);

  const goOnline = useCallback(
    async (vId: string) => {
      await api.driverGoOnline(vId);
      await refresh();
    },
    [refresh],
  );

  const goOffline = useCallback(async () => {
    await api.driverGoOffline();
    stopLocationStreaming();
    await refresh();
  }, [refresh]);

  const tripEvent = useCallback(async (event: 'en-route' | 'arrived' | 'start' | 'complete' | 'cancel') => {
    if (!activeTrip) return;
    const next = event === 'en-route' ? 'På väg' : event === 'arrived' ? 'arrived' : event === 'start' ? 'Hämtad' : event === 'complete' ? 'Slutförd' : 'Avbokad';
    const patch: Record<string, unknown> = { status: next, updated_at: new Date().toISOString() };
    if (event === 'start') patch.picked_up_at = new Date().toISOString();
    if (event === 'complete') patch.completed_at = new Date().toISOString();
    if (event === 'cancel') patch.cancelled_at = new Date().toISOString();
    if (!driverId) throw new Error('Förarkontot är inte kopplat.');
    const { error } = await supabase.from('bookings').update(patch).eq('id', activeTrip.id).eq('driver_id', driverId);
    if (error) throw error;
    await refresh();
  }, [activeTrip, driverId, refresh]);

  return { loading, online, vehicleId, driverId, activeTrip, refresh, goOnline, goOffline, tripEvent };
}

/** Vehicles this driver can operate (their default vehicle(s)). */
export async function fetchMyVehicles(driverId: string): Promise<Vehicle[]> {
  const { data } = await supabase
    .from('vehicles')
    .select('id, registration_number, reg, make, model, vehicle_class')
    .eq('driver_id', driverId)
    .eq('active', true);
  return ((data as any[]) ?? []).map((v) => ({ id: v.id, rego: v.registration_number ?? v.reg ?? '', make: v.make ?? '', model: v.model ?? '', vehicle_type: v.vehicle_class ?? 'Standard' }));
}
