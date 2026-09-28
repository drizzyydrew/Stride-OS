import os, re
S=os.environ['S']; R=os.environ['R']
src=open(f'{R}/src/achievements/firsts/firstsArtwork.ts').read()
src=src.replace("from '../../store/settingsStore'",f"from '{R}/src/store/settingsStore'")
src=src.replace("from './firstsDefinitions'",f"from '{R}/src/achievements/firsts/firstsDefinitions'")
src=src.replace("from './firstsUtils'",f"from '{R}/src/achievements/firsts/firstsUtils'")
old_imp="""import {
  FIRSTS_COLORS,
  FIRSTS_LOCKED_COLORS,
  FIRSTS_NEAR_BLACK,
} from './firstsTokens';"""
assert old_imp in src
src=src.replace(old_imp,f"""import {{ FIRSTS_LOCKED_COLORS, FIRSTS_NEAR_BLACK }} from '{R}/src/achievements/firsts/firstsTokens';
const FIRSTS_COLORS = {{ primary: '#E3BC7E', secondary: '#C1A276', highlight: '#F4DCA9', shadow: '#A8844F', glow: '#C99A55', text: '#E9C78C' }};""")
run=open(f'{S}/run_glyph.txt').read().splitlines()
hx,hy,_=run[0].split()[1:]
body=run[1][5:]; speed=run[2][6:]
new_run=("    case 'run':\n      return `<path d=\"" + speed + "\" fill=\"none\" ${strokeAttrs(tokens, 1.25)}/>\n"
         "        <circle cx=\"" + hx + "\" cy=\"" + hy + "\" r=\"2.9\" fill=\"none\" ${strokeAttrs(tokens, 1.7)}/>\n"
         "        <path d=\"" + body + "\" fill=\"none\" ${strokeAttrs(tokens, 2.05)}/>`;")
src,n=re.subn(r"    case 'run':\n      return `[\s\S]*?`;", lambda m: new_run, src, count=1); assert n==1
def rep(a,b):
    global src
    assert a in src, a[:70]
    src=src.replace(a,b)
rep("""  <g>
    ${glyph(definition, tokens, units)}
  </g>""","""  <g transform="${definition.glyph === 'run' ? '' : 'translate(50 36.5) scale(1.22) translate(-50 -38.5)'}">
    ${glyph(definition, tokens, units)}
  </g>""")
rep('stroke="url(#${edgeId})" stroke-width="2.25"','stroke="url(#${edgeId})" stroke-width="1.35"')
src,n=re.subn(r'  <path d="\$\{FIRSTS_HEXAGON_PATH\}" fill="none" stroke="\$\{tokens\.highlight\}" stroke-width="0\.68"[^\n]*\n','',src); assert n==1
rep("const startY = lines.length > 1 ? 63.2 : 66;","const startY = lines.length > 1 ? 62.2 : 65.2;")
rep("const lineHeight = lines.length > 1 ? 6.6 : 0;","const lineHeight = lines.length > 1 ? 7.2 : 0;")
rep("const size = line.length > 16 ? 5 : 5.7;","const size = line.length > 16 ? 5.6 : 6.6;")
rep('font-weight="900" letter-spacing="0.35" fill="${tokens.text}"','font-weight="700" letter-spacing="0.45" fill="${tokens.primary}"')
rep("const wordmarkY = definition.titleLines.length > 1 ? 76.3 : 74.2;","const wordmarkY = definition.titleLines.length > 1 ? 76.6 : 74.2;")
rep('font-size="3.6" font-weight="900" letter-spacing="1.45" fill="${tokens.text}"','font-size="3.3" font-weight="700" letter-spacing="1.3" fill="${tokens.text}"')
src=src.replace('stroke-width="1.05"','stroke-width="1.2"')
rep('stroke="${tokens.highlight}" stroke-width="1.2"','stroke="${tokens.primary}" stroke-width="1.2"')
open(f'{S}/proposedArtwork.ts','w').write(src)
print("ok")
