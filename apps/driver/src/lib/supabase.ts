import { createClient } from '@supabase/supabase-js';

import { secureStorage } from './secure-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy apps/driver/.env.example to .env.local and restart with `expo start --clear`.',
  );
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type DriverRow = {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  phone: string | null;
  active: boolean;
  approved: boolean | null;
  is_online: boolean | null;
  status: string | null;
  archived_at: string | null;
};

type BookingRow = {
  id: string;
  driver_id: string | null;
  status: string;
  pickup_address: string;
  dropoff_address: string | null;
  customer_phone: string | null;
  estimated_price: number | null;
  fixed_price: number | null;
  actual_price: number | null;
  updated_at: string;
  picked_up_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
};

type DriverLocationRow = {
  driver_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed_kmh: number | null;
  updated_at: string;
};

type VehicleRow = {
  id: string;
  driver_id: string | null;
  registration_number: string | null;
  reg: string | null;
  make: string | null;
  model: string | null;
  vehicle_class: string | null;
  active: boolean;
};

type IncidentReportRow = {
  id: string;
  reported_by: string;
  driver_id: string | null;
  category: string;
  severity: string;
  description: string;
};

type AvenynDatabase = {
  public: {
    Tables: {
      drivers: Table<DriverRow>;
      bookings: Table<BookingRow>;
      driver_locations: Table<DriverLocationRow, DriverLocationRow>;
      vehicles: Table<VehicleRow>;
      incident_reports: Table<IncidentReportRow, Omit<IncidentReportRow, 'id'>>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export const supabase = createClient<AvenynDatabase>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: secureStorage,
  },
});
