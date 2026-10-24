import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CaseLibrary from '../modules/cases/CaseLibrary';

const mocks = vi.hoisted(() => ({ list: vi.fn().mockResolvedValue({
  items: [{ id: 41, case_id: 'CASE-41', description: 'Breast biopsy', reviewer: 'pathologist.one', status: 'In Review', slide_count: 1, slides: [] }],
  total: 1,
}) }));

vi.mock('../modules/auth/AuthProvider', () => ({ useAuth: () => ({ user: { username: 'pathologist.one', display_name: 'Pathologist One', role: 'Pathologist' } }) }));
vi.mock('../services/caseService', () => ({ caseService: { list: mocks.list } }));
vi.mock('../services/platformService', () => ({ platformService: { deleteCase: vi.fn() } }));

describe('Case Library', () => {
  it('uses API-backed saved filters and does not expose deletion to a pathologist', async () => {
    render(<MemoryRouter><CaseLibrary /></MemoryRouter>);
    expect((await screen.findAllByText('CASE-41')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /remove case/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'My assigned cases' }));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ assigned_to_me: true, limit: 25 }), expect.anything()));
    fireEvent.change(screen.getByLabelText('Case status'), { target: { value: 'Reviewed' } });
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Reviewed' }), expect.anything()));
  });
});
