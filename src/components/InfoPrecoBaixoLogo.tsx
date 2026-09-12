/**
 * SVG vector logos and helpers for INFOPRECOBAIXO
 * All vectors are pure SVG with no raster dependencies or external fonts.
 * Fonts use system-ui / -apple-system / 'Segoe UI' / Roboto / sans-serif with bold vector rendering.
 */

export type LogoVariant = 'light' | 'dark' | 'mono'
export type ConceptType = 'tag_arrow' | 'hex_hardware' | 'fast_lightning'

export interface LogoSvgOptions {
  variant?: LogoVariant
  showSubtext?: boolean // "Uma marca Ambicorp" / "Recondicionados com Garantia"
  width?: number | string
  height?: number | string
  className?: string
}

/**
 * PALETA OFICIAL INFOPRECOBAIXO:
 * - Verde-Limão Cyber / Preço Baixo: #10b981 / #00E676 / #22c55e (Destaque de oportunidade, economia e frescor)
 * - Grafite Profundo / Confiança Tech: #0f172a / #1e293b (Base sólida corporativa)
 * - Laranja Ambicorp (Toque sutil de união): #f97316 (Ligação com a fábrica Ambicorp)
 * - Fundo Claro: #ffffff / #f8fafc
 * - Fundo Escuro: #090d16 / #0f172a
 */
export const BRAND_COLORS = [
  {
    name: 'Verde Preço Baixo (Destaque Principal)',
    role: 'Acento de economia, oportunidade e recondicionados premium',
    hex: '#10B981',
    rgb: '16, 185, 129',
    textDark: true,
  },
  {
    name: 'Verde Neon Cyber (Glow & Ícone)',
    role: 'Iluminação de contraste, tags de frete e badges de oferta',
    hex: '#00E676',
    rgb: '0, 230, 118',
    textDark: true,
  },
  {
    name: 'Grafite Noturno / Ardósia Tech',
    role: 'Base de seriedade, tipografia principal e fundos de contraste',
    hex: '#0F172A',
    rgb: '15, 23, 42',
    textDark: false,
  },
  {
    name: 'Azul Ardósia Médio',
    role: 'Estruturas secundárias, bordas e divisores',
    hex: '#334155',
    rgb: '51, 65, 85',
    textDark: false,
  },
  {
    name: 'Laranja Ambicorp Flow (Chancela)',
    role: 'Selo de procedência industrial Ambicorp / Recondicionamento de fábrica',
    hex: '#F97316',
    rgb: '249, 115, 22',
    textDark: false,
  },
  {
    name: 'Branco Puro',
    role: 'Fundo limpo padrão Mercado Livre e etiquetas de impressão',
    hex: '#FFFFFF',
    rgb: '255, 255, 255',
    textDark: true,
  },
]

/**
 * 1. CONCEITO PRINCIPAL (RECOMENDADO):
 * Símbolo: Tag de preço angular dinâmica integrada à seta para baixo descendente estilizada
 * (remetendo a "preço baixo") que ao mesmo tempo sugere a letra 'b' de "BAIXO" e um chip/slot de notebook.
 * Texto: "INFOPRECO" em peso pesado e "BAIXO" em destaque de cor verde neon/esmeralda com a chancela Ambicorp.
 */
export function getRecommendedLogoSvgString(
  variant: LogoVariant = 'light',
  showSubtext: boolean = true,
): string {
  const isDark = variant === 'dark'
  const isMono = variant === 'mono'

  // Colors
  const textColor1 = isMono ? (isDark ? '#FFFFFF' : '#000000') : isDark ? '#F8FAFC' : '#0F172A'
  const textColor2 = isMono ? (isDark ? '#CBD5E1' : '#333333') : '#10B981'
  const tagFill1 = isMono ? (isDark ? '#333333' : '#E2E8F0') : '#0F172A'
  const tagStroke = isMono ? (isDark ? '#FFFFFF' : '#000000') : '#10B981'
  const arrowFill = isMono ? (isDark ? '#FFFFFF' : '#000000') : '#00E676'
  const subtextColor = isMono ? (isDark ? '#94A3B8' : '#64748B') : isDark ? '#94A3B8' : '#64748B'
  const bgRect = isDark ? `<rect width="640" height="160" fill="#090D16" rx="16" />` : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 160" width="100%" height="100%">
  <defs>
    <linearGradient id="rec-grad-accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00E676" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>
    <linearGradient id="rec-grad-dark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
    <filter id="rec-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  ${bgRect}

  <!-- ÍCONE SÍMBOLO: TAG PREÇO + SETA DESCENDENTE + LETRA 'b' (x: 28, y: 26, size: 108x108) -->
  <g transform="translate(30, 26)">
    <!-- Base da Tag Inclinada Tecnológica -->
    <path d="M18 12 L74 12 C82 12 90 18 94 25 L104 42 C108 49 108 58 104 65 L84 94 C80 100 72 104 64 104 L18 104 C8 104 0 96 0 86 L0 30 C0 20 8 12 18 12 Z" 
          fill="${isDark ? '#0F172A' : isMono ? tagFill1 : '#F1F5F9'}" 
          stroke="${tagStroke}" 
          stroke-width="3.5" />
    
    <!-- Orifício da Tag / Botão de Power circular com traço de circuito -->
    <circle cx="28" cy="38" r="8" fill="none" stroke="${tagStroke}" stroke-width="3" />
    <circle cx="28" cy="38" r="3.5" fill="${arrowFill}" />

    <!-- Traço tech de circuito conectando a tag -->
    <path d="M38 38 L54 38 L62 46" fill="none" stroke="${tagStroke}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2 3" opacity="0.7" />

    <!-- A Seta Para Baixo Estilizada formando a silhueta da letra 'b' de "BAIXO" e indicador de economia -->
    <path d="M50 36 V68 C50 78 58 84 68 84 C78 84 86 76 86 66 C86 56 78 48 68 48 C62 48 56 51 52 56" 
          fill="none" 
          stroke="${isMono ? arrowFill : 'url(#rec-grad-accent)'}" 
          stroke-width="7.5" 
          stroke-linecap="round" 
          stroke-linejoin="round" />

    <!-- Ponta da Seta indicando "PREÇO BAIXO / QUEDA DE PREÇO" na base inferior esquerda -->
    <path d="M42 66 L50 78 L58 66" 
          fill="none" 
          stroke="${isMono ? arrowFill : 'url(#rec-grad-accent)'}" 
          stroke-width="7.5" 
          stroke-linecap="round" 
          stroke-linejoin="round" />
  </g>

  <!-- TIPOGRAFIA DA LOGOMARCA (Vetorial via fontes do sistema de alto contraste) -->
  <g transform="translate(160, 40)">
    <!-- Linha Superior / Principal: INFOPRECO BAIXO -->
    <text x="0" y="52" 
          font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" 
          font-size="44" 
          font-weight="900" 
          letter-spacing="-1.5">
      <tspan fill="${textColor1}">INFO</tspan><tspan fill="${textColor1}">PRECO</tspan><tspan fill="${textColor2}" dx="8">BAIXO</tspan>
    </text>

    <!-- Ponto de exclamação tech / Badge de Preço -->
    <circle cx="438" cy="22" r="5" fill="${arrowFill}" />

    <!-- Linha Secundária: Subtítulo / Chancela Oficial -->
    ${
      showSubtext
        ? `
    <g transform="translate(2, 78)">
      <!-- Tracinho acento -->
      <rect x="0" y="3" width="16" height="3" rx="1.5" fill="${arrowFill}" />
      
      <text x="26" y="9" 
            font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" 
            font-size="13" 
            font-weight="700" 
            letter-spacing="0.8" 
            fill="${subtextColor}">
        Hub de Ofertas e Tecnologia
      </text>
    </g>`
        : ''
    }
  </g>
</svg>`
}

/**
 * 2. VARIAÇÃO ALTERNATIVA 1: HEXÁGONO HARDWARE + CIFRÃO / SETA PREÇO BAIXO
 * Símbolo: Hexágono tecnológico com trilhas de placa-mãe, centralizando a seta descendente cortada por cifrão tech.
 */
export function getHexHardwareLogoSvgString(
  variant: LogoVariant = 'light',
  showSubtext: boolean = true,
): string {
  const isDark = variant === 'dark'
  const isMono = variant === 'mono'

  const textColor1 = isMono ? (isDark ? '#FFFFFF' : '#000000') : isDark ? '#F8FAFC' : '#0F172A'
  const textColor2 = isMono ? (isDark ? '#CBD5E1' : '#333333') : '#00E676'
  const hexStroke = isMono ? (isDark ? '#FFFFFF' : '#000000') : '#10B981'
  const symbolFill = isMono ? (isDark ? '#FFFFFF' : '#000000') : '#00E676'
  const subtextColor = isMono ? (isDark ? '#94A3B8' : '#64748B') : isDark ? '#94A3B8' : '#64748B'
  const bgRect = isDark ? `<rect width="640" height="160" fill="#090D16" rx="16" />` : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 160" width="100%" height="100%">
  <defs>
    <linearGradient id="hex-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#00E676" />
    </linearGradient>
  </defs>

  ${bgRect}

  <!-- ÍCONE HEXÁGONO HARDWARE (x: 32, y: 26) -->
  <g transform="translate(34, 26)">
    <!-- Hexágono Externo -->
    <polygon points="54,6 98,30 98,78 54,102 10,78 10,30" 
             fill="${isDark ? '#0F172A' : isMono ? '#F1F5F9' : '#F8FAFC'}" 
             stroke="${hexStroke}" 
             stroke-width="3.5" 
             stroke-linejoin="round" />

    <!-- Trilhas de Circuito / Hardware -->
    <path d="M10 54 H28 L36 62" fill="none" stroke="${hexStroke}" stroke-width="2" stroke-linecap="round" opacity="0.6" />
    <path d="M98 54 H80 L72 46" fill="none" stroke="${hexStroke}" stroke-width="2" stroke-linecap="round" opacity="0.6" />
    <circle cx="36" cy="62" r="2.5" fill="${hexStroke}" />
    <circle cx="72" cy="46" r="2.5" fill="${hexStroke}" />

    <!-- Seta para Baixo Tech Vazada / Cifrão Integrado -->
    <path d="M54 26 V74 M42 62 L54 74 L66 62" 
          fill="none" 
          stroke="${symbolFill}" 
          stroke-width="6.5" 
          stroke-linecap="round" 
          stroke-linejoin="round" />

    <!-- Traço sutil de Moeda / Preço -->
    <circle cx="54" cy="42" r="14" fill="none" stroke="${symbolFill}" stroke-width="2.5" stroke-dasharray="16 8" />
  </g>

  <!-- TEXTO -->
  <g transform="translate(160, 40)">
    <text x="0" y="52" 
          font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" 
          font-size="44" 
          font-weight="900" 
          letter-spacing="-1.5">
      <tspan fill="${textColor1}">INFOPRECO</tspan><tspan fill="${textColor2}" dx="8">BAIXO</tspan>
    </text>

    ${
      showSubtext
        ? `
    <g transform="translate(2, 78)">
      <text x="0" y="9" 
            font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" 
            font-size="12" 
            font-weight="700" 
            letter-spacing="1" 
            text-transform="uppercase" 
            fill="${subtextColor}">
        LINHA RECONDICIONADA • HUB DE OFERTAS & HARDWARE
      </text>
    </g>`
        : ''
    }
  </g>
</svg>`
}

/**
 * 3. VARIAÇÃO ALTERNATIVA 2: RAIO DE VELOCIDADE FORMANDO A LETRA 'V' / BAIXO
 * Símbolo: Raio dinâmico que desce com corte de velocidade, expressando "Preço Baixo Relâmpago / Queima de Estoque".
 */
export function getFastLightningLogoSvgString(
  variant: LogoVariant = 'light',
  showSubtext: boolean = true,
): string {
  const isDark = variant === 'dark'
  const isMono = variant === 'mono'

  const textColor1 = isMono ? (isDark ? '#FFFFFF' : '#000000') : isDark ? '#F8FAFC' : '#0F172A'
  const textColor2 = isMono ? (isDark ? '#CBD5E1' : '#333333') : '#10B981'
  const boltFill = isMono ? (isDark ? '#FFFFFF' : '#000000') : '#00E676'
  const ringStroke = isMono ? (isDark ? '#FFFFFF' : '#000000') : '#0F172A'
  const subtextColor = isMono ? (isDark ? '#94A3B8' : '#64748B') : isDark ? '#94A3B8' : '#64748B'
  const bgRect = isDark ? `<rect width="640" height="160" fill="#090D16" rx="16" />` : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 160" width="100%" height="100%">
  ${bgRect}

  <!-- ÍCONE RAIO RELÂMPAGO / QUEDA DE PREÇO ACELERADA -->
  <g transform="translate(36, 26)">
    <!-- Base Circular Dinâmica com Corte -->
    <rect x="4" y="4" width="96" height="96" rx="24" 
          fill="${isDark ? '#0F172A' : isMono ? '#F1F5F9' : '#0F172A'}" 
          stroke="${ringStroke}" 
          stroke-width="2" />

    <!-- Raio em V voltado para baixo: Queda Rápida de Preço -->
    <path d="M60 18 L32 56 H54 L44 90 L76 46 H54 L64 18 Z" 
          fill="${boltFill}" 
          stroke="${isMono ? '#000000' : '#10B981'}" 
          stroke-width="1.5" 
          stroke-linejoin="round" />
  </g>

  <!-- TEXTO -->
  <g transform="translate(160, 40)">
    <text x="0" y="52" 
          font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" 
          font-size="44" 
          font-weight="900" 
          letter-spacing="-1.5">
      <tspan fill="${textColor1}">INFOPRECO</tspan><tspan fill="${textColor2}" dx="8">BAIXO</tspan>
    </text>

    ${
      showSubtext
        ? `
    <g transform="translate(2, 78)">
      <text x="0" y="9" 
            font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" 
            font-size="12" 
            font-weight="700" 
            letter-spacing="1" 
            text-transform="uppercase" 
            fill="${subtextColor}">
        OFERTAS RELÂMPAGO • NOTEBOOKS CORPORATIVOS
      </text>
    </g>`
        : ''
    }
  </g>
</svg>`
}

/**
 * 4. ÍCONE QUADRADO / AVATAR / FAVICON (512x512)
 * Perfeito para Mercado Livre, WhatsApp Comercial, Instagram e Favicon.
 */
export function getBrandAvatarSvgString(variant: 'dark' | 'light' | 'green' = 'dark'): string {
  const bg = {
    dark: '#0F172A',
    light: '#FFFFFF',
    green: '#10B981',
  }[variant]

  const strokeColor = variant === 'green' ? '#FFFFFF' : '#10B981'
  const arrowColor = variant === 'green' ? '#FFFFFF' : '#00E676'
  const tagFill =
    variant === 'dark' ? '#1E293B' : variant === 'light' ? '#F8FAFC' : 'rgba(255,255,255,0.15)'

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="av-accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00E676" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>
    <filter id="av-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.25" />
    </filter>
  </defs>

  <!-- Fundo com cantos arredondados modernos (formato app icon) -->
  <rect width="512" height="512" rx="112" fill="${bg}" />

  <!-- Símbolo Tag + Seta Preço Baixo / Letra 'b' ampliada e centralizada -->
  <g transform="translate(86, 76)" filter="url(#av-shadow)">
    <!-- Base da Tag Inclinada Tecnológica -->
    <path d="M50 36 L220 36 C245 36 270 54 282 76 L312 130 C324 152 324 178 312 200 L252 290 C240 310 216 322 192 322 L50 322 C22 322 0 300 0 272 L0 86 C0 58 22 36 50 36 Z" 
          fill="${tagFill}" 
          stroke="${strokeColor}" 
          stroke-width="10" />

    <!-- Orifício da Tag / Botão Power -->
    <circle cx="80" cy="116" r="24" fill="none" stroke="${strokeColor}" stroke-width="9" />
    <circle cx="80" cy="116" r="11" fill="${arrowColor}" />

    <!-- Traço tech circuito -->
    <path d="M112 116 H160 L184 140" fill="none" stroke="${strokeColor}" stroke-width="7" stroke-linecap="round" stroke-dasharray="6 8" opacity="0.8" />

    <!-- A Seta Para Baixo Estilizada formando o 'b' de Baixo -->
    <path d="M148 110 V206 C148 238 174 260 206 260 C238 260 264 234 264 202 C264 170 238 144 206 144 C186 144 168 154 156 170" 
          fill="none" 
          stroke="${variant === 'green' ? '#FFFFFF' : 'url(#av-accent)'}" 
          stroke-width="22" 
          stroke-linecap="round" 
          stroke-linejoin="round" />

    <!-- Ponta da Seta indicando QUEDA DE PREÇO -->
    <path d="M124 200 L148 236 L172 200" 
          fill="none" 
          stroke="${variant === 'green' ? '#FFFFFF' : 'url(#av-accent)'}" 
          stroke-width="22" 
          stroke-linecap="round" 
          stroke-linejoin="round" />
  </g>

  <!-- Tag inferior INFOPRECO BAIXO sutil -->
  <g transform="translate(256, 460)">
    <text text-anchor="middle" 
          font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" 
          font-size="28" 
          font-weight="900" 
          letter-spacing="3" 
          fill="${variant === 'light' ? '#0F172A' : '#FFFFFF'}">
      INFOPRECOBAIXO
    </text>
  </g>
</svg>`
}

/**
 * Utilitário para download direto de qualquer SVG em formato de arquivo .svg
 */
export function downloadSvgFile(svgContent: string, fileName: string) {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.endsWith('.svg') ? fileName : `${fileName}.svg`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export interface ExportRasterOptions {
  format: 'png' | 'jpeg'
  targetWidth?: number
  targetHeight?: number
  backgroundColor?: string | null // null para PNG transparente; cor hex/rgb para JPG ou PNG com fundo
  quality?: number // default 0.95 para JPG
}

/**
 * Converte uma string SVG em raster (PNG ou JPG) client-side usando canvas e dispara o download.
 * - viewBox original é respeitado para calcular o aspect ratio
 * - targetWidth padrão: 2048px (ou se viewBox for 512x512, calcula proporcionalmente)
 * - Para JPG, preenche o fundo com backgroundColor antes do drawImage para evitar fundo preto
 */
export async function downloadRasterFromSvg(
  svgContent: string,
  fileName: string,
  options: ExportRasterOptions,
): Promise<void> {
  const { format, targetWidth = 2048, targetHeight, backgroundColor, quality = 0.95 } = options

  return new Promise((resolve, reject) => {
    // 1. Extrair dimensões / viewBox do SVG para preservar proporção correta
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    const svgEl = doc.querySelector('svg')
    let vbWidth = 640
    let vbHeight = 160

    if (svgEl) {
      const viewBox = svgEl.getAttribute('viewBox')
      if (viewBox) {
        const parts = viewBox
          .trim()
          .split(/[\s,]+/)
          .map(Number)
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          vbWidth = parts[2]
          vbHeight = parts[3]
        }
      } else {
        const wAttr = parseFloat(svgEl.getAttribute('width') || '')
        const hAttr = parseFloat(svgEl.getAttribute('height') || '')
        if (!isNaN(wAttr) && !isNaN(hAttr) && wAttr > 0 && hAttr > 0) {
          vbWidth = wAttr
          vbHeight = hAttr
        }
      }
    }

    const finalWidth = targetWidth
    const finalHeight = targetHeight ?? Math.round((finalWidth * vbHeight) / vbWidth)

    // 2. Criar Blob SVG com charset utf-8
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = finalWidth
        canvas.height = finalHeight
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          URL.revokeObjectURL(url)
          reject(new Error('Não foi possível obter o contexto 2D do Canvas'))
          return
        }

        // Se for JPEG ou se backgroundColor estiver definido, pintar o fundo
        if (format === 'jpeg') {
          // JPEG não suporta transparência, sempre exige fundo sólido
          ctx.fillStyle = backgroundColor || '#FFFFFF'
          ctx.fillRect(0, 0, finalWidth, finalHeight)
        } else if (backgroundColor) {
          ctx.fillStyle = backgroundColor
          ctx.fillRect(0, 0, finalWidth, finalHeight)
        }

        // Desenhar a imagem vetorial escalada com anti-aliasing de alta qualidade
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, finalWidth, finalHeight)

        URL.revokeObjectURL(url)

        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
        const ext = format === 'jpeg' ? '.jpg' : '.png'

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Falha ao gerar o blob da imagem'))
              return
            }

            const downloadUrl = URL.createObjectURL(blob)
            const link = document.createElement('a')
            const cleanName = fileName.replace(/\.(svg|png|jpg|jpeg)$/i, '')
            link.href = downloadUrl
            link.download = `${cleanName}${ext}`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(downloadUrl)
            resolve()
          },
          mimeType,
          quality,
        )
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err)
      }
    }

    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(new Error('Erro ao carregar o SVG na imagem para renderização: ' + String(e)))
    }

    img.src = url
  })
}
