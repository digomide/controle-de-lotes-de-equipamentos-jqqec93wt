import type { Product } from '@/types/inventory'
import { STORE_CONFIG } from '@/lib/storeConfig'
import pb from '@/lib/pocketbase/client'
import { generateQRCodeMatrix } from '@/components/QRCodeSVG'

export type CaptionFormat = 'tecnico' | 'urgencia' | 'lote'

/**
 * Obtém a URL da foto de capa principal do produto.
 * Respeita a ordenação customizada (photo_order), suportando tanto arquivos
 * enviados no PocketBase (incluindo imagens geradas por IA com fundo branco)
 * quanto URLs externas.
 */
export function getProductCoverPhoto(product: Product): string {
  const validPhotos = Array.isArray(product.photos) ? product.photos : []
  const validImages = Array.isArray(product.images) ? product.images : []

  // 1. Prioridade absoluta para photo_order se existir
  if (product.photo_order && Array.isArray(product.photo_order) && product.photo_order.length > 0) {
    for (const item of product.photo_order) {
      if (!item || !item.value) continue

      if (item.type === 'photo') {
        if (validPhotos.includes(item.value)) {
          return pb.files.getURL(product, item.value)
        }
        // Se a foto tiver nome de arquivo salvo diretamente (ex.: notebook_ml_bg_white_...)
        return pb.files.getURL(product, item.value)
      }

      if (item.type === 'image' && item.value) {
        const val = String(item.value).trim()
        if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:')) {
          return val
        }
        return val
      }
    }
  }

  // 2. Se tiver photos (arquivo nativo PocketBase / fotos processadas pela IA adicionadas à coleção)
  if (validPhotos.length > 0 && validPhotos[0]) {
    return pb.files.getURL(product, validPhotos[0])
  }

  // 3. Se tiver images (URLs externas)
  if (validImages.length > 0 && validImages[0]) {
    const val = String(validImages[0]).trim()
    if (val) return val
  }

  // Fallback padrão
  return 'https://img.usecurling.com/p/800/800?q=laptop'
}

/**
 * Converte qualquer URL de imagem em Data URL (base64) via fetch blob
 * para evitar qualquer restrição de Canvas Tainted / CORS ao exportar toDataURL.
 */
async function loadImageAsDataUrl(url: string): Promise<string> {
  // Se já for data URL, retorna imediatamente
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
    // Fallback: se o fetch falhar por CORS estrito, retorna a URL original
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

  // Fundo branco com cantos arredondados para alto contraste
  const outerSize = size + padding * 2
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(x - padding, y - padding, outerSize, outerSize, 8)
  ctx.fill()

  // Borda sutil escura
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Módulos pretos do QR code
  const cellSize = size / moduleCount
  ctx.fillStyle = '#000000'

  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (matrix[r][c]) {
        // Renderizar com pequenos ajustes anti-bleeding
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
 * Monta a URL pública canônica da página do produto na loja
 */
export function getProductStoreUrl(product: Product): string {
  const slug = product.code || product.sku || product.id
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/loja/${slug}`
  }
  return `https://ambicorpflow.com.br/loja/${slug}`
}

export function generateInstagramCaption(
  product: Product,
  format: CaptionFormat,
  storeUrl?: string,
): string {
  const brandModel = [product.brand, product.model].filter(Boolean).join(' ') || product.name
  const priceFormatted = Number(product.unit_price || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  // URL da loja pública para o equipamento ou geral
  const finalStoreUrl = storeUrl || getProductStoreUrl(product)

  const phone = STORE_CONFIG.whatsappDisplay
  const storeName = STORE_CONFIG.name || 'AMbicorpFlow'

  // Montar hashtags relevantes com base na marca e tipo
  const brandTag = product.brand
    ? `#${product.brand.toLowerCase().replace(/[^a-z0-9]/g, '')}`
    : '#notebook'
  const modelTag = product.model ? `#${product.model.toLowerCase().replace(/[^a-z0-9]/g, '')}` : ''
  const baseHashtags = [
    '#notebookrecondicionado',
    brandTag,
    modelTag,
    '#informatica',
    '#notebooks',
    '#tecnologia',
    '#seminovos',
    '#recondicionado',
    '#dell',
    '#thinkpad',
    '#lenovo',
    '#hp',
    '#ti',
    '#homeoffice',
    '#hardware',
  ]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 10)
    .join(' ')

  if (format === 'tecnico') {
    return `💻 ${brandModel.toUpperCase()} — RECONDICIONADO COM GARANTIA!

Procurando máquina corporativa robusta e com custo-benefício imbatível? Confira esta oportunidade:

⚙️ ESPECIFICAÇÕES TÉCNICAS:
• Marca: ${product.brand || 'Consulte'}
• Modelo: ${product.model || 'Linha Corporativa'}
• Processador: ${product.processor || 'Intel Core'}
• Memória RAM: ${product.ram || '8GB DDR4'}
• Armazenamento: ${product.storage || 'SSD ultrarrápido'}
• Tela: ${product.screen_size || '14" Antirreflexo'}
• Condição: Recondicionado · Excelente (Revisado em bancada)
• Checklist técnico de 16 itens inspecionado e aprovado ✅
• Bateria testada: ${product.battery_health || 'Ótima autonomia'}
${product.includes_charger ? '• Acompanha carregador original' : ''}

💰 Valor à vista: ${priceFormatted}

📲 Peça fotos ou garanta a sua unidade agora:
WhatsApp: ${phone}
Catálogo online: ${finalStoreUrl}

Garantia e procedência garantida pela ${storeName}. Enviamos para todo o Brasil! 📦

.
.
${baseHashtags}`
  }

  if (format === 'urgencia') {
    return `🚨 ÚLTIMA UNIDADE DISPONÍVEL! 🚨

${brandModel} por apenas ${priceFormatted} à vista!

Equipamento corporativo de alto desempenho, testado item a item e pronto para entrega imediata. Quando acabar esse lote, o preço vai subir!

⚡ Destaques rápidos:
- ${product.processor || 'Processador de alta performance'}
- ${product.ram || 'Memória ágil'} | ${product.storage || 'Armazenamento SSD'}
- Bateria com saúde aferida (${product.battery_health || '90%+'} de capacidade)
- Condição excelente, impecável para trabalho pesado ou estudos

👉 Não perca tempo, reserve agora no WhatsApp antes que outro leve:
📲 ${phone}
🌐 Acesse o link da nossa loja: ${finalStoreUrl}

${storeName} — Equipamentos corporativos com nota e garantia!

.
.
${baseHashtags}`
  }

  // format === 'lote'
  return `📦 OPORTUNIDADE PARA REVENDEDORES & EMPRESAS — COMPRA POR VOLUME!

Disponível em lote: ${brandModel}
Condição: Recondicionado · Excelente / Revisado Item a Item.

Ideal para:
🏢 Empresas estruturando ou renovando parque de TI
💻 Revendedores de informática buscando alta margem e giro rápido
📈 Coworkings, call centers e escritórios

Vantagens para compras em volume:
✅ Desconto progressivo por quantidade
✅ Nota fiscal e garantia inclusa
✅ Checklist rigoroso de 16 itens já realizado
✅ Configuração padronizada: ${product.processor || 'Intel Core'}, ${product.ram || '16GB'}, ${product.storage || 'SSD'}

Fale direto com nosso setor corporativo para tabela especial de atacado:
📲 WhatsApp Corporativo: ${phone}
🌐 Conheça nossa loja: ${finalStoreUrl}

${storeName} — Seu fornecedor confiável de seminovos corporativos!

.
.
${baseHashtags} #vendascorporativas #lotesdenotebooks #revendainformatica #atacadoinformatica`
}

/**
 * Gera uma imagem 1080x1080 com a foto do produto em crop centralizado,
 * selo de procedência mantido no topo esquerdo (removendo selo "16 itens testados"),
 * rodapé corporativo AMbicorpFlow, preço, WhatsApp e QR Code escaneável
 * apontando direto para a página de compra do produto.
 */
export async function generatePostImage(
  imageUrl: string,
  product: Product,
  storeName: string = STORE_CONFIG.name || 'AMbicorpFlow',
): Promise<string> {
  // Pré-converter a imagem em Data URL segura contra CORS tainted canvas
  const safeDataUrl = await loadImageAsDataUrl(imageUrl)

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1080
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Não foi possível obter o contexto 2D do Canvas'))
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      // 1. Fundo limpo branco puro
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 1080, 1080)

      // 2. Desenhar a foto em crop quadrado centralizado (área da foto: 1080 x 920 para dar espaço ao rodapé de 160px)
      const photoAreaHeight = 920
      const photoAreaWidth = 1080

      const imgWidth = img.naturalWidth || img.width
      const imgHeight = img.naturalHeight || img.height

      // Fit proporcional centralizado com margem elegante
      const scale = Math.min((photoAreaWidth - 80) / imgWidth, (photoAreaHeight - 80) / imgHeight)
      const drawWidth = imgWidth * scale
      const drawHeight = imgHeight * scale
      const drawX = (photoAreaWidth - drawWidth) / 2
      const drawY = 40 + (photoAreaHeight - 40 - drawHeight) / 2

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

      // 3. Selo/Tag superior elegante (Condição & Procedência) no TOPO ESQUERDO
      // NOTA: O selo "16 ITENS TESTADOS" no topo direito foi removido conforme solicitado.
      ctx.save()
      const badgeText = 'RECONDICIONADO · PROCEDÊNCIA GARANTIDA'
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif'
      const badgeWidth = ctx.measureText(badgeText).width + 36
      const badgeHeight = 44
      const badgeX = 40
      const badgeY = 40

      // Pílula arredondada verde escuro / esmeralda
      ctx.fillStyle = '#064e3b'
      ctx.beginPath()
      ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 10)
      ctx.fill()

      ctx.fillStyle = '#34d399'
      ctx.fillText(badgeText, badgeX + 18, badgeY + 30)
      ctx.restore()

      // 4. Faixa/Rodapé inferior estilizado da marca (160px de altura)
      const footerY = 920
      const footerHeight = 160

      // Gradiente escuro corporativo para o rodapé
      const grad = ctx.createLinearGradient(0, footerY, 1080, 1080)
      grad.addColorStop(0, '#090d16')
      grad.addColorStop(1, '#0f172a')
      ctx.fillStyle = grad
      ctx.fillRect(0, footerY, 1080, footerHeight)

      // Linha de detalhe verde esmeralda no topo do rodapé
      ctx.fillStyle = '#10b981'
      ctx.fillRect(0, footerY, 1080, 6)

      // 5. QR Code escaneável para a página do produto na loja
      // Posicionado no lado direito da faixa inferior
      const storeProductUrl = getProductStoreUrl(product)
      const qrCodeSize = 104
      const qrPadding = 6
      const qrRightMargin = 40
      const qrX = 1080 - qrRightMargin - qrCodeSize
      const qrY = footerY + (footerHeight - qrCodeSize) / 2 + 3

      drawQRCodeOnCanvas(ctx, storeProductUrl, qrX, qrY, qrCodeSize, qrPadding)

      // Micro call-to-action embaixo / ao lado do QR Code
      ctx.save()
      ctx.fillStyle = '#a7f3d0'
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('COMPRE PELO QR', qrX + qrCodeSize / 2, footerY + footerHeight - 12)
      ctx.restore()

      // 6. Texto do Rodapé: Nome da Marca & Specs principais (lado esquerdo)
      ctx.save()

      // Nome da Loja / Marca
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 44px system-ui, -apple-system, sans-serif'
      ctx.fillText(storeName, 44, footerY + 68)

      // Subtítulo da marca (Specs)
      ctx.fillStyle = '#94a3b8'
      ctx.font = '500 22px system-ui, -apple-system, sans-serif'
      const specLine = [product.processor, product.ram, product.storage].filter(Boolean).join(' · ')
      ctx.fillText(specLine || 'Notebooks Corporativos Revisados', 44, footerY + 115)

      // 7. Bloco Central/Direito: Preço e WhatsApp (à esquerda do QR Code)
      const priceFormatted = Number(product.unit_price || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })

      // Posição de alinhamento à direita dos dados de preço/contato antes do QR Code
      const textRightEdge = qrX - 32

      ctx.textAlign = 'right'
      ctx.fillStyle = '#34d399'
      ctx.font = 'bold 40px system-ui, -apple-system, sans-serif'
      ctx.fillText(priceFormatted, textRightEdge, footerY + 68)

      ctx.fillStyle = '#f1f5f9'
      ctx.font = '600 20px system-ui, -apple-system, sans-serif'
      ctx.fillText(`WhatsApp: ${STORE_CONFIG.whatsappDisplay}`, textRightEdge, footerY + 115)

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
