import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AiAnalysisPanel from '../components/WsiViewer/AiAnalysisPanel';

vi.mock('../services/aiSubscriptionService', () => ({
  aiSubscriptionService: { entitlements: vi.fn() },
}));

vi.mock('../services/viewerService', () => ({
  viewerService: { getAiAnalyses: vi.fn().mockResolvedValue([]) },
}));

describe('AiAnalysisPanel access states', () => {
  let aiSubscriptionService;

  beforeEach(async () => {
    ({ aiSubscriptionService } = await import('../services/aiSubscriptionService'));
    vi.clearAllMocks();
  });

  it('shows the permitted feature description', async () => {
    aiSubscriptionService.entitlements.mockResolvedValue({
      effective_feature_codes: ['HOVERNET'],
      features: [{
        id: 1,
        feature_code: 'HOVERNET',
        feature_name: 'HoVer-Net',
        description: 'Nuclei detection and classification.',
        is_entitled: true,
        is_active: true,
        is_implemented: true,
        user_enabled: true,
      }],
    });

    render(<AiAnalysisPanel slide={{ id: 1 }} />);
    expect(await screen.findByLabelText('Select permitted AI feature')).toBeInTheDocument();
    expect(screen.getByText('Nuclei detection and classification.')).toBeInTheDocument();
  });

  it('explains when the user has no permitted feature', async () => {
    aiSubscriptionService.entitlements.mockResolvedValue({
      effective_feature_codes: [],
      features: [{
        id: 1,
        feature_code: 'HOVERNET',
        is_entitled: false,
        is_active: true,
        is_implemented: true,
        user_enabled: true,
      }],
    });

    render(<AiAnalysisPanel slide={{ id: 1 }} />);
    expect(await screen.findByText(/no ai features are available/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Why unavailable?' })).toBeInTheDocument();
  });
});
