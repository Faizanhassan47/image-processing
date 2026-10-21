import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AIFeatures from '../modules/ai/AIFeatures';

vi.mock('../modules/auth/AuthProvider', () => ({ useAuth: () => ({ user: { username: 'regular_admin', role: 'System Administrator' } }) }));

vi.mock('../services/aiSubscriptionService', () => ({
  aiSubscriptionService: { entitlements: vi.fn().mockResolvedValue({
    subscription: { status: 'Active' },
    effective_feature_codes: ['HOVERNET'],
    features: [
      { id: 1, feature_code: 'HOVERNET', feature_name: 'HoVer-Net', description: 'Nuclei analysis', catalog_title: 'HoVer-Net', catalog_session_price_usd: 10, catalog_session_price_pkr: 2800, is_implemented: true, is_active: true, is_entitled: true, user_enabled: true },
      { id: 2, feature_code: 'IMAGE_QC', feature_name: 'Image Quality Control', description: 'Image quality', catalog_title: 'Image Quality Control', catalog_session_price_usd: 8, catalog_session_price_pkr: 2240, is_implemented: false, is_active: true, is_entitled: false },
      { id: 3, feature_code: 'TUMOR_DETECTION', feature_name: 'Tumor Detection', description: 'Tumor regions', catalog_title: 'Tumor Detection', catalog_session_price_usd: 12, catalog_session_price_pkr: 3360, is_implemented: false, is_active: true, is_entitled: false },
      { id: 4, feature_code: 'TISSUE_SEGMENTATION', feature_name: 'Tissue Segmentation', description: 'Tissue regions', catalog_title: 'Tissue Segmentation', catalog_session_price_usd: 15, catalog_session_price_pkr: 4200, is_implemented: false, is_active: true, is_entitled: false },
    ],
  }), setFeatureActive: vi.fn(), setMyFeaturePreference: vi.fn().mockResolvedValue({ subscription: { status: 'Active' }, effective_feature_codes: [], features: [] }) },
}));

describe('AI Features catalog', () => {
  it('renders the AI model store with clear model purpose and access state', async () => {
    render(<MemoryRouter><AIFeatures /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'AI Model Store' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'HoVer-Net' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Image Quality Control' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tumor Detection' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tissue Segmentation' })).toBeInTheDocument();
    expect(screen.getAllByText('Available to you').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Coming soon').filter((node) => node.classList.contains('ai-model-state'))).toHaveLength(3);
    expect(screen.getAllByText('Clinical purpose')).toHaveLength(4);
    expect(screen.getAllByText('Clinical value')).toHaveLength(4);
    expect(screen.getByText('USD 10.00')).toBeInTheDocument();
    expect(screen.getByText('PKR 2,800')).toBeInTheDocument();
    expect(screen.getByText(/support, not replace, professional diagnosis/i)).toBeInTheDocument();
  });

  it('lets an entitled user opt out of a feature without changing the license', async () => {
    const { aiSubscriptionService } = await import('../services/aiSubscriptionService');
    render(<MemoryRouter><AIFeatures /></MemoryRouter>);
    const preference = await screen.findByRole('checkbox', { name: /use in workspace/i });
    expect(preference).toBeChecked();
    fireEvent.click(preference);
    await waitFor(() => expect(aiSubscriptionService.setMyFeaturePreference).toHaveBeenCalledWith(1, false));
  });
});
