import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HomeScreen } from './src/screens/HomeScreen';
import { PhoneAuthScreen } from './src/screens/PhoneAuthScreen';
import { ReceiptsScreen } from './src/screens/ReceiptsScreen';
import { ReportIncidentScreen } from './src/screens/ReportIncidentScreen';
import { TripScreen } from './src/screens/TripScreen';
import { useSession } from './src/lib/auth';

export type RootStackParamList = {
  PhoneAuth: undefined;
  Home: undefined;
  Trip: { tripId: string };
  Receipts: undefined;
  ReportIncident: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { session, loading: sessionLoading } = useSession();
  const booting = sessionLoading;

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {booting ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : !session ? (
        <PhoneAuthScreen />
      ) : (
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Home" options={{ title: 'Avenyn Taxi' }}>
              {() => <HomeScreen displayName={session.user.user_metadata?.full_name ?? session.user.phone ?? null} />}
            </Stack.Screen>
            <Stack.Screen name="Trip" component={TripScreen} options={{ title: 'Din resa' }} />
            <Stack.Screen name="Receipts" component={ReceiptsScreen} options={{ title: 'Kvitton' }} />
            <Stack.Screen
              name="ReportIncident"
              component={ReportIncidentScreen}
              options={{ title: 'Rapportera problem' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}
