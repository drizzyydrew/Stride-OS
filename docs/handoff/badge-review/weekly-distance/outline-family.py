"""Fit each Weekly Distance numeral within the approved 5K typography system."""

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
approved = json.loads((ROOT / 'typography.json').read_text())
definitions = json.loads((ROOT / 'definitions.json').read_text())['definitions']
numbers = {}
for definition in definitions:
    label = definition['label']
    if label == '5K':
        numbers[label] = approved['number']
        continue
    size = 29
    number = typography.outline(label, typography.DIDOT, 0, size, 51, lining_digits=True)
    # Keep the approved condensed serif treatment; fit longer labels without
    # adding extra horizontal compression or letting their ink approach the frame.
    width_scale = approved['number']['horizontalFit']
    fitted_width = (number['bounds'][2] - number['bounds'][0]) * width_scale
    if fitted_width > 48:
        size *= 48 / fitted_width
        number = typography.outline(label, typography.DIDOT, 0, size, 51, lining_digits=True)
    pen = SVGPathPen(None)
    parse_path(number['path'], TransformPen(pen, (width_scale, 0, 0, 1, 50 * (1 - width_scale) + number['translateX'] * width_scale, 0)))
    number['path'] = pen.getCommands()
    number['translateX'] = 0
    number['bounds'][0] = 50 + (number['bounds'][0] - 50) * width_scale
    number['bounds'][2] = 50 + (number['bounds'][2] - 50) * width_scale
    number['horizontalFit'] = width_scale
    assert abs((number['bounds'][0] + number['bounds'][2]) / 2 - 50) < 1e-8
    assert number['bounds'][2] - number['bounds'][0] <= 48.000001
    numbers[label] = number
(ROOT / 'family-typography.json').write_text(json.dumps({'numbers': numbers}, indent=2) + '\n')
print('Outlined all eight Weekly Distance numerals, preserving approved 5K paths.')
