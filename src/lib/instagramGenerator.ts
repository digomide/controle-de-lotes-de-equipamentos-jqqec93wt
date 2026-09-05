import type { Product } from '@/types/inventory'
import { STORE_CONFIG } from '@/lib/storeConfig'

export type CaptionFormat = 'tecnico' | 'urgencia' | 'lote'

export function getProductCoverPhoto(product: Product): string {
  // 1. Prioridade para photo_order se existir
  if (product.photo_order && Array.isArray(product.photo_order) && product.photo_order.length > 0) {
    for (const item of product.photo_order) {
      if (!item || !item.value) continue
      if (
        item.type === 'photo' &&
        Array.isArray(product.photos) &&
        product.photos.includes(item.value)
      ) {
        return `/api/files/products/${product.id}/${item.value}`
      }
      if (item.type === 'image' && item.value) {
        return item.value
      }
    }
  }

  // 2. Se tiver photos (arquivo nativo PocketBase)
  if (
    product.photos &&
    Array.isArray(product.photos) &&
    product.photos.length > 0 &&
    product.photos[0]
  ) {
    return `/api/files/products/${product.id}/${product.photos[0]}`
  }

  // 3. Se tiver images (URLs)
  if (
    product.images &&
    Array.isArray(product.images) &&
    product.images.length > 0 &&
    product.images[0]
  ) {
    return product.images[0]
  }

  return 'https://img.usecurling.com/p/800/800?q=laptop'
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
  const finalStoreUrl =
    storeUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/loja/${product.code || product.sku || product.id}`
      : `https://ambicorpflow.com.br/loja/${product.code || product.sku || product.id}`)

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
 * Gera uma imagem 1080x1080 com a foto do produto em crop quadrado central
 * e uma barra/rodapé profissional com o nome da marca (AMbicorpFlow),
 * especificações e contato.
 */
export async function generatePostImage(
  imageUrl: string,
  product: Product,
  storeName: string = STORE_CONFIG.name || 'AMbicorpFlow',
): Promise<string> {
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
      // 1. Fundo limpo branco/cinza bem suave
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 1080, 1080)

      // 2. Desenhar a foto em crop quadrado centralizado (área da foto: 1080 x 920 para dar espaço ao rodapé de 160px)
      const photoAreaHeight = 920
      const photoAreaWidth = 1080

      const imgWidth = img.naturalWidth || img.width
      const imgHeight = img.naturalHeight || img.height

      // Calcular aspecto para preencher proporcionalmente (cover ou contain elegante)
      // Como são fotos em fundo branco de notebooks, usamos fit proporcional centralizado com margem
      const scale = Math.min((photoAreaWidth - 80) / imgWidth, (photoAreaHeight - 80) / imgHeight)
      const drawWidth = imgWidth * scale
      const drawHeight = imgHeight * scale
      const drawX = (photoAreaWidth - drawWidth) / 2
      const drawY = 40 + (photoAreaHeight - 40 - drawHeight) / 2

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

      // 3. Selo/Tag superior elegante (Condição & Procedência)
      ctx.save()
      // Faixa de fundo do selo
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

      // Selo 100% Testado no canto direito
      const testText = '16 ITENS TESTADOS'
      const testWidth = ctx.measureText(testText).width + 32
      const testX = 1080 - 40 - testWidth
      ctx.fillStyle = '#0f172a'
      ctx.beginPath()
      ctx.roundRect(testX, badgeY, testWidth, badgeHeight, 10)
      ctx.fill()
      ctx.fillStyle = '#f8fafc'
      ctx.fillText(testText, testX + 16, badgeY + 30)
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

      // Texto do Rodapé: Nome da Marca & Specs principais
      ctx.save()

      // Nome da Loja / Marca
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 44px system-ui, -apple-system, sans-serif'
      ctx.fillText(storeName, 48, footerY + 68)

      // Subtítulo da marca
      ctx.fillStyle = '#94a3b8'
      ctx.font = '500 22px system-ui, -apple-system, sans-serif'
      const specLine = [product.processor, product.ram, product.storage].filter(Boolean).join(' · ')
      ctx.fillText(specLine || 'Notebooks Corporativos Revisados', 48, footerY + 115)

      // Bloco do WhatsApp / Preço no canto direito do rodapé
      const priceFormatted = Number(product.unit_price || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })

      ctx.textAlign = 'right'
      ctx.fillStyle = '#34d399'
      ctx.font = 'bold 42px system-ui, -apple-system, sans-serif'
      ctx.fillText(priceFormatted, 1032, footerY + 68)

      ctx.fillStyle = '#f1f5f9'
      ctx.font = '600 22px system-ui, -apple-system, sans-serif'
      ctx.fillText(`WhatsApp: ${STORE_CONFIG.whatsappDisplay}`, 1032, footerY + 115)

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

    img.src = imageUrl
  })
}
