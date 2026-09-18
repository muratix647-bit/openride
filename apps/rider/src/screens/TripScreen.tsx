import { channels } from '@openride/realtime';
import { colors, formatMoney, spacing, typography } from '@openride/ui';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../../App';
import { supabase } from '../lib/supabase';

type Props = { route: RouteProp<RootStackParamList, 'Trip'> };

interface TripRow {
  id: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
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
  'Avslutad': 'Resan är avslutad',
  'Avbokad': 'Resan är avbokad',
};

const ACTIVE = new Set(['Ny', 'Bekräftad', 'Tilldelad', 'På väg', 'Framme', 'Kund i bilen']);

export function TripScreen({ route }: Props) {
  const { tripId } = route.params;
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void supabase
      .from('bookings')
      .select('id, status, pickup_address, dropoff_address, estimated_price, fixed_price, actual_price, driver_id')
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
      <View style={[styles.statusBox, isActive ? styles.statusActive : styles.statusDone]}>
        {isActive && trip.status !== 'Framme' ? (
          <ActivityIndicator color="#fff" style={{ marginBottom: spacing.sm }} />
        ) : null}
        <Text style={styles.statusText}>{STATUS_LABEL[trip.status] ?? trip.status}</Text>
      </View>

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
          <Text style={styles.value}>{trip.dropoff_address}</Text>
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
  statusBox: { borderRadius: 12, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.xl },
  statusActive: { backgroundColor: colors.brand },
  statusDone: { backgroundColor: colors.success },
  statusText: { color: '#fff', fontSize: typography.size.lg, fontWeight: '700' },
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
