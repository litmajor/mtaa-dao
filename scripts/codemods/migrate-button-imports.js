#!/usr/bin/env node
// Simple codemod to replace imports of button-design with canonical Button
// Usage: node scripts/codemods/migrate-button-imports.js

const fs = require('fs')
const path = require('path')
const glob = require('glob')

const root = path.resolve(__dirname, '../../client/src')

const patterns = [
  `${root}/**/*.tsx`,
  `${root}/**/*.ts`,
  `${root}/**/*.jsx`,
  `${root}/**/*.js`,
]

const files = patterns.flatMap(p => glob.sync(p, { nodir: true }))

let changed = 0

files.forEach((file) => {
  let src = fs.readFileSync(file, 'utf8')
  const original = src

  // Replace absolute barrel imports
  src = src.replace(/@\/components\/ui\/button-design/g, '@\/components\/ui')

  // Replace relative imports to ui folder
  src = src.replace(/(\.\.\/ui)\/button-design/g, '$1')
  src = src.replace(/(\.\/)button-design/g, '$1button')

  // Fallback: replace '/button-design' -> '/button' (careful)
  src = src.replace(/\/button-design/g, '/button')

  if (src !== original) {
    fs.writeFileSync(file, src, 'utf8')
    console.log('Updated', file)
    changed++
  }
})

console.log(`Codemod complete — files changed: ${changed}`)
