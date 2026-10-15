"""Fit the lifetime distance numerals without changing the approved frame."""

import importlib.util
import json
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path


ROOT = Path(__file__).resolve().parent
BASE = ROOT.parent / 'lifetime-running'
spec = importlib.util.spec_from_file_location('distance_type', BASE / 'outline-preview-type.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
approved = json.loads((BASE / 'typography.json').read_text())
definitions = json.loads((ROOT / 'definitions.json').read_text())


def diamond_extent(value):
    pen = BoundsPen(None)
    x = value['translateX']
    # In the rotated basis, the four diamond edges are axis-aligned. Exact
    # Bezier bounds enforce border clearance without a guessed global x shift.
    parse_path(value['path'], TransformPen(pen, (1, 1, -1, 1, x, x)))
    a, b, c, d = pen.bounds
    return max(abs(a), abs(c), abs(b - 100), abs(d - 100))


def fitted_number(text):
    if text == '1':
        return approved['number']
    size = 30
    while size >= 10:
        value = module.outline(text, module.DIDOT, 0, size, 51, lining_digits=True)
        descent = value['bounds'][3] - 51
        if abs(descent) > 1e-8:
            value = module.outline(text, module.DIDOT, 0, size, 51 - descent, lining_digits=True)
        if value['bounds'][2] - value['bounds'][0] <= 46 and diamond_extent(value) <= 39:
            value['fitDiamondExtent'] = diamond_extent(value)
            return value
        size = round(size - .1, 1)
    raise ValueError(f'Cannot fit numeral: {text}')


numbers = {definition[key] for family in ('running', 'cycling')
           for definition in definitions[family]
           for key in ('imperialNumber', 'metricNumber')}
result = {
    'numbers': {text: fitted_number(text) for text in sorted(numbers)},
    'units': {
        'MI': approved['unit'],
        'KM': module.outline('KM', module.AVENIR, 7, 8, 61, .2),
    },
    'wordmark': approved['wordmark'],
}
for value in [*result['numbers'].values(), *result['units'].values(), result['wordmark']]:
    assert abs((value['bounds'][0] + value['bounds'][2]) / 2 - 50) < 1e-8
assert result['numbers']['1'] == approved['number']
(ROOT / 'typography.json').write_text(json.dumps(result, indent=2) + '\n')
print(f'Outlined and centered {len(numbers)} numerals, MI/KM and the approved wordmark.')
