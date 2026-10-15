const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(path.join(directory, entry.name)) : entry.name.endsWith('.tsx') ? [path.join(directory, entry.name)] : []);
}
for (const file of [...files('app'), 'src/components/movement/TimedCaptureCamera.tsx']) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== 'react-native-safe-area-context') continue;
    const named = statement.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named) || !named.elements.some(element => element.name.text === 'useSafeAreaInsets')) continue;
    const remaining = named.elements.filter(element => element.name.text !== 'useSafeAreaInsets').map(element => element.getText(ast));
    let relative = path.relative(path.dirname(file), 'src/components/layout/PageSafeAreaView').replaceAll(path.sep, '/');
    if (!relative.startsWith('.')) relative = `./${relative}`;
    edits.push({ start: statement.getStart(ast), end: statement.end, value:
      `${remaining.length ? `import { ${remaining.join(', ')} } from 'react-native-safe-area-context';\n` : ''}import { usePageSafeAreaInsets as useSafeAreaInsets } from '${relative}';` });
  }
  if (edits.length) {
    let result = source;
    for (const edit of edits.sort((a, b) => b.start - a.start)) result = result.slice(0, edit.start) + edit.value + result.slice(edit.end);
    fs.writeFileSync(file, result);
  }
}
