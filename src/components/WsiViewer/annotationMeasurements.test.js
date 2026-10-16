import { describe, expect, it } from 'vitest';

import { getAnnotationHoverMeasurements, getAnnotationMeasurements } from './annotationMeasurements';

const calibration = { available: true, pixel_size_microns_x: 10, pixel_size_microns_y: 20 };

describe('annotation physical measurements', () => {
  it('calculates rectangle dimensions using independent x and y calibration', () => {
    const measurements = getAnnotationMeasurements({ annotation_type: 'rectangle', width: 100, height: 50 }, calibration);
    expect(measurements[0].value).toContain('1 mm');
    expect(measurements[0].value).toContain('0.0394 in');
    expect(measurements[1].value).toContain('1 mm²');
  });

  it('calculates calibrated line length', () => {
    const measurements = getAnnotationMeasurements({ annotation_type: 'line', points: [[0, 0], [3000, 2000]] }, { available: true, pixel_size_microns_x: 10, pixel_size_microns_y: 10 });
    expect(measurements[0].label).toBe('Length');
    expect(measurements[0].value).toContain('36.056 mm');
  });

  it('does not invent physical measurements without calibration', () => {
    expect(getAnnotationMeasurements({ annotation_type: 'ellipse', width: 10, height: 10 }, { available: false })[0].value).toContain('Unavailable');
  });

  it('provides centimetre and inch values for the hover tooltip', () => {
    const measurements = getAnnotationHoverMeasurements({ annotation_type: 'ellipse', width: 100, height: 50 }, calibration);
    expect(measurements[0].metric).toBe('0.1 cm × 0.1 cm');
    expect(measurements[0].imperial).toBe('0.0394 in × 0.0394 in');
  });

  it('measures AI geometry that uses a generic type field', () => {
    const measurements = getAnnotationMeasurements({ type: 'ellipse', width: 100, height: 50 }, calibration);
    expect(measurements[0].label).toBe('Diameters');
    expect(measurements[1].label).toBe('Area');
  });
});
