import { colors, spacing, typography } from '@openride/ui';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signOut } from '../lib/auth';
import { fetchMyFordons, type Fordon } from '../lib/driver-state';

interface Props {
  driverId: string;
  displayName?: string | null;
  online: boolean;
  onGoOnline: (vehicleId: string) => Promise<void>;
  onGoOffline: () => Promise<void>;
  onRapportera: () => void;
}

export function HomeScreen({ driverId, displayName, online, onGoOnline, onGoOffline, onRapportera }: Props) {
  const [vehicles, setFordons] = useState<Fordon[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchMyFordons(driverId).then((vs) => {
      if (!active) return;
      setFordons(vs);
      setSelected((cur) => cur ?? vs[0]?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, [driverId]);

  async function toggle(): Promise<void> {
    setBusy(true);
    try {
      if (online) {
        await onGoOffline();
      } else {
        if (!selected) throw new Error('Lägg till ett aktivt fordon innan du går online.');
        await onGoOnline(selected);
      }
    } catch (e) {
      Alert.alert(online ? 'Kunde inte gå offline' : 'Kunde inte gå online', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.header}>
        <Text style={styles.hi}>{displayName ?? 'Förare'}</Text>
        <View style={styles.headerLinks}>
          <Pressable onPress={onRapportera} hitSlop={8}>
            <Text style={styles.link}>Rapportera</Text>
          </Pressable>
          <Pressable onPress={() => void signOut()} hitSlop={8}>
            <Text style={styles.signOut}>Logga ut</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.statusPill, online ? styles.onlinePill : styles.offlinePill]}>
        <Text style={styles.statusText}>{online ? 'Online' : 'Offline'}</Text>
      </View>

      <Text style={styles.headline}>{online ? 'Väntar på körning…' : 'Du är offline'}</Text>

      {!online ? (
        <>
          <Text style={styles.label}>Fordon</Text>
          {vehicles.length === 0 ? (
            <Text style={styles.muted}>
              Inget aktivt fordon är tilldelat. Dispatch måste lägga till ett fordon innan du kan gå online.
            </Text>
          ) : (
            vehicles.map((v) => (
              <Pressable
                key={v.id}
                style={[styles.vehicle, selected === v.id && styles.vehicleActive]}
                onPress={() => setSelected(v.id)}
              >
                <Text style={styles.vehicleRego}>{v.rego}</Text>
                <Text style={styles.muted}>
                  {v.make} {v.model} · {v.vehicle_type}
                </Text>
              </Pressable>
            ))
          )}
        </>
      ) : (
        <Text style={styles.muted}>
          Din position delas när du är online. Nya körningar visas automatiskt här.
        </Text>
      )}

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, online ? styles.danger : styles.primary, (!online && !selected) && styles.disabled]}
          onPress={toggle}
          disabled={busy || (!online && !selected)}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{online ? 'Gå offline' : 'Gå online'}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  hi: { fontSize: typography.size.lg, fontWeight: '600' },
  headerLinks: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  link: { color: colors.brandDark, fontSize: typography.size.sm, fontWeight: '600' },
  signOut: { color: colors.danger, fontSize: typography.size.sm, fontWeight: '600' },
  statusPill: { alignSelf: 'flex-start', paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 999, marginBottom: spacing.lg },
  onlinePill: { backgroundColor: colors.online },
  offlinePill: { backgroundColor: colors.offline },
  statusText: { color: '#fff', fontWeight: '600' },
  headline: { fontSize: typography.size.xl, fontWeight: '600', marginBottom: spacing.lg },
  label: { fontSize: typography.size.sm, color: colors.textMuted, marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontSize: typography.size.md, lineHeight: 22 },
  vehicle: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm },
  vehicleActive: { borderColor: colors.brandDark, backgroundColor: colors.surfaceMuted },
  vehicleRego: { fontSize: typography.size.md, fontWeight: '600' },
  actions: { marginTop: 'auto' },
  button: { padding: spacing.lg, borderRadius: 8, alignItems: 'center' },
  primary: { backgroundColor: colors.brandDark },
  danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: typography.size.lg },
});
