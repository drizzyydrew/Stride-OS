"""Generate centered vector lettering for the one-mile review badge."""

import hashlib
import json
from functools import cache
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parent
DIDOT = Path('/System/Library/Fonts/Supplemental/Didot.ttc')
AVENIR = Path('/System/Library/Fonts/Avenir Next.ttc')


@cache
def font_face(font_path, font_index):
    return TTFont(font_path, fontNumber=font_index)


def outline(text, font_path, font_index, size, baseline, tracking=0, lining_digits=False):
    font = font_face(font_path, font_index)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    # Didot's Unicode cmap selects oldstyle digits; its Mac Roman cmap contains
    # the tall lining numerals in the approved reference, including the wedge 1.
    if lining_digits:
        cmap = font['cmap'].getcmap(1, 0).cmap
    scale = size / font['head'].unitsPerEm
    pen = SVGPathPen(glyphs)
    bounds = BoundsPen(glyphs)
    cursor = 0
    for character in text:
        name = cmap[ord(character)]
        transform = (scale, 0, 0, -scale, cursor, baseline)
        glyphs[name].draw(TransformPen(pen, transform))
        glyphs[name].draw(TransformPen(bounds, transform))
        cursor += glyphs[name].width * scale + tracking
    x0, y0, x1, y1 = bounds.bounds
    offset = 50 - (x0 + x1) / 2
    return {
        'text': text,
        'path': pen.getCommands(),
        'translateX': offset,
        'bounds': [x0 + offset, y0, x1 + offset, y1],
        'font': font['name'].getDebugName(6),
        'fontHash': hashlib.sha256(font_path.read_bytes()).hexdigest(),
        'size': size,
        'baseline': baseline,
        'tracking': tracking,
        'liningDigits': lining_digits,
    }


def main():
    result = {
        'number': outline('1', DIDOT, 0, 30, 51, lining_digits=True),
        'unit': outline('MI', AVENIR, 7, 8, 61, .2),
        'wordmark': outline('STRIDEOS', AVENIR, 5, 3.4, 71, .85),
    }
    for label in result.values():
        assert abs((label['bounds'][0] + label['bounds'][2]) / 2 - 50) < 1e-8
    (ROOT / 'typography.json').write_text(json.dumps(result, indent=2) + '\n')
    print('Outlined 1 / MI / STRIDEOS; all visible ink bounds centered at x=50.')


if __name__ == '__main__':
    main()
