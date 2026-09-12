import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import {
  Download,
  Copy,
  Check,
  Sparkles,
  Layers,
  Palette,
  Laptop,
  Building2,
  Tag,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Box,
  Cpu,
  Zap,
  Printer,
  Eye,
  Info,
} from 'lucide-react'
import {
  BRAND_COLORS,
  LogoVariant,
  getRecommendedLogoSvgString,
  getHexHardwareLogoSvgString,
  getFastLightningLogoSvgString,
  getBrandAvatarSvgString,
  downloadSvgFile,
  downloadRasterFromSvg,
} from '@/components/InfoPrecoBaixoLogo'

export default function LogoPage() {
  const [activeVariant, setActiveVariant] = useState<LogoVariant>('light')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState<string | null>(null)

  const handleDownloadRaster = async (
    svgContent: string,
    fileName: string,
    format: 'png' | 'jpeg',
    backgroundColor: string | null,
    targetWidth: number = 2048,
    targetHeight?: number,
  ) => {
    const ext = format === 'jpeg' ? 'JPG' : 'PNG'
    const opKey = `${fileName}-${format}`
    setIsExporting(opKey)
    try {
      await downloadRasterFromSvg(svgContent, fileName, {
        format,
        targetWidth,
        targetHeight,
        backgroundColor,
        quality: 0.95,
      })
      toast({
        title: `Download ${ext} Concluído!`,
        description: `Arquivo ${fileName.replace(/\.(svg|png|jpg)$/i, '')}.${format === 'jpeg' ? 'jpg' : 'png'} gerado em alta resolução.`,
      })
    } catch (err) {
      console.error(err)
      toast({
        title: `Erro ao gerar ${ext}`,
        description: 'Não foi possível converter o SVG para imagem raster.',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(null)
    }
  }

  // SVGs gerados para o conceito principal
  const recommendedLightSvg = getRecommendedLogoSvgString('light', true)
  const recommendedDarkSvg = getRecommendedLogoSvgString('dark', true)
  const recommendedMonoSvg = getRecommendedLogoSvgString('mono', true)

  // Alternativas
  const hexLightSvg = getHexHardwareLogoSvgString('light', true)
  const hexDarkSvg = getHexHardwareLogoSvgString('dark', true)
  const lightningLightSvg = getFastLightningLogoSvgString('light', true)
  const lightningDarkSvg = getFastLightningLogoSvgString('dark', true)

  // Favicons / Avatares
  const avatarDarkSvg = getBrandAvatarSvgString('dark')
  const avatarLightSvg = getBrandAvatarSvgString('light')
  const avatarGreenSvg = getBrandAvatarSvgString('green')

  const copyToClipboard = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      toast({
        title: 'SVG Copiado com Sucesso!',
        description: `O código vetorial do ${label} foi copiado para a área de transferência.`,
      })
      setTimeout(() => setCopiedKey(null), 2500)
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar automaticamente.',
        variant: 'destructive',
      })
    }
  }

  const currentRecommendedSvg =
    activeVariant === 'light'
      ? recommendedLightSvg
      : activeVariant === 'dark'
        ? recommendedDarkSvg
        : recommendedMonoSvg

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Cabeçalho da Identidade Visual */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs tracking-wide">
              NOVA IDENTIDADE VISUAL
            </Badge>
            <Badge variant="outline" className="text-slate-600 border-slate-300 text-xs">
              Vendas Mercado Livre & E-Commerce
            </Badge>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            INFOPRECOBAIXO
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Logomarca e identidade vetorial desenhada para transmitir{' '}
            <strong className="text-slate-900">
              preço baixo imbatível + garantia técnica e confiança
            </strong>{' '}
            de notebooks recondicionados com o selo de produção industrial{' '}
            <strong className="text-orange-600">AMBICORP</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() =>
              downloadSvgFile(recommendedLightSvg, 'infoprecobaixo-logo-principal-light.svg')
            }
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-xs"
          >
            <Download className="w-4 h-4" />
            Oficial .SVG
          </Button>
          <Button
            variant="outline"
            disabled={isExporting !== null}
            onClick={() =>
              handleDownloadRaster(
                recommendedLightSvg,
                'infoprecobaixo-logo-principal-light',
                'png',
                null,
                2048,
              )
            }
            className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1.5 shadow-xs"
          >
            <Download className="w-4 h-4" />
            Oficial .PNG
          </Button>
          <Button
            variant="outline"
            disabled={isExporting !== null}
            onClick={() =>
              handleDownloadRaster(
                recommendedLightSvg,
                'infoprecobaixo-logo-principal-light',
                'jpeg',
                '#FFFFFF',
                2048,
              )
            }
            className="border-slate-300 text-slate-800 hover:bg-slate-100 gap-1.5 shadow-xs"
          >
            <Download className="w-4 h-4" />
            Oficial .JPG
          </Button>
        </div>
      </div>

      {/* Relacionamento de Marcas: AMBICORP vs INFOPRECOBAIXO */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-md border border-slate-700/60">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                  Arquitetura de Marca & Operação
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-xs text-slate-300">Produção vs. Venda</span>
              </div>
              <h2 className="text-base font-bold text-white mt-0.5">
                AMBICORP{' '}
                <span className="text-slate-400 font-normal text-xs">
                  (Fábrica/Recondicionamento)
                </span>{' '}
                + <span className="text-emerald-400">INFOPRECOBAIXO</span>{' '}
                <span className="text-slate-400 font-normal text-xs">
                  (Loja Oficial / Venda Final)
                </span>
              </h2>
            </div>
          </div>
          <div className="text-xs text-slate-300 lg:max-w-md bg-slate-800/80 p-3 rounded-lg border border-slate-700">
            A <strong>AMBICORP</strong> é a fábrica/holding responsável pela entrada de lotes
            corporativos, triagem, reparo, limpeza e garantia. A <strong>INFOPRECOBAIXO</strong> é a
            marca comercial direta (seller) que atua no Mercado Livre e canais digitais entregando a
            melhor oferta e preço baixo com confiança.
          </div>
        </div>
      </div>

      {/* 1. SEÇÃO PRINCIPAL: LOGOMARCA RECOMENDADA EM 3 VARIANTES */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600 text-white font-bold gap-1 text-[11px]">
                  <Sparkles className="w-3 h-3" />
                  RECOMENDADA PELA EQUIPE
                </Badge>
                <span className="text-xs text-slate-500 font-medium">
                  Conceito Tag de Preço + Seta 'b' + Chancela Ambicorp
                </span>
              </div>
              <CardTitle className="text-xl font-black text-slate-900 mt-1">
                Conceito Oficial: Tag Angular de Preço Baixo & Hardware
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Combina a clássica etiqueta de preço inclinada com a seta descendente indicando
                queda de preço, formando a letra "b" de baixo e remetendo a componentes de notebook.
              </CardDescription>
            </div>

            {/* Controles de Variante de Fundo */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200 self-start sm:self-auto shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveVariant('light')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeVariant === 'light'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Fundo Claro (ML)
              </button>
              <button
                type="button"
                onClick={() => setActiveVariant('dark')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeVariant === 'dark'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Fundo Escuro
              </button>
              <button
                type="button"
                onClick={() => setActiveVariant('mono')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeVariant === 'mono'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monocromático (P&B)
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Palco de Visualização Principal */}
          <div
            className={`w-full rounded-2xl p-6 sm:p-10 flex items-center justify-center transition-all duration-300 border ${
              activeVariant === 'dark'
                ? 'bg-[#090D16] border-slate-800'
                : activeVariant === 'mono'
                  ? 'bg-slate-100 border-slate-300'
                  : 'bg-white border-slate-200'
            }`}
            style={{
              minHeight: '220px',
              backgroundImage:
                activeVariant === 'light'
                  ? 'radial-gradient(#e2e8f0 1px, transparent 1px)'
                  : activeVariant === 'dark'
                    ? 'radial-gradient(#1e293b 1px, transparent 1px)'
                    : 'none',
              backgroundSize: '24px 24px',
            }}
          >
            <div
              className="w-full max-w-2xl max-h-48 flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: currentRecommendedSvg }}
            />
          </div>

          {/* Barra de Ações do Conceito Principal */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Tag className="w-4 h-4 text-emerald-600" />
              <span>
                Variante atual:{' '}
                <strong className="text-slate-800 uppercase">
                  {activeVariant === 'light'
                    ? 'Fundo Claro (Padrão Mercado Livre)'
                    : activeVariant === 'dark'
                      ? 'Fundo Escuro (Tech / Hero)'
                      : 'Monocromático (Térmica / Caixas)'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  copyToClipboard(
                    currentRecommendedSvg,
                    `rec-${activeVariant}`,
                    `SVG (${activeVariant})`,
                  )
                }
                className="text-xs gap-1.5 h-8 border-slate-200"
              >
                {copiedKey === `rec-${activeVariant}` ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar Código SVG
                  </>
                )}
              </Button>

              <Button
                size="sm"
                onClick={() =>
                  downloadSvgFile(currentRecommendedSvg, `infoprecobaixo-logo-${activeVariant}.svg`)
                }
                className="text-xs gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar .SVG
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={isExporting !== null}
                onClick={() =>
                  handleDownloadRaster(
                    currentRecommendedSvg,
                    `infoprecobaixo-logo-${activeVariant}`,
                    'png',
                    activeVariant === 'dark' ? '#090D16' : null,
                    2048,
                  )
                }
                className="text-xs gap-1.5 h-8 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar .PNG
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={isExporting !== null}
                onClick={() =>
                  handleDownloadRaster(
                    currentRecommendedSvg,
                    `infoprecobaixo-logo-${activeVariant}`,
                    'jpeg',
                    activeVariant === 'dark' ? '#090D16' : '#FFFFFF',
                    2048,
                  )
                }
                className="text-xs gap-1.5 h-8 border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar .JPG
              </Button>
            </div>
          </div>

          {/* Comparativo lado a lado das 3 variantes do conceito principal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            {/* 1. Clara */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">1. Versão Fundo Claro</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200"
                  >
                    Mercado Livre
                  </Badge>
                </div>
                <div className="h-24 flex items-center justify-center bg-slate-50/60 rounded-lg p-2 border border-slate-100">
                  <div
                    className="w-full h-full flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: recommendedLightSvg }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 block">
                  Ideal para anúncios ML e fundo branco
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-1 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    downloadSvgFile(recommendedLightSvg, 'infoprecobaixo-fundo-claro.svg')
                  }
                  className="text-xs h-7 text-emerald-700 hover:bg-emerald-50 px-2 gap-1"
                >
                  <Download className="w-3 h-3" /> .SVG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isExporting !== null}
                  onClick={() =>
                    handleDownloadRaster(
                      recommendedLightSvg,
                      'infoprecobaixo-fundo-claro',
                      'png',
                      null,
                      2048,
                    )
                  }
                  className="text-xs h-7 border-emerald-300 text-emerald-800 hover:bg-emerald-50 px-2 gap-1"
                >
                  <Download className="w-3 h-3" /> .PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isExporting !== null}
                  onClick={() =>
                    handleDownloadRaster(
                      recommendedLightSvg,
                      'infoprecobaixo-fundo-claro',
                      'jpeg',
                      '#FFFFFF',
                      2048,
                    )
                  }
                  className="text-xs h-7 border-slate-300 text-slate-700 hover:bg-slate-100 px-2 gap-1"
                >
                  <Download className="w-3 h-3" /> .JPG
                </Button>
              </div>
            </div>

            {/* 2. Escura */}
            <div className="rounded-xl border border-slate-800 bg-[#0F172A] p-4 space-y-3 shadow-2xs text-white flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">2. Versão Fundo Escuro</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] text-slate-300 border-slate-700 bg-slate-800"
                  >
                    Tech / Painéis
                  </Badge>
                </div>
                <div className="h-24 flex items-center justify-center bg-[#090D16] rounded-lg p-2 border border-slate-800">
                  <div
                    className="w-full h-full flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: recommendedDarkSvg }}
                  />
                </div>
                <span className="text-[11px] text-slate-400 block">
                  Para cabeçalhos escuros e fundo grafite
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-1 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    downloadSvgFile(recommendedDarkSvg, 'infoprecobaixo-fundo-escuro.svg')
                  }
                  className="text-xs h-7 text-emerald-400 hover:bg-slate-800 px-2 gap-1"
                >
                  <Download className="w-3 h-3" /> .SVG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isExporting !== null}
                  onClick={() =>
                    handleDownloadRaster(
                      recommendedDarkSvg,
                      'infoprecobaixo-fundo-escuro',
                      'png',
                      '#090D16',
                      2048,
                    )
                  }
                  className="text-xs h-7 border-slate-700 text-slate-200 hover:bg-slate-800 px-2 gap-1"
                >
                  <Download className="w-3 h-3" /> .PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isExporting !== null}
                  onClick={() =>
                    handleDownloadRaster(
                      recommendedDarkSvg,
                      'infoprecobaixo-fundo-escuro',
                      'jpeg',
                      '#0F172A',
                      2048,
                    )
                  }
                  className="text-xs h-7 border-slate-700 text-slate-300 hover:bg-slate-800 px-2 gap-1"
                >
                  <Download className="w-3 h-3" /> .JPG
                </Button>
              </div>
            </div>

            {/* 3. Monocromática P&B */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 shadow-2xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">3. Versão Monocromática</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] text-slate-700 border-slate-300 bg-white"
                  >
                    Térmica / Impressão
                  </Badge>
                </div>
                <div className="h-24 flex items-center justify-center bg-white rounded-lg p-2 border border-slate-200">
                  <div
                    className="w-full h-full flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: recommendedMonoSvg }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 block">
                  Impressora Zebra, Danfe e Caixas
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 gap-1 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    downloadSvgFile(recommendedMonoSvg, 'infoprecobaixo-monocromatico.svg')
                  }
                  className="text-xs h-7 text-slate-700 hover:bg-slate-200 px-2 gap-1"
                >
                  <Download className="w-3 h-3" /> .SVG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isExporting !== null}
                  onClick={() =>
                    handleDownloadRaster(
                      recommendedMonoSvg,
                      'infoprecobaixo-mono',
                      'png',
                      null,
                      2048,
                    )
                  }
                  className="text-xs h-7 border-slate-300 text-slate-800 hover:bg-slate-200 px-2 gap-1"
                >
                  <Download className="w-3 h-3" /> .PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isExporting !== null}
                  onClick={() =>
                    handleDownloadRaster(
                      recommendedMonoSvg,
                      'infoprecobaixo-mono',
                      'jpeg',
                      '#FFFFFF',
                      2048,
                    )
                  }
                  className="text-xs h-7 border-slate-300 text-slate-700 hover:bg-slate-200 px-2 gap-1"
                >
                  <Download className="w-3 h-3" /> .JPG
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. COMPARAÇÃO: 2 VARIAÇÕES ALTERNATIVAS DO CONCEITO */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-slate-600" />
              Variações Alternativas de Conceito para Comparação
            </h2>
            <p className="text-xs text-slate-500">
              Outras abordagens criativas desenhadas especificamente para o negócio de notebooks
              recondicionados.
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-normal text-slate-500">
            2 Alternativas
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Alternativa A: Hexágono Hardware + Cifrão */}
          <Card className="border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Alternativa A: Hexágono Hardware + Circuito
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Enfatiza o processador, motherboard e componente técnico
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  Hardware Focus
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center min-h-[140px]">
                <div
                  className="w-full max-h-32 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: hexLightSvg }}
                />
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center min-h-[110px]">
                <div
                  className="w-full max-h-24 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: hexDarkSvg }}
                />
              </div>

              <div className="text-xs text-slate-600 leading-relaxed">
                <strong>Análise:</strong> Símbolo em formato de socket hexagonal com trilhas
                condutoras de circuito impresso e seta descendente com traço monetário integrado.
                Excelente para quem quer transmitir 100% foco em eletrônica.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(hexLightSvg, 'hex-light', 'Alternativa Hardware SVG')
                  }
                  className="text-xs h-8"
                >
                  {copiedKey === 'hex-light' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 mr-1" />
                  )}
                  Copiar SVG
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    downloadSvgFile(hexLightSvg, 'infoprecobaixo-hardware-hexagon.svg')
                  }
                  className="text-xs h-8 gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  .SVG
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isExporting !== null}
                  onClick={() =>
                    handleDownloadRaster(
                      hexLightSvg,
                      'infoprecobaixo-hardware-hexagon',
                      'png',
                      null,
                      2048,
                    )
                  }
                  className="text-xs h-8 gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  .PNG
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isExporting !== null}
                  onClick={() =>
                    handleDownloadRaster(
                      hexLightSvg,
                      'infoprecobaixo-hardware-hexagon',
                      'jpeg',
                      '#FFFFFF',
                      2048,
                    )
                  }
                  className="text-xs h-8 gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  <Download className="w-3.5 h-3.5" />
                  .JPG
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Alternativa B: Raio Relâmpago / Velocidade */}
          <Card className="border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Alternativa B: Raio de Velocidade & Oferta
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Enfatiza queima de estoque rápida, agilidade e oportunidade
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  Agile / Flash Sale
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center min-h-[140px]">
                <div
                  className="w-full max-h-32 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: lightningLightSvg }}
                />
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center min-h-[110px]">
                <div
                  className="w-full max-h-24 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: lightningDarkSvg }}
                />
              </div>

              <div className="text-xs text-slate-600 leading-relaxed">
                <strong>Análise:</strong> O raio energético aponta para baixo formando um V
                acentuado de "queda de preço relâmpago". Transmite velocidade extrema de despacho e
                giro alto de estoque no Mercado Livre.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(lightningLightSvg, 'lightning-light', 'Alternativa Raio SVG')
                  }
                  className="text-xs h-8"
                >
                  {copiedKey === 'lightning-light' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 mr-1" />
                  )}
                  Copiar SVG
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    downloadSvgFile(lightningLightSvg, 'infoprecobaixo-raio-velocidade.svg')
                  }
                  className="text-xs h-8 gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  .SVG
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isExporting !== null}
                  onClick={() =>
                    handleDownloadRaster(
                      lightningLightSvg,
                      'infoprecobaixo-raio-velocidade',
                      'png',
                      null,
                      2048,
                    )
                  }
                  className="text-xs h-8 gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  .PNG
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isExporting !== null}
                  onClick={() =>
                    handleDownloadRaster(
                      lightningLightSvg,
                      'infoprecobaixo-raio-velocidade',
                      'jpeg',
                      '#FFFFFF',
                      2048,
                    )
                  }
                  className="text-xs h-8 gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  <Download className="w-3.5 h-3.5" />
                  .JPG
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3. PALETA DE CORES E IDENTIDADE VISUAL */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-emerald-600" />
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Paleta Cromática Oficial & Códigos HEX
              </CardTitle>
              <CardDescription className="text-xs">
                Cores balanceadas para alta conversão no Mercado Livre, contraste impecável em fundo
                branco e ligação com a Ambicorp.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {BRAND_COLORS.map((color) => (
              <div
                key={color.hex}
                className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs flex flex-col"
              >
                {/* Amostra visual de cor */}
                <div
                  className="h-20 w-full relative flex items-end p-2 transition-transform hover:scale-105 duration-200"
                  style={{ backgroundColor: color.hex }}
                >
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow-xs ${
                      color.textDark ? 'bg-slate-900/80 text-white' : 'bg-white/90 text-slate-900'
                    }`}
                  >
                    {color.hex}
                  </span>
                </div>
                <div className="p-3 flex-1 flex flex-col justify-between space-y-1">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 leading-tight">{color.name}</h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-tight">{color.role}</p>
                  </div>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">rgb({color.rgb})</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(color.hex, color.hex, `código ${color.hex}`)}
                      className="text-slate-400 hover:text-slate-800 p-1"
                      title="Copiar código HEX"
                    >
                      {copiedKey === color.hex ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Por que esta paleta funciona no Mercado Livre?</strong> O verde esmeralda/neon
              (#10B981 / #00E676) comunica imediatamente vantagem de preço e economia sustentável
              (recondicionados), sem competir ou se confundir com o amarelo e azul oficiais do
              Mercado Livre. O grafite noturno (#0F172A) entrega o peso corporativo e a seriedade
              técnica necessária para a venda de notebooks.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. ÍCONE QUADRADO, AVATAR E FAVICON (512x512) */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Box className="w-5 h-5 text-emerald-600" />
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Favicon, Ícone de App & Avatar Quadrado (512 × 512)
                </CardTitle>
                <CardDescription className="text-xs">
                  Símbolo isolado em alta resolução vetorial para perfil de vendedor no Mercado
                  Livre, WhatsApp Comercial e foto de loja
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* 1. Avatar Escuro */}
            <div className="space-y-3 flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-900">Avatar Dark Tech (Padrão)</span>
              <div className="w-36 h-36 rounded-2xl overflow-hidden shadow-lg border border-slate-800">
                <div
                  className="w-full h-full"
                  dangerouslySetInnerHTML={{ __html: avatarDarkSvg }}
                />
              </div>
              <div className="flex items-center gap-1.5 pt-2 flex-wrap justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(avatarDarkSvg, 'av-dark', 'Avatar Dark SVG')}
                  className="text-xs h-7 px-2 gap-1"
                >
                  <Copy className="w-3 h-3" /> Copiar
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    downloadSvgFile(avatarDarkSvg, 'infoprecobaixo-avatar-dark-512.svg')
                  }
                  className="text-xs h-7 px-2 bg-slate-900 hover:bg-slate-800 text-white gap-1"
                >
                  <Download className="w-3 h-3" /> .SVG
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isExporting !== null}
                  onClick={() =>
                    handleDownloadRaster(
                      avatarDarkSvg,
                      'infoprecobaixo-avatar-dark-512',
                      'png',
                      null,
                      512,
                      512,
                    )
                  }
                  className="text-xs h-7 px-2 border-slate-300 text-slate-700 hover:bg-slate-100 gap-1"
                >
                  <Download className="w-3 h-3" /> .PNG
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isExporting !== null}
                  onClick={() =>
                    handleDownloadRaster(
                      avatarDarkSvg,
                      'infoprecobaixo-avatar-dark-512',
                      'jpeg',
                      '#0F172A',
                      512,
                      512,
                    )
                  }
                  className="text-xs h-7 px-2 border-slate-300 text-slate-700 hover:bg-slate-100 gap-1"
                >
                  <Download className="w-3 h-3" /> .JPG
                </Button>
              </div>
            </div>

            {/* 2. Avatar Fundo Claro */}
            <div className="space-y-3 flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-900">Avatar Fundo Claro (ML)</span>
              <div className="w-36 h-36 rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-white">
                <div
                  className="w-full h-full"
                  dangerouslySetInnerHTML={{ __html: avatarLightSvg }}
                />
              </div>
              <div className="flex items-center gap-1.5 pt-2 flex-wrap justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(avatarLightSvg, 'av-light', 'Avatar Light SVG')}
                  className="text-xs h-7 px-2 gap-1"
                >
                  <Copy className="w-3 h-3" /> Copiar
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    downloadSvgFile(avatarLightSvg, 'infoprecobaixo-avatar-light-512.svg')
                  }
                  className="text-xs h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                >
                  <Download className="w-3 h-3" /> .SVG
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isExporting !== null}
                  onClick={() =>
                    handleDownloadRaster(
                      avatarLightSvg,
                      'infoprecobaixo-avatar-light-512',
                      'png',
                      null,
                      512,
                      512,
                    )
                  }
                  className="text-xs h-7 px-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1"
                >
                  <Download className="w-3 h-3" /> .PNG
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isExporting !== null}
                  onClick={() =>
                    handleDownloadRaster(
                      avatarLightSvg,
                      'infoprecobaixo-avatar-light-512',
                      'jpeg',
                      '#FFFFFF',
                      512,
                      512,
                    )
                  }
                  className="text-xs h-7 px-2 border-slate-300 text-slate-700 hover:bg-slate-100 gap-1"
                >
                  <Download className="w-3 h-3" /> .JPG
                </Button>
              </div>
            </div>

            {/* 3. Avatar Verde Limão */}
            <div className="space-y-3 flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-900">
                Avatar Verde Cyber (Promoção)
              </span>
              <div className="w-36 h-36 rounded-2xl overflow-hidden shadow-md border border-emerald-500 bg-emerald-500">
                <div
                  className="w-full h-full"
                  dangerouslySetInnerHTML={{ __html: avatarGreenSvg }}
                />
              </div>
              <div className="flex items-center gap-1.5 pt-2 flex-wrap justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(avatarGreenSvg, 'av-green', 'Avatar Green SVG')}
                  className="text-xs h-7 px-2 gap-1"
                >
                  <Copy className="w-3 h-3" /> Copiar
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    downloadSvgFile(avatarGreenSvg, 'infoprecobaixo-avatar-green-512.svg')
                  }
                  className="text-xs h-7 px-2 bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                >
                  <Download className="w-3 h-3" /> .SVG
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isExporting !== null}
                  onClick={() =>
                    handleDownloadRaster(
                      avatarGreenSvg,
                      'infoprecobaixo-avatar-green-512',
                      'png',
                      null,
                      512,
                      512,
                    )
                  }
                  className="text-xs h-7 px-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1"
                >
                  <Download className="w-3 h-3" /> .PNG
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isExporting !== null}
                  onClick={() =>
                    handleDownloadRaster(
                      avatarGreenSvg,
                      'infoprecobaixo-avatar-green-512',
                      'jpeg',
                      '#10B981',
                      512,
                      512,
                    )
                  }
                  className="text-xs h-7 px-2 border-slate-300 text-slate-700 hover:bg-slate-100 gap-1"
                >
                  <Download className="w-3 h-3" /> .JPG
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. MOCKUPS VETORIAIS REALISTAS DE APLICAÇÃO */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Eye className="w-5 h-5 text-slate-600" />
            Mockups de Aplicação Real: Na Caixa & No Mercado Livre
          </h2>
          <p className="text-xs text-slate-500">
            Simulação visual de como a identidade se comporta na logística de envio da Ambicorp e na
            página de produto do Mercado Livre.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* MOCKUP 1: ETIQUETA DE CAIXA DE DESPACHO / EMBALAGEM AMBICORP */}
          <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-amber-50/50 border-b border-amber-100 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-amber-700" />
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Aplicação 1: Etiqueta de Caixa & Lacre de Garantia
                  </CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] text-amber-800 border-amber-300 bg-amber-100"
                >
                  Despacho Correios / Full
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {/* Caixa parda de papelão com adesivo colado */}
              <div
                className="w-full rounded-2xl p-6 sm:p-8 relative shadow-inner border border-amber-900/20"
                style={{
                  backgroundColor: '#c89f6d',
                  backgroundImage:
                    'repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 2px, transparent 2px, transparent 4px)',
                }}
              >
                {/* Fita de empacotamento Ambicorp */}
                <div className="absolute top-0 left-0 right-0 h-6 bg-amber-950/20 backdrop-blur-xs flex items-center px-4 overflow-hidden border-b border-amber-950/10">
                  <span className="text-[10px] tracking-widest font-mono text-amber-950/60 uppercase font-bold">
                    AMBICORP QUALITY CONTROL • EMBALAGEM TESTADA • LACRE DE SEGURANÇA
                  </span>
                </div>

                {/* Etiqueta Branca Térmica Colada na Caixa */}
                <div className="mt-4 bg-white rounded-lg p-5 shadow-md border-2 border-slate-300 space-y-4 max-w-md mx-auto">
                  <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
                    <div className="w-48">
                      <div
                        className="w-full"
                        dangerouslySetInnerHTML={{ __html: recommendedMonoSvg }}
                      />
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono block text-slate-500 font-bold">
                        LOTE RECOND.
                      </span>
                      <span className="text-xs font-mono font-black text-slate-900">
                        #AMB-9482-BR
                      </span>
                    </div>
                  </div>

                  {/* Informações de checklist e procedência */}
                  <div className="grid grid-cols-2 gap-3 text-[11px] font-mono text-slate-700 pt-1">
                    <div>
                      <span className="block text-slate-400 text-[9px] uppercase">
                        EQUIPAMENTO:
                      </span>
                      <strong className="text-slate-900">NOTEBOOK DELL I5 16GB</strong>
                    </div>
                    <div>
                      <span className="block text-slate-400 text-[9px] uppercase">
                        PRODUÇÃO & TESTE:
                      </span>
                      <strong className="text-orange-600">AMBICORP FLOW TECH</strong>
                    </div>
                    <div>
                      <span className="block text-slate-400 text-[9px] uppercase">
                        CANAL DE VENDA:
                      </span>
                      <strong className="text-slate-900">INFOPRECOBAIXO ML</strong>
                    </div>
                    <div>
                      <span className="block text-slate-400 text-[9px] uppercase">GARANTIA:</span>
                      <strong className="text-emerald-700">90 DIAS CERTIFICADA</strong>
                    </div>
                  </div>

                  {/* Código de barras simulado da etiqueta */}
                  <div className="pt-2 border-t border-slate-200 flex flex-col items-center">
                    <div className="flex items-center justify-center gap-1 h-9 w-full bg-slate-900/5 px-2">
                      <div className="w-1 h-full bg-slate-900" />
                      <div className="w-0.5 h-full bg-slate-900" />
                      <div className="w-2 h-full bg-slate-900" />
                      <div className="w-0.5 h-full bg-slate-900" />
                      <div className="w-1.5 h-full bg-slate-900" />
                      <div className="w-0.5 h-full bg-slate-900" />
                      <div className="w-2.5 h-full bg-slate-900" />
                      <div className="w-1 h-full bg-slate-900" />
                      <div className="w-3 h-full bg-slate-900" />
                      <div className="w-0.5 h-full bg-slate-900" />
                      <div className="w-1.5 h-full bg-slate-900" />
                      <div className="w-2 h-full bg-slate-900" />
                      <div className="w-0.5 h-full bg-slate-900" />
                      <div className="w-1 h-full bg-slate-900" />
                      <div className="w-2.5 h-full bg-slate-900" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 mt-1">
                      7898492019482-AMB
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* MOCKUP 2: PERFIL DO VENDEDOR & ANÚNCIO NO MERCADO LIVRE */}
          <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-yellow-50/50 border-b border-yellow-200/60 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-yellow-700" />
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Aplicação 2: Card de Vendedor Oficial no Mercado Livre
                  </CardTitle>
                </div>
                <Badge className="bg-yellow-400 text-slate-900 font-bold hover:bg-yellow-400 text-[10px]">
                  MercadoLíder Platinum
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {/* Simulação da interface do Mercado Livre com a nova logo */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                {/* Header do anúncio */}
                <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
                  {/* Avatar redondo com a logo oficial */}
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-emerald-500 shadow-md flex-shrink-0 bg-slate-900">
                    <div
                      className="w-full h-full"
                      dangerouslySetInnerHTML={{ __html: avatarDarkSvg }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base">INFOPRECOBAIXO</h3>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-xs text-slate-500">
                      Loja Oficial de Notebooks & Informática
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        +5.000 vendas concretizadas
                      </span>
                      <span className="text-[10px] font-medium text-slate-500">
                        Recondicionados por Ambicorp
                      </span>
                    </div>
                  </div>
                </div>

                {/* Banner de anúncio ilustrativo do ML */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="w-full sm:w-56">
                    <div
                      className="w-full"
                      dangerouslySetInnerHTML={{ __html: recommendedLightSvg }}
                    />
                  </div>
                  <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4">
                    <span className="text-xs text-slate-400 line-through">R$ 2.499</span>
                    <div className="text-2xl font-black text-slate-900 tracking-tight">
                      R$ 1.189
                      <span className="text-xs font-normal text-emerald-600 ml-1">52% OFF</span>
                    </div>
                    <span className="text-[11px] text-emerald-700 font-semibold block">
                      ⚡ Envio Full com Nota Fiscal
                    </span>
                  </div>
                </div>

                {/* Termômetro de reputação do Mercado Livre */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                    <span>Reputação do Vendedor</span>
                    <span className="text-emerald-700 font-bold">Excelente (Termômetro Verde)</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 h-2">
                    <div className="bg-red-200 rounded-sm" />
                    <div className="bg-orange-200 rounded-sm" />
                    <div className="bg-yellow-200 rounded-sm" />
                    <div className="bg-lime-200 rounded-sm" />
                    <div className="bg-emerald-500 rounded-sm shadow-xs" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 6. MANUAL DE USO & TIPOGRAFIA VETORIAL */}
      <Card className="border-slate-200 shadow-sm bg-slate-900 text-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Diretrizes de Aplicação & Tipografia Vetorial
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            Orientações de compatibilidade para garantir que o logo nunca perca qualidade ou quebre
            fontes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs text-slate-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-1.5">
              <span className="text-emerald-400 font-bold block text-sm">
                1. Sem Fontes Externas
              </span>
              <p className="leading-relaxed">
                Todos os arquivos SVG utilizam famílias nativas do sistema com renderização robusta
                (<code>system-ui, -apple-system, Segoe UI, sans-serif</code>) e pesos vetoriais 900
                (Black). Aparecem exatamente iguais em Mac, Windows, Linux, Android e iOS sem
                precisar instalar .TTF/.OTF.
              </p>
            </div>

            <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-1.5">
              <span className="text-emerald-400 font-bold block text-sm">2. Área de Proteção</span>
              <p className="leading-relaxed">
                Mantenha um respiro mínimo equivalente à largura da tag (ou 20% da altura da logo)
                ao redor do símbolo para não encavalar com badges de preço do Mercado Livre ou fotos
                de notebook.
              </p>
            </div>

            <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-1.5">
              <span className="text-orange-400 font-bold block text-sm">
                3. Parceria com AMBICORP
              </span>
              <p className="leading-relaxed">
                A chancela "AMBICORP FLOW TECH" abaixo do nome funciona como o selo "Intel Inside"
                da marca: garante ao comprador que por trás do preço baixo existe uma indústria
                séria recondicionando os equipamentos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
