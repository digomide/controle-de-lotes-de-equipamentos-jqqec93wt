/**
 * Utilitários para extração, validação, formatação, cópia e download
 * do `focus_payload` de notas fiscais (coleção `nf_invoices`).
 *
 * Suporta payloads gravados como objeto JSON ou serializados como string,
 * com fallback robusto para clipboard e download de arquivo .json.
 */

/**
 * Faz parse tolerante de qualquer valor vindo do banco/API para JSON object/array.
 * Se já for objeto/array não-nulo, retorna diretamente.
 * Se for string, remove espaços e faz JSON.parse (com tolerância a aspas ou dupla serialização).
 */
export function parseFocusPayload(raw: any): any | null {
  if (raw === null || raw === undefined) return null

  // Se já for objeto não nulo
  if (typeof raw === 'object') {
    // Objeto vazio {} ainda pode ser payload se tiver chaves
    if (Array.isArray(raw)) return raw.length > 0 ? raw : null
    return Object.keys(raw).length > 0 ? raw : null
  }

  // Se for string serializada
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '{}') {
      return null
    }

    try {
      const parsed = JSON.parse(trimmed)
      // Se era uma string duplamente serializada
      if (typeof parsed === 'string') {
        try {
          return JSON.parse(parsed)
        } catch {
          return parsed
        }
      }
      return parsed
    } catch {
      // Se falhar o JSON.parse, mas for string não vazia, retorna nulo ou texto bruto
      return null
    }
  }

  return null
}

/**
 * Retorna o JSON formatado com 2 espaços de indentação exatamente como gravado.
 */
export function formatFocusPayload(payload: any): string {
  const parsed = parseFocusPayload(payload)
  if (!parsed) {
    if (typeof payload === 'string' && payload.trim().length > 0) {
      return payload
    }
    return ''
  }
  return JSON.stringify(parsed, null, 2)
}

/**
 * Gera o nome de arquivo canônico para envio ao suporte da Focus:
 * ex.: focus_payload_NF_1789244037477_cpxjv.json
 */
export function buildFocusPayloadFilename(ref?: string): string {
  const cleanRef = (ref || 'sem_ref').replace(/[^a-zA-Z0-9_-]/g, '_')
  return `focus_payload_${cleanRef}.json`
}

/**
 * Copia texto para a área de transferência com fallback para execCommand caso
 * a Clipboard API falhe (ex: contextos HTTP / permissões restritas do browser).
 */
export async function copyToClipboardSafe(text: string): Promise<boolean> {
  if (!text) return false

  // 1. Tenta API moderna do navegador
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fallback para método legado
    }
  }

  // 2. Fallback com textarea temporário invisível
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    textArea.setAttribute('readonly', '')
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch {
    return false
  }
}

/**
 * Dispara o download de um arquivo JSON no navegador.
 */
export function downloadJsonFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 300)
}
