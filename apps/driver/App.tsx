import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ActiveTripScreen } from './src/screens/ActiveTripScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { PhoneAuthScreen } from './src/screens/PhoneAuthScreen';
import { ReportIncidentScreen } from './src/screens/ReportIncidentScreen';
import { useSession } from './src/lib/auth';
import { useDriverState } from './src/lib/driver-state';

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center' }} edges={['top', 'right', 'bottom', 'left']}>
      {children}
    </SafeAreaView>
  );
}

function SignedIn({ session }: { session: Session }) {
  const displayName =
    (session.user.user_metadata?.display_name as string | undefined) ?? session.user.phone ?? null;
  const state = useDriverState(session);
  const [showReport, setShowReport] = useState(false);

  if (state.loading) {
    return (
      <Centered>
        <ActivityIndicator />
      </Centered>
    );
  }

  if (showReport) {
    return <ReportIncidentScreen onDone={() => setShowReport(false)} />;
  }

  // Active trip takes precedence over the home/idle view.
  if (state.activeTrip) {
    return (
      <ActiveTripScreen
        trip={state.activeTrip}
        onEvent={async (event) => {
          await state.tripEvent(event);
        }}
      />
    );
  }


  if (!state.driverId) {
    return (
      <Centered>
        <Text style={{ textAlign: 'center', paddingHorizontal: 24 }}>
          Förarkontot är inte kopplat till Avenyn Taxi. Kontakta Dispatch.
        </Text>
      </Centered>
    );
  }

  return (
    <HomeScreen
      driverId={state.driverId}
      displayName={displayName}
      online={state.online}
      onGoOnline={state.goOnline}
      onGoOffline={state.goOffline}
      onRapportera={() => setShowReport(true)}
    />
  );
}

export default function App() {
  const { session, loading } = useSession();

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {loading ? (
        <Centered>
          <ActivityIndicator />
        </Centered>
      ) : !session ? (
        <PhoneAuthScreen />
      ) : (
        <SignedIn session={session} />
      )}
    </SafeAreaProvider>
  );
}
