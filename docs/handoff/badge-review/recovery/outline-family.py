"""Fit Recovery title copy and central glyphs into the accepted vine frame."""

import importlib.util
import json
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.svgLib.path import parse_path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('badge_type', ROOT.parent / 'lifetime-running/outline-preview-type.py')
typography = importlib.util.module_from_spec(spec)
spec.loader.exec_module(typography)
definitions = json.loads((ROOT / 'definitions.json').read_text())['definitions']
approved = json.loads((ROOT / 'artwork.json').read_text())
centers = json.loads((ROOT / 'central-glyphs.json').read_text())
hammock = json.loads((ROOT / 'vine-hammock/glyph-data.json').read_text())['hammock']
result = {}

def shape_bounds(shape):
    pad = shape.get('width', 0) / 2
    if shape['kind'] == 'path':
        pen = BoundsPen(None)
        parse_path(shape['d'], pen)
        x0, y0, x1, y1 = pen.bounds
    else:
        rx, ry = shape.get('rx', shape.get('r')), shape.get('ry', shape.get('r'))
        x0, y0, x1, y1 = shape['cx'] - rx, shape['cy'] - ry, shape['cx'] + rx, shape['cy'] + ry
    return [x0 - pad, y0 - pad, x1 + pad, y1 + pad]

for definition in definitions:
    key = definition['id']
    if key == 'recovery_week_completed':
        result[key] = {'copy': {name: approved[name] for name in ['title1', 'title2']}}
        continue
    copy = {}
    lines = definition['titleLines']
    for index, text in enumerate(lines):
        baseline = 75.5 if len(lines) == 1 else 71.5 + index * 8
        value = typography.outline(text, typography.AVENIR, 5, 6.9, baseline, .08)
        width = value['bounds'][2] - value['bounds'][0]
        max_width = 50 if len(lines) == 2 and index == 1 else 61
        if width > max_width:
            value = typography.outline(text, typography.AVENIR, 5, 6.9 * (max_width - .5) / width, baseline, .08)
        assert value['bounds'][2] - value['bounds'][0] <= max_width
        copy[f'title{index + 1}'] = value
    glyph = centers[key]
    bounds = [shape_bounds(shape) for shape in glyph['shapes']]
    if glyph.get('reuseHammock'):
        bounds.extend(shape_bounds({'kind': 'path', 'd': path, 'width': 1}) for path in hammock.values())
    left, right = min(value[0] for value in bounds), max(value[2] for value in bounds)
    offset = 50 - (left + right) / 2
    result[key] = {
        'copy': copy,
        'centerOffsetX': offset,
        'centerBounds': [left + offset, min(value[1] for value in bounds), right + offset, max(value[3] for value in bounds)],
    }
(ROOT / 'family-typography.json').write_text(json.dumps(result, indent=2) + '\n')
print('Fitted seven Recovery titles and six new center glyphs, preserving the approved Week.')
