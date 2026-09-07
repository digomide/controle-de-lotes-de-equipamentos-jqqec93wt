import React, { useState, useEffect, useRef } from 'react'
import {
  Bookmark,
  Copy,
  Check,
  Upload,
  FileJson,
  TrendingUp,
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  Database,
  Trash2,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowRight,
  ShoppingBag,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { getBookmarkletScript, type MLCollectorPayload } from '@/lib/mlBookmarklet'
import { mlCollectorService, type MLCollectorImportRecord } from '@/services/mlCollectorService'

interface ColetorNavegadorPanelProps {
  initialSearchTerm?: string
  onImportApplied?: (imported: MLCollectorImportRecord) => void
}

export function ColetorNavegadorPanel({
  initialSearchTerm = '',
  onImportApplied,
}: ColetorNavegadorPanelProps) {
  const { toast } = useToast()
  const bookmarkletCode = getBookmarkletScript()

  const [copiedCode, setCopiedCode] = useState(false)
  const [searchTermInput, setSearchTermInput] = useState(initialSearchTerm)
  const [jsonInput, setJsonInput] = useState('')
  const [importing, setImporting] = useState(false)
  const [previewPayload, setPreviewPayload] = useState<MLCollectorPayload | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [history, setHistory] = useState<MLCollectorImportRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [activeImportId, setActiveImportId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Atualizar termo se a prop mudar
  useEffect(() => {
    if (initialSearchTerm && !searchTermInput) {
      setSearchTermInput(initialSearchTerm)
    }
  }, [initialSearchTerm])

  // Carregar histórico de coletas
  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const list = await mlCollectorService.listRecentImports(30)
      setHistory(list)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  // Copiar código do bookmarklet
  async function handleCopyBookmarklet() {
    try {
      await navigator.clipboard.writeText(bookmarkletCode)
      setCopiedCode(true)
      toast({
        title: 'Código do Coletor copiado!',
        description:
          'Cole no campo URL de um novo favorito no seu Chrome ou arraste o botão para a barra.',
      })
      setTimeout(() => setCopiedCode(false), 3000)
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Selecione o código manualmente e copie.',
        variant: 'destructive',
      })
    }
  }

  // Parse dinâmico conforme o usuário digita/cola no textarea
  useEffect(() => {
    if (!jsonInput.trim()) {
      setPreviewPayload(null)
      setPreviewError(null)
      return
    }

    try {
      const parsed = mlCollectorService.parseAndValidatePayload(jsonInput)
      setPreviewPayload(parsed)
      setPreviewError(null)
      if (parsed.search_term && !searchTermInput) {
        setSearchTermInput(parsed.search_term)
      }
    } catch (err: any) {
      setPreviewPayload(null)
      setPreviewError(err.message || 'JSON inválido.')
    }
  }, [jsonInput])

  // Upload de arquivo .json
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        setJsonInput(content)
        toast({
          title: 'Arquivo carregado',
          description: `Arquivo ${file.name} carregado. Verifique os dados abaixo e clique em Salvar Coleta.`,
        })
      }
    }
    reader.onerror = () => {
      toast({
        title: 'Erro ao ler arquivo',
        description: 'Não foi possível ler o arquivo .json selecionado.',
        variant: 'destructive',
      })
    }
    reader.readAsText(file)
  }

  // Salvar importação no PocketBase
  async function handleSaveImport() {
    const term = (searchTermInput || previewPayload?.search_term || '').trim()
    if (!term) {
      toast({
        title: 'Informe o termo de busca',
        description: 'Identifique a qual busca ou produto exato estes dados pertencem.',
        variant: 'destructive',
      })
      return
    }

    if (!previewPayload) {
      toast({
        title: 'Nenhum dado válido para importar',
        description: previewError || 'Cole o JSON gerado pelo bookmarklet.',
        variant: 'destructive',
      })
      return
    }

    setImporting(true)
    try {
      const record = await mlCollectorService.saveCollectorImport({
        searchTerm: term,
        payload: previewPayload,
        sourceUrl: previewPayload.source_url,
      })

      toast({
        title: 'Coleta importada com sucesso!',
        description: `${record.results_count} anúncios lidos (${record.with_sales_count} com vendas explícitas) registrados para "${term}".`,
      })

      setJsonInput('')
      setPreviewPayload(null)
      setActiveImportId(record.id)
      await loadHistory()

      if (onImportApplied) {
        onImportApplied(record)
      }
    } catch (err: any) {
      toast({
        title: 'Falha ao salvar coleta',
        description: err.message || 'Erro ao registrar no banco de dados.',
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  // Deletar item do histórico
  async function handleDeleteHistory(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Deseja excluir esta coleta salva?')) return
    const ok = await mlCollectorService.deleteImport(id)
    if (ok) {
      toast({ title: 'Coleta removida' })
      loadHistory()
      if (activeImportId === id) setActiveImportId(null)
    }
  }

  // Aplicar uma coleta do histórico
  function handleSelectHistoryItem(item: MLCollectorImportRecord) {
    setActiveImportId(item.id)
    if (onImportApplied) {
      onImportApplied(item)
      toast({
        title: `Coleta aplicada: "${item.search_term}"`,
        description: 'As métricas do Raio-X foram atualizadas com as vendas desta coleta.',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner Principal com Diagnóstico da Ponte */}
      <Card className="border-indigo-900/60 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center shrink-0">
                  <Bookmark className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    Coletor do Navegador
                    <Badge className="bg-emerald-500 text-slate-950 text-[10px] font-bold">
                      Bypass WAF 100% Legal
                    </Badge>
                  </h2>
                  <p className="text-xs text-slate-300">
                    O Mercado Livre bloqueia servidores que tentam raspar vendas públicas (erro 403
                    / WAF). Com este Coletor, seu próprio navegador Chrome resolve o desafio da
                    página e exporta os contadores reais (+500 vendidos, +5 mil vendidos) direto
                    para o Raio-X.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <Button
                onClick={handleCopyBookmarklet}
                className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-2 shadow-xs"
              >
                {copiedCode ? (
                  <Check className="w-4 h-4 text-emerald-300" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copiedCode ? 'Código Copiado!' : 'Copiar Código do Coletor'}
              </Button>
              <Button
                variant="outline"
                className="h-10 text-xs text-slate-200 border-slate-700 bg-slate-800/80 hover:bg-slate-700"
                asChild
              >
                <a
                  href={bookmarkletCode}
                  onClick={(e) => {
                    // Prevenir navegação se clicar direto na página
                    e.preventDefault()
                    toast({
                      title: 'Arraste para os Favoritos',
                      description:
                        'Arraste este botão para a sua Barra de Favoritos (Ctrl+Shift+B) ou use o botão "Copiar Código".',
                    })
                  }}
                  title="Arraste para a Barra de Favoritos do Chrome"
                >
                  <Bookmark className="w-3.5 h-3.5 text-amber-400 mr-1.5" />
                  Arraste p/ Favoritos
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Passo-a-passo Visual Numerado */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-indigo-600" />
            Como Usar o Coletor em 6 Passos Simples
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Você só precisa configurar o favorito <strong>uma única vez</strong> no Chrome. Depois,
            basta 1 clique em qualquer busca do ML.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Passo 1 */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <span className="text-xs font-bold text-slate-900">Copie o Coletor</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Clique no botão azul <strong>&quot;Copiar Código do Coletor&quot;</strong> acima
                para copiar o script bookmarklet para sua área de transferência.
              </p>
            </div>

            {/* Passo 2 */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <span className="text-xs font-bold text-slate-900">Crie o Favorito</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                No seu Chrome, pressione{' '}
                <kbd className="px-1 py-0.5 bg-slate-200 text-slate-800 rounded text-[10px] font-mono">
                  Ctrl+Shift+O
                </kbd>{' '}
                (ou clique com botão direito na barra de favoritos) e escolha{' '}
                <strong>Adicionar página</strong>. Dê o nome de <em>&quot;Coletor ML&quot;</em> e
                cole o código no campo <strong>URL</strong>.
              </p>
            </div>

            {/* Passo 3 */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <span className="text-xs font-bold text-slate-900">Abra a Busca no ML</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                No seu navegador, acerte a busca do Mercado Livre (ex.: <em>cooler lenovo m900</em>,{' '}
                <em>dell latitude 5420</em> ou a página do anúncio individual).
              </p>
            </div>

            {/* Passo 4 */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  4
                </span>
                <span className="text-xs font-bold text-slate-900">Clique no Favorito</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Com a página do Mercado Livre aberta e carregada, clique no favorito{' '}
                <strong>&quot;Coletor ML&quot;</strong>. Uma janelinha escura surgirá na tela
                instantaneamente com os dados extraídos.
              </p>
            </div>

            {/* Passo 5 */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  5
                </span>
                <span className="text-xs font-bold text-slate-900">Copie o JSON</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Na janela do coletor, clique no botão azul <strong>&quot;Copiar JSON&quot;</strong>{' '}
                (ou em &quot;Baixar .json&quot; caso prefira salvar o arquivo).
              </p>
            </div>

            {/* Passo 6 */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  6
                </span>
                <span className="text-xs font-bold text-slate-900">Cole Aqui e Salve</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Volte nesta aba, cole o JSON na área abaixo e clique em{' '}
                <strong>&quot;Importar Coleta&quot;</strong>. O Raio-X usará na hora as vendas reais
                de cada anúncio!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulário de Importação: Colar JSON ou Upload de Arquivo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-slate-200 shadow-xs bg-white">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-blue-600" />
                  Importar Coleta do Mercado Livre
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Cole o JSON copiado do navegador ou faça upload do arquivo .json
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs h-8 gap-1.5 border-slate-300"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload .json
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Termo de Busca / Produto Exato</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Será vinculado às buscas do Raio-X
                  </span>
                </label>
                <Input
                  value={searchTermInput}
                  onChange={(e) => setSearchTermInput(e.target.value)}
                  placeholder="Ex.: cooler lenovo m900, thinkpad t480, latitude 5420..."
                  className="h-9 text-xs bg-slate-50 border-slate-200 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <FileJson className="w-3.5 h-3.5 text-blue-600" />
                    Conteúdo JSON da Coleta
                  </label>
                  {jsonInput && (
                    <button
                      type="button"
                      onClick={() => setJsonInput('')}
                      className="text-[10px] text-slate-400 hover:text-rose-600 underline"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <Textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='Cole aqui o JSON gerado pelo coletor (começa com {"version": "1.0.0", "results": [...]})'
                  rows={8}
                  className="font-mono text-xs bg-slate-50 border-slate-200 focus:bg-white resize-y"
                />
              </div>

              {previewError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Formato Inválido:</strong> {previewError}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  disabled={importing || !previewPayload}
                  onClick={handleSaveImport}
                  className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2 shadow-xs"
                >
                  {importing ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <TrendingUp className="w-4 h-4" />
                  )}
                  {importing ? 'Importando e Vinculando...' : 'Importar Coleta para o Raio-X'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pré-visualização do que foi lido */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-slate-200 shadow-xs bg-white h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Feedback da Leitura
                </span>
                {previewPayload && (
                  <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                    ✓ Validado
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Resumo dos contadores extraídos antes de salvar
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
              {previewPayload ? (
                <div className="space-y-4">
                  {/* Grade de estatísticas */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Anúncios Lidos
                      </span>
                      <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">
                        {previewPayload.results_count}
                      </span>
                    </div>

                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                        Com Vendas Explícitas
                      </span>
                      <span className="text-2xl font-black text-emerald-900 font-mono mt-0.5 block">
                        {previewPayload.with_sales_count}
                      </span>
                    </div>
                  </div>

                  {previewPayload.source_url && (
                    <div className="text-[11px] text-slate-500 truncate">
                      <strong>Origem:</strong>{' '}
                      <span className="font-mono text-[10px]">{previewPayload.source_url}</span>
                    </div>
                  )}

                  {/* Amostra dos primeiros anúncios lidos */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                      Exemplos Lidos da Página:
                    </span>
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1 border border-slate-100 rounded-md p-2 bg-slate-50/50">
                      {previewPayload.results.slice(0, 5).map((item, i) => (
                        <div
                          key={i}
                          className="p-2 bg-white rounded border border-slate-200 text-xs space-y-1 shadow-2xs"
                        >
                          <div className="font-semibold text-slate-800 line-clamp-1">
                            {item.title}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>
                              {item.price
                                ? item.price.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })
                                : 'Preço não lido'}
                            </span>
                            {item.sold_quantity != null ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-mono">
                                🔥 {item.sold_quantity} vendidos
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-400 text-[9px]">
                                Vendas não visíveis
                              </Badge>
                            )}
                          </div>
                          {item.seller_name && (
                            <div className="text-[10px] text-slate-400 truncate">
                              Seller: {item.seller_name}
                            </div>
                          )}
                        </div>
                      ))}
                      {previewPayload.results.length > 5 && (
                        <div className="text-center text-[10px] text-slate-400 pt-1">
                          + {previewPayload.results.length - 5} outros anúncios no payload
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-lg">
                  <FileJson className="w-8 h-8 text-slate-300" />
                  <p className="text-xs">
                    Cole o código JSON ao lado para ver o resumo de anúncios e contadores de vendas
                    capturados.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Histórico de Coletas Salvas */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-600" />
              Histórico de Coletas do Navegador
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Coletas salvas ficam vinculadas ao termo de pesquisa e alimentam o Raio-X
            </CardDescription>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadHistory}
            disabled={loadingHistory}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {history.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Nenhuma coleta realizada ainda. Execute o bookmarklet na busca do Mercado Livre para
              iniciar!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {history.map((item) => {
                const isSelected = activeImportId === item.id
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectHistoryItem(item)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer space-y-2 relative ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide block">
                          Termo de Busca
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {item.search_term}
                        </h4>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteHistory(item.id, e)}
                        className="h-6 w-6 text-slate-400 hover:text-rose-600 -mr-1"
                        title="Excluir coleta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        {item.results_count || 0} anúncios
                      </Badge>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-mono font-bold">
                        🔥 {item.with_sales_count || 0} com vendas
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>
                        {item.imported_at ? new Date(item.imported_at).toLocaleString('pt-BR') : ''}
                      </span>
                      <span className="text-indigo-600 font-bold flex items-center gap-0.5">
                        {isSelected ? '✓ Aplicado' : 'Reaplicar →'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
