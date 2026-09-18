import * as Location from 'expo-location';

import { supabase } from './supabase';

// Foreground location streaming. Expo Go only supports foreground; background
// streaming (screen off / app backgrounded) needs a custom dev client with an
// expo-location background task — a later upgrade.
let sub: Location.LocationSubscription | null = null;

export async function startLocationStreaming(driverId: string): Promise<void> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Platsbehörighet krävs för att gå online.');

  // Push once immediately so the driver appears on the map without waiting.
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    await pushLocation(driverId, pos);
  } catch {
    // ignore — the watcher will catch up
  }

  sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 20 },
    (pos) => {
      void pushLocation(driverId, pos);
    },
  );
}

export function stopLocationStreaming(): void {
  sub?.remove();
  sub = null;
}

async function pushLocation(driverId: string, pos: Location.LocationObject): Promise<void> {
  await supabase.from('driver_locations').upsert(
    {
      driver_id: driverId,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      heading: pos.coords.heading,
      speed_kmh: pos.coords.speed == null ? null : Math.max(0, pos.coords.speed * 3.6),
      updated_at: new Date(pos.timestamp).toISOString(),
    },
    { onConflict: 'driver_id' },
  );
}
