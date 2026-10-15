"""Outline the source-defined First Strength Session title and wordmark."""

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('badge_type', ROOT.parent / 'lifetime-running/outline-preview-type.py')
typography = importlib.util.module_from_spec(spec)
spec.loader.exec_module(typography)
definition = json.loads((ROOT / 'definitions.json').read_text())['definitions'][0]
artwork = {
    'title1': typography.outline(definition['titleLines'][0], typography.AVENIR, 5, 7.0, 62, .08),
    'title2': typography.outline(definition['titleLines'][1], typography.AVENIR, 5, 7.0, 69.5, .08),
    'wordmark': typography.outline('STRIDEOS', typography.AVENIR, 5, 3.4, 78.5, .6),
}
for value in artwork.values():
    assert abs((value['bounds'][0] + value['bounds'][2]) / 2 - 50) < 1e-8
    assert value['bounds'][2] - value['bounds'][0] < 61
(ROOT / 'typography.json').write_text(json.dumps(artwork, indent=2) + '\n')
print('Outlined First Strength Session with equal visible-ink side margins.')
