import { channels } from '@openride/realtime';
import { colors, spacing, typography } from '@openride/ui';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import type { RootStackParamList } from '../../App';
import { supabase } from '../lib/supabase';

type Props = { route: RouteProp<RootStackParamList, 'Trip'> };

interface DriverLocation {
  driver_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  updated_at: string;
}

interface AssignedDriver {
  full_name: string;
  phone: string | null;
  vehicle: { registration_number: string | null; make: string | null; model: string | null } | null;
}

interface TripRow {
  id: string;
  booking_number: number | null;
  status: string;
  pickup_address: string;
  dropoff_address: string | null;
  estimated_price: number | null;
  fixed_price: number | null;
  actual_price: number | null;
  driver_id: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  'Ny': 'Söker efter en förare…',
  'Bekräftad': 'Bokningen är bekräftad',
  'Tilldelad': 'Förare tilldelad',
  'På väg': 'Föraren är på väg',
  'Framme': 'Din förare är framme',
  'Kund i bilen': 'Resan pågår',
  'Slutförd': 'Resan är avslutad',
  'Hämtad': 'Resan pågår',
  'Avbokad': 'Resan är avbokad',
};

const ACTIVE = new Set(['Ny', 'Bekräftad', 'Tilldelad', 'På väg', 'Framme', 'Kund i bilen']);

export function TripScreen({ route }: Props) {
  const { tripId } = route.params;
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [assignedDriver, setAssignedDriver] = useState<AssignedDriver | null>(null);

  useEffect(() => {
    let active = true;

    void supabase
      .from('bookings')
      .select('id, booking_number, status, pickup_address, dropoff_address, estimated_price, fixed_price, actual_price, driver_id')
      .eq('id', tripId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setTrip(data as TripRow | null);
          setLoading(false);
        }
      });

    const channel = supabase
      .channel(channels.trip(tripId))
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${tripId}` },
        (payload) => setTrip((prev) => ({ ...(prev ?? {}), ...(payload.new as TripRow) })),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [tripId]);

  useEffect(() => {
    if (!trip?.driver_id || !ACTIVE.has(trip.status)) {
      setAssignedDriver(null);
      return;
    }
    const driverId = trip.driver_id;
    void Promise.all([
      supabase.from('drivers').select('full_name, phone').eq('id', driverId).maybeSingle(),
      supabase.from('vehicles').select('registration_number, make, model').eq('driver_id', driverId).eq('active', true).limit(1).maybeSingle(),
    ]).then(([driverRes, vehicleRes]) => {
      const driver = driverRes.data as { full_name: string; phone: string | null } | null;
      if (!driver) return setAssignedDriver(null);
      setAssignedDriver({ ...driver, vehicle: vehicleRes.data as AssignedDriver['vehicle'] });
    });
  }, [trip?.driver_id, trip?.status]);

  useEffect(() => {
    if (!trip?.driver_id || !ACTIVE.has(trip.status)) {
      setDriverLocation(null);
      return;
    }
    const driverId = trip.driver_id;
    let active = true;
    const loadLocation = async () => {
      const { data } = await supabase
        .from('driver_locations')
        .select('driver_id, latitude, longitude, heading, updated_at')
        .eq('driver_id', driverId)
        .maybeSingle();
      if (active) setDriverLocation(data as DriverLocation | null);
    };
    void loadLocation();
    const channel = supabase
      .channel(`avenyn:rider-location:${driverId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') setDriverLocation(null);
          else setDriverLocation(payload.new as DriverLocation);
        },
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [trip?.driver_id, trip?.status]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!trip) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Resan hittades inte.</Text>
      </View>
    );
  }

  const isActive = ACTIVE.has(trip.status);
  const fare = trip.actual_price ?? trip.fixed_price ?? trip.estimated_price;

  return (
    <View style={styles.container}>
      {trip.booking_number != null ? (
        <Text style={styles.bookingNumber}>Bokning #{trip.booking_number}</Text>
      ) : null}
      <View style={[styles.statusBox, isActive ? styles.statusActive : styles.statusDone]}>
        {isActive && trip.status !== 'Framme' ? (
          <ActivityIndicator color="#fff" style={{ marginBottom: spacing.sm }} />
        ) : null}
        <Text style={styles.statusText}>{STATUS_LABEL[trip.status] ?? trip.status}</Text>
      </View>

      {assignedDriver && isActive ? (
        <View style={styles.driverCard}>
          <Text style={styles.driverTitle}>Din förare</Text>
          <Text style={styles.driverName}>{assignedDriver.full_name}</Text>
          {assignedDriver.vehicle ? (
            <Text style={styles.muted}>
              {[assignedDriver.vehicle.make, assignedDriver.vehicle.model, assignedDriver.vehicle.registration_number].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {driverLocation && isActive ? (
        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            region={{
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            <Marker
              coordinate={{ latitude: driverLocation.latitude, longitude: driverLocation.longitude }}
              title="Din Avenyn Taxi"
              description="Förarens liveposition"
              rotation={driverLocation.heading ?? 0}
            />
          </MapView>
          <Text style={styles.liveText}>Taxins position uppdateras live</Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Text style={styles.dot}>●</Text>
        <View style={styles.flex}>
          <Text style={styles.label}>Hämtas från</Text>
          <Text style={styles.value}>{trip.pickup_address}</Text>
        </View>
      </View>
      <View style={styles.row}>
        <Text style={[styles.dot, { color: colors.brand }]}>◆</Text>
        <View style={styles.flex}>
          <Text style={styles.label}>Destination</Text>
          <Text style={styles.value}>{trip.dropoff_address ?? '—'}</Text>
        </View>
      </View>

      {fare != null ? (
        <View style={styles.fareRow}>
          <Text style={styles.label}>{trip.actual_price != null ? 'Pris' : 'Beräknat pris'}</Text>
          <Text style={styles.fare}>{`${fare} kr`}</Text>
        </View>
      ) : null}

      <Text style={styles.note}>
        Resans status uppdateras automatiskt i realtid.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  bookingNumber: { fontSize: typography.size.md, fontWeight: '700', marginBottom: spacing.sm, color: colors.text },
  statusBox: { borderRadius: 12, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.xl },
  statusActive: { backgroundColor: colors.brand },
  statusDone: { backgroundColor: colors.success },
  statusText: { color: '#fff', fontSize: typography.size.lg, fontWeight: '700' },
  driverCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg },
  driverTitle: { fontSize: typography.size.sm, color: colors.textMuted },
  driverName: { fontSize: typography.size.lg, fontWeight: '700', marginTop: spacing.xs },
  mapWrap: { marginBottom: spacing.xl },
  map: { height: 240, borderRadius: 12 },
  liveText: { marginTop: spacing.sm, color: colors.textMuted, fontSize: typography.size.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg },
  dot: { fontSize: 14, marginRight: spacing.md, marginTop: 2, color: colors.textMuted },
  flex: { flex: 1 },
  label: { fontSize: typography.size.sm, color: colors.textMuted },
  value: { fontSize: typography.size.md, fontWeight: '500' },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  fare: { fontSize: typography.size.xl, fontWeight: '700', color: colors.brand },
  note: { marginTop: spacing.xl, color: colors.textMuted, fontSize: typography.size.sm, lineHeight: 20 },
  muted: { color: colors.textMuted },
});
