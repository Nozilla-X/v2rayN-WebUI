import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const projectRequire = createRequire(path.join(root, 'package.json'))
const ts = projectRequire('typescript')
const vue = projectRequire('vue')
const { parse, compileScript } = projectRequire('@vue/compiler-sfc')

// Execute the actual composables and App setup, without a browser or a Backend checkout.
export function createSourceHarness() {
  const modules = new Map()
  const mounted = []
  const unmounted = []
  const scope = vue.effectScope()
  const provided = new Map()
  const hooks = {
    ...vue,
    provide: (key, value) => provided.set(key, value),
    inject: (key, fallback) => provided.has(key) ? provided.get(key) : fallback,
    onMounted: (callback) => mounted.push(callback),
    onUnmounted: (callback) => unmounted.push(callback),
  }

  function loadSource(relativePath) {
    const file = path.resolve(root, relativePath)
    if (modules.has(file)) return modules.get(file).exports
    const module = { exports: {} }
    modules.set(file, module)
    let source = fs.readFileSync(file, 'utf8')
    if (file.endsWith('.vue')) {
      const { descriptor } = parse(source, { filename: file })
      source = compileScript(descriptor, { id: 'test-app' }).content
    }
    const code = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText
    function importModule(specifier) {
      if (specifier === 'vue') return hooks
      if (specifier === 'vue-i18n') return { useI18n: () => ({ t: (key) => key, locale: vue.ref('zh-CN') }) }
      if (specifier.endsWith('.vue')) return { __esModule: true, default: {} }
      if (specifier.startsWith('.')) {
        const candidate = path.resolve(path.dirname(file), specifier)
        const target = ['', '.ts', '.js', '.mjs'].map((suffix) => candidate + suffix).find((entry) => fs.existsSync(entry))
        if (!target) throw new Error(`Cannot resolve ${specifier} from ${file}`)
        return loadSource(path.relative(root, target))
      }
      return projectRequire(specifier)
    }
    // App polling is tested by explicit loads rather than wall-clock intervals.
    new Function('require', 'module', 'exports', 'setInterval', 'clearInterval', code)(
      importModule, module, module.exports, () => 1, () => {},
    )
    return module.exports
  }

  return {
    vue, mounted, loadSource,
    setup: (callback) => scope.run(callback),
    async dispose() {
      for (const callback of unmounted) await callback()
      scope.stop()
    },
  }
}
