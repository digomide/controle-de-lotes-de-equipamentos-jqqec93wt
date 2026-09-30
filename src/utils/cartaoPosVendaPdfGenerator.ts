/**
 * Utilitário de Geração e Download de PDF para o Cartão de Satisfação Pós-Venda.
 * - Formato: A5 Paisagem (210mm x 148mm) ou A4 proporcional
 * - Reutiliza bundle html2pdf.js com fallback dinâmico
 */

export interface GenerateCartaoPdfOptions {
  elementId?: string
  filename?: string
  onProgress?: (progress: number, label: string) => void
}

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
 * Realiza o download do Cartão de Pós-Venda em formato A5 Paisagem (210 x 148 mm)
 */
export async function downloadCartaoPosVendaPdf(
  options: GenerateCartaoPdfOptions = {},
): Promise<boolean> {
  const elementId = options.elementId || 'cartao-pos-venda-doc'
  const filename = options.filename || 'Cartao-Pos-Venda-Ambicorp.pdf'
  const onProgress = options.onProgress || (() => {})

  const element = document.getElementById(elementId)
  if (!element) {
    throw new Error(`Elemento #${elementId} não encontrado no documento.`)
  }

  try {
    onProgress(20, 'Preparando motor de renderização PDF...')
    const html2pdf = await getHtml2PdfInstance()

    onProgress(50, 'Processando layout gráfico do cartão...')

    // Configuração para folha única A5 em orientação horizontal (landscape: 210mm larg x 148mm alt)
    const opt = {
      margin: [0, 0, 0, 0], // Sem borda externa para preenchimento total do cartão
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        letterRendering: true,
        scrollX: 0,
        scrollY: 0,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a5',
        orientation: 'landscape',
        compress: true,
      },
    }

    onProgress(80, 'Gerando arquivo PDF...')
    await html2pdf().set(opt).from(element).save()
    onProgress(100, 'Download concluído com sucesso!')
    return true
  } catch (err) {
    console.error('Falha no html2pdf do cartão pós-venda:', err)
    throw err
  }
}
