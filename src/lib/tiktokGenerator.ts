import type { Product } from '@/types/inventory'
import { STORE_CONFIG } from '@/lib/storeConfig'
import { generateQRCodeMatrix } from '@/components/QRCodeSVG'
import { getProductCoverPhoto, getProductStoreUrl } from '@/lib/instagramGenerator'

export type TikTokCaptionFormat = 'achadinho' | 'urgencia' | 'revendedor'

/**
 * Converte qualquer URL de imagem em Data URL (base64) via fetch blob
 * para evitar qualquer restrição de Canvas Tainted / CORS ao exportar toDataURL.
 */
async function loadImageAsDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) {
    return url
  }

  try {
    const response = await fetch(url, { credentials: 'omit' })
    if (!response.ok) {
      throw new Error(`Status HTTP ${response.status}`)
    }
    const blob = await response.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result)
        } else {
          reject(new Error('Falha ao ler blob da imagem como Data URL'))
        }
      }
      reader.onerror = () => reject(new Error('Erro no FileReader'))
      reader.readAsDataURL(blob)
    })
  } catch (fetchErr) {
    console.warn('Fallback para URL direta (fetch dataUrl falhou):', fetchErr)
    return url
  }
}

/**
 * Desenha o QR Code diretamente em um Canvas 2D
 */
function drawQRCodeOnCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  padding: number = 8,
) {
  const matrix = generateQRCodeMatrix(text)
  const moduleCount = matrix.length

  const outerSize = size + padding * 2
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(x - padding, y - padding, outerSize, outerSize, 12)
  ctx.fill()

  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1.5
  ctx.stroke()

  const cellSize = size / moduleCount
  ctx.fillStyle = '#000000'

  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (matrix[r][c]) {
        ctx.fillRect(
          Math.floor(x + c * cellSize),
          Math.floor(y + r * cellSize),
          Math.ceil(cellSize),
          Math.ceil(cellSize),
        )
      }
    }
  }

  ctx.restore()
}

/**
 * Gera legenda otimizada para TikTok (linguagem mais casual, rápida e viral)
 */
export function generateTikTokCaption(
  product: Product,
  format: TikTokCaptionFormat,
  storeUrl?: string,
): string {
  const brandModel = [product.brand, product.model].filter(Boolean).join(' ') || product.name
  const priceFormatted = Number(product.unit_price || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  const finalStoreUrl = storeUrl || getProductStoreUrl(product)
  const phone = STORE_CONFIG.whatsappDisplay
  const storeName = STORE_CONFIG.name || 'AmbicorpFlow'

  const brandTag = product.brand
    ? `#${product.brand.toLowerCase().replace(/[^a-z0-9]/g, '')}`
    : '#notebook'
  const modelTag = product.model ? `#${product.model.toLowerCase().replace(/[^a-z0-9]/g, '')}` : ''

  const baseHashtags = [
    '#tiktokbrasil',
    '#achadinhos',
    '#notebookrecondicionado',
    brandTag,
    modelTag,
    '#informatica',
    '#tecnologia',
    '#setup',
    '#homeoffice',
    '#custobeneficio',
    '#notebook',
    '#achados',
  ]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 10)
    .join(' ')

  if (format === 'achadinho') {
    return `👀 Achei desse jeito e não acreditei no preço!

Se liga nessa máquina corporativa que acabou de entrar no estoque da ${storeName}:

💻 ${brandModel}
⚡ Processador: ${product.processor || 'Core i5/i7 de alta velocidade'}
🧠 Memória RAM: ${product.ram || '8GB ou mais'}
🚀 SSD: ${product.storage || 'SSD ultrarrápido'}
🔋 Bateria testada: ${product.battery_health || 'Ótima autonomia'}
✨ Condição: Recondicionado com garantia e procedência

💸 Apenas ${priceFormatted} à vista! Muito mais máquina do que comprar notebook novo de entrada pelo dobro do preço.

👉 Quer garantir ou tirar dúvidas?
📲 WhatsApp: ${phone}
🛒 Loja e catálogo: ${finalStoreUrl}

Enviamos pra todo o Brasil com nota e garantia! 📦🇧🇷

.
${baseHashtags}`
  }

  if (format === 'urgencia') {
    return `🚨 ÚLTIMA UNIDADE NO ESTOQUE! Corre antes que levem! 🚨

${brandModel} saindo por APENAS ${priceFormatted} à vista! 🔥

Configuração pronta pra trabalhar e rodar liso:
- ${product.processor || 'Processador potente'}
- ${product.ram || 'Memória ágil'} + ${product.storage || 'SSD ultra veloz'}
- Bateria revisada (${product.battery_health || 'autonomia testada'})
${product.includes_charger ? '- Acompanha carregador original' : ''}

Quem conhece linha corporativa sabe que dura 10 anos. Quando esse lote fechar, o valor volta ao normal!

👇 Chama no Whats agora ou clica no link:
📲 WhatsApp: ${phone}
🌐 Compre direto no site: ${finalStoreUrl}

.
${baseHashtags} #urgencia #promocao`
  }

  // format === 'revendedor'
  return `📦 ATENÇÃO REVENDEDORES DE TI & EMPRESAS! Oportunidade de lote direto da fonte!

Disponível para venda corporativa e revenda:
💻 ${brandModel}
Configuração: ${[product.processor, product.ram, product.storage].filter(Boolean).join(' · ')}

Por que fechar com a ${storeName}?
✅ Equipamentos 100% revisados em bancada técnica
✅ Nota fiscal e garantia formal
✅ Desconto progressivo para compras por volume (3, 5, 10+ unidades)
✅ Margem excelente pra você revender na sua região

Valor unitário de referência: ${priceFormatted} (preço de atacado sob consulta).

📲 Fale direto com a mesa de vendas corporativas:
WhatsApp: ${phone}
Catálogo completo: ${finalStoreUrl}

.
${baseHashtags} #atacado #revenda #lotedenotebooks #b2b #informatica`
}

/**
 * Gera uma arte VERTICAL 1080×1920 (9:16) em Canvas para TikTok:
 * - Fundo premium escuro/neutro com destaque esmeralda
 * - Selo "RECONDICIONADO · PROCEDÊNCIA GARANTIDA" no topo
 * - Foto de capa do produto em crop central proporcional
 * - Faixa inferior escura com linha esmeralda, marca AmbicorpFlow, specs, preço à vista e WhatsApp
 * - QR Code escaneável apontando para a URL pública do produto com "COMPRE PELO QR"
 */
export async function generateTikTokPostImage(
  imageUrl: string,
  product: Product,
  storeName: string = STORE_CONFIG.name || 'AmbicorpFlow',
): Promise<string> {
  const safeDataUrl = await loadImageAsDataUrl(imageUrl)

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1920
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Não foi possível obter o contexto 2D do Canvas'))
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      // 1. Fundo vertical limpo com gradiente suave do cinza claro ao branco
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 1920)
      bgGrad.addColorStop(0, '#f8fafc')
      bgGrad.addColorStop(0.7, '#ffffff')
      bgGrad.addColorStop(1, '#f1f5f9')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, 1080, 1920)

      // 2. Header superior sutil (marca e tag TikTok Shop / Oferta)
      ctx.save()
      // Pílula superior "TIKTOK SHOP · OFERTA VERIFICADA"
      const topBadgeX = 60
      const topBadgeY = 70
      ctx.fillStyle = '#0f172a'
      ctx.beginPath()
      ctx.roundRect(topBadgeX, topBadgeY, 320, 52, 26)
      ctx.fill()

      // Ponto de luz ciano/magenta sutil do TikTok
      ctx.fillStyle = '#00f2fe'
      ctx.beginPath()
      ctx.arc(topBadgeX + 28, topBadgeY + 26, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fe0979'
      ctx.beginPath()
      ctx.arc(topBadgeX + 34, topBadgeY + 26, 5, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif'
      ctx.fillText('TIKTOK SHOP · OFERTA', topBadgeX + 54, topBadgeY + 34)

      // Selo de procedência mantido (sem o selo de 16 itens que foi removido)
      const sealText = 'RECONDICIONADO · PROCEDÊNCIA GARANTIDA'
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif'
      const sealWidth = ctx.measureText(sealText).width + 40
      const sealX = 1080 - 60 - sealWidth
      const sealY = 70

      ctx.fillStyle = '#064e3b'
      ctx.beginPath()
      ctx.roundRect(sealX, sealY, sealWidth, 52, 26)
      ctx.fill()

      ctx.fillStyle = '#34d399'
      ctx.fillText(sealText, sealX + 20, sealY + 34)
      ctx.restore()

      // Título do Produto no topo (destaque vertical para prender atenção nos primeiros 3s de vídeo)
      ctx.save()
      const brandModel = [product.brand, product.model].filter(Boolean).join(' ') || product.name
      ctx.fillStyle = '#0f172a'
      ctx.font = '900 48px system-ui, -apple-system, sans-serif'
      const maxTitleWidth = 960
      let titleStr = brandModel
      if (ctx.measureText(titleStr).width > maxTitleWidth) {
        while (ctx.measureText(titleStr + '...').width > maxTitleWidth && titleStr.length > 0) {
          titleStr = titleStr.slice(0, -1)
        }
        titleStr += '...'
      }
      ctx.fillText(titleStr, 60, 185)

      // Sub-tag de categoria / specs rápidas
      ctx.fillStyle = '#64748b'
      ctx.font = '600 24px system-ui, -apple-system, sans-serif'
      const quickSpec = [product.processor, product.ram, product.storage]
        .filter(Boolean)
        .join('  |  ')
      ctx.fillText(quickSpec || 'Equipamento corporativo revisado', 60, 225)
      ctx.restore()

      // 3. Área da Foto do Produto (Crop central vertical proporcional)
      // Área: Y de 260 até 1420 (altura 1160px, largura 960px)
      const photoAreaX = 60
      const photoAreaY = 260
      const photoAreaWidth = 960
      const photoAreaHeight = 1140

      // Card container para a foto com sombra suave e borda
      ctx.save()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.roundRect(photoAreaX, photoAreaY, photoAreaWidth, photoAreaHeight, 32)
      ctx.fill()
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()

      // Desenho proporcional da imagem dentro do card
      const imgWidth = img.naturalWidth || img.width
      const imgHeight = img.naturalHeight || img.height
      const margin = 50
      const availW = photoAreaWidth - margin * 2
      const availH = photoAreaHeight - margin * 2

      const scale = Math.min(availW / imgWidth, availH / imgHeight)
      const drawWidth = imgWidth * scale
      const drawHeight = imgHeight * scale
      const drawX = photoAreaX + (photoAreaWidth - drawWidth) / 2
      const drawY = photoAreaY + (photoAreaHeight - drawHeight) / 2

      ctx.save()
      // Clip com cantos arredondados para não vazar a foto
      ctx.beginPath()
      ctx.roundRect(photoAreaX, photoAreaY, photoAreaWidth, photoAreaHeight, 32)
      ctx.clip()
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)
      ctx.restore()

      // Badge flutuante de Preço sobre a foto no canto inferior esquerdo do card
      const priceFormatted = Number(product.unit_price || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
      ctx.save()
      const priceBadgeX = photoAreaX + 32
      const priceBadgeY = photoAreaY + photoAreaHeight - 110
      ctx.fillStyle = '#090d16'
      ctx.beginPath()
      ctx.roundRect(priceBadgeX, priceBadgeY, 360, 80, 20)
      ctx.fill()
      ctx.strokeStyle = '#10b981'
      ctx.lineWidth = 3
      ctx.stroke()

      ctx.fillStyle = '#a7f3d0'
      ctx.font = 'bold 16px system-ui, -apple-system, sans-serif'
      ctx.fillText('VALOR À VISTA', priceBadgeX + 24, priceBadgeY + 30)

      ctx.fillStyle = '#34d399'
      ctx.font = '900 36px system-ui, -apple-system, sans-serif'
      ctx.fillText(priceFormatted, priceBadgeX + 24, priceBadgeY + 68)
      ctx.restore()

      // 4. Faixa Inferior Escura com detalhe Esmeralda (Y: 1440 até 1920, altura 480px)
      const footerY = 1440
      const footerHeight = 480

      ctx.save()
      const fGrad = ctx.createLinearGradient(0, footerY, 1080, 1920)
      fGrad.addColorStop(0, '#090d16')
      fGrad.addColorStop(1, '#0f172a')
      ctx.fillStyle = fGrad
      ctx.fillRect(0, footerY, 1080, footerHeight)

      // Linha de detalhe verde esmeralda no topo da faixa
      ctx.fillStyle = '#10b981'
      ctx.fillRect(0, footerY, 1080, 8)

      // 5. Marca AmbicorpFlow e Specs
      ctx.fillStyle = '#ffffff'
      ctx.font = '900 52px system-ui, -apple-system, sans-serif'
      ctx.fillText(storeName, 60, footerY + 80)

      // Linha de specs detalhadas
      ctx.fillStyle = '#34d399'
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif'
      ctx.fillText('CONFIGURAÇÃO REVISADA EM BANCADA:', 60, footerY + 130)

      const specsList = [
        `• Processador: ${product.processor || 'Linha corporativa'}`,
        `• Memória RAM: ${product.ram || 'Expandível'}`,
        `• Armazenamento: ${product.storage || 'SSD ultrarrápido'}`,
        `• Bateria: ${product.battery_health || 'Autonomia testada'}`,
      ]

      ctx.fillStyle = '#cbd5e1'
      ctx.font = '500 24px system-ui, -apple-system, sans-serif'
      let specY = footerY + 175
      for (const line of specsList) {
        ctx.fillText(line, 60, specY)
        specY += 36
      }

      // Linha de WhatsApp
      ctx.fillStyle = '#f8fafc'
      ctx.font = 'bold 26px system-ui, -apple-system, sans-serif'
      ctx.fillText(`WhatsApp: ${STORE_CONFIG.whatsappDisplay}`, 60, footerY + 360)

      ctx.fillStyle = '#94a3b8'
      ctx.font = '500 20px system-ui, -apple-system, sans-serif'
      ctx.fillText('Garantia, Nota Fiscal e Envio para Todo o Brasil', 60, footerY + 400)

      // 6. QR Code escaneável apontando para a página pública do produto
      const storeProductUrl = getProductStoreUrl(product)
      const qrCodeSize = 200
      const qrPadding = 12
      const qrX = 1080 - 60 - qrCodeSize
      const qrY = footerY + 110

      drawQRCodeOnCanvas(ctx, storeProductUrl, qrX, qrY, qrCodeSize, qrPadding)

      // Micro call-to-action em destaque abaixo do QR Code
      ctx.fillStyle = '#10b981'
      ctx.beginPath()
      ctx.roundRect(
        qrX - qrPadding,
        qrY + qrCodeSize + qrPadding + 14,
        qrCodeSize + qrPadding * 2,
        44,
        8,
      )
      ctx.fill()

      ctx.fillStyle = '#064e3b'
      ctx.font = '900 18px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('COMPRE PELO QR', qrX + qrCodeSize / 2, qrY + qrCodeSize + qrPadding + 42)

      ctx.restore()

      try {
        const dataUrl = canvas.toDataURL('image/png')
        resolve(dataUrl)
      } catch (canvasErr) {
        reject(canvasErr)
      }
    }

    img.onerror = (err) => {
      reject(new Error('Falha ao carregar imagem para o Canvas: ' + err))
    }

    img.src = safeDataUrl
  })
}

export { getProductCoverPhoto, getProductStoreUrl }
