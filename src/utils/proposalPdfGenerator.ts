/**
 * Utilitário de Geração e Download de PDF para a Proposta de Imóvel.
 * - Suporta importação direta da biblioteca html2pdf.js via bundle instalado ou fallback dinâmico
 * - Renderiza o elemento A4 fielmente com múltiplas páginas e download direto no navegador
 * - Nome do arquivo padrão: Proposta-Imovel-Francisco-Sales-905.pdf
 */

export interface GeneratePdfOptions {
  elementId?: string
  filename?: string
  onProgress?: (progress: number, label: string) => void
}

/**
 * Carrega a instância de html2pdf (via import de pacote ou window.html2pdf ou script tag dinâmica).
 */
async function getHtml2PdfInstance(): Promise<any> {
  // 1. Já disponível no window
  if (typeof (window as any).html2pdf === 'function') {
    return (window as any).html2pdf
  }

  // 2. Import dinâmico do pacote npm html2pdf.js
  try {
    const mod = await import('html2pdf.js')
    const fn = (mod && (mod.default || mod)) as any
    if (typeof fn === 'function') {
      return fn
    }
  } catch (err) {
    console.warn('Import de html2pdf.js via módulo falhou, tentando fallback script CDN:', err)
  }

  // 3. Script dinâmico via CDN se necessário
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
 * Faz o download do documento da proposta em PDF direto no navegador.
 */
export async function downloadProposalPdf(options: GeneratePdfOptions = {}): Promise<boolean> {
  const elementId = options.elementId || 'proposta-imovel-doc'
  const filename = options.filename || 'Proposta-Imovel-Francisco-Sales-905.pdf'
  const onProgress = options.onProgress || (() => {})

  const element = document.getElementById(elementId)
  if (!element) {
    throw new Error(`Elemento #${elementId} não encontrado no documento.`)
  }

  try {
    onProgress(15, 'Preparando motor de renderização PDF...')
    const html2pdf = await getHtml2PdfInstance()

    onProgress(45, 'Processando layout e tabelas A4...')

    // Configuração para A4 portrait com quebras de página suaves
    const opt = {
      margin: [10, 10, 10, 10], // mm [top, left, bottom, right]
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
          'tr',
          'table',
          'header',
          'section',
          '.proposta-section-block',
        ],
      },
    }

    onProgress(75, 'Gerando arquivo PDF...')
    await html2pdf().set(opt).from(element).save()
    onProgress(100, 'Download concluído com sucesso!')
    return true
  } catch (err) {
    console.error('Falha no html2pdf client-side:', err)
    throw err
  }
}
