"""Center outlined Foundation lettering without runtime font substitution."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('preview_type', ROOT.parent / 'lifetime-running/outline-preview-type.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
definition = json.loads((ROOT / 'definitions.json').read_text())['definitions'][0]
title = helper.outline(definition['titleUpper'], Path('/System/Library/Fonts/Avenir Next Condensed.ttc'), 2, 9.8, 67.5, .08)
width = title['bounds'][2] - title['bounds'][0]
if width > 58:
    title = helper.outline(definition['titleUpper'], Path('/System/Library/Fonts/Avenir Next Condensed.ttc'), 2, 9.8 * 57.5 / width, 67.5, .08)
wordmark = helper.outline('STRIDEOS', helper.AVENIR, 5, 3.3, 76, .65)
for value in [title, wordmark]:
    assert abs((value['bounds'][0] + value['bounds'][2]) / 2 - 50) < 1e-8
(ROOT / 'typography.json').write_text(json.dumps({'title': title, 'wordmark': wordmark}, indent=2) + '\n')
print('Outlined centered condensed Foundation title and tracked StrideOS wordmark.')
