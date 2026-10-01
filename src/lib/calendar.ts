import type { Session } from '../types';

function encode(value: string): string {
  return encodeURIComponent(value);
}

export function getGoogleCalendarUrl(session: Session): string {
  const start = session.scheduledAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const endDate = new Date(session.scheduledAt.getTime() + session.durationMinutes * 60 * 1000);
  const end = endDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const details = session.notes || `EduSwap session with ${session.teacherName} and ${session.learnerName}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encode(`EduSwap: ${session.skill}`)}&dates=${start}/${end}&details=${encode(details)}&location=${encode(session.meetingLink || 'EduSwap')}`;
}

export function downloadIcsFile(session: Session): void {
  const endDate = new Date(session.scheduledAt.getTime() + session.durationMinutes * 60 * 1000);
  const start = session.scheduledAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = endDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const content = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EduSwap//Sessions//EN',
    'BEGIN:VEVENT', `UID:eduswap-${session.id}`, `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:EduSwap: ${session.skill}`, `DESCRIPTION:${session.notes || 'Skill exchange session'}`,
    `LOCATION:${session.meetingLink || 'EduSwap'}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `eduswap-${session.skill.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}