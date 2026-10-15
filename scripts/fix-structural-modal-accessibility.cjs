const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(path.join(directory, entry.name)) : entry.name.endsWith('.tsx') ? [path.join(directory, entry.name)] : []);
}
for (const file of [...files('app'), ...files('src/components')]) {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes('stopPropagation')) continue;
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const positions = [];
  function visit(node) {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(ast) === 'Pressable') {
      const attributes = node.attributes.properties;
      const onPress = attributes.find(attribute => attribute.name?.getText(ast) === 'onPress')?.getText(ast) ?? '';
      const style = attributes.find(attribute => attribute.name?.getText(ast) === 'style')?.getText(ast) ?? '';
      const structural = onPress.includes('stopPropagation') || /overlay|backdrop|modal|wrap/i.test(style) && node.parent.getText(ast).includes('stopPropagation');
      if (structural && !attributes.some(attribute => attribute.name?.getText(ast) === 'accessible')) positions.push(node.end - 1);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (positions.length) {
    let result = source;
    for (const position of positions.sort((a, b) => b - a)) result = result.slice(0, position) + ' accessible={false}' + result.slice(position);
    fs.writeFileSync(file, result);
  }
}
