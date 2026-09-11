/**
 * Validação de sintaxe e integridade dos scripts gerados para o Coletor:
 * - getTampermonkeyUserscript
 * - getTurboBookmarkletScript
 * - getBookmarkletScript
 *
 * Executável nativamente pelo Node.js ESM.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const tsSourcePath = path.resolve(__dirname, '../src/lib/mlBookmarklet.ts')
const tsSource = fs.readFileSync(tsSourcePath, 'utf8')

// Extrai e compila os geradores de script ou testa o código gerado
console.log('--- 1. Verificação de integridade estática no código-fonte ---')

// 1. Verificação inicial da string estática do fonte

if (tsSource.includes('//+$')) {
  console.error('ERRO: mlBookmarklet.ts ainda contém //+$!')
  process.exit(1)
}

// 2. Verificar se _Desde_(d+) existe no fonte
if (/_Desde_\(d\+\)/i.test(tsSource)) {
  console.error('ERRO: mlBookmarklet.ts ainda contém _Desde_(d+)!')
  process.exit(1)
}

// 3. Verificar versão 1.6.4
if (!tsSource.includes("SCRIPT_VERSION = '1.6.4'")) {
  console.error('ERRO: SCRIPT_VERSION não está definido como 1.6.4!')
  process.exit(1)
}

console.log(
  '✓ Código-fonte estático limpo: zero ocorrências de //+$ e _Desde_(d+). Versão 1.6.4 confirmada.',
)

// 4. Teste de compilação dinâmica do template do userscript
console.log('--- 2. Simulação e validação de sintaxe JS (new Function) ---')

const options = {
  backendUrl: 'https://app-teste.goskip.app',
  appUrl: 'https://app-teste.goskip.app',
  collectorKey: 'ml_col_test_key_123456789',
}

// Para garantir que testamos exatamente a função real sem mock manual do template:
// Transpilamos o mlBookmarklet.ts usando oxc-parser ou regex/eval simples de TS para JS
// ou compilamos a função getTampermonkeyUserscript diretamente com TypeScript ou avaliamos seu retorno.
const ts = require('typescript')
const compiledJs = ts.transpileModule(tsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText

// Carrega o módulo compilado dinamicamente via Data URI
const dataUri = 'data:text/javascript;base64,' + Buffer.from(compiledJs).toString('base64')
const loadedModule = await import(dataUri)
const { getTampermonkeyUserscript, getTurboBookmarkletScript } = loadedModule

const generatedScript = getTampermonkeyUserscript(options)

// Remove o cabeçalho de metadados do Tampermonkey para validação sintática no motor JS
const jsExecutableCode = generatedScript
  .replace(/^\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==/m, '')
  .trim()

// Testes no texto gerado
if (generatedScript.includes('//+$')) {
  console.error('ERRO: O texto do userscript gerado contém //+$!')
  process.exit(1)
}
if (generatedScript.includes('replace(//+')) {
  console.error('ERRO: O texto do userscript gerado contém replace(//+ !')
  process.exit(1)
}
if (generatedScript.includes('replace(/+$')) {
  console.error('ERRO: O texto do userscript gerado contém replace(/+$ !')
  process.exit(1)
}
if (!generatedScript.includes(".replace(/\\/+$/, '')")) {
  console.error(
    "ERRO: O texto do userscript gerado NÃO contém o regex correto .replace(/\\/+$/, '') com a barra escapada!",
  )
  process.exit(1)
}
if (/_Desde_\(d\+\)/i.test(generatedScript)) {
  console.error('ERRO: O texto do userscript gerado contém _Desde_(d+)!')
  process.exit(1)
}
if (!generatedScript.includes('1.6.4')) {
  console.error('ERRO: O texto do userscript gerado não contém a versão 1.6.4!')
  process.exit(1)
}

console.log(
  "✓ Verificação no TEXTO GERADO aprovada: contém .replace(/\\/+$/, ''), zero ocorrências de //+ e /+$",
)

try {
  // new Function avalia a sintaxe completa do JavaScript no motor V8 sem executá-lo
  new Function(jsExecutableCode)
  console.log(
    '✓ Userscript Tampermonkey v1.6.4 compilado pelo parser JavaScript com sucesso sem erros de sintaxe!',
  )
  const matchedLine = generatedScript
    .split('\n')
    .find((l) => l.includes('baseUrl =') && l.includes('replace'))
  if (matchedLine) {
    console.log('Linha gerada no userscript:', matchedLine.trim())
  }
} catch (syntaxError) {
  console.error('ERRO de sintaxe ao compilar o userscript:', syntaxError)
  process.exit(1)
}

// Também testar Turbo bookmarklet chamando a função real
try {
  const turboRaw = getTurboBookmarkletScript(options)
  const turboDecoded = decodeURIComponent(turboRaw.replace(/^javascript:/, ''))
  new Function(turboDecoded)
  console.log('✓ Script do Turbo Bookmarklet gerado pela função real compilado com sucesso!')
} catch (err) {
  console.error('ERRO de sintaxe ao compilar o Turbo Bookmarklet:', err)
  process.exit(1)
}

console.log('✓ Todos os testes de sintaxe e critérios de aceite passaram!')
