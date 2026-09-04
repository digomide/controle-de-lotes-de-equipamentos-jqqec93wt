/**
 * Módulo client-side de remoção de fundo com IA para o navegador.
 *
 * Utiliza o modelo de segmentação neural via @imgly/background-removal (carregado dinamicamente via ESM CDN),
 * executa no navegador via WASM/WebGPU, compõe o objeto sobre fundo branco puro (#FFFFFF)
 * no padrão exigido pelo Mercado Livre e exporta JPEG em alta resolução (mínimo 1200x1200px).
 */

export interface BackgroundRemovalProgress {
  key: string
  current: number
  total: number
  percentage: number
  message: string
}

export interface RemoveBackgroundOptions {
  /**
   * Largura e altura alvo mínimas para o Mercado Livre (padrão: 1200x1200)
   */
  minDimension?: number
  /**
   * Qualidade do JPEG de saída (0 a 1, padrão: 0.92)
   */
  quality?: number
  /**
   * Callback de progresso com porcentagem e status amigável
   */
  onProgress?: (progress: BackgroundRemovalProgress) => void
}

export interface RemoveBackgroundResult {
  /**
   * Blob do JPEG final com fundo branco puro (#FFFFFF)
   */
  blob: Blob
  /**
   * Data URL para preview imediato no frontend
   */
  previewUrl: string
  /**
   * Largura final da imagem gerada
   */
  width: number
  /**
   * Altura final da imagem gerada
   */
  height: number
  /**
   * Tamanho em bytes
   */
  size: number
}

// Singleton de import dinâmico da biblioteca @imgly/background-removal
let imglyModulePromise: Promise<any> | null = null

/**
 * Função utilitária para contornar verificação estática do TypeScript em URLs externas
 */
const dynamicImport = new Function('url', 'return import(url)')

async function loadImglyModule(): Promise<any> {
  if (!imglyModulePromise) {
    imglyModulePromise = (async () => {
      // Carregar dinamicamente via CDN estável esm.sh com fallback para jsdelivr
      try {
        const mod = await dynamicImport('https://esm.sh/@imgly/background-removal@1.5.7')
        return mod.removeBackground ? mod : mod.default || mod
      } catch (err1) {
        console.warn(
          'Falha ao carregar @imgly/background-removal via esm.sh, tentando jsdelivr...',
          err1,
        )
        const mod = await dynamicImport(
          'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.7/dist/index.mjs',
        )
        return mod.removeBackground ? mod : mod.default || mod
      }
    })()
  }
  return imglyModulePromise
}

/**
 * Remove o fundo de uma imagem usando IA no navegador e aplica fundo branco puro (#FFFFFF).
 *
 * @param imageSource URL da imagem (PocketBase / blob / dataURL / HTMLImageElement)
 * @param options Opções de dimensionamento, qualidade e progresso
 */
export async function removeBackgroundClientSide(
  imageSource: string | Blob | File,
  options: RemoveBackgroundOptions = {},
): Promise<RemoveBackgroundResult> {
  const { minDimension = 1200, quality = 0.92, onProgress } = options

  // 1. Carregar biblioteca
  onProgress?.({
    key: 'init',
    current: 0,
    total: 100,
    percentage: 5,
    message: 'Inicializando motor de inteligência artificial...',
  })

  let removeBackgroundFn: any
  try {
    const mod = await loadImglyModule()
    removeBackgroundFn = mod.removeBackground || mod.default || mod
    if (typeof removeBackgroundFn !== 'function') {
      throw new Error('Função removeBackground não disponível no pacote importado.')
    }
  } catch (loadErr: any) {
    console.error('Falha ao carregar biblioteca de IA:', loadErr)
    throw new Error(
      'Não foi possível carregar o modelo de IA para remoção de fundo. Verifique sua conexão com a internet.',
    )
  }

  // 2. Executar modelo neural com acompanhamento de progresso
  onProgress?.({
    key: 'model_download',
    current: 10,
    total: 100,
    percentage: 15,
    message: 'Carregando modelo neural no navegador (pode levar ~20-30s na 1ª vez)...',
  })

  // Se o input for uma URL de imagem externa, garantimos um blob com crossOrigin seguro
  let inputSource: Blob | File | string = imageSource
  if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
    try {
      const resp = await fetch(imageSource, { mode: 'cors' })
      if (resp.ok) {
        inputSource = await resp.blob()
      }
    } catch (corsErr) {
      console.warn(
        'Não foi possível obter imagem com CORS antecipado, passando URL direta:',
        corsErr,
      )
    }
  }

  const rawTransparentBlob: Blob = await removeBackgroundFn(inputSource, {
    publicPath: 'https://staticimgly.com/@imgly/background-removal-data/1.5.7/dist/',
    model: 'medium', // Equilíbrio ótimo entre velocidade e precisão
    output: {
      format: 'image/png',
      quality: 1.0,
    },
    progress: (key: string, current: number, total: number) => {
      let percent = 20
      let msg = 'Processando recorte do equipamento...'

      if (key.includes('fetch') || key.includes('download')) {
        const ratio = total > 0 ? current / total : 0.5
        percent = Math.min(60, Math.round(15 + ratio * 45))
        msg = `Baixando modelo de IA (${Math.round(percent)}%)...`
      } else if (key.includes('inference')) {
        percent = 70
        msg = 'Identificando notebook e removendo fundo...'
      } else if (key.includes('mask') || key.includes('encode')) {
        percent = 85
        msg = 'Finalizando máscara de transparência...'
      }

      onProgress?.({
        key,
        current,
        total,
        percentage: percent,
        message: msg,
      })
    },
  })

  onProgress?.({
    key: 'composite',
    current: 90,
    total: 100,
    percentage: 90,
    message: 'Compondo imagem sobre fundo branco puro (#FFFFFF) no padrão ML...',
  })

  // 3. Compor a imagem recortada sobre canvas com fundo branco puro (#FFFFFF)
  // e garantir as dimensões mínimas exigidas pelo Mercado Livre (1200x1200px)
  const cutImage = await loadImageFromBlob(rawTransparentBlob)

  const originalWidth = cutImage.naturalWidth || cutImage.width || 1200
  const originalHeight = cutImage.naturalHeight || cutImage.height || 1200

  // Se a imagem for menor que o mínimo do ML (1200px no maior lado), escalonar mantendo proporção
  let targetWidth = originalWidth
  let targetHeight = originalHeight

  const maxSide = Math.max(originalWidth, originalHeight)
  if (maxSide < minDimension) {
    const scale = minDimension / maxSide
    targetWidth = Math.round(originalWidth * scale)
    targetHeight = Math.round(originalHeight * scale)
  }

  // Se preferir um canvas quadrado perfeito (1200x1200 com o produto centralizado)
  // isso atende com perfeição o padrão visual do Mercado Livre
  const canvasWidth = Math.max(targetWidth, minDimension)
  const canvasHeight = Math.max(targetHeight, minDimension)

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Falha ao inicializar contexto 2D do Canvas.')
  }

  // 3.1 Preencher fundo branco puro (#FFFFFF)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // 3.2 Suavização de alta qualidade
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // 3.3 Centralizar o objeto recortado no canvas com margem de respiro (padding 4%)
  const paddingPercent = 0.04
  const availableWidth = canvasWidth * (1 - paddingPercent * 2)
  const availableHeight = canvasHeight * (1 - paddingPercent * 2)

  const fitScale = Math.min(
    availableWidth / originalWidth,
    availableHeight / originalHeight,
    1.0, // não esticar além se já for grande
  )

  const drawWidth = Math.round(originalWidth * fitScale)
  const drawHeight = Math.round(originalHeight * fitScale)
  const drawX = Math.round((canvasWidth - drawWidth) / 2)
  const drawY = Math.round((canvasHeight - drawHeight) / 2)

  ctx.drawImage(cutImage, drawX, drawY, drawWidth, drawHeight)

  onProgress?.({
    key: 'encode_jpeg',
    current: 98,
    total: 100,
    percentage: 98,
    message: 'Exportando foto em alta resolução JPEG...',
  })

  // 4. Converter para Blob JPEG de alta qualidade
  const finalBlob = await canvasToBlob(canvas, 'image/jpeg', quality)
  const previewUrl = URL.createObjectURL(finalBlob)

  onProgress?.({
    key: 'complete',
    current: 100,
    total: 100,
    percentage: 100,
    message: 'Fundo branco gerado com sucesso!',
  })

  return {
    blob: finalBlob,
    previewUrl,
    width: canvasWidth,
    height: canvasHeight,
    size: finalBlob.size,
  }
}

/**
 * Auxiliar para carregar Blob em elemento HTMLImageElement
 */
function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(new Error('Falha ao decodificar imagem processada pelo modelo.'))
    }
    img.src = url
  })
}

/**
 * Auxiliar para converter Canvas em Blob com Promise
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/jpeg',
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Não foi possível gerar Blob a partir do Canvas.'))
        }
      },
      type,
      quality,
    )
  })
}
