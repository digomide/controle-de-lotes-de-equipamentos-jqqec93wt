/**
 * Utilitário de Geração e Download de PDF para o Relatório de Contestação de Reputação.
 * - Formato: A4 Retrato (210 x 297 mm)
 * - Margens de documento corporativo com paginação e suporte a quebras limpas
 * - Reutiliza bundle html2pdf.js com fallback de CDN idêntico ao reembolsoPdfGenerator.ts
 */

export interface GenerateReputationPdfOptions {
  elementId?: string
  filename?: string
  onProgress?: (progress: number, label: string) => void
}

/**
 * Carrega a biblioteca html2pdf.js por import de pacote ou script CDN de fallback
 */
async function getHtml2PdfInstance(): Promise<any> {
  if (typeof (window as any).html2pdf === 'function') {
    return (window as any).html2pdf
  }

  try {
    const mod = await import('html2pdf.js')
    const fn = (mod && (mod.default || mod)) as any
    if (typeof fn === 'function') {
      return fn
    }
  } catch (err) {
    console.warn('Import de html2pdf.js via módulo falhou, tentando fallback CDN:', err)
  }

  const cdnUrl = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${cdnUrl}"]`)
    if (existing && typeof (window as any).html2pdf === 'function') {
      return resolve((window as any).html2pdf)
    }

    const script = document.createElement('script')
    script.src = cdnUrl
    script.async = true
    script.crossOrigin = 'anonymous'

    const timer = setTimeout(() => {
      reject(new Error('Tempo limite ao carregar biblioteca de PDF'))
    }, 10000)

    script.onload = () => {
      clearTimeout(timer)
      if (typeof (window as any).html2pdf === 'function') {
        resolve((window as any).html2pdf)
      } else {
        reject(new Error('Biblioteca html2pdf não inicializada'))
      }
    }

    script.onerror = () => {
      clearTimeout(timer)
      reject(new Error('Falha de rede ao carregar html2pdf'))
    }

    document.head.appendChild(script)
  })
}

/**
 * Faz o download do Relatório de Contestação de Reputação em PDF A4
 */
export async function downloadReputationReportPdf(
  options: GenerateReputationPdfOptions = {},
): Promise<boolean> {
  const elementId = options.elementId || 'relatorio-contestacao-pdf-doc'
  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = options.filename || `Relatorio-Contestacao-Reputacao-${dateStr}.pdf`
  const onProgress = options.onProgress || (() => {})

  const element = document.getElementById(elementId)
  if (!element) {
    throw new Error(`Elemento #${elementId} não encontrado no documento para geração do PDF.`)
  }

  try {
    onProgress(15, 'Preparando motor de renderização PDF...')
    const html2pdf = await getHtml2PdfInstance()

    onProgress(45, 'Processando casos e defesas de reputação...')

    const opt = {
      margin: [10, 12, 10, 12], // mm [top, left, bottom, right]
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        letterRendering: true,
        scrollX: 0,
        scrollY: 0,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
        compress: true,
      },
      pagebreak: {
        mode: ['avoid-all', 'css', 'legacy'],
        avoid: [
          '.break-inside-avoid',
          '.report-case-card',
          '.report-header-block',
          '.report-summary-block',
          '.report-footer-block',
        ],
      },
    }

    onProgress(75, 'Gerando arquivo PDF...')
    await html2pdf().set(opt).from(element).save()
    onProgress(100, 'Download concluído com sucesso!')
    return true
  } catch (err) {
    console.error('Falha na geração do PDF de contestação de reputação:', err)
    throw err
  }
}
