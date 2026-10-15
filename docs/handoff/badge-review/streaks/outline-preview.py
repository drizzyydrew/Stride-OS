"""Outline the reference's three-day streak lettering and bound its flame."""

import importlib.util
import json
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.svgLib.path import parse_path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('badge_type', ROOT.parent / 'lifetime-running/outline-preview-type.py')
type_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(type_module)

flame_path = (
    'M43.8 50.2 C38.2 47.6 35.5 43.7 37.3 37.6 '
    'C38 34.4 40.7 31.1 41.7 27.4 C42.7 29.4 43.4 32 43.7 33.5 '
    'C48.1 29 46.2 24.3 51.3 20.7 C48.9 26.7 55 30.4 55 35 '
    'C57.3 33.7 58.1 31.3 58.9 28 C62.3 33.5 65 39.5 62.6 44.7 '
    'C61.1 47.5 59 49 55.7 50.2 C58.3 46.9 58.2 44 55.9 41 '
    'L55.5 43 C53 41.1 52.6 37.6 50.4 35.4 '
    'C49.4 39.1 47.5 41.1 45.4 42.7 L44.8 40.6 '
    'C41.8 43.1 41 46.9 43.8 50.2 Z'
)
pen = BoundsPen(None)
parse_path(flame_path, pen)
left, top, right, bottom = pen.bounds
scale = .92
x = 50 - (left + right) / 2 * scale
y = 20.5 - top * scale
result = {
    'flame': {
        'path': flame_path,
        'transform': f'translate({x} {y}) scale({scale})',
        'bounds': [left * scale + x, top * scale + y, right * scale + x, bottom * scale + y],
        'construction': 'custom three-tongue filled silhouette with open negative-space center',
    },
    'number': type_module.outline('3', type_module.DIDOT, 0, 17.8, 64.5, lining_digits=True),
    'title': type_module.outline('DAY STREAK', type_module.AVENIR, 5, 5.4, 71.8, .1),
    'wordmark': type_module.outline('STRIDEOS', type_module.AVENIR, 5, 3, 80.3, .65),
}
for value in result.values():
    assert abs((value['bounds'][0] + value['bounds'][2]) / 2 - 50) < 1e-8
(ROOT / 'artwork.json').write_text(json.dumps(result, indent=2) + '\n')
print('Outlined 3 / DAY STREAK / STRIDEOS and centered the custom flame.')
