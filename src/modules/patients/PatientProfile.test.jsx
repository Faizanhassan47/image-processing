import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PatientProfile from './PatientProfile';
import { patientService } from '../../services/patientService';

vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { username: 'pathologist', role: 'Pathologist' } }) }));
vi.mock('../../services/patientService', () => ({ patientService: {
  profile: vi.fn(), history: vi.fn(), cases: vi.fn(), tests: vi.fn(), reports: vi.fn(), slides: vi.fn(), notes: vi.fn(), documents: vi.fn(), timeline: vi.fn(),
  exportUrl: (id) => `/api/patients/${id}/export`, documentUrl: vi.fn(),
} }));

const profile = {
  patient: { id: 7, display_label: 'Amina Khan', patient_identifier: 'PAT-000007', medical_record_number: 'MRN-7', status: 'Active', first_name: 'Amina', last_name: 'Khan', date_of_birth: '1984-06-12', age: 42, sex: 'Female' },
  summary: { total_cases: 1, total_tests: 2, total_finalized_reports: 1, total_slides: 3 },
  medical_history: { history: { allergies: ['Penicillin'], chronicConditions: [], surgicalHistory: [], medications: [], familyHistory: [] }, revision_number: 1 },
  recent_cases: [], recent_tests: [], recent_reports: [], recent_timeline: [],
};

describe('PatientProfile', () => {
  afterEach(cleanup);
  beforeEach(() => { vi.clearAllMocks(); patientService.profile.mockResolvedValue(profile); patientService.cases.mockResolvedValue({ items: [], total: 0 }); });

  it('renders the persisted patient summary and navigation actions', async () => {
    render(<MemoryRouter initialEntries={['/patients/7']}><Routes><Route path="/patients/:patientId" element={<PatientProfile />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Amina Khan' })).toBeInTheDocument();
    expect(screen.getByText('Penicillin')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Export JSON/ })).toHaveAttribute('href', '/api/patients/7/export');
  });

  it('lazy-loads the selected patient tab', async () => {
    render(<MemoryRouter initialEntries={['/patients/7']}><Routes><Route path="/patients/:patientId" element={<PatientProfile />} /></Routes></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Amina Khan' });
    fireEvent.click(screen.getByRole('button', { name: /Case history/ }));
    expect(await screen.findByText('No linked cases.')).toBeInTheDocument();
    expect(patientService.cases).toHaveBeenCalledWith('7', expect.any(Object), expect.any(AbortSignal));
  });
});
