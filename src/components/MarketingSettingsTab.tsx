import React, { useState, useEffect } from 'react'
import {
  KeyRound,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  HelpCircle,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Send,
  Instagram,
  Phone,
  Layers,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { marketingService } from '@/services/marketingService'
import type { MarketingSettings, MarketingConnectionTestResult } from '@/types/marketing'

export function MarketingSettingsTab() {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const [metaWaToken, setMetaWaToken] = useState('')
  const [metaWaPhoneId, setMetaWaPhoneId] = useState('')
  const [metaWaAccountId, setMetaWaAccountId] = useState('')
  const [instagramUserId, setInstagramUserId] = useState('')
  const [instagramToken, setInstagramToken] = useState('')
  const [senderPhoneDisplay, setSenderPhoneDisplay] = useState('(31) 99231-0866')

  const [showInstructions, setShowInstructions] = useState(false)
  const [testResult, setTestResult] = useState<MarketingConnectionTestResult | null>(null)

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await marketingService.getSettings()
      setMetaWaToken(data.meta_wa_token || '')
      setMetaWaPhoneId(data.meta_wa_phone_number_id || '')
      setMetaWaAccountId(data.meta_wa_business_account_id || '')
      setInstagramUserId(data.instagram_user_id || '')
      setInstagramToken(data.instagram_token || '')
      setSenderPhoneDisplay(data.sender_phone_display || '(31) 99231-0866')

      // Se tiver credenciais, faz um teste inicial silencioso
      if (data.meta_wa_token && data.meta_wa_phone_number_id) {
        marketingService
          .testConnection()
          .then((res) => setTestResult(res))
          .catch(() => {})
      }
    } catch (err: any) {
      console.error('Erro ao carregar configurações de marketing:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await marketingService.saveSettings({
        meta_wa_token: metaWaToken.trim(),
        meta_wa_phone_number_id: metaWaPhoneId.trim(),
        meta_wa_business_account_id: metaWaAccountId.trim(),
        instagram_user_id: instagramUserId.trim(),
        instagram_token: instagramToken.trim(),
        sender_phone_display: senderPhoneDisplay.trim(),
      })
      toast({
        title: 'Configurações salvas!',
        description: 'Credenciais de integração armazenadas no banco de dados.',
      })
      handleTestConnection()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await marketingService.testConnection({
        meta_wa_token: metaWaToken.trim(),
        meta_wa_phone_number_id: metaWaPhoneId.trim(),
        instagram_token: instagramToken.trim(),
        instagram_user_id: instagramUserId.trim(),
      })
      setTestResult(res)
      if (res.whatsapp.ok) {
        toast({
          title: 'WhatsApp Conectado!',
          description: res.whatsapp.message,
        })
      } else {
        toast({
          title: 'Aviso WhatsApp',
          description: res.whatsapp.message,
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Falha ao testar credenciais',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setTesting(false)
    }
  }

  const waConfigured = Boolean(metaWaToken && metaWaPhoneId)
  const igConfigured = Boolean(instagramToken || metaWaToken)

  return (
    <div className="space-y-6">
      {/* Banner Superior de Status por Canal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status WhatsApp */}
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            testResult?.whatsapp?.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : waConfigured
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                testResult?.whatsapp?.ok
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">WhatsApp Meta Cloud API</span>
                {testResult?.whatsapp?.ok ? (
                  <Badge className="bg-emerald-600 text-white text-[10px]">Conectado</Badge>
                ) : waConfigured ? (
                  <Badge variant="outline" className="border-amber-400 text-amber-700 text-[10px]">
                    Validando
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-500 bg-white text-[10px]">
                    Não configurado
                  </Badge>
                )}
              </div>
              <p className="text-[11px] opacity-80 mt-0.5">
                {testResult?.whatsapp?.message ||
                  (waConfigured
                    ? 'Credenciais informadas. Clique em "Verificar Conexão".'
                    : 'Aguardando credenciais oficiais da Meta.')}
              </p>
            </div>
          </div>
        </div>

        {/* Status Instagram */}
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            testResult?.instagram?.ok
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : igConfigured
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                testResult?.instagram?.ok
                  ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              <Instagram className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">Instagram Graph API</span>
                {testResult?.instagram?.ok ? (
                  <Badge className="bg-rose-600 text-white text-[10px]">Conectado</Badge>
                ) : igConfigured ? (
                  <Badge variant="outline" className="border-amber-400 text-amber-700 text-[10px]">
                    Configurado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-500 bg-white text-[10px]">
                    Opcional
                  </Badge>
                )}
              </div>
              <p className="text-[11px] opacity-80 mt-0.5">
                {testResult?.instagram?.message ||
                  'Automação complementar ativa via Estúdio de Post e fila social_posts.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Formulário de Configuração */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-600" />
              Credenciais da Meta (Facebook Developers)
            </CardTitle>
            <CardDescription className="text-xs">
              Insira o Token de Acesso e o ID do Número fornecidos pelo painel de desenvolvedores da
              Meta.
            </CardDescription>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-xs text-slate-600 hover:text-slate-900 h-8 gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            {showInstructions ? 'Ocultar passo a passo' : 'Como obter as credenciais?'}
          </Button>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {showInstructions && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Passo a passo rápido para configurar a Meta Cloud API:
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed">
                <li>
                  Acesse{' '}
                  <a
                    href="https://developers.facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 font-semibold hover:underline inline-flex items-center gap-0.5"
                  >
                    developers.facebook.com <ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  e crie um app do tipo <strong>Empresa (Business)</strong>.
                </li>
                <li>
                  Adicione o produto <strong>WhatsApp</strong> ao seu aplicativo.
                </li>
                <li>
                  Em <strong>WhatsApp &gt; Início Rápido</strong>, você verá o campo{' '}
                  <strong>Identificação do número de telefone (Phone Number ID)</strong>. Cole-o no
                  campo abaixo.
                </li>
                <li>
                  Gere o <strong>Token de Acesso do Sistema</strong> (permanente ou de teste) e cole
                  no campo <strong>META_WA_TOKEN</strong>.
                </li>
                <li>
                  Cadastre o número comercial da AmbicorpFlow <strong>(31) 99231-0866</strong> como
                  número oficial da sua conta comercial.
                </li>
              </ol>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            {/* WhatsApp Phone Number ID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-slate-700">ID do Número de Telefone (Phone Number ID)</Label>
                <Input
                  placeholder="Ex: 104523894729182"
                  value={metaWaPhoneId}
                  onChange={(e) => setMetaWaPhoneId(e.target.value)}
                  className="font-mono text-xs h-9 bg-slate-50 focus:bg-white"
                />
                <p className="text-[11px] text-slate-400">
                  Encontrado na aba WhatsApp &gt; Configuração da API no painel da Meta.
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-slate-700">ID da Conta Comercial (WABA ID - Opcional)</Label>
                <Input
                  placeholder="Ex: 109823749182374"
                  value={metaWaAccountId}
                  onChange={(e) => setMetaWaAccountId(e.target.value)}
                  className="font-mono text-xs h-9 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            {/* Token Meta WhatsApp */}
            <div className="space-y-1">
              <Label className="text-slate-700">Token de Acesso (META_WA_TOKEN)</Label>
              <Input
                type="password"
                placeholder="EAA..."
                value={metaWaToken}
                onChange={(e) => setMetaWaToken(e.target.value)}
                className="font-mono text-xs h-9 bg-slate-50 focus:bg-white"
              />
              <p className="text-[11px] text-slate-400">
                Token com permissão <code>whatsapp_business_messaging</code> e{' '}
                <code>whatsapp_business_management</code>.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Instagram className="w-4 h-4 text-rose-500" />
                Integração Instagram Graph API (Opcional / Complementar)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-slate-700">Instagram User ID / Account ID</Label>
                  <Input
                    placeholder="Ex: 17841400..."
                    value={instagramUserId}
                    onChange={(e) => setInstagramUserId(e.target.value)}
                    className="font-mono text-xs h-9 bg-slate-50 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-slate-700">Token do Instagram (se separado)</Label>
                  <Input
                    type="password"
                    placeholder="Deixe vazio para usar o mesmo token da Meta"
                    value={instagramToken}
                    onChange={(e) => setInstagramToken(e.target.value)}
                    className="font-mono text-xs h-9 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Telefone de Exibição */}
            <div className="space-y-1">
              <Label className="text-slate-700">Telefone Oficial da Loja para Exibição</Label>
              <Input
                value={senderPhoneDisplay}
                onChange={(e) => setSenderPhoneDisplay(e.target.value)}
                className="h-9 text-xs w-64"
              />
              <p className="text-[11px] text-slate-400">
                Número informado nas mensagens e no rodapé das campanhas.
              </p>
            </div>

            <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testing}
                className="text-xs h-9 border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5"
              >
                {testing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                )}
                Verificar Conexão com a Meta
              </Button>

              <Button
                type="submit"
                disabled={saving}
                size="sm"
                className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4"
              >
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
