"""Outline the first Challenges preview using actual centered ink bounds."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('lettering', ROOT.parent / 'lifetime-running/outline-preview-type.py')
lettering = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lettering)
definition = json.loads((ROOT / 'definitions.json').read_text())['definitions'][0]
result = {}
for index, text in enumerate(definition['titleLines']):
    size = 7.2
    value = lettering.outline(text, lettering.AVENIR, 5, size, 67 + index * 9, .08)
    width = value['bounds'][2] - value['bounds'][0]
    if width > 57:
        size *= 57 / width
        value = lettering.outline(text, lettering.AVENIR, 5, size, 67 + index * 9, .08)
    assert abs((value['bounds'][0] + value['bounds'][2]) / 2 - 50) < 1e-8
    assert value['bounds'][2] - value['bounds'][0] < 58
    result[f'title{index + 1}'] = value
(ROOT / 'typography.json').write_text(json.dumps(result, indent=2) + '\n')
print('August and Base Builder lettering centered at x=50, outlined Avenir Next Medium.')
