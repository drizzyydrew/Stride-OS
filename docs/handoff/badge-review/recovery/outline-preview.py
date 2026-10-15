"""Center custom leaf-cycle geometry and outline Recovery title copy."""

import importlib.util
import json
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.svgLib.path import parse_path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('badge_type', ROOT.parent / 'lifetime-running/outline-preview-type.py')
typography = importlib.util.module_from_spec(spec)
spec.loader.exec_module(typography)
definition = json.loads((ROOT / 'definitions.json').read_text())['definitions'][0]
glyph = json.loads((ROOT / 'glyph-data.json').read_text())
bounds = []
for shape in glyph['paths']:
    pen = BoundsPen(None)
    parse_path(shape['d'], pen)
    x0, y0, x1, y1 = pen.bounds
    pad = shape.get('strokeWidth', 0) / 2
    bounds.append([x0 - pad, y0 - pad, x1 + pad, y1 + pad])
left, right = min(value[0] for value in bounds), max(value[2] for value in bounds)
offset = 50 - (left + right) / 2
glyph['translateX'] = offset
glyph['translateY'] = 6
glyph['bounds'] = [left + offset, min(value[1] for value in bounds) + 6, right + offset, max(value[3] for value in bounds) + 6]
artwork = {
    'glyph': glyph,
    'title1': typography.outline(definition['titleLines'][0], typography.AVENIR, 5, 6.9, 71.5, .08),
    'title2': typography.outline(definition['titleLines'][1], typography.AVENIR, 5, 6.9, 79.5, .08),
}
for value in [artwork['title1'], artwork['title2']]:
    width = value['bounds'][2] - value['bounds'][0]
    if width > 61:
        replacement = typography.outline(value['text'], typography.AVENIR, 5, value['size'] * 60.5 / width, value['baseline'], .08)
        value.update(replacement)
for value in artwork.values():
    assert abs((value['bounds'][0] + value['bounds'][2]) / 2 - 50) < 1e-8
(ROOT / 'artwork.json').write_text(json.dumps(artwork, indent=2) + '\n')
print('Centered leaf-cycle glyph and outlined Recovery Week Completed.')
