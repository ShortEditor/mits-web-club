// DEMO FIXTURES - clearly-marked sample content used only when Supabase env vars
// are not configured (demo mode). The admin panel replaces these with real content.
export const demoEvents = [
  {
    id: 'demo-1',
    slug: 'intro-to-web-dev-workshop',
    title: 'Introduction to Web Development (Demo)',
    short_description: 'Sample event: hands-on HTML, CSS and JavaScript basics for beginners.',
    description: 'This is demo content shown before real events are published from the admin panel.',
    poster_path: '/demo-poster.svg',
    event_date: '2026-11-20',
    start_time: '10:00',
    end_time: '13:00',
    venue: 'Seminar Hall (demo)',
    category: 'Workshop',
    lifecycle: 'ongoing',
    published: true,
  },
  {
    id: 'demo-2',
    slug: 'react-bootcamp-demo',
    title: 'React Bootcamp (Demo)',
    short_description: 'Sample event: build your first React app, components to deployment.',
    description: 'This is demo content shown before real events are published from the admin panel.',
    poster_path: null,
    event_date: '2026-12-05',
    start_time: '09:30',
    end_time: '16:30',
    venue: 'Lab Block (demo)',
    category: 'Bootcamp',
    lifecycle: 'ongoing',
    published: true,
  },
  {
    id: 'demo-3',
    slug: 'ui-design-sprint-demo',
    title: 'UI Design Sprint (Demo)',
    short_description: 'Sample completed event with a report and gallery attached.',
    description: 'This is demo content shown before real events are published from the admin panel.',
    poster_path: null,
    event_date: '2026-10-12',
    start_time: '14:00',
    end_time: '17:00',
    venue: 'Web Club Lab (demo)',
    category: 'Sprint',
    lifecycle: 'completed',
    published: true,
  },
]

export const demoGallery = []
export const demoDocuments = []

// Sample registrations so the faculty attendance panel can be previewed in
// demo mode (dev builds without a backend). Never used in production.
export const demoRegistrations = [
  {
    id: 'demo-reg-1', event_id: 'demo-1', user_id: 'demo-u1',
    roll_number: '23471A05B2', name: 'Ananya Sharma', email: '23471a05b2@mits.ac.in',
    department: 'CSE', section: 'A', year: '2nd',
    attendance_status: 'present', attendance_marked_by: 'demo-faculty',
    attendance_marked_at: '2026-11-06T10:05:00+05:30',
    created_at: '2026-11-04T18:20:00+05:30', updated_at: '2026-11-06T10:05:00+05:30',
  },
  {
    id: 'demo-reg-2', event_id: 'demo-1', user_id: 'demo-u2',
    roll_number: '23471A05C7', name: 'Rahul Verma', email: 'rahul.v@mits.ac.in',
    department: 'CSE', section: 'B', year: '2nd',
    attendance_status: 'absent', attendance_marked_by: 'demo-faculty',
    attendance_marked_at: '2026-11-06T10:05:00+05:30',
    created_at: '2026-11-04T19:02:00+05:30', updated_at: '2026-11-06T10:05:00+05:30',
  },
  {
    id: 'demo-reg-3', event_id: 'demo-1', user_id: 'demo-u3',
    roll_number: '24475A0511', name: 'Meena Krishnan', email: 'meena.k@mits.ac.in',
    department: 'IT', section: 'A', year: '1st',
    attendance_status: null, attendance_marked_by: null, attendance_marked_at: null,
    created_at: '2026-11-05T09:41:00+05:30', updated_at: '2026-11-05T09:41:00+05:30',
  },
]
