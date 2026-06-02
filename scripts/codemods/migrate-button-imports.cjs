#!/usr/bin/env node
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

  src = src.replace(/@\/components\/ui\/button-design/g, '@\/components\/ui')
  src = src.replace(/(\.\.\/ui)\/button-design/g, '$1')
  src = src.replace(/(\.\/)button-design/g, '$1button')
  src = src.replace(/\/button-design/g, '/button')

  if (src !== original) {
    fs.writeFileSync(file, src, 'utf8')
    console.log('Updated', file)
    changed++
  }
})

console.log(`Codemod complete — files changed: ${changed}`)
