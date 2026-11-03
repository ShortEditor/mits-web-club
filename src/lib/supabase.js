import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const configured = !!url && !!anonKey

// DEMO MODE (local sample data, no sign-in) exists ONLY in dev builds, so the
// UI can be previewed before the backend exists. A production build without
// Supabase env vars is MISCONFIGURED, not demo: events/gallery stay locked
// behind sign-in there and the app says the backend is not connected yet.
// This guarantees the open demo access can never reach a production release.
export const isDemoMode = import.meta.env.DEV && !configured
export const isMisconfigured = import.meta.env.PROD && !configured
export const supabase = configured ? createClient(url, anonKey) : null
