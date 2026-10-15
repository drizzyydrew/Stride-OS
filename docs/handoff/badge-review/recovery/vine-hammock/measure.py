"""Bound the mirrored vine wreath without changing any approved artwork."""

import json
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.svgLib.path import parse_path

ROOT = Path(__file__).resolve().parent
glyph = json.loads((ROOT / 'glyph-data.json').read_text())

def bounds(path, padding=0):
    pen = BoundsPen(None)
    parse_path(path, pen)
    x0, y0, x1, y1 = pen.bounds
    return [x0 - padding, y0 - padding, x1 + padding, y1 + padding]

left_bounds = [bounds(glyph['stem'], .425), bounds(glyph['veins'], .225)]
left_bounds.extend(bounds(leaf) for leaf in glyph['leaves'])
all_bounds = left_bounds + [[100 - x1, y0, 100 - x0, y1] for x0, y0, x1, y1 in left_bounds]
all_bounds.extend(bounds(value, .5) for value in glyph['hammock'].values())
result = [min(value[0] for value in all_bounds), min(value[1] for value in all_bounds), max(value[2] for value in all_bounds), max(value[3] for value in all_bounds)]
assert abs((result[0] + result[2]) / 2 - 50) < 1e-8
(ROOT / 'bounds.json').write_text(json.dumps({'bounds': result, 'construction': 'mirrored vines around a central hammock'}, indent=2) + '\n')
print('Vine/hammock geometry is centered at x=50.')
