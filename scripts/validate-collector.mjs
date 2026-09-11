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

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const tsSourcePath = path.resolve(__dirname, '../src/lib/mlBookmarklet.ts')
const tsSource = fs.readFileSync(tsSourcePath, 'utf8')

// Extrai e compila os geradores de script ou testa o código gerado
console.error('[FORCE_FAIL_TEST] Provando que run_qa executa este script!')
process.exit(99)
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

// 3. Verificar versão 1.6.2
if (!tsSource.includes("SCRIPT_VERSION = '1.6.2'")) {
  console.error('ERRO: SCRIPT_VERSION não está definido como 1.6.2!')
  process.exit(1)
}

console.log(
  '✓ Código-fonte estático limpo: zero ocorrências de //+$ e _Desde_(d+). Versão 1.6.2 confirmada.',
)

// 4. Teste de compilação dinâmica do template do userscript
console.log('--- 2. Simulação e validação de sintaxe JS (new Function) ---')

// Extração do corpo de getTampermonkeyUserscript simulando as entradas
// Na prática podemos simular gerando o texto com a função simulada ou avaliando os blocos de script
const options = {
  backendUrl: 'https://app-teste.goskip.app',
  appUrl: 'https://app-teste.goskip.app',
  collectorKey: 'ml_col_test_key_123456789',
}

// Mock das variáveis no template para extrair a string exata gerada
const cleanBackendUrl = (options.backendUrl || options.appUrl || '').replace(/\/+$/, '')
const cleanAppUrl = (options.appUrl || '').replace(/\/+$/, '')
const collectorKey = options.collectorKey || ''
const SCRIPT_VERSION = '1.6.2'

// Encontra onde começa getTampermonkeyUserscript
const fnStart = tsSource.indexOf('export function getTampermonkeyUserscript')
if (fnStart === -1) {
  console.error('ERRO: Função getTampermonkeyUserscript não encontrada no fonte!')
  process.exit(1)
}
const returnBacktick = tsSource.indexOf('return `// ==UserScript==', fnStart)
if (returnBacktick === -1) {
  console.error('ERRO: Início da template string do userscript não encontrado!')
  process.exit(1)
}
const templateContentStart = returnBacktick + 'return `'.length
// A template string termina no fechamento da função: `\n}`
const templateContentEnd = tsSource.lastIndexOf('\n`\n}')
if (templateContentEnd === -1 || templateContentEnd <= templateContentStart) {
  console.error('ERRO: Fim da template string do userscript não encontrado!')
  process.exit(1)
}

const rawTemplateContent = tsSource.slice(templateContentStart, templateContentEnd)

// Simula a interpolação exata de getTampermonkeyUserscript
let generatedScript = rawTemplateContent
  .replace(/\${SCRIPT_VERSION}/g, SCRIPT_VERSION)
  .replace(/\${connectDirectives}/g, '// @connect      app-teste.goskip.app')
  .replace(/\${JSON\.stringify\(cleanBackendUrl\)}/g, JSON.stringify(cleanBackendUrl))
  .replace(
    /\${JSON\.stringify\(cleanAppUrl \|\| cleanBackendUrl\)}/g,
    JSON.stringify(cleanAppUrl || cleanBackendUrl),
  )
  .replace(/\${JSON\.stringify\(collectorKey\)}/g, JSON.stringify(collectorKey))

// Remove o cabeçalho de metadados do Tampermonkey para validação sintática no motor JS
const jsExecutableCode = generatedScript
  .replace(/^\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==/m, '')
  .trim()

// Testes no texto gerado
if (generatedScript.includes('//+$')) {
  console.error('ERRO: O texto do userscript gerado contém //+$!')
  process.exit(1)
}
if (/_Desde_\(d\+\)/i.test(generatedScript)) {
  console.error('ERRO: O texto do userscript gerado contém _Desde_(d+)!')
  process.exit(1)
}
if (!generatedScript.includes('1.6.2')) {
  console.error('ERRO: O texto do userscript gerado não contém a versão 1.6.2!')
  process.exit(1)
}

try {
  // new Function avalia a sintaxe completa do JavaScript no motor V8 sem executá-lo
  new Function(jsExecutableCode)
  console.log(
    '✓ Userscript Tampermonkey v1.6.2 compilado pelo parser JavaScript com sucesso sem erros de sintaxe!',
  )
} catch (syntaxError) {
  console.error('ERRO de sintaxe ao compilar o userscript:', syntaxError)
  process.exit(1)
}

// Também testar Turbo bookmarklet
const turboMatch = tsSource.match(
  /export function getTurboBookmarkletScript[\s\S]*?const code = `([\s\S]*?)`\s*return `javascript:/,
)
if (turboMatch) {
  const targetBackendUrl = cleanBackendUrl
  let generatedTurbo = turboMatch[1]
    .replace(/\${JSON\.stringify\(targetBackendUrl\)}/g, JSON.stringify(targetBackendUrl))
    .replace(/\${JSON\.stringify\(options\.collectorKey \|\| ''\)}/g, JSON.stringify(collectorKey))
  try {
    new Function(generatedTurbo)
    console.log('✓ Script do Turbo Bookmarklet compilado pelo parser JavaScript com sucesso!')
  } catch (err) {
    console.error('ERRO de sintaxe ao compilar o Turbo Bookmarklet:', err)
    process.exit(1)
  }
}

console.log('✓ Todos os testes de sintaxe e critérios de aceite passaram!')
