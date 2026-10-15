"""Outline the first Weekly Distance preview without runtime font fallback."""

import importlib.util
import json
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('badge_type', ROOT.parent / 'lifetime-running/outline-preview-type.py')
typography = importlib.util.module_from_spec(spec)
spec.loader.exec_module(typography)

artwork = {
    'number': typography.outline('5K', typography.DIDOT, 0, 29, 51, lining_digits=True),
    'period': typography.outline('PER WEEK', typography.AVENIR, 5, 6.2, 64, .12),
    'wordmark': typography.outline('STRIDEOS', typography.AVENIR, 5, 3.7, 76, .55),
}
# Match the reference's condensed numeral proportions without reducing its height.
number = artwork['number']
width_scale = .81
pen = SVGPathPen(None)
parse_path(number['path'], TransformPen(pen, (width_scale, 0, 0, 1, 50 * (1 - width_scale) + number['translateX'] * width_scale, 0)))
number['path'] = pen.getCommands()
number['translateX'] = 0
number['bounds'][0] = 50 + (number['bounds'][0] - 50) * width_scale
number['bounds'][2] = 50 + (number['bounds'][2] - 50) * width_scale
number['horizontalFit'] = width_scale
for item in artwork.values():
    assert abs((item['bounds'][0] + item['bounds'][2]) / 2 - 50) < 1e-8
(ROOT / 'typography.json').write_text(json.dumps(artwork, indent=2) + '\n')
print('Outlined 5K / PER WEEK / STRIDEOS with equal visible-ink side margins.')
