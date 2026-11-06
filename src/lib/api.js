import { supabase, isDemoMode } from './supabase'
import { demoEvents, demoRegistrations } from './demoData'

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


// Delete an event (RLS: admins only). Order matters: collect the event's exact
// storage paths BEFORE deleting rows, delete the DB row (children cascade),
// then remove those files. Any file that could not be removed is returned as
// orphanedFiles so the caller can report it - nothing is silently orphaned.
// Demo mode refuses loudly instead of crashing on the null client.
export async function deleteEvent(id) {
  if (isDemoMode) throw new Error('Local preview only: deleting needs the live backend.')
  const paths = []
  const { data: ev, error: evErr } = await supabase.from('events').select('poster_path').eq('id', id).single()
  if (evErr) throw evErr
  if (ev?.poster_path) paths.push(ev.poster_path)
  const { data: gal, error: galErr } = await supabase.from('event_gallery_images').select('image_path').eq('event_id', id)
  if (galErr) throw galErr
  for (const g of gal || []) if (g.image_path) paths.push(g.image_path)
  const { data: doc, error: docErr } = await supabase.from('event_documents').select('pdf_path').eq('event_id', id).maybeSingle()
  if (docErr) throw docErr
  if (doc?.pdf_path) paths.push(doc.pdf_path)

  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error

  const orphanedFiles = []
  if (paths.length) {
    const { data: removed, error: rmErr } = await supabase.storage.from('media').remove(paths)
    const removedNames = new Set((removed || []).map((f) => f.name))
    for (const p of paths) if (rmErr || !removedNames.has(p)) orphanedFiles.push(p)
  }
  return { orphanedFiles }
}


// Duplicate an event as an unpublished draft (RLS: admins only). Slug is made
// unique-ish with a suffix; the admin can edit it before publishing.
export async function duplicateEvent(id) {
  if (isDemoMode) throw new Error('Local preview only: duplicating needs the live backend.')
  const { data, error } = await supabase.from('events').select('*').eq('id', id).single()
  if (error) throw error
  const copy = { ...data }
  delete copy.id; delete copy.created_at; delete copy.updated_at
  copy.title = `${data.title} (copy)`
  copy.slug = `${data.slug}-copy-${Date.now().toString(36)}`
  copy.published = false
  const { data: row, error: e2 } = await supabase.from('events').insert(copy).select().single()
  if (e2) throw e2
  return row
}

// Update a gallery image's caption / alt text / display order (RLS: admins only).
export async function updateGalleryImage(id, fields) {
  if (isDemoMode) throw new Error('Local preview only: editing needs the live backend.')
  const { error } = await supabase.from('event_gallery_images').update(fields).eq('id', id)
  if (error) throw error
}

// Latest gallery photos from published events, for the homepage strip. Returns
// [] when the current reader has no gallery access (RLS decides).
export async function listRecentPhotos(limit = 6) {
  if (isDemoMode) return []
  const { data, error } = await supabase
    .from('event_gallery_images')
    .select('id, image_path, caption, alt_text, events!inner(published)')
    .eq('events.published', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return data
}

// Upload a file into the private "media" bucket. kind is 'poster', 'gallery'
// or 'docs'. Paths are kind-namespaced so storage RLS can tell them apart:
//   events/<eventId>/poster/...  - faculty may write only for events they own
//   events/<eventId>/gallery/... - admin-only
//   docs/<eventId>/...           - admin-only
export async function uploadMedia(kind, eventId, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const leaf = `${Date.now()}-${safeName}`
  const path = kind === 'docs' ? `docs/${eventId}/${leaf}` : `events/${eventId}/${kind}/${leaf}`
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

export async function listFacultyDirectory() {
  const { data, error } = await supabase.rpc('faculty_editor_directory')
  if (error) throw error
  return data
}

export async function addFacultyByEmail(email) {
  const { data, error } = await supabase.rpc('add_faculty_editor_by_email', { target_email: email })
  if (error) throw error
  return data
}

export async function removeFacultyByEmail(email) {
  const { data, error } = await supabase.rpc('remove_faculty_editor_by_email', { target_email: email })
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

// Admin management (migration 0003): server-enforced RPCs. The functions
// re-check is_admin() inside the database, so a non-admin session gets an error.
export async function listAdminDirectory() {
  const { data, error } = await supabase.rpc('admin_directory')
  if (error) throw error
  return data || []
}

export async function addAdminByEmail(email) {
  const { data, error } = await supabase.rpc('add_admin_by_email', { target_email: email })
  if (error) throw error
  return data
}

// ---------- Event registrations + attendance (migration 0008) ----------

// The signed-in student's own registration for one event (null when not
// registered). RLS: students read only their own rows.
export async function getMyRegistration(eventId) {
  if (isDemoMode) return null
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData?.user?.id
  if (!uid) return null
  const { data, error } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', uid)
    .maybeSingle()
  if (error) throw error
  return data
}

// Student self-registration. RLS: published events only, own user id, and
// attendance can never be pre-set by the student.
export async function registerForEvent(eventId, fields) {
  if (isDemoMode) throw new Error('Local preview only: registration needs the live backend.')
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData?.user?.id
  if (!uid) throw new Error('Sign in to register.')
  const { data, error } = await supabase
    .from('event_registrations')
    .insert({ event_id: eventId, user_id: uid, ...fields })
    .select()
    .single()
  if (error) {
    if (String(error.message).toLowerCase().includes('duplicate')) {
      throw new Error('That roll number is already registered for this event.')
    }
    throw error
  }
  return data
}

// Event managers (admin or the faculty editor who owns the event): full
// registration list for one event.
export async function listRegistrations(eventId) {
  if (isDemoMode) return demoRegistrations
  const { data, error } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', eventId)
    .order('roll_number')
  if (error) throw error
  return data
}

// Event managers: save attendance marks. entries: [{ id, status }] with status
// 'present' | 'absent' | null (null clears a mark). RLS and the guard trigger
// restrict this to the event's faculty owner or an admin.
export async function saveAttendance(entries) {
  if (isDemoMode) throw new Error('Local preview only: attendance needs the live backend.')
  if (!entries.length) return
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData?.user?.id || null
  const now = new Date().toISOString()
  for (const entry of entries) {
    const { error } = await supabase
      .from('event_registrations')
      .update({
        attendance_status: entry.status,
        attendance_marked_by: entry.status ? uid : null,
        attendance_marked_at: entry.status ? now : null,
        updated_at: now,
      })
      .eq('id', entry.id)
    if (error) throw error
  }
}
