const parser = require('@babel/parser');
const fs = require('fs');
const code = fs.readFileSync('src/pages/AdminPage.jsx', 'utf8');
try {
  parser.parse(code, { 
    plugins: ['jsx', 'importMeta', 'topLevelAwait', 'classProperties', 'classPrivateProperties', 'classPrivateMethods'],
    sourceType: 'module',
    allowImportExportEverywhere: true
  });
  console.log('SUCCESS: File parsed without errors');
} catch (e) {
  console.log('ERROR at line', e.loc?.line, 'col', e.loc?.column);
  console.log(e.message);
}
