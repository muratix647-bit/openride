import { colors, formatMoney, spacing, typography } from '@openride/ui';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ActiveTrip } from '../lib/driver-state';

type Event = 'en-route' | 'arrived' | 'start' | 'complete' | 'cancel';

interface Props {
  trip: ActiveTrip;
  onEvent: (event: Event) => Promise<void>;
}

const STATUS_LABEL: Record<string, string> = {
  assigned: 'Kör till kunden',
  driver_en_route: 'På väg till kunden',
  arrived_at_pickup: 'Framme hos kunden',
  in_progress: 'Kund i bilen',
};

export function ActiveTripScreen({ trip, onEvent }: Props) {
  const [busy, setBusy] = useState(false);

  async function navigateTo(address: string): Promise<void> {
    if (!address.trim()) {
      Alert.alert('Adress saknas', 'Det finns ingen adress att navigera till.');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Navigation kunde inte öppnas', 'Kontrollera att telefonen har en kartapp eller webbläsare.');
      return;
    }
    await Linking.openURL(url);
  }

  async function callCustomer(): Promise<void> {
    const phone = trip.customer_phone?.trim();
    if (!phone) {
      Alert.alert('Telefonnummer saknas', 'Kunden har inget telefonnummer registrerat.');
      return;
    }
    const url = `tel:${phone.replace(/\s+/g, '')}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Kunde inte ringa', 'Telefonen kan inte öppna samtalsfunktionen.');
      return;
    }
    await Linking.openURL(url);
  }

  async function run(event: Event): Promise<void> {
    setBusy(true);
    try {
      await onEvent(event);
    } catch (e) {
      Alert.alert('Åtgärden misslyckades', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const inProgress = trip.status === 'in_progress';
  const target = inProgress ? (trip.dropoff_address ?? '') : trip.pickup_address;
  const fareCents = trip.final_fare_cents ?? trip.estimated_fare_cents;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <Text style={styles.status}>{STATUS_LABEL[trip.status] ?? trip.status}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Hämtas från</Text>
        <Text style={styles.value}>{trip.pickup_address}</Text>
        <Text style={[styles.label, { marginTop: spacing.md }]}>Destination</Text>
        <Text style={styles.value}>{trip.dropoff_address}</Text>
        {fareCents != null ? <Text style={styles.fare}>{formatMoney(fareCents)}</Text> : null}
      </View>

      {trip.customer_phone ? (
        <Pressable style={styles.callButton} onPress={() => void callCustomer()}>
          <Text style={styles.callText}>Ring kund</Text>
        </Pressable>
      ) : null}

      <Pressable style={styles.navButton} onPress={() => void navigateTo(target)}>
        <Text style={styles.navText}>Navigera till {inProgress ? 'destination' : 'kund'}</Text>
      </Pressable>

      <View style={styles.actions}>
        {trip.status === 'assigned' && (
          <PrimaryButton label="På väg till kund" busy={busy} onPress={() => run('en-route')} />
        )}
        {trip.status === 'driver_en_route' && (
          <PrimaryButton label="Framme hos kund" busy={busy} onPress={() => run('arrived')} />
        )}
        {trip.status === 'arrived_at_pickup' && (
          <PrimaryButton label="Kund i bilen" busy={busy} onPress={() => run('start')} />
        )}
        {trip.status === 'in_progress' && (
          <PrimaryButton label="Avsluta körning" busy={busy} onPress={() => run('complete')} />
        )}
        {!inProgress && (
          <Pressable style={styles.cancel} onPress={() => run('cancel')} disabled={busy}>
            <Text style={styles.cancelText}>Avbryt körning</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function PrimaryButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.button, busy && styles.disabled]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.surface },
  status: { fontSize: typography.size.xl, fontWeight: '700', marginBottom: spacing.lg },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg },
  label: { fontSize: typography.size.sm, color: colors.textMuted },
  value: { fontSize: typography.size.md, fontWeight: '600' },
  fare: { fontSize: typography.size.xl, fontWeight: '700', color: colors.brand, marginTop: spacing.md },
  callButton: { borderWidth: 1, borderColor: colors.brand, borderRadius: 8, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  callText: { color: colors.brand, fontWeight: '600', fontSize: typography.size.md },
  navButton: { borderWidth: 1, borderColor: colors.brandDark, borderRadius: 8, padding: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
  navText: { color: colors.brandDark, fontWeight: '600', fontSize: typography.size.md },
  actions: { marginTop: 'auto', gap: spacing.sm },
  button: { backgroundColor: colors.brandDark, padding: spacing.lg, borderRadius: 8, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: typography.size.lg },
  cancel: { padding: spacing.md, alignItems: 'center' },
  cancelText: { color: colors.danger, fontWeight: '600' },
});
