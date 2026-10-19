import { describe, expect, it } from 'vitest';

import { SYSTEM_ADMIN_ROLE, USER_ROLES } from './roles';

describe('assignable user roles', () => {
  it('contains exactly the approved three-role catalogue', () => {
    const roleValues = USER_ROLES.map(({ value }) => value);
    expect(roleValues).toEqual([SYSTEM_ADMIN_ROLE, 'Laboratory Manager', 'Pathologist']);
  });
});
