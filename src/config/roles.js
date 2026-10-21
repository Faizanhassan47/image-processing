export const USER_ROLES = [
  { value: 'Super Administrator', label: 'Super Administrator' },
  { value: 'System Administrator', label: 'System Administrator' },
  { value: 'Laboratory Manager', label: 'Laboratory Manager / Supervisor' },
  { value: 'Pathologist', label: 'Pathologist' },
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

export function isIntakeRole(role) {
  return role === SYSTEM_ADMIN_ROLE || role === 'Laboratory Manager';
}

export function isClinicalReadRole(role) {
  return role === SYSTEM_ADMIN_ROLE || role === 'Laboratory Manager' || role === 'Pathologist' || role === 'Auditor';
}

export function isAuditorRole(role) {
  return role === 'Auditor';
}
