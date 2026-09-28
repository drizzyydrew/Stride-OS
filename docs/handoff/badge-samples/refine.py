import os, re
S=os.environ['S']
p=f'{S}/proposedArtwork.ts'; src=open(p).read()
def rep(a,b):
    global src
    assert a in src, a[:80]; src=src.replace(a,b)
# narrower, taller hexagon: scale x about the center by 0.92
m=re.search(r"export const FIRSTS_HEXAGON_PATH =\n  '([^']+)';", src)
path=m.group(1)
toks=re.findall(r'[A-Z]|-?\d+\.?\d*', path)
out=[]; coord_idx=0
for t in toks:
    if t.isalpha(): out.append(t); coord_idx=0; continue
    v=float(t)
    if coord_idx%2==0: v=50+(v-50)*0.92
    out.append(f"{v:.2f}".rstrip('0').rstrip('.')); coord_idx+=1
newpath=' '.join(out).replace(' Z','Z')
src=src.replace(path,newpath)
# lighter, brighter title and wordmark (as in the reference)
rep('font-weight="700" letter-spacing="0.45" fill="${tokens.primary}"','font-weight="500" letter-spacing="0.35" fill="${tokens.highlight}"')
rep("const size = line.length > 16 ? 5.6 : 6.6;","const size = line.length > 16 ? 5.8 : 7;")
rep('font-size="3.3" font-weight="700" letter-spacing="1.3" fill="${tokens.text}"','font-size="3.7" font-weight="600" letter-spacing="0.9" fill="${tokens.highlight}"')
# finer runner + chevrons
rep('${strokeAttrs(tokens, 2.05)}','${strokeAttrs(tokens, 1.75)}')
src=src.replace('stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"','stroke-width="0.95" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"')
rep("const chevOneY = definition.titleLines.length > 1 ? 82 : 81.5;","const chevOneY = definition.titleLines.length > 1 ? 81.4 : 79.8;")
rep("const chevTwoY = definition.titleLines.length > 1 ? 87.2 : 86.7;","const chevTwoY = definition.titleLines.length > 1 ? 85.2 : 83.6;")
open(p,'w').write(src); print('refined')
