const ACTION_COPY = {
  'auth.login': { title: 'Signed in', category: 'Access', outcome: 'Successful' },
  'auth.logout': { title: 'Signed out', category: 'Access', outcome: 'Successful' },
  'user.create': { title: 'Created a user account', category: 'Users', outcome: 'Completed' },
  'user.delete': { title: 'Deleted a user account', category: 'Users', outcome: 'Completed' },
  'user.role_change': { title: 'Changed a user role', category: 'Users', outcome: 'Completed' },
  'user.password_reset': { title: 'Reset a user password', category: 'Users', outcome: 'Completed' },
  'image.version_import': { title: 'Imported a new slide image version', category: 'Slides', outcome: 'Completed' },
  'annotation.delete': { title: 'Deleted an annotation', category: 'Annotations', outcome: 'Completed' },
  'slide.delete': { title: 'Removed a slide', category: 'Slides', outcome: 'Completed' },
  'case.delete': { title: 'Removed a case', category: 'Cases', outcome: 'Completed' },
};

function humanize(value) {
  return String(value || 'Activity').replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseDetails(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return value; }
}

export function describeAuditEvent(event) {
  const copy = ACTION_COPY[event.action] || {
    title: humanize(event.action), category: humanize(event.target_type || 'System'), outcome: 'Recorded',
  };
  const details = parseDetails(event.details);
  let explanation = `Affected ${humanize(event.target_type || 'record').toLowerCase()} ${event.target_id || '—'}.`;
  if (event.action === 'case.delete' && details?.case_id) explanation = `Removed case ${details.case_id} and ${details.slide_count || 0} associated slide(s).`;
  if (event.action === 'slide.delete' && details?.label) explanation = `Removed slide “${details.label}” from its case.`;
  if (event.action === 'user.role_change' && event.details) explanation = `Assigned the ${event.details} role to user record ${event.target_id}.`;
  if (event.action === 'user.create' && event.details) explanation = `Created user record ${event.target_id} with the ${event.details} role.`;
  if (event.action === 'auth.login') explanation = 'The user successfully entered the application.';
  if (event.action === 'auth.logout') explanation = 'The user securely ended their session.';
  return { ...copy, explanation };
}

export function auditCategories(events) {
  return [...new Set(events.map((event) => describeAuditEvent(event).category))].sort();
}
