"""Outline individually fitted Strength titles, counts and consistency labels."""

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('badge_type', ROOT.parent / 'lifetime-running/outline-preview-type.py')
typography = importlib.util.module_from_spec(spec)
spec.loader.exec_module(typography)
approved = json.loads((ROOT / 'typography.json').read_text())
definitions = json.loads((ROOT / 'definitions.json').read_text())['definitions']
result = {}

def title(text, baseline, size=7):
    value = typography.outline(text, typography.AVENIR, 5, size, baseline, .08)
    width = value['bounds'][2] - value['bounds'][0]
    if width > 58:
        value = typography.outline(text, typography.AVENIR, 5, size * 57.5 / width, baseline, .08)
    return value

for definition in definitions:
    key = definition['id']
    if key == 'first_strength_session':
        result[key] = {'copy': {name: approved[name] for name in ['title1', 'title2']}}
        continue
    if definition['glyph'] == 'sessionDumbbell':
        copy = {
            'count': title(definition['badgeNumber'], 60, 9.6 if len(definition['badgeNumber']) < 3 else 9),
            'unit': title(definition['badgeUnit'], 69.5),
        }
    else:
        copy = {f'title{i + 1}': title(line, 62 + i * 7.5) for i, line in enumerate(definition['titleLines'])}
    value = {'copy': copy}
    if definition['glyph'] == 'consistentWeeks':
        number = typography.outline(definition['badgeNumber'], typography.DIDOT, 0, 13.5, 37, lining_digits=True)
        total = typography.outline('TOTAL', typography.AVENIR, 5, 3, 42.5, .08)
        for label in [number, total]:
            label['translateX'] -= 19
            label['bounds'][0] -= 19
            label['bounds'][2] -= 19
        left = min(25.5, number['bounds'][0], total['bounds'][0])
        value.update({'glyphNumber': number, 'glyphTotal': total, 'glyphOffsetX': 50 - (left + 76.4) / 2})
    result[key] = value
(ROOT / 'family-typography.json').write_text(json.dumps(result, indent=2) + '\n')
print('Outlined copy for ten Strength badges, preserving approved First Session.')
