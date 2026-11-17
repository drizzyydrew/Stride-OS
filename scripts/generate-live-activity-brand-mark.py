#!/usr/bin/env python3
"""Extract the approved three-chevron mark for the 28pt Live Activity slot.

The canonical app icon is not changed. Its three flat foreground colors define
its actual ink region; antialiasing is uncomposited against the existing brown
background instead of carrying that background into the transparent export.
No generic arrow paths or replacement logo geometry is drawn.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/images/icon.png'
ASSETS = ROOT / 'targets/StrideRunLiveActivity/Assets.xcassets/StrideOSMark.imageset'
APPROVED_SOURCE_SHA256 = 'ea0a126faaf054008b769b244b3508f2b2f314c34e82d7548ab5da8f57b20aec'
BACKGROUND = (46, 38, 32)
CHEVRON_COLORS = [(139, 146, 124), (220, 192, 167), (94, 126, 146)]
POINT_SIZE = 28
INK_WIDTH_POINTS = 26


def extract_mark():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == APPROVED_SOURCE_SHA256, 'Canonical icon changed; review the new artwork before extracting.'
    source = Image.open(SOURCE).convert('RGBA')
    pixels = source.load()
    solid = [(x, y) for y in range(source.height) for x in range(source.width)
             if pixels[x, y][3] == 255 and pixels[x, y][:3] in CHEVRON_COLORS]
    assert solid, 'Canonical foreground colors not found.'
    # The rounded tile also has antialiased exterior pixels. Restrict recovery to
    # the actual foreground's bounds + a 4px antialias margin, never the tile edge.
    region = (max(0, min(x for x, _ in solid) - 4), max(0, min(y for _, y in solid) - 4),
              min(source.width, max(x for x, _ in solid) + 5), min(source.height, max(y for _, y in solid) + 5))
    mark = Image.new('RGBA', source.size)
    output = mark.load()
    for y in range(region[1], region[3]):
        for x in range(region[0], region[2]):
            pixel = pixels[x, y]
            if pixel[:3] == BACKGROUND or not pixel[3]:
                continue
            candidates = []
            for foreground in CHEVRON_COLORS:
                delta = [foreground[i] - BACKGROUND[i] for i in range(3)]
                alpha = max(0, min(1, sum((pixel[i] - BACKGROUND[i]) * delta[i] for i in range(3)) / sum(value * value for value in delta)))
                error = max(abs(pixel[i] - (BACKGROUND[i] + alpha * delta[i])) for i in range(3))
                candidates.append((error, alpha, foreground))
            error, alpha, foreground = min(candidates, key=lambda candidate: candidate[0])
            assert error <= 1.1, f'Unexpected foreground color at {(x, y)}; extraction needs review.'
            recovered_alpha = round(alpha * pixel[3])
            if recovered_alpha:
                output[x, y] = (*foreground, recovered_alpha)
    bounds = mark.getbbox()
    assert bounds is not None
    return mark.crop(bounds), bounds


def generate(check=False, report=None):
    mark, bounds = extract_mark()
    images = []
    outputs = []
    ASSETS.mkdir(parents=True, exist_ok=True)
    for scale in (1, 2, 3):
        size = POINT_SIZE * scale
        width = INK_WIDTH_POINTS * scale
        height = round(width * mark.height / mark.width)
        canvas = Image.new('RGBA', (size, size))
        ink = mark.resize((width, height), Image.Resampling.LANCZOS)
        canvas.paste(ink, ((size-width)//2, (size-height)//2))
        filename = f'StrideOSMark{("@"+str(scale)+"x") if scale > 1 else ""}.png'
        destination = ASSETS / filename
        if check:
            actual = Image.open(destination).convert('RGBA')
            assert actual.size == canvas.size and actual.tobytes() == canvas.tobytes(), f'Asset drift: {filename}'
        else:
            canvas.save(destination)
        alpha = canvas.getchannel('A')
        assert alpha.getextrema() == (0, 255), f'Missing true alpha: {filename}'
        assert all(canvas.getpixel(point)[3] == 0 for point in [(0,0),(size-1,0),(0,size-1),(size-1,size-1)])
        assert canvas.getpixel((size//2, 0))[3] == 0
        remaining = {(x, y) for y in range(size) for x in range(size) if canvas.getpixel((x,y))[3] >= 64}
        components = []
        while remaining:
            stack = [remaining.pop()]
            count = 0
            while stack:
                x, y = stack.pop()
                count += 1
                for point in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                    if point in remaining:
                        remaining.remove(point)
                        stack.append(point)
            components.append(count)
        assert len(components) == 3, f'Expected exactly three visible chevrons: {filename}'
        assert not any(canvas.getpixel((x,y))[:3] == BACKGROUND and canvas.getpixel((x,y))[3] for y in range(size) for x in range(size)), 'Brown tile pixels remain.'
        images.append({'filename':filename,'idiom':'universal','scale':f'{scale}x'})
        outputs.append({'file':str(destination.relative_to(ROOT)),'pixels':[size,size],'scale':scale,'logicalPoints':[size/scale,size/scale],'visibleBounds':list(alpha.getbbox()),'visibleChevronComponents':len(components),'sha256':hashlib.sha256(destination.read_bytes()).hexdigest()})
    contents = {'images':images,'info':{'author':'xcode','version':1},'properties':{'template-rendering-intent':'original'}}
    catalog = ASSETS / 'Contents.json'
    if check:
        assert json.loads(catalog.read_text()) == contents, 'Asset scale/rendering declaration drift.'
    else:
        catalog.write_text(json.dumps(contents, indent=2)+'\n')
    result = {'source':str(SOURCE.relative_to(ROOT)),'sourceSha256':APPROVED_SOURCE_SHA256,'sourceInkBounds':list(bounds),'sourceInkPixels':[mark.width,mark.height],'pointSize':POINT_SIZE,'inkWidthPoints':INK_WIDTH_POINTS,'canonicalColors':[list(color) for color in CHEVRON_COLORS],'outputs':outputs,'check':check}
    if report:
        Path(report).write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    parser.add_argument('--report')
    args=parser.parse_args()
    generate(args.check,args.report)
