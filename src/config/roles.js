export const USER_ROLES = [
  { value: 'System Administrator', label: 'System Administrator' },
  { value: 'Laboratory Manager', label: 'Laboratory Manager / Supervisor' },
  { value: 'Pathologist', label: 'Pathologist' },
  { value: 'Histotechnologist', label: 'Histotechnologist / Scanner Operator' },
  { value: 'AI Analyst', label: 'AI Analyst / Research User' },
  { value: 'Integration Engineer', label: 'IT / Integration Engineer' },
  { value: 'Auditor', label: 'Auditor / Read-only User' },
];

export const SYSTEM_ADMIN_ROLE = 'System Administrator';

export const SUPER_ADMIN_ROLE = 'Super Administrator';
export const PROTECTED_SUPER_ADMIN_USERNAMES = new Set(['etddev', 'etdadmin']);

export function isProtectedSuperAdmin(username) {
  return PROTECTED_SUPER_ADMIN_USERNAMES.has(String(username || '').toLowerCase());
}

export function isAdministratorRole(role) {
  return role === SYSTEM_ADMIN_ROLE || role === SUPER_ADMIN_ROLE;
}
