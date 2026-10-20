import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { viewerService } from './viewerService';

describe('viewerService.downloadAiReportPdf', () => {
  let originalFetch;
  let originalCreateObjectURL;
  let originalRevokeObjectURL;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalCreateObjectURL = window.URL.createObjectURL;
    originalRevokeObjectURL = window.URL.revokeObjectURL;

    window.URL.createObjectURL = vi.fn(() => 'blob:http://localhost:5173/mock-uuid');
    window.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('downloads PDF as a binary blob with credentials: include and extracts filename', async () => {
    const mockBlob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
    const mockHeaders = new Headers({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="ai_report_case_demo_analysis_27.pdf"',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: mockHeaders,
      blob: vi.fn().mockResolvedValue(mockBlob),
    });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await viewerService.downloadAiReportPdf(27);

    // Verify fetch was called with credentials: 'include'
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/ai/analyses/27/report.pdf'),
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
      })
    );

    expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('throws descriptive error and dispatches auth:unauthorized on 401 response', async () => {
    const unauthorizedListener = vi.fn();
    window.addEventListener('auth:unauthorized', unauthorizedListener);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: vi.fn().mockResolvedValue({ detail: 'Invalid or expired authentication token' }),
    });

    await expect(viewerService.downloadAiReportPdf(27)).rejects.toThrow(
      'Invalid or expired authentication token'
    );

    expect(unauthorizedListener).toHaveBeenCalled();
    window.removeEventListener('auth:unauthorized', unauthorizedListener);
  });

  it('throws descriptive error on 404 analysis not found', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: vi.fn().mockResolvedValue({ detail: 'AI analysis #999 not found' }),
    });

    await expect(viewerService.downloadAiReportPdf(999)).rejects.toThrow(
      'AI analysis #999 not found'
    );
  });
});
