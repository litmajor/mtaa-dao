import os, re, json
from pathlib import Path

root = Path.cwd()
ignore_dirs = {'.git', 'node_modules', 'dist', 'build', 'out', 'coverage', '.cache', 'cache'}
exts = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'}
files = []
for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in ignore_dirs]
    for fn in filenames:
        if Path(fn).suffix in exts:
            files.append(Path(dirpath, fn))

try:
    tsconfig = json.loads((root / 'tsconfig.json').read_text(encoding='utf-8'))
    baseUrl = tsconfig.get('compilerOptions', {}).get('baseUrl', '.')
    paths = tsconfig.get('compilerOptions', {}).get('paths', {})
except Exception:
    baseUrl = '.'
    paths = {}


def resolve_import(spec, from_file):
    if not spec or spec.startswith(('http://', 'https://', 'node:', 'fs', 'path')):
        return None
    if spec.startswith('.') or spec.startswith('/'):
        base = (from_file.parent / spec).resolve()
        candidates = [base]
        for ext in exts:
            candidates.append(base.with_suffix(ext))
        candidates.extend([
            base / 'index.ts', base / 'index.tsx', base / 'index.js', base / 'index.jsx'
        ])
        for cand in candidates:
            if cand.exists() and cand.is_file():
                return cand.resolve()
        return None
    for pattern, targets in paths.items():
        if '*' in pattern:
            m = re.match('^' + pattern.replace('*', '(.+)') + '$', spec)
            if m:
                target = targets[0]
                mapped = target.replace('*', m.group(1))
                resolved = (root / baseUrl / mapped).resolve()
                for ext in exts:
                    cand = resolved.with_suffix(ext)
                    if cand.exists() and cand.is_file():
                        return cand.resolve()
                for cand in [resolved / 'index.ts', resolved / 'index.tsx', resolved / 'index.js', resolved / 'index.jsx']:
                    if cand.exists() and cand.is_file():
                        return cand.resolve()
                return resolved
        elif spec == pattern:
            target = targets[0]
            resolved = (root / baseUrl / target).resolve()
            for ext in exts:
                cand = resolved.with_suffix(ext)
                if cand.exists() and cand.is_file():
                    return cand.resolve()
            return resolved
    return None

file_set = {f.resolve() for f in files}
graph = {f.resolve(): set() for f in files}
import_re = re.compile(r"(?:import|export)\s+(?:type\s+)?(?:[^'\";]+?\s+from\s+)?['\"]([^'\"]+)['\"]")
dynamic_re = re.compile(r"import\(\s*['\"]([^'\"]+)['\"]\s*\)")
for f in files:
    text = f.read_text(encoding='utf-8', errors='ignore')
    specs = []
    for m in import_re.finditer(text):
        specs.append(m.group(1))
    for m in dynamic_re.finditer(text):
        specs.append(m.group(1))
    for spec in specs:
        resolved = resolve_import(spec, f.resolve())
        if not resolved or resolved not in file_set:
            continue
        graph[f.resolve()].add(resolved)

indegree = {f: 0 for f in graph}
outdegree = {f: len(graph[f]) for f in graph}
for src, targets in graph.items():
    for tgt in targets:
        indegree[tgt] = indegree.get(tgt, 0) + 1

ranked = []
for f in graph:
    rel = os.path.relpath(f, root).replace('\\', '/')
    ranked.append((rel, indegree[f], outdegree[f], indegree[f] + outdegree[f]))

ranked.sort(key=lambda x: (-x[3], -x[1], -x[2], x[0]))
print('TOP 20 by combined fan-in + fan-out')
for rel, fan_in, fan_out, score in ranked[:20]:
    print(f'{rel} | fanIn={fan_in} fanOut={fan_out} score={score}')
