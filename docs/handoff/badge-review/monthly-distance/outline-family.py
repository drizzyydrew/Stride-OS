"""Extend approved Weekly lettering to the existing Monthly Distance milestones."""
import importlib.util
import json
from pathlib import Path
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('badge_type', ROOT.parent / 'lifetime-running/outline-preview-type.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
approved = json.loads((ROOT.parent / 'weekly-distance/typography.json').read_text())
definitions = json.loads((ROOT / 'definitions.json').read_text())['definitions']
numbers = {}
for definition in definitions:
    label, size, width_scale = definition['label'], 29, approved['number']['horizontalFit']
    number = helper.outline(label, helper.DIDOT, 0, size, 51, lining_digits=True)
    width = (number['bounds'][2] - number['bounds'][0]) * width_scale
    if width > 48:
        size *= 48 / width
        number = helper.outline(label, helper.DIDOT, 0, size, 51, lining_digits=True)
    pen = SVGPathPen(None)
    parse_path(number['path'], TransformPen(pen, (width_scale, 0, 0, 1, 50 * (1 - width_scale) + number['translateX'] * width_scale, 0)))
    number['path'], number['translateX'] = pen.getCommands(), 0
    number['bounds'][0] = 50 + (number['bounds'][0] - 50) * width_scale
    number['bounds'][2] = 50 + (number['bounds'][2] - 50) * width_scale
    number['horizontalFit'] = width_scale
    assert abs((number['bounds'][0] + number['bounds'][2]) / 2 - 50) < 1e-8
    assert number['bounds'][2] - number['bounds'][0] <= 48.000001
    numbers[definition['id']] = number
period = helper.outline('PER MONTH', helper.AVENIR, 5, 6.2, 64, .12)
assert period['bounds'][2] - period['bounds'][0] < 48
(ROOT / 'typography.json').write_text(json.dumps({'numbers': numbers, 'period': period, 'wordmark': approved['wordmark']}, indent=2) + '\n')
print('Outlined seven lining Monthly numerals and PER MONTH; preserved Weekly wordmark geometry.')
