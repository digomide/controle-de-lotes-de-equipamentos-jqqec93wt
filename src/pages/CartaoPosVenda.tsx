import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Printer,
  ArrowLeft,
  Download,
  Pencil,
  Loader2,
  Save,
  RotateCcw,
  X,
  AlertTriangle,
  Phone,
  HelpCircle,
  CheckCircle,
  Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { cartaoPosVendaService, CartaoPosVendaConfig } from '@/services/cartaoPosVendaService'
import { downloadCartaoPosVendaPdf } from '@/utils/cartaoPosVendaPdfGenerator'

/**
 * Ícone estilizado do WhatsApp em SVG puro
 */
const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.42 0-2.82-.37-4.06-1.07l-.29-.17-3.12.82.83-3.04-.19-.3a8.21 8.21 0 0 1-1.26-4.48c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.4-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.32-.02-.45-.06-.13-.56-1.34-.76-1.84-.2-.49-.4-.42-.56-.43h-.47c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.71 4.3 3.8.6.26 1.07.42 1.44.54.61.19 1.16.17 1.6.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.18-.47-.3z" />
  </svg>
)

/**
 * Ícone estilizado de aperto de mãos (remetendo ao símbolo de confiança e satisfação)
 */
const HandshakeIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="32" cy="32" r="30" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
    <path
      d="M18 36L26 28L32 34L28 38L18 36Z"
      fill="#fde047"
      stroke="#1e3a8a"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M46 36L38 28L32 34L36 38L46 36Z"
      fill="#fde047"
      stroke="#1e3a8a"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M26 28L22 24C21 23 19 23 18 24L14 28"
      stroke="#1e3a8a"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M38 28L42 24C43 23 45 23 46 24L50 28"
      stroke="#1e3a8a"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M28 38L32 42L36 38"
      stroke="#1e3a8a"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const CartaoPosVenda: React.FC = () => {
  const [config, setConfig] = useState<CartaoPosVendaConfig>(() =>
    cartaoPosVendaService.getConfig(),
  )
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState<CartaoPosVendaConfig>(() => config)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [pdfProgressLabel, setPdfProgressLabel] = useState<string>('')

  // Sincroniza estado com eventos locais
  useEffect(() => {
    const loaded = cartaoPosVendaService.getConfig()
    setConfig(loaded)
    setEditValues(loaded)

    const handleUpdate = (e: any) => {
      if (e?.detail) {
        setConfig(e.detail)
        setEditValues(e.detail)
      }
    }
    window.addEventListener('cartao_pos_venda_updated', handleUpdate)
    return () => {
      window.removeEventListener('cartao_pos_venda_updated', handleUpdate)
    }
  }, [])

  const handleStartEditing = () => {
    setEditValues(config)
    setIsEditing(true)
  }

  const handleCancelEditing = () => {
    setEditValues(config)
    setIsEditing(false)
  }

  const handleSaveEditing = () => {
    const saved = cartaoPosVendaService.saveConfig(editValues)
    setConfig(saved)
    setIsEditing(false)
    toast({
      title: 'Cartão atualizado com sucesso',
      description: 'Alterações salvas localmente no seu navegador.',
    })
  }

  const handleResetToDefault = () => {
    if (
      !window.confirm(
        'Deseja restaurar todos os textos e campos do cartão para os dizeres originais?',
      )
    ) {
      return
    }
    const standard = cartaoPosVendaService.resetToDefault()
    setConfig(standard)
    setEditValues(standard)
    setIsEditing(false)
    toast({
      title: 'Dizeres originais restaurados',
      description: 'O modelo base foi redefinido.',
    })
  }

  const handlePrint = () => {
    if (isEditing) {
      handleSaveEditing()
    }
    window.focus()
    setTimeout(() => {
      window.print()
    }, 150)
  }

  const handleDownloadPdf = async () => {
    if (isEditing) {
      handleSaveEditing()
    }
    setIsDownloadingPdf(true)
    setPdfProgressLabel('Preparando PDF...')
    try {
      toast({
        title: 'Gerando PDF para impressão',
        description: 'Construindo cartão A5 horizontal de alta definição...',
      })
      await downloadCartaoPosVendaPdf({
        elementId: 'cartao-pos-venda-doc',
        filename: 'Cartao-Pos-Venda-Ambicorp.pdf',
        onProgress: (_prog, label) => setPdfProgressLabel(label),
      })
      toast({
        title: 'PDF baixado com sucesso!',
        description: 'Arquivo salvo na sua pasta de Downloads.',
      })
    } catch (err) {
      console.error('Erro ao gerar PDF via html2pdf:', err)
      toast({
        title: 'Usando impressão como alternativa',
        description:
          'Seu navegador abrirá o diálogo: selecione "Salvar como PDF" ou sua impressora.',
      })
      setTimeout(() => {
        window.print()
      }, 300)
    } finally {
      setIsDownloadingPdf(false)
      setPdfProgressLabel('')
    }
  }

  const current = isEditing ? editValues : config

  return (
    <div
      id="cartao-pos-venda-container"
      className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased p-0 sm:p-4 md:p-6 print:p-0 print:m-0 print:bg-white"
    >
      {/* BARRA SUPERIOR DE AÇÕES (OCULTA NA IMPRESSÃO) */}
      <div className="cartao-no-print max-w-[210mm] mx-auto mb-4 px-3 sm:px-0 flex flex-wrap items-center justify-between gap-2.5 bg-slate-800/90 backdrop-blur p-3 rounded-xl border border-slate-700 shadow-md print:hidden">
        <div className="flex items-center gap-2">
          <Link to="/configuracoes">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Configurações
            </Button>
          </Link>
          <Badge
            variant="outline"
            className="text-[11px] font-semibold bg-amber-500/10 text-amber-300 border-amber-500/40"
          >
            Flyer Caixa ML • A5 Horizontal
          </Badge>
          {config.updatedAt && (
            <span className="hidden sm:inline text-[11px] text-slate-400 bg-slate-700/60 px-2 py-0.5 rounded">
              Editado localmente
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEditing}
                className="gap-1 text-xs text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEditing}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <Save className="w-3.5 h-3.5" />
                Salvar Alterações
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartEditing}
              className="gap-1.5 text-xs text-slate-200 border-slate-600 hover:bg-slate-700 hover:text-white font-medium"
              title="Editar WhatsApp, Slogan e dizeres"
            >
              <Pencil className="w-3.5 h-3.5 text-amber-400" />
              Editar Dados
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToDefault}
            className="gap-1.5 text-xs text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white"
            title="Restaurar textos do modelo original"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            Restaurar Padrão
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="gap-1.5 text-xs text-emerald-300 border-emerald-600/60 bg-emerald-950/40 hover:bg-emerald-900/60 font-semibold"
            title="Baixar arquivo PDF A5 direto no navegador"
          >
            {isDownloadingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <Download className="w-3.5 h-3.5 text-emerald-400" />
            )}
            {isDownloadingPdf ? pdfProgressLabel || 'Baixando PDF...' : 'Baixar PDF'}
          </Button>

          <Button
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-sm"
            title="Imprimir cartão limpo sem barras laterais"
          >
            <Printer className="w-3.5 h-3.5 text-slate-950" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* FORMULÁRIO DE EDIÇÃO RÁPIDA (QUANDO ATIVO) */}
      {isEditing && (
        <div className="cartao-no-print max-w-[210mm] mx-auto mb-5 p-4 bg-slate-800 rounded-xl border border-amber-500/40 text-slate-200 text-xs space-y-3 shadow-lg print:hidden">
          <div className="flex items-center justify-between pb-2 border-b border-slate-700">
            <span className="font-bold text-amber-400 flex items-center gap-1.5 text-sm">
              <Pencil className="w-4 h-4" />
              Edição dos Textos do Cartão
            </span>
            <span className="text-[11px] text-slate-400">
              Personalize o telefone de contato, nomes e instruções
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                WhatsApp / Atendimento
              </label>
              <Input
                value={editValues.whatsappNumero}
                onChange={(e) =>
                  setEditValues((prev) => ({ ...prev, whatsappNumero: e.target.value }))
                }
                placeholder="(XX) XXXXX-XXXX"
                className="bg-slate-900 border-slate-700 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Marca Principal (Topo & Rodapé)
              </label>
              <Input
                value={editValues.subtituloMarca}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    subtituloMarca: e.target.value,
                    marcasRodape: e.target.value,
                  }))
                }
                placeholder="AMBICORP"
                className="bg-slate-900 border-slate-700 text-slate-100 text-xs h-8"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Slogan do Rodapé
              </label>
              <Input
                value={editValues.sloganRodape}
                onChange={(e) =>
                  setEditValues((prev) => ({ ...prev, sloganRodape: e.target.value }))
                }
                placeholder="Tecnologia e Qualidade"
                className="bg-slate-900 border-slate-700 text-slate-100 text-xs h-8"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Texto de ATENÇÃO (Evitar Reclamação)
              </label>
              <Textarea
                rows={3}
                value={editValues.textoAtencao}
                onChange={(e) =>
                  setEditValues((prev) => ({ ...prev, textoAtencao: e.target.value }))
                }
                className="bg-slate-900 border-slate-700 text-slate-100 text-xs leading-relaxed resize-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Opção de Devolução Rápida Recomendada
              </label>
              <Textarea
                rows={3}
                value={editValues.opcaoDevolucao}
                onChange={(e) =>
                  setEditValues((prev) => ({ ...prev, opcaoDevolucao: e.target.value }))
                }
                className="bg-slate-900 border-slate-700 text-slate-100 text-xs leading-relaxed resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelEditing}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEditing}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Salvar Alterações
            </Button>
          </div>
        </div>
      )}

      {/* ÁREA DE VISUALIZAÇÃO E IMPRESSÃO DO CARTÃO (DIMENSÕES PROPORCIONAIS A5 PAISAGEM: 210mm x 148mm) */}
      <div className="flex justify-center items-center py-2 sm:py-4 overflow-x-auto">
        <div
          id="cartao-pos-venda-doc"
          style={{
            width: '210mm',
            minHeight: '148mm',
            height: '148mm',
            boxSizing: 'border-box',
          }}
          className="relative bg-[#10245a] text-white shadow-2xl rounded-sm overflow-hidden flex flex-col justify-between select-none print:shadow-none print:rounded-none print:m-0 print:border-none"
        >
          {/* CAMADA DE FUNDO COM GRADIENTE E PADRÃO SUTIL TECH */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background:
                'radial-gradient(circle at 80% 20%, rgba(37, 99, 235, 0.4) 0%, transparent 60%), radial-gradient(circle at 20% 80%, rgba(29, 78, 216, 0.3) 0%, transparent 70%)',
            }}
          />

          {/* PARTE SUPERIOR: CABEÇALHO COM FAIXA AMARELA DIAGONAL ESTILIZADA */}
          <div className="relative z-10">
            {/* Faixa Amarela Estilo Ângulo/Banner */}
            <div
              className="relative px-5 py-3.5 flex items-center justify-between"
              style={{
                backgroundColor: '#FFE500',
                clipPath: 'polygon(0 0, 100% 0, 100% 82%, 0 100%)',
                paddingBottom: '22px',
              }}
            >
              {/* Texto Grande da Faixa: "GRATO PELA COMPRA DO NOSSO PRODUTO" */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-amber-300">
                  <HandshakeIcon className="w-9 h-9" />
                </div>
                <div className="flex flex-col">
                  <h1
                    className="font-black tracking-tight leading-none text-[#0f2257]"
                    style={{
                      fontSize: '19px',
                      textTransform: 'uppercase',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                  >
                    {current.tituloCabecalho}
                  </h1>
                </div>
              </div>

              {/* Marca AMBICORP Estilizada (Substitui o logo do ML do original) */}
              <div className="flex flex-col items-end pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black tracking-widest text-[#0f2257]/80 uppercase">
                    PRODUTO
                  </span>
                  <div className="flex items-baseline font-black tracking-tight text-xl leading-none text-[#0f2257]">
                    <span className="text-[#ea580c]">A</span>
                    <span>MBICORP</span>
                  </div>
                </div>
                <span className="text-[8.5px] font-bold text-[#0f2257]/90 tracking-wider uppercase">
                  {current.marcaSecundaria || 'INFOPRECOBAIXO'}
                </span>
              </div>
            </div>

            {/* SEÇÃO 1: BLOCO DE ATENÇÃO (EVITE ABRIR RECLAMAÇÃO) */}
            <div className="px-6 pt-1 pb-2">
              <div
                className="rounded-lg p-2.5 flex items-start gap-2.5 border border-amber-400/30"
                style={{
                  backgroundColor: 'rgba(15, 34, 87, 0.85)',
                }}
              >
                <div className="shrink-0 mt-0.5">
                  <div className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-xs">
                    <AlertTriangle className="w-4 h-4 fill-slate-950 stroke-amber-400" />
                  </div>
                </div>

                <div className="flex-1 text-[11px] leading-[1.38] text-amber-50">
                  <span className="font-extrabold text-amber-300 text-[11.5px] uppercase tracking-wide mr-1">
                    ATENÇÃO:
                  </span>
                  <span>
                    Caso ocorra qualquer divergência ou problema com sua mercadoria, pedimos que{' '}
                    <strong className="underline decoration-amber-400 font-bold text-white">
                      não abra reclamação
                    </strong>
                    . Entre em contato diretamente conosco. Assim, resolveremos seu problema de
                    forma mais rápida.{' '}
                    <span className="font-extrabold text-amber-300 uppercase tracking-tight">
                      RECLAMAÇÃO É UM PROCESSO BUROCRÁTICO E, PORTANTO, AUMENTA MUITO O TEMPO PARA
                      RESOLUÇÃO.
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: BLOCO CENTRAL COM INSTRUÇÕES DE DEVOLUÇÃO CASO PRECISE */}
            <div className="px-6 py-1">
              <div
                className="rounded-lg p-2.5 border border-blue-400/30 text-center"
                style={{
                  backgroundColor: 'rgba(23, 49, 122, 0.75)',
                }}
              >
                {/* TÍTULO DA SEÇÃO */}
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="h-[1px] w-8 bg-blue-300/40" />
                  <h2
                    className="font-black text-amber-300 text-[12.5px] tracking-wide uppercase"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                  >
                    {current.tituloSecaoProblema}
                  </h2>
                  <div className="h-[1px] w-8 bg-blue-300/40" />
                </div>

                <p className="text-[10.5px] text-slate-200 font-medium mb-1.5">
                  {current.perguntaArrependimento}
                </p>

                {/* PASSOS RÁPIDOS */}
                <div className="flex flex-col items-center gap-1 my-1">
                  <div className="flex items-center gap-2 text-[10.5px] text-white">
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-[9px] shrink-0">
                      1
                    </span>
                    <span>{current.passo1}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[10.5px] text-white">
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-[9px] shrink-0">
                      2
                    </span>
                    <span>{current.passo2}</span>
                  </div>
                </div>

                {/* CAIXA DESTAQUE DA OPÇÃO CERTA */}
                <div className="my-1.5 px-3 py-1 bg-white/10 rounded border border-white/20 inline-block max-w-[92%]">
                  <p className="text-[11px] font-extrabold text-amber-200 tracking-tight">
                    {current.opcaoDevolucao}
                  </p>
                </div>

                <p className="text-[10px] text-emerald-300 font-semibold italic">
                  {current.textoVantagem}
                </p>
              </div>
            </div>
          </div>

          {/* PARTE INFERIOR: RODAPÉ BRANCO COM WHATSAPP EM DESTAQUE E MARCAS */}
          <div className="relative z-10 bg-white text-slate-900 px-6 py-2 border-t-2 border-amber-400 flex items-center justify-between">
            {/* Bloco WhatsApp Atendimento */}
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-md">
                <WhatsAppIcon className="w-6 h-6" />
              </div>

              <div className="flex flex-col justify-center">
                <p className="text-[9.5px] text-slate-700 leading-tight max-w-[280px]">
                  {current.textoAtendimentoWhatsApp}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="text-[16px] font-black tracking-tight text-[#0f2257]"
                    style={{ fontFamily: 'monospace, system-ui' }}
                  >
                    {current.whatsappNumero}
                  </span>
                  {current.whatsappNumero === '(XX) XXXXX-XXXX' && (
                    <span className="cartao-no-print text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 print:hidden">
                      Clique em Editar para informar seu número
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Bloco de Marcas e Chancela Ambicorp */}
            <div className="flex flex-col items-end justify-center pl-3 border-l border-slate-200">
              <div className="flex items-center gap-2">
                <div className="flex items-baseline font-black tracking-tight text-lg text-slate-900 leading-none">
                  <span className="text-[#ea580c]">A</span>
                  <span>MBICORP</span>
                </div>
                <div className="h-4 w-[1px] bg-slate-300" />
                <span className="text-[11px] font-extrabold text-slate-700 tracking-wider uppercase">
                  {current.marcaSecundaria || 'INFOPRECOBAIXO'}
                </span>
              </div>
              <span className="text-[8.5px] text-slate-500 font-semibold tracking-wide uppercase mt-0.5">
                {current.sloganRodape || 'Tecnologia e Qualidade'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* DICA DE IMPRESSÃO / CORTE (OCULTA NO PRINT) */}
      <div className="cartao-no-print max-w-[210mm] mx-auto mt-3 px-4 py-2 bg-slate-800/60 rounded-lg border border-slate-700 text-slate-400 text-[11px] flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Dica de Impressão:</strong> Papel sulfite 75g/90g ou couche 120g em tamanho A5
            (ou 2 cartões por folha A4 cortados ao meio). Formato: 210 × 148 mm.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500">Impressão nítida e direta</span>
        </div>
      </div>
    </div>
  )
}

export default CartaoPosVenda
