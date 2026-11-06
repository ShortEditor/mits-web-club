import * as XLSX from 'xlsx'

// Faculty Excel download: one sheet with every registered student's details and
// attendance, plus totals. Rolls/dept/etc. are written as text cells so Excel
// keeps leading zeros and never reinterprets them.
export function downloadAttendanceSheet(event, rows) {
  const header = ['Roll Number', 'Name', 'College Email', 'Department', 'Section', 'Year', 'Registered At', 'Attendance']
  const fmt = (iso) => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  }
  const body = rows.map((r) => [
    r.roll_number || '',
    r.name || '',
    r.email || '',
    r.department || '',
    r.section || '',
    r.year || '',
    fmt(r.created_at),
    r.attendance_status === 'present' ? 'Present' : r.attendance_status === 'absent' ? 'Absent' : 'Not marked',
  ])
  const present = rows.filter((r) => r.attendance_status === 'present').length
  const absent = rows.filter((r) => r.attendance_status === 'absent').length
  const aoa = [
    [`${event.title} - Registrations & Attendance`],
    [],
    header,
    ...body,
    [],
    ['Total Registered', rows.length],
    ['Total Present', present],
    ['Total Absent', absent],
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 16 }, { wch: 26 }, { wch: 32 }, { wch: 20 }, { wch: 9 }, { wch: 7 }, { wch: 22 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
  const safe = (event.slug || 'event').replace(/[^a-z0-9-]/gi, '-')
  XLSX.writeFile(wb, `${safe}-attendance.xlsx`)
}
