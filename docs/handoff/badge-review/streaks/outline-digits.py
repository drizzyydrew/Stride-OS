"""Export lining numeral glyphs for arbitrary daily streak counts."""

import json
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent
font = TTFont('/System/Library/Fonts/Supplemental/Didot.ttc', fontNumber=0)
glyphs = font.getGlyphSet()
cmap = font['cmap'].getcmap(1, 0).cmap
digits = {}
for character in '0123456789':
    glyph = glyphs[cmap[ord(character)]]
    path = SVGPathPen(glyphs)
    bounds = BoundsPen(glyphs)
    glyph.draw(path)
    glyph.draw(bounds)
    digits[character] = {'path': path.getCommands(), 'bounds': bounds.bounds, 'advance': glyph.width}
result = {'unitsPerEm': font['head'].unitsPerEm, 'digits': digits}
(ROOT / 'digits.json').write_text(json.dumps(result, indent=2) + '\n')
print('Exported ten lining digit glyphs for dynamic daily streak numbers.')
