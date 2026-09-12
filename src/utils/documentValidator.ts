/**
 * Utilitários de validação e formatação de CPF e CNPJ (Módulo 11)
 * Usado para validação fiscal antes da transmissão SEFAZ
 */

/**
 * Remove qualquer caracter não numérico
 */
export function cleanDocument(doc: string | null | undefined): string {
  if (!doc) return ''
  return String(doc).replace(/\D/g, '')
}

/**
 * Validação de CPF via algoritmo oficial de Dígito Verificador (Módulo 11)
 */
export function isValidCPF(cpfRaw: string | null | undefined): boolean {
  const cpf = cleanDocument(cpfRaw)
  if (cpf.length !== 11) return false

  // Bloqueia números conhecidos de todos dígitos iguais (ex: 000.000.000-00, 111.111.111-11)
  if (/^(\d)\1{10}$/.test(cpf)) return false

  // Validação 1º dígito
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (10 - i)
  }
  let remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cpf.charAt(9), 10)) return false

  // Validação 2º dígito
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (11 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cpf.charAt(10), 10)) return false

  return true
}

/**
 * Validação de CNPJ via algoritmo oficial de Dígito Verificador (Módulo 11)
 */
export function isValidCNPJ(cnpjRaw: string | null | undefined): boolean {
  const cnpj = cleanDocument(cnpjRaw)
  if (cnpj.length !== 14) return false

  // Bloqueia números conhecidos de todos dígitos iguais
  if (/^(\d)\1{13}$/.test(cnpj)) return false

  // Validação 1º dígito
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj.charAt(i), 10) * weights1[i]
  }
  let remainder = sum % 11
  const digit1 = remainder < 2 ? 0 : 11 - remainder
  if (digit1 !== parseInt(cnpj.charAt(12), 10)) return false

  // Validação 2º dígito
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  sum = 0
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj.charAt(i), 10) * weights2[i]
  }
  remainder = sum % 11
  const digit2 = remainder < 2 ? 0 : 11 - remainder
  if (digit2 !== parseInt(cnpj.charAt(13), 10)) return false

  return true
}

export type DocumentValidationResult = {
  valid: boolean
  type: 'CPF' | 'CNPJ' | 'UNKNOWN'
  clean: string
  formatted: string
  error?: string
}

/**
 * Valida se é CPF ou CNPJ válido com detalhe do motivo
 */
export function validateFiscalDocument(
  docRaw: string | null | undefined,
): DocumentValidationResult {
  const clean = cleanDocument(docRaw)

  if (!clean) {
    return {
      valid: false,
      type: 'UNKNOWN',
      clean: '',
      formatted: '',
      error: 'Documento ausente ou não informado',
    }
  }

  if (clean.length === 11) {
    const valid = isValidCPF(clean)
    return {
      valid,
      type: 'CPF',
      clean,
      formatted: formatDocument(clean),
      error: valid ? undefined : 'CPF inválido (dígito verificador incorreto)',
    }
  }

  if (clean.length === 14) {
    const valid = isValidCNPJ(clean)
    return {
      valid,
      type: 'CNPJ',
      clean,
      formatted: formatDocument(clean),
      error: valid ? undefined : 'CNPJ inválido (dígito verificador incorreto)',
    }
  }

  return {
    valid: false,
    type: 'UNKNOWN',
    clean,
    formatted: clean,
    error: `Documento com tamanho inválido (${clean.length} dígitos — esperado 11 para CPF ou 14 para CNPJ)`,
  }
}

/**
 * Formata CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00)
 */
export function formatDocument(docRaw: string | null | undefined): string {
  const clean = cleanDocument(docRaw)
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  return clean || docRaw || ''
}
