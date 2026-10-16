const MICRONS_PER_MM = 1000;
const MICRONS_PER_CM = 10000;
const MICRONS_PER_INCH = 25400;

function formatNumber(value, maximumFractionDigits = 3) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

function lengthUnits(microns) {
  return {
    mm: microns / MICRONS_PER_MM,
    cm: microns / MICRONS_PER_CM,
    inches: microns / MICRONS_PER_INCH,
  };
}

function formatLength(microns) {
  const units = lengthUnits(microns);
  return `${formatNumber(units.mm)} mm · ${formatNumber(units.cm)} cm · ${formatNumber(units.inches, 4)} in`;
}

function segmentLength([x1, y1], [x2, y2], micronX, micronY) {
  return Math.hypot((x2 - x1) * micronX, (y2 - y1) * micronY);
}

function pathLength(points, micronX, micronY, closed = false) {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) total += segmentLength(points[index - 1], points[index], micronX, micronY);
  if (closed) total += segmentLength(points[points.length - 1], points[0], micronX, micronY);
  return total;
}

function polygonArea(points, micronX, micronY) {
  if (!points || points.length < 3) return 0;
  const twiceArea = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + ((point[0] * micronX) * (next[1] * micronY)) - ((next[0] * micronX) * (point[1] * micronY));
  }, 0);
  return Math.abs(twiceArea) / 2;
}

function formatArea(squareMicrons) {
  return `${formatNumber(squareMicrons / 1_000_000)} mm² · ${formatNumber(squareMicrons / 100_000_000, 4)} cm² · ${formatNumber(squareMicrons / (MICRONS_PER_INCH ** 2), 5)} in²`;
}

export function getAnnotationMeasurements(annotation, calibration) {
  if (!annotation) return [];
  if (!calibration?.available) return [{ label: 'Physical size', value: 'Unavailable — slide calibration is missing' }];

  const micronX = Number(calibration.pixel_size_microns_x);
  const micronY = Number(calibration.pixel_size_microns_y || calibration.pixel_size_microns_x);
  if (!(micronX > 0) || !(micronY > 0)) return [{ label: 'Physical size', value: 'Unavailable — slide calibration is invalid' }];

  const type = annotation.annotation_type || annotation.type?.toLowerCase();
  if (type === 'rectangle' || type === 'ellipse') {
    const widthMicrons = Number(annotation.width) * micronX;
    const heightMicrons = Number(annotation.height) * micronY;
    const area = type === 'ellipse'
      ? Math.PI * (widthMicrons / 2) * (heightMicrons / 2)
      : widthMicrons * heightMicrons;
    return [
      { label: type === 'ellipse' ? 'Diameters' : 'Dimensions', value: `${formatLength(widthMicrons)} × ${formatLength(heightMicrons)}` },
      { label: 'Area', value: formatArea(area) },
    ];
  }

  if (['line', 'arrow', 'freehand'].includes(type)) {
    return [{ label: 'Length', value: formatLength(pathLength(annotation.points, micronX, micronY)) }];
  }

  if (type === 'polygon') {
    return [
      { label: 'Perimeter', value: formatLength(pathLength(annotation.points, micronX, micronY, true)) },
      { label: 'Area', value: formatArea(polygonArea(annotation.points, micronX, micronY)) },
    ];
  }

  return [{ label: 'Physical size', value: 'Not applicable to a point annotation' }];
}

function valueForUnit(value, unit) {
  const dimensions = value.split(' × ');
  const unitPattern = new RegExp(`(?:^| · )([^·]+ ${unit.replace('²', '\\²')})(?: · |$)`);
  const matches = dimensions.map((dimension) => dimension.match(unitPattern)?.[1]?.trim()).filter(Boolean);
  return matches.length ? matches.join(' × ') : null;
}

export function getAnnotationHoverMeasurements(annotation, calibration) {
  return getAnnotationMeasurements(annotation, calibration).map(({ label, value }) => {
    if (value.startsWith('Unavailable') || value.startsWith('Not applicable')) return { label, metric: value, imperial: null };
    return {
      label,
      metric: valueForUnit(value, label === 'Area' ? 'cm²' : 'cm'),
      imperial: valueForUnit(value, label === 'Area' ? 'in²' : 'in'),
    };
  });
}
