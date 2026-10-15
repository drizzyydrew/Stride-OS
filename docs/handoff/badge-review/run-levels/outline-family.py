"""Fit each existing Run Level title without changing the approved Foundation."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('preview_type', ROOT.parent / 'lifetime-running/outline-preview-type.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
definitions = json.loads((ROOT / 'definitions.json').read_text())['definitions']
approved = json.loads((ROOT / 'typography.json').read_text())
font = Path('/System/Library/Fonts/Avenir Next Condensed.ttc')
result = {}
for definition in definitions:
    if definition['slug'] == 'foundation':
        result[definition['id']] = approved['title']
        continue
    size = 9.8
    value = helper.outline(definition['titleUpper'], font, 2, size, 67.5, .08)
    width = value['bounds'][2] - value['bounds'][0]
    if width > 58:
        value = helper.outline(definition['titleUpper'], font, 2, size * 57.5 / width, 67.5, .08)
    assert abs((value['bounds'][0] + value['bounds'][2]) / 2 - 50) < 1e-8
    result[definition['id']] = value
(ROOT / 'family-typography.json').write_text(json.dumps(result, indent=2) + '\n')
print('Outlined seven centered Run Level titles; Foundation path is unchanged.')
