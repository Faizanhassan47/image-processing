import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PatientDirectory from './PatientDirectory';
import { patientService } from '../../services/patientService';

vi.mock('../../services/patientService', () => ({ patientService: {
  list: vi.fn(), duplicates: vi.fn(), create: vi.fn(), importPreview: vi.fn(),
} }));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { role: 'Laboratory Manager' } }) }));

describe('PatientDirectory', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    patientService.list.mockResolvedValue({ items: [{ id: 12, display_label: 'Amina Khan', patient_identifier: 'PAT-000012', medical_record_number: 'MRN-12', date_of_birth: '1984-06-12', age: 42, sex: 'Female', status: 'Active', total_cases: 2 }], total: 1 });
    patientService.duplicates.mockResolvedValue([]);
    patientService.create.mockResolvedValue({ id: 13 });
  });

  it('renders patient search results and profile navigation', async () => {
    render(<MemoryRouter><PatientDirectory /></MemoryRouter>);
    expect(await screen.findByText('Amina Khan')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open profile' })).toHaveAttribute('href', '/patients/12');
    fireEvent.change(screen.getByPlaceholderText(/Patient ID/), { target: { value: 'MRN-12' } });
    await waitFor(() => expect(patientService.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'MRN-12' }), expect.any(AbortSignal)));
  });

  it('validates duplicate candidates before registration', async () => {
    patientService.duplicates.mockResolvedValue([{ id: 12, patient_identifier: 'PAT-000012', display_label: 'Amina Khan' }]);
    render(<MemoryRouter><PatientDirectory /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Register patient' }));
    fireEvent.change(screen.getByLabelText('First name *'), { target: { value: 'Amina' } });
    fireEvent.change(screen.getByLabelText('Last name *'), { target: { value: 'Khan' } });
    fireEvent.change(screen.getByLabelText('CNIC *'), { target: { value: '3520112345671' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Register patient' }).at(-1));
    expect(await screen.findByText('Possible duplicate found')).toBeInTheDocument();
    expect(patientService.create).not.toHaveBeenCalled();
  });
});
