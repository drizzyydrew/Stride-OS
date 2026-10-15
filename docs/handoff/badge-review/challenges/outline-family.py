"""Fit canonical Challenges titles and distance numerals as centered paths."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('type_helper', ROOT.parent / 'lifetime-running/outline-preview-type.py')
typography = importlib.util.module_from_spec(spec)
spec.loader.exec_module(typography)
definitions = json.loads((ROOT / 'definitions.json').read_text())['presentations']
approved = json.loads((ROOT / 'typography.json').read_text())

def label(text, baseline, size=7.2, max_width=57, serif=False):
    font, face = (typography.DIDOT, 0) if serif else (typography.AVENIR, 5)
    value = typography.outline(text, font, face, size, baseline, 0 if serif else .08, lining_digits=serif)
    width = value['bounds'][2] - value['bounds'][0]
    if width > max_width:
        value = typography.outline(text, font, face, size * (max_width - .4) / width, baseline, 0 if serif else .08, lining_digits=serif)
    assert abs((value['bounds'][0] + value['bounds'][2]) / 2 - 50) < 1e-8
    assert value['bounds'][2] - value['bounds'][0] <= max_width
    return value

result = {}
three_lines = {
    'challenge_september_consistency': ['SEPTEMBER', 'CONSISTENCY', 'CHALLENGE'],
    'challenge_winter_strength_block': ['WINTER', 'STRENGTH', 'BLOCK'],
    'challenge_spring_mileage_build': ['SPRING', 'MILEAGE', 'BUILD'],
    'challenge_summer_long_run': ['SUMMER', 'LONG RUN', 'CHALLENGE'],
    'recovery_check_in_streak': ['RECOVERY', 'CONSISTENCY', 'CHALLENGE'],
}
for definition in definitions:
    key = definition['id']
    if key == 'challenge_august_base_builder':
        result[key] = {'copy': approved}
    elif definition['glyph'] == 'numericBadge':
        result[key] = {
            'number': label(definition['badgeNumber'], 51, 30, 52, serif=True),
            'copy': {'distance': label(definition['badgeNumber'], 66, 7.2), 'period': label(definition['badgeUnit'], 75, 7.2)},
        }
    else:
        lines = three_lines.get(key, definition['titleLines'])
        baselines = [62.5, 70.5, 78.5] if len(lines) == 3 else [67, 76]
        result[key] = {'copy': {f'title{i + 1}': label(line, baselines[i], max_width=50 if len(lines) == 3 and i == 2 else 57) for i, line in enumerate(lines)}}
(ROOT / 'family-typography.json').write_text(json.dumps(result, indent=2) + '\n')
print(f'Outlined {len(definitions)} Challenges presentations; approved August lettering preserved.')
