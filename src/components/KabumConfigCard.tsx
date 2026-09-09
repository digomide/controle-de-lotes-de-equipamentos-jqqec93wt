import React, { useState, useEffect } from 'react'
import {
  Server,
  Key,
  Globe,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Layers,
  Store,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { kabumService, DEFAULT_KABUM_URLS } from '@/services/kabumService'
import { kabumCategoriesService } from '@/services/kabumCategoriesService'
import type { KabumSettings } from '@/types/kabum'

export function KabumConfigCard() {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncingCategories, setSyncingCategories] = useState(false)
  const [syncingPrices, setSyncingPrices] = useState(false)

  const [settings, setSettings] = useState<KabumSettings>({
    api_key: '',
    api_url: DEFAULT_KABUM_URLS.production,
    environment: 'production',
  })

  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiUrlInput, setApiUrlInput] = useState(DEFAULT_KABUM_URLS.production)
  const [environment, setEnvironment] = useState<'production' | 'homologation'>('production')
  const [notesInput, setNotesInput] = useState('')

  const [categoriesCount, setCategoriesCount] = useState<number>(0)

  // Carregar dados
  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [loadedSettings, categories] = await Promise.all([
          kabumService.getSettings(),
          kabumCategoriesService.getAll(),
        ])

        if (loadedSettings) {
          setSettings(loadedSettings)
          setApiKeyInput(loadedSettings.api_key || '')
          setApiUrlInput(
            loadedSettings.api_url ||
              (loadedSettings.environment === 'homologation'
                ? DEFAULT_KABUM_URLS.homologation
                : DEFAULT_KABUM_URLS.production),
          )
          setEnvironment(loadedSettings.environment || 'production')
          setNotesInput(loadedSettings.notes || '')
        }
        setCategoriesCount(categories.length)
      } catch (err) {
        console.error('Erro ao carregar configurações Kabum:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleEnvironmentChange = (value: 'production' | 'homologation') => {
    setEnvironment(value)
    if (value === 'homologation') {
      setApiUrlInput(DEFAULT_KABUM_URLS.homologation)
    } else {
      setApiUrlInput(DEFAULT_KABUM_URLS.production)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await kabumService.saveSettings({
        api_key: apiKeyInput.trim(),
        api_url: apiUrlInput.trim(),
        environment,
        notes: notesInput.trim(),
      })
      setSettings(updated)
      toast({
        title: 'Configurações salvas',
        description: 'Credenciais do Kabum Marketplace atualizadas com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Falha ao salvar as configurações.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    const key = apiKeyInput.trim()
    if (!key) {
      toast({
        title: 'Chave ausente',
        description: 'Cole a chave de API Mirakl antes de executar o teste de credencial.',
        variant: 'destructive',
      })
      return
    }

    setTesting(true)
    try {
      // Salva antes de testar
      await kabumService.saveSettings({
        api_key: key,
        api_url: apiUrlInput.trim(),
        environment,
      })

      const res = await kabumService.testConnection({
        apiKey: key,
        apiUrl: apiUrlInput.trim(),
        environment,
      })

      if (res.ok) {
        toast({
          title: 'Conexão confirmada com sucesso!',
          description: `Loja Mirakl reconhecida: ${res.shop?.shop_name || 'Kabum Seller Store'}. Credencial válida!`,
        })
      } else {
        toast({
          title: 'Falha na validação da chave',
          description: res.message || 'Verifique se a chave de homologação/produção está correta.',
          variant: 'destructive',
        })
      }

      // Recarrega configurações atualizadas
      const refreshed = await kabumService.getSettings()
      if (refreshed) setSettings(refreshed)
    } catch (err: any) {
      toast({
        title: 'Erro no teste',
        description: err?.message || 'Erro ao conectar à API Mirakl do Kabum.',
        variant: 'destructive',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSyncCategories = async () => {
    if (!apiKeyInput.trim()) {
      toast({
        title: 'Integração em repouso',
        description: 'A sincronização de categorias requer a chave de API ativa.',
        variant: 'destructive',
      })
      return
    }

    setSyncingCategories(true)
    try {
      const res = await kabumCategoriesService.syncFromMirakl()
      if (res.ok) {
        toast({
          title: 'Categorias sincronizadas!',
          description: `${res.count || 0} categorias atualizadas via Mirakl H11.`,
        })
        const cats = await kabumCategoriesService.getAll()
        setCategoriesCount(cats.length)
      } else {
        toast({
          title: 'Aviso na sincronização',
          description: res.message || 'Não foi possível buscar a taxonomia Mirakl no momento.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro na sincronização',
        description: err?.message || 'Falha ao sincronizar categorias.',
        variant: 'destructive',
      })
    } finally {
      setSyncingCategories(false)
    }
  }

  const handleSyncPricesAndStock = async () => {
    if (!apiKeyInput.trim()) {
      toast({
        title: 'Integração em repouso',
        description: 'Configure a chave da API antes de sincronizar preço e estoque.',
        variant: 'destructive',
      })
      return
    }

    setSyncingPrices(true)
    try {
      const res = await kabumService.triggerPriceStockSync()
      if (res.ok) {
        toast({
          title: 'Worker executado!',
          description: res.message,
        })
      } else {
        toast({
          title: 'Aviso no worker',
          description: res.message,
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro no worker',
        description: err?.message || 'Falha ao executar worker.',
        variant: 'destructive',
      })
    } finally {
      setSyncingPrices(false)
    }
  }

  const hasApiKey = Boolean(apiKeyInput.trim())
  const isTestedSuccess = settings.last_test_status === 'success'

  return (
    <Card className="border-orange-200/80 shadow-sm relative overflow-hidden bg-gradient-to-b from-white to-orange-50/20">
      {/* Faixa decorativa Kabum Laranja */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#ff6500] via-[#ff8800] to-[#002f6c]" />

      <CardHeader className="pb-4 pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ff6500]/10 border border-[#ff6500]/20 flex items-center justify-center text-[#ff6500] font-black text-lg shadow-xs">
              K!
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-bold text-slate-900">
                  Kabum Marketplace (Mirakl)
                </CardTitle>
                <Badge
                  variant="outline"
                  className={
                    hasApiKey && isTestedSuccess
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : hasApiKey
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                  }
                >
                  {hasApiKey && isTestedSuccess ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Conectado
                    </span>
                  ) : hasApiKey ? (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" /> Chave inserida (não testada)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-slate-500" /> Aguardando Chave de API
                    </span>
                  )}
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Plataforma Mirakl integrada para publicação assíncrona (P41/P42/P44), taxonomia H11
                e gestão de ofertas.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://documentation.mirakl.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#002f6c] hover:underline flex items-center gap-1 font-medium bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200/60"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Docs Mirakl Seller
            </a>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Aviso de Chave Pendente ou Estado Plug-and-Play */}
        {!hasApiKey ? (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-900 space-y-2">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-amber-950 text-sm">
                  Solicite sua chave ao analista Kabum / acesso ao ambiente de homologação
                </p>
                <p className="text-amber-800 leading-relaxed">
                  Sua conta de seller Kabum está ativa. A infraestrutura de envio assíncrono (P41),
                  sincronização de ofertas e árvore de categorias está{' '}
                  <strong>pronta e em modo de repouso</strong>. Assim que o analista disponibilizar
                  a chave da API (ou o acesso a <code>kabum-dev.mirakl.net</code>), cole abaixo para
                  ativar o ecossistema imediatamente sem necessidade de novos deploys.
                </p>
                <div className="pt-1 flex flex-wrap items-center gap-3 text-[11px] text-amber-700 font-medium">
                  <span>• Autenticação: API Key por Header Authorization</span>
                  <span>• Taxonomia: Categorias H11 / PM11</span>
                  <span>• Ofertas: Estoque e Preço OR11 / OF01</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 text-emerald-950 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-semibold text-emerald-900">
                  Credencial configurada para o Kabum
                </span>
                <p className="text-emerald-700 text-[11px]">
                  {settings.shop_name
                    ? `Loja identificada: ${settings.shop_name} (ID: ${settings.shop_id || 'N/A'})`
                    : 'Aguardando validação com o endpoint leve de credencial ST11.'}
                </p>
              </div>
            </div>
            {settings.last_tested_at && (
              <span className="text-[10px] text-emerald-600 font-mono">
                Último teste: {new Date(settings.last_tested_at).toLocaleDateString('pt-BR')} às{' '}
                {new Date(settings.last_tested_at).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        )}

        {/* Campos de Configuração */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ambiente */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-500" /> Ambiente do Kabum
            </Label>
            <Select
              value={environment}
              onValueChange={(val: 'production' | 'homologation') => handleEnvironmentChange(val)}
            >
              <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Produção (kabum.mirakl.net)</SelectItem>
                <SelectItem value="homologation">
                  Homologação / Sandbox (kabum-dev.mirakl.net)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500">
              Selecione o ambiente liberado pelo seu analista Kabum.
            </p>
          </div>

          {/* URL da API Mirakl */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-500" /> URL da Instância Mirakl
            </Label>
            <Input
              value={apiUrlInput}
              onChange={(e) => setApiUrlInput(e.target.value)}
              placeholder="https://kabum.mirakl.net"
              className="h-9 text-xs font-mono bg-white border-slate-200"
            />
            <p className="text-[11px] text-slate-500">
              Default produção: <code>https://kabum.mirakl.net</code>
            </p>
          </div>

          {/* Chave de API Mirakl */}
          <div className="md:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-500" /> Chave de API (API Key Mirakl)
              </Label>
              <a
                href={
                  environment === 'homologation'
                    ? 'https://kabum-dev.mirakl.net/mmp/shop/account/api-key'
                    : 'https://kabum.mirakl.net/mmp/shop/account/api-key'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#ff6500] hover:underline flex items-center gap-1"
              >
                Gerar chave no portal Mirakl <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <Input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Cole aqui a chave gerada em: Usuário > Chave de API da Loja"
                className="h-9 text-xs font-mono bg-white border-slate-200 pr-24"
              />
              <div className="absolute right-1 top-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testing || !apiKeyInput.trim()}
                  className="h-7 text-[11px] px-2.5 font-semibold border-orange-300 text-orange-700 hover:bg-orange-50"
                  title="Testar chave fazendo chamada leve de shop info"
                >
                  {testing ? (
                    <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <Zap className="w-3 h-3 mr-1 text-[#ff6500]" />
                  )}
                  {testing ? 'Testando...' : 'Testar Chave'}
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              A chave Mirakl possui formato UUID v4. O sistema usa esta chave para autenticar
              endpoints ST11, categorias H11 e envio P41.
            </p>
          </div>

          {/* Anotações / Contato do analista */}
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Observações / Contato do Analista Kabum
            </Label>
            <Input
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="Ex: Analista Marcos - Ticket #18492 - Aguardando validação de catálogo"
              className="h-9 text-xs bg-white border-slate-200"
            />
          </div>
        </div>

        {/* Status do último teste */}
        {settings.last_test_message && (
          <div
            className={`p-3 rounded-lg text-xs border ${
              settings.last_test_status === 'success'
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                : 'bg-rose-50/70 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {settings.last_test_status === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{settings.last_test_message}</span>
            </div>
          </div>
        )}

        {/* Painel de Recursos & Sincronização Plug-and-Play */}
        <div className="pt-2 border-t border-slate-200/80">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Bloco Categorias */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#ff6500]" /> Árvore de Categorias (H11)
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {categoriesCount > 0
                    ? `${categoriesCount} categorias no banco`
                    : 'Infraestrutura Pronta'}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Mesma arquitetura do Mercado Livre: categorias organizadas por família e sub-família
                para notebooks, desktops e hardware.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSyncCategories}
                disabled={syncingCategories || !hasApiKey}
                className="w-full h-8 text-xs font-medium border-slate-300 text-slate-700 hover:bg-white"
              >
                {syncingCategories ? (
                  <RefreshCw className="w-3 h-3 animate-spin mr-1.5" />
                ) : (
                  <RefreshCw className="w-3 h-3 mr-1.5 text-slate-500" />
                )}
                {syncingCategories ? 'Sincronizando...' : 'Sincronizar Categorias Mirakl'}
              </Button>
            </div>

            {/* Bloco Preço e Estoque */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-600" /> Sincronização Preço & Estoque
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                >
                  Worker Cron (30 min)
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Worker agendado no backend que dorme silencioso e passa a atualizar ofertas de
                notebooks assim que a chave for ativada.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSyncPricesAndStock}
                disabled={syncingPrices || !hasApiKey}
                className="w-full h-8 text-xs font-medium border-slate-300 text-slate-700 hover:bg-white"
              >
                {syncingPrices ? (
                  <RefreshCw className="w-3 h-3 animate-spin mr-1.5" />
                ) : (
                  <Store className="w-3 h-3 mr-1.5 text-slate-500" />
                )}
                {syncingPrices ? 'Executando Worker...' : 'Disparar Worker de Ofertas'}
              </Button>
            </div>
          </div>
        </div>

        {/* Rodapé de Ações do Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Estrutura plug-and-play pronta — ativada no momento em que a chave for salva.
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing || !hasApiKey}
              className="text-xs h-9 border-slate-300"
            >
              {testing && <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Testar Conexão
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-[#ff6500] hover:bg-[#e65c00] text-white text-xs h-9 font-semibold shadow-xs"
            >
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
