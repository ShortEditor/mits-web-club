import { supabase, isDemoMode } from './supabase'
import { demoEvents } from './demoData'

// Data access layer: demo fixtures when unconfigured, Supabase when live.
// RLS on the database is the real gate - these queries assume it.

export async function listPublishedEvents() {
  if (isDemoMode) return demoEvents
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('published', true)
    .order('event_date', { ascending: false })
  if (error) throw error
  return data
}

export async function getEventBySlug(slug) {
  if (isDemoMode) return demoEvents.find((e) => e.slug === slug) || null
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single()
  if (error) return null
  return data
}

export async function listGallery(eventId) {
  if (isDemoMode) return []
  const { data, error } = await supabase
    .from('event_gallery_images')
    .select('*')
    .eq('event_id', eventId)
    .order('display_order')
  if (error) throw error
  return data
}

// Signed URL for private media (posters, gallery images). Never used for docs/* -
// documentation PDFs are admin-only and minted only inside the admin panel.
export async function mediaUrl(path) {
  if (isDemoMode || !path) return null
  const { data, error } = await supabase.storage.from('media').createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}

// ---------- Admin operations (RLS enforces admin-only server-side) ----------

export async function listAllEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('event_date', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data
}

export function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function createEvent(fields) {
  const { data, error } = await supabase.from('events').insert(fields).select().single()
  if (error) throw error
  return data
}

export async function updateEvent(id, fields) {
  const { data, error } = await supabase
    .from('events')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Upload a file into the private "media" bucket. prefix is 'events' (posters,
// gallery) or 'docs' (report PDFs - storage policy keeps docs/ admin-only).
export async function uploadMedia(prefix, eventId, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${prefix}/${eventId}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from('media').upload(path, file)
  if (error) throw error
  return path
}

export async function addGalleryImage(eventId, imagePath, caption) {
  const { data, error } = await supabase
    .from('event_gallery_images')
    .insert({ event_id: eventId, image_path: imagePath, caption })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeGalleryImage(image) {
  const { error: rowErr } = await supabase
    .from('event_gallery_images')
    .delete()
    .eq('id', image.id)
  if (rowErr) throw rowErr
  await supabase.storage.from('media').remove([image.image_path])
}

export async function getEventDocument(eventId) {
  const { data, error } = await supabase
    .from('event_documents')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertEventDocument(eventId, fields) {
  const { data, error } = await supabase
    .from('event_documents')
    .upsert({ event_id: eventId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'event_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------- Members (registered viewers) and per-event participants ----------

export async function listMembers() {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addMember(fields) {
  const { data, error } = await supabase.from('members').insert(fields).select().single()
  if (error) throw error
  return data
}

export async function listParticipants(eventId) {
  const { data, error } = await supabase
    .from('event_participants')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at')
  if (error) throw error
  return data
}

export async function addParticipant(eventId, fields) {
  const { data, error } = await supabase
    .from('event_participants')
    .insert({ event_id: eventId, ...fields })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeParticipant(id) {
  const { error } = await supabase.from('event_participants').delete().eq('id', id)
  if (error) throw error
}
