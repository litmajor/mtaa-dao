#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const glob = require('glob')

const root = path.resolve(__dirname, '../../client/src')
const patterns = [`${root}/**/*.tsx`, `${root}/**/*.ts`, `${root}/**/*.jsx`, `${root}/**/*.js`]

const files = patterns.flatMap(p => glob.sync(p, { nodir: true }))
let changed = 0

function stripGradientClasses(classStr) {
  // remove bg-gradient-to-*, from-*, to-*, via-*, hover:from-*, hover:to-*
  return classStr
    .replace(/\b(bg-gradient-to-[^\s]+)\b/g, '')
    .replace(/\bfrom-[^\s]+\b/g, '')
    .replace(/\bto-[^\s]+\b/g, '')
    .replace(/\bvia-[^\s]+\b/g, '')
    .replace(/\bhover:from-[^\s]+\b/g, '')
    .replace(/\bhover:to-[^\s]+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

files.forEach((file) => {
  let src = fs.readFileSync(file, 'utf8')
  const original = src

  // match <Button ... className="...bg-gradient..." ...>
  src = src.replace(/<Button([^>]*)className=\"([^\"]*?bg-gradient[^\"]*?)\"([^>]*)>/g, (m, before, cls, after) => {
    const cleaned = stripGradientClasses(cls)
    const classAttr = cleaned ? ` className=\"${cleaned}\"` : ''
    // if variant already present, don't duplicate
    if (/\bvariant=/.test(before + after)) {
      return `<Button${before}${classAttr}${after}>`
    }
    return `<Button${before} variant=\"primary\"${classAttr}${after}>`
  })

  if (src !== original) {
    fs.writeFileSync(file, src, 'utf8')
    console.log('Updated', file)
    changed++
  }
})

console.log(`Gradient->variant codemod complete — files changed: ${changed}`)
