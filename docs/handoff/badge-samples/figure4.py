import os, re, math
S=os.environ['S']

def tapered(points):
    """Closed polygon around a polyline whose width varies per point."""
    left=[]; right=[]
    n=len(points)
    for i,(x,y,w) in enumerate(points):
        if i==0: dx,dy=points[1][0]-x, points[1][1]-y
        elif i==n-1: dx,dy=x-points[i-1][0], y-points[i-1][1]
        else:
            ax,ay=x-points[i-1][0], y-points[i-1][1]; bx,by=points[i+1][0]-x, points[i+1][1]-y
            la=math.hypot(ax,ay); lb=math.hypot(bx,by); dx,dy=ax/la+bx/lb, ay/la+by/lb
        l=math.hypot(dx,dy); nx,ny=-dy/l, dx/l
        scale=1.0
        if 0<i<n-1:
            ax,ay=x-points[i-1][0], y-points[i-1][1]; la=math.hypot(ax,ay)
            cos_half=abs((-ay/la)*nx+(ax/la)*ny)
            scale=1/max(cos_half,0.55)
        hw=w/2*scale
        left.append((x+nx*hw, y+ny*hw)); right.append((x-nx*hw, y-ny*hw))
    pts=left+right[::-1]
    return 'M'+' L'.join(f'{a:.2f} {b:.2f}' for a,b in pts)+' Z'

def poly(pts): return 'M'+' L'.join(f'{a:.2f} {b:.2f}' for a,b in pts)+' Z'

parts = {
  # torso's lower edge tucks into the thighs so waist -> hip reads as one line
  'torso': poly([(51.6,24.6),(53.0,23.5),(55.4,23.2),(57.4,24.0),(57.6,25.4),(54.2,32.8),(51.2,34.0),(49.0,33.0)]),
  'armFront': tapered([(56.2,25.4,2.6),(61.2,30.4,2.2),(66.4,27.4,1.8)]),
  'armBack': tapered([(53.6,25.2,2.6),(47.2,26.6,2.2),(43.2,30.8,1.8)]),
  # legs start inside the torso and continue straight into the feet
  'legFront': tapered([(52.9,31.6,4.2),(58.4,38.0,2.8),(56.6,45.9,2.0),(59.9,47.5,1.9),(61.8,47.7,1.4)]),
  'legBack': tapered([(50.4,31.9,4.2),(45.4,41.6,2.8),(40.0,45.4,2.0),(39.0,48.9,1.5)]),
}
# solid shoes = the foot segment of each leg, widened by the outline band so
# the fill meets the leg outline with no seam
shoes = [
  tapered([(56.6,45.9,2.0+2*0.95),(59.9,47.5,1.9+2*0.95),(61.8,47.7,1.4+2*0.95)]),
  tapered([(40.0,45.4,2.0+2*0.95),(39.0,48.9,1.5+2*0.95)]),
]
head = (57.9, 18.4, 3.2)

parts_ts = ',\n          '.join(f"'{d}'" for d in parts.values())
shoes_ts = ' '.join(shoes)
case = f"""    case 'run':
      return `<g stroke="${{tokens.primary}}" stroke-width="1.05" stroke-linecap="round" fill="none">
          <path d="M22.5 27.2 H38.6" stroke-opacity="${{tokens.glyphOpacity * 0.95}}"/>
          <path d="M18.4 31.2 H37.2" stroke-opacity="${{tokens.glyphOpacity * 0.85}}"/>
          <path d="M20.6 35.2 H36.8" stroke-opacity="${{tokens.glyphOpacity * 0.75}}"/>
          <path d="M24.2 39.2 H37.8" stroke-opacity="${{tokens.glyphOpacity * 0.6}}"/>
          <path d="M28.8 43.2 H38.4" stroke-opacity="${{tokens.glyphOpacity * 0.45}}"/>
        </g>
        <g transform="translate(51.5 34) scale(1.14) translate(-51.5 -34)">
        ${{outlinedShapes(`run-${{tokens.primary.slice(1)}}-${{tokens.fillOpacity}}`, [
          {parts_ts},
        ], {{ cx: {head[0]}, cy: {head[1]}, r: {head[2]} }}, '{shoes_ts}', tokens)}}
        </g>`;"""

helper = r'''
// Outlined silhouette from real body-part shapes (tapered limbs, stout torso):
// shapes are filled + expanded by `line` in white, then the original shapes
// are knocked out in black, leaving one clean outline of their union. Shoes
// are solid. The head floats above the shoulders (no neck).
function outlinedShapes(id: string, shapes: string[], head: { cx: number; cy: number; r: number }, shoes: string, tokens: FirstsRenderTokens, line = 0.95): string {
  const outer = shapes.map(d => `<path d="${d}" fill="#fff" stroke="#fff" stroke-width="${line * 2}" stroke-linejoin="round"/>`).join('');
  const inner = shapes.map(d => `<path d="${d}" fill="#000"/>`).join('');
  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#000"/>${outer}${inner}</mask>
        <rect width="100" height="100" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}" mask="url(#${id})"/>
        <path d="${shoes}" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}" stroke="${tokens.primary}" stroke-width="0.5" stroke-linejoin="round" stroke-opacity="${tokens.glyphOpacity}"/>
        <circle cx="${head.cx}" cy="${head.cy}" r="${head.r}" fill="none" stroke="${tokens.primary}" stroke-width="${line}" stroke-opacity="${tokens.glyphOpacity}"/>`;
}
'''
p=f'{S}/proposedArtwork.ts'; src=open(p).read()
if 'function outlinedShapes(' not in src:
    src=src.replace("function glyph(definition: FirstAchievementDefinition", helper+"\nfunction glyph(definition: FirstAchievementDefinition",1)
start=src.index("    case 'run':"); end=src.index("    case 'walk':")
src=src[:start]+case+"\n"+src[end:]
open(p,'w').write(src); print('ok')
