import { describe, expect, it } from 'vitest';

import { SUPER_ADMIN_ROLE, SYSTEM_ADMIN_ROLE, USER_ROLES } from './roles';

describe('assignable user roles', () => {
  it('includes System Administrator and excludes the protected Super Administrator role', () => {
    const roleValues = USER_ROLES.map(({ value }) => value);

    expect(roleValues).toContain(SYSTEM_ADMIN_ROLE);
    expect(roleValues).not.toContain(SUPER_ADMIN_ROLE);
  });
});
