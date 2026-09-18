import { colors, spacing, typography } from '@openride/ui';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { sendOtp, verifyOtp } from '../lib/auth';

export function PhoneAuthScreen() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);

  async function onSendOtp(): Promise<void> {
    setBusy(true);
    try {
      await sendOtp(phone.trim());
      setStage('code');
    } catch (e) {
      Alert.alert('Kunde inte skicka kod', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(): Promise<void> {
    setBusy(true);
    try {
      await verifyOtp(phone.trim(), code.trim());
    } catch (e) {
      Alert.alert('Koden stämde inte', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <Text style={styles.title}>Avenyn Taxi Förare</Text>
      <Text style={styles.subtitle}>
        {stage === 'phone' ? 'Logga in med ditt förarnummer' : `Kod skickad till ${phone}`}
      </Text>

      {stage === 'phone' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="+46 70 000 00 00"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            editable={!busy}
          />
          <Pressable style={styles.button} onPress={onSendOtp} disabled={busy || phone.length < 6}>
            <Text style={styles.buttonText}>Skicka kod</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="6-siffrig kod"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            editable={!busy}
            maxLength={6}
          />
          <Pressable style={styles.button} onPress={onVerify} disabled={busy || code.length < 4}>
            <Text style={styles.buttonText}>Verifiera</Text>
          </Pressable>
          <Pressable onPress={() => setStage('phone')} disabled={busy}>
            <Text style={styles.link}>Använd ett annat nummer</Text>
          </Pressable>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center', backgroundColor: colors.surface },
  title: { fontSize: typography.size.xxl, fontWeight: '700', color: colors.brandDark, marginBottom: spacing.sm },
  subtitle: { fontSize: typography.size.md, color: colors.textMuted, marginBottom: spacing.xl },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.size.md,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.brandDark,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: typography.size.md },
  link: { color: colors.brandDark, textAlign: 'center', fontSize: typography.size.sm },
});
