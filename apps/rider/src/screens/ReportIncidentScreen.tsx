import { colors, spacing, typography } from '@openride/ui';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../lib/supabase';

const CATEGORIES = [
  { key: 'safety', label: 'Säkerhet' },
  { key: 'vehicle_damage', label: 'Fordonsskada' },
  { key: 'abuse', label: 'Olämpligt beteende' },
  { key: 'payment_dispute', label: 'Betalning' },
  { key: 'medical', label: 'Medicinskt' },
  { key: 'other', label: 'Övrigt' },
] as const;

const HIGH = new Set(['safety', 'medical', 'abuse']);

export function ReportIncidentScreen() {
  const navigation = useNavigation();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['key']>('safety');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const id = u.user?.id;
      if (!id) throw new Error('Du är inte inloggad');
      const { error } = await supabase.from('incident_reports').insert({
        reported_by: id,
        rider_id: id,
        category,
        severity: HIGH.has(category) ? 'high' : 'low',
        description: description.trim(),
      });
      if (error) throw error;
      Alert.alert('Tack', 'Din rapport har skickats.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Kunde inte skicka rapporten', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Vad har hänt?</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.key}
            style={[styles.chip, category === c.key && styles.chipActive]}
            onPress={() => setCategory(c.key)}
          >
            <Text style={category === c.key ? styles.chipTextActive : styles.chipText}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Beskriv händelsen</Text>
      <TextInput
        style={styles.input}
        placeholder="Berätta vad som hände…"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
      />

      <Pressable
        style={[styles.button, (busy || description.trim().length < 5) && styles.disabled]}
        onPress={submit}
        disabled={busy || description.trim().length < 5}
      >
        <Text style={styles.buttonText}>{busy ? 'Skickar…' : 'Skicka rapport'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.surface },
  label: { fontSize: typography.size.sm, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.size.md,
    minHeight: 120,
  },
  button: { backgroundColor: colors.brand, padding: spacing.lg, borderRadius: 8, alignItems: 'center', marginTop: spacing.xl },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: typography.size.lg },
});
