const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
for (const file of [...files('app'), ...files('src/components')].filter(file => file.endsWith('.tsx'))) {
  let text = fs.readFileSync(file, 'utf8');
  if (file.endsWith('_layout.tsx') && text.includes('<Stack') && !file.includes('app/_layout')) {
    text = text.replace(/headerShown: false(?!, gestureEnabled)/g, 'headerShown: false, gestureEnabled: false, fullScreenGestureEnabled: false');
  }
  if (!text.includes('<Modal') || file.includes('FeatureTourProvider') || file.includes('RecoverableModal')) {
    if (text !== fs.readFileSync(file, 'utf8')) fs.writeFileSync(file, text);
    continue;
  }
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  let found = false;
  for (const stmt of ast.statements) {
    if (!ts.isImportDeclaration(stmt) || stmt.moduleSpecifier.text !== 'react-native') continue;
    const named = stmt.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named) || !named.elements.some(e => e.name.text === 'Modal')) continue;
    found = true;
    const remaining = named.elements.filter(e => e.name.text !== 'Modal').map(e => e.getText(ast));
    edits.push({ start: named.getStart(ast), end: named.end, value: `{ ${remaining.join(', ')} }` });
  }
  if (!found) continue;
  const visit = node => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'Modal') {
      const attrs = node.openingElement.attributes.properties;
      const close = attrs.find(a => ts.isJsxAttribute(a) && a.name.getText(ast) === 'onRequestClose');
      const transparent = attrs.some(a => ts.isJsxAttribute(a) && a.name.getText(ast) === 'transparent' && (!a.initializer || a.initializer.getText(ast) === '{true}'));
      const root = node.children.find(child => ts.isJsxElement(child));
      if (transparent && close?.initializer && ts.isJsxExpression(close.initializer) && root) {
        const rootName = root.openingElement.tagName.getText(ast);
        const card = root.children.find(child => ts.isJsxElement(child));
        if (['View', 'Pressable'].includes(rootName) && card && ['View', 'Pressable'].includes(card.openingElement.tagName.getText(ast))) {
          const callback = close.initializer.expression.getText(ast);
          for (const [element, handler] of [[root, callback], [card, 'event => event.stopPropagation()']]) {
            const name = element.openingElement.tagName;
            if (name.getText(ast) !== 'Pressable') {
              edits.push({ start: name.getStart(ast), end: name.end, value: 'Pressable' });
              edits.push({ start: element.closingElement.tagName.getStart(ast), end: element.closingElement.tagName.end, value: 'Pressable' });
            }
            if (!element.openingElement.attributes.properties.some(a => ts.isJsxAttribute(a) && a.name.getText(ast) === 'onPress')) {
              edits.push({ start: element.openingElement.attributes.end, end: element.openingElement.attributes.end, value: ` onPress={${handler}}` });
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const needsPressable = edits.some(edit => edit.value === 'Pressable');
  if (needsPressable && !/\bPressable\b/.test(ast.statements.filter(ts.isImportDeclaration).map(s => s.getText(ast)).join(' '))) {
    const edit = edits.find(edit => edit.value.startsWith('{ '));
    if (edit) edit.value = edit.value.replace('{ ', '{ Pressable, ');
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + edit.value + text.slice(edit.end);
  let target = path.relative(path.dirname(file), 'src/components/ui/RecoverableModal').replaceAll(path.sep, '/');
  if (!target.startsWith('.')) target = './' + target;
  text = `import Modal from '${target}';\n` + text;
  fs.writeFileSync(file, text);
  console.log(file);
}

// Only remove pure router-back controls; local wizard/confirmation actions stay.
for (const file of files('app').filter(file => file.endsWith('.tsx'))) {
  let text = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const visit = node => {
    if (ts.isJsxElement(node) && ['TouchableOpacity', 'Pressable'].includes(node.openingElement.tagName.getText(ast))) {
      const press = node.openingElement.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(ast) === 'onPress');
      const callback = press?.initializer && ts.isJsxExpression(press.initializer) ? press.initializer.expression?.getText(ast) : '';
      if (/^\(\)\s*=>\s*router\.back\(\)$/.test(callback)
        && (/name="(?:chevron-back|arrow-back)"/.test(node.getText(ast)) || /←\s*Back/.test(node.getText(ast)))) {
        edits.push({ start: node.getStart(ast), end: node.end, value: '<LegacyBackControl onBack={() => router.back()} />' });
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  if (!edits.length) continue;
  for (const edit of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + edit.value + text.slice(edit.end);
  let target = path.relative(path.dirname(file), 'src/components/layout/NavigationEscape').replaceAll(path.sep, '/');
  if (!target.startsWith('.')) target = './' + target;
  text = `import { LegacyBackControl } from '${target}';\n` + text;
  fs.writeFileSync(file, text);
  console.log('fixed back:', file);
}
