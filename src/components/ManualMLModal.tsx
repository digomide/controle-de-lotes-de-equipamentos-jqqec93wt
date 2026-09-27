import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  BookOpen,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  Building2,
  CheckCircle2,
  HelpCircle,
  Key,
  Globe,
  LogIn,
  Layers,
  ArrowRight,
  ShieldCheck,
  Info,
} from 'lucide-react'

export const ML_APP_ID_OFFICIAL = '253167816099623'
export const ML_REDIRECT_URI_OFFICIAL =
  'https://controle-de-lotes-de-equipamentos-25024.goskip.app/configuracoes'

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
}

export function CopySnippetButton({ text, label, className }: CopyButtonProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast({
      title: 'Copiado para a área de transferência!',
      description: text,
    })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={`h-7 px-2 text-xs gap-1 font-medium ${className || ''}`}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-600" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
      {copied ? 'Copiado!' : label || 'Copiar'}
    </Button>
  )
}

interface ManualMLContentProps {
  currentTenantName?: string
  currentTenantSlug?: string
  onCloseModal?: () => void
  showCloseAction?: boolean
}

export function ManualMLContent({
  currentTenantName,
  currentTenantSlug,
  onCloseModal,
  showCloseAction = false,
}: ManualMLContentProps) {
  return (
    <div className="space-y-6 text-slate-800 text-sm leading-relaxed">
      {/* Cabeçalho de Destaque */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 rounded-2xl border border-amber-200/80">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-[#ffe600] text-slate-950 rounded-xl font-bold shadow-xs shrink-0 mt-0.5">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Como conectar sua conta do Mercado Livre ao sistema
              </h2>
              <Badge className="bg-amber-600 text-white text-[11px] font-semibold">
                Manual do Cliente
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              Guia oficial passo a passo para conectar e autorizar a conta da sua filial com
              segurança, isolamento e autonomia.
            </p>
            {currentTenantName && (
              <div className="pt-2 flex items-center gap-2 text-xs font-medium text-amber-900">
                <Building2 className="w-4 h-4 text-amber-700" />
                <span>
                  Você está configurando a filial/tenant:{' '}
                  <strong className="text-slate-900">{currentTenantName}</strong>{' '}
                  {currentTenantSlug && (
                    <span className="font-mono text-slate-600">({currentTenantSlug})</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ANTES DE COMEÇAR */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>ANTES DE COMEÇAR</span>
        </div>
        <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
            <span>
              <strong>Acesso administrativo:</strong> Você precisa ser administrador do sistema e
              ter acesso de login/senha à conta do Mercado Livre que será conectada.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
            <span>
              <strong>Isolamento multi-tenant (filial):</strong> Cada conta ML conectada fica 100%
              isolada por tenant (filial). Os dados de anúncios, pedidos, perguntas e estoque só
              aparecem para a conta conectada àquele tenant específico.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
            <span>
              <strong>Atenção aos testes:</strong> Se você for testar a integração, <em>não</em> use
              o modo &quot;Ver como cliente&quot; para executar ações do Gestor ML. Faça o login
              direto ou opere como o tenant de destino.
            </span>
          </li>
        </ul>
      </div>

      {/* PASSOS NUMERADOS */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <span>Passo a Passo de Configuração</span>
          <span className="h-px bg-slate-200 flex-1" />
        </h3>

        {/* PASSO 1 */}
        <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white shadow-xs space-y-3 hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">
                1
              </span>
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                PASSO 1 — Preparar a sessão do Mercado Livre
              </h4>
            </div>
            <Badge variant="outline" className="text-slate-600 border-slate-300 text-[11px]">
              Prevenção
            </Badge>
          </div>
          <div className="pl-9 space-y-2 text-xs sm:text-sm text-slate-700">
            <p>
              Abra uma <strong>janela anônima/privada</strong> do seu navegador e faça login na
              conta do Mercado Livre que deseja conectar.
            </p>
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Por que isso é fundamental?</strong> Quando já existe outra conta ML aberta
                no navegador (ex: conta pessoal ou de outra filial), o navegador pode vincular a
                conta errada automaticamente. A janela anônima garante que a autorização seja feita
                estritamente na conta certa.
              </span>
            </div>
          </div>
        </div>

        {/* PASSO 2 */}
        <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white shadow-xs space-y-3 hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">
                2
              </span>
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                PASSO 2 — Credenciais do aplicativo
              </h4>
            </div>
            <Badge variant="outline" className="text-slate-600 border-slate-300 text-[11px]">
              Credenciais
            </Badge>
          </div>
          <div className="pl-9 space-y-3 text-xs sm:text-sm text-slate-700">
            <p>
              Use as credenciais do app já cadastrado no <strong>Mercado Livre Developers</strong>.
              Normalmente as mesmas credenciais do aplicativo servem para todas as contas e filiais
              — <em>não é preciso criar um aplicativo novo para cada filial</em>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600 uppercase flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-600" />
                  App ID Oficial (Client ID)
                </span>
                <div className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded border border-slate-300 font-mono text-xs font-bold text-slate-900">
                  <span>{ML_APP_ID_OFFICIAL}</span>
                  <CopySnippetButton text={ML_APP_ID_OFFICIAL} label="Copiar ID" />
                </div>
                <p className="text-[11px] text-slate-500">
                  Preenchido no campo <em>Client ID</em> da aba Configurações.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600 uppercase flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  Redirect URI Oficial Cadastrada
                </span>
                <div className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded border border-slate-300 font-mono text-[11px] text-slate-800 break-all">
                  <span className="truncate">{ML_REDIRECT_URI_OFFICIAL}</span>
                  <CopySnippetButton text={ML_REDIRECT_URI_OFFICIAL} label="Copiar URI" />
                </div>
                <p className="text-[11px] text-slate-500">
                  Deve ser exatamente essa, cadastrada no app do Mercado Livre.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* PASSO 3 */}
        <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white shadow-xs space-y-3 hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">
                3
              </span>
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                PASSO 3 — Iniciar a conexão no sistema
              </h4>
            </div>
            <Badge variant="outline" className="text-slate-600 border-slate-300 text-[11px]">
              Autorização
            </Badge>
          </div>
          <div className="pl-9 space-y-2 text-xs sm:text-sm text-slate-700">
            <p>
              No sistema AmbicorpFlow, vá em{' '}
              <strong>Configurações → Integração Mercado Livre</strong> (ou clique no botão
              &quot;Conectar conta ML&quot; / &quot;Conectar Mercado Livre&quot;) e inicie o fluxo
              de autorização. Você será redirecionado à tela de login/autorização oficial do Mercado
              Livre.
            </p>
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-950">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Importante: Acesse pela URL de Produção</span>
              </div>
              <p className="leading-relaxed">
                Faça a autorização acessando o sistema pela URL oficial de produção (
                <code className="font-mono font-bold bg-white/80 px-1 py-0.5 rounded border border-rose-200 text-[11px]">
                  https://controle-de-lotes-de-equipamentos-25024.goskip.app/configuracoes
                </code>
                ), <strong>não</strong> por localhost ou outro endereço, senão o redirect OAuth do
                Mercado Livre falhará por incompatibilidade de domínio.
              </p>
            </div>
          </div>
        </div>

        {/* PASSO 4 */}
        <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white shadow-xs space-y-3 hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">
                4
              </span>
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                PASSO 4 — Autorizar o aplicativo
              </h4>
            </div>
            <Badge variant="outline" className="text-slate-600 border-slate-300 text-[11px]">
              Confirmação ML
            </Badge>
          </div>
          <div className="pl-9 space-y-2 text-xs sm:text-sm text-slate-700">
            <p>
              Na tela do Mercado Livre, confira com calma se o{' '}
              <strong>nome da conta exibida</strong> é a conta correta que você deseja conectar a
              esta filial e clique em <strong>&quot;Autorizar&quot; / &quot;Permitir&quot;</strong>.
            </p>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              O sistema solicita apenas permissões estritamente necessárias para leitura e
              publicação de anúncios, perguntas e pedidos.
            </p>
          </div>
        </div>

        {/* PASSO 5 */}
        <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white shadow-xs space-y-3 hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">
                5
              </span>
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                PASSO 5 — Confirmar a conexão
              </h4>
            </div>
            <Badge className="bg-emerald-600 text-white text-[11px] font-semibold">Validação</Badge>
          </div>
          <div className="pl-9 space-y-2 text-xs sm:text-sm text-slate-700">
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Ao retornar para o sistema, verifique em <strong>Configurações</strong> se o
                  selo/badge da integração está <strong>verde (&quot;Conectado&quot;)</strong> com o
                  apelido (nickname) da sua conta.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Independência confirmada:</strong> Confirme que a nova conta ficou
                  independente das outras: os dados de anúncios, pedidos e perguntas exibidos no
                  painel passam a ser os da conta recém-conectada, e as contas de outras filiais não
                  sofrem nenhuma alteração.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* SE ALGO DER ERRADO (SOLUÇÃO DE PROBLEMAS) */}
      <div className="bg-gradient-to-br from-rose-50/70 via-white to-amber-50/40 border border-rose-200/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-rose-950 font-bold text-base">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>SE ALGO DER ERRADO (Solução de Problemas)</span>
          </div>
          <Badge variant="outline" className="text-rose-800 border-rose-300 text-xs">
            Diagnóstico Rápido
          </Badge>
        </div>

        <div className="space-y-3">
          {/* Problema 1 */}
          <div className="bg-white p-3.5 rounded-xl border border-rose-200/80 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-rose-900 font-semibold text-xs sm:text-sm">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              <span>&quot;Tela de autorização mostra outra conta&quot;</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 pl-4">
              <strong>Causa & Solução:</strong> A sessão do navegador já estava conectada em outra
              conta do Mercado Livre. Feche a aba, abra uma <strong>janela anônima/privada</strong>,
              faça o login na conta correta e refaça o processo a partir do Passo 3.
            </p>
          </div>
          {/* Problema 2 */}
          <div className="bg-white p-3.5 rounded-xl border border-rose-200/80 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-rose-900 font-semibold text-xs sm:text-sm">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              <span>&quot;redirect_uri inválido / mismatch&quot;</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 pl-4">
              <strong>Causa & Solução:</strong> A URL usada para acessar o sistema é diferente da
              redirect URI cadastrada no app do Mercado Livre. Acesse o sistema exatamente por{' '}
              <a
                href={ML_REDIRECT_URI_OFFICIAL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs font-semibold text-blue-600 underline hover:text-blue-800"
              >
                {ML_REDIRECT_URI_OFFICIAL}
              </a>
              . Não utilize endereços locais ou temporários para a autorização.
            </p>
          </div>
          {/* Problema 3 */}
          <div className="bg-white p-3.5 rounded-xl border border-rose-200/80 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-rose-900 font-semibold text-xs sm:text-sm">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              <span>&quot;Badge fica vermelho / não conecta&quot;</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 pl-4">
              <strong>Causa & Solução:</strong> O tenant (filial) atual ainda não tem registro de
              credenciais salvas em seu perfil ou o App ID não foi informado antes de conectar.
              Certifique-se de estar conectado no tenant (filial) correto em Configurações, salve o
              Client ID/Secret e então inicie a autorização.
            </p>
          </div>
          {/* Problema 4 */}
          <div className="bg-white p-3.5 rounded-xl border border-rose-200/80 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-rose-900 font-semibold text-xs sm:text-sm">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              <span>
                &quot;Erro de permissão (403 / PolicyAgent / policy_agent_unauthorized)&quot;
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 pl-4">
              <strong>Causa & Solução:</strong> O token foi emitido sem o escopo granular de escrita
              (<code>urn:ml:mktp:offers:/read-write</code> e <code>write</code>). No painel
              Configurações → Mercado Livre, clique em{' '}
              <strong>&quot;Reconectar com Novas Permissões&quot;</strong> para refazer a
              autorização OAuth e conceder permissão total de alteração de preços e anúncios.
            </p>
          </div>{' '}
        </div>
      </div>

      {/* Ações / Fechar */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200 flex-wrap gap-2">
        <a
          href="https://developers.mercadolivre.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 font-medium"
        >
          Portal Mercado Livre Developers <ExternalLink className="w-3 h-3" />
        </a>

        {showCloseAction && onCloseModal && (
          <Button
            type="button"
            onClick={onCloseModal}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-8"
          >
            Fechar Manual
          </Button>
        )}
      </div>
    </div>
  )
}

interface ManualMLModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentTenantName?: string
  currentTenantSlug?: string
}

export function ManualMLModal({
  open,
  onOpenChange,
  currentTenantName,
  currentTenantSlug,
}: ManualMLModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ffe600] flex items-center justify-center font-bold text-slate-950 shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Manual de Configuração — Mercado Livre
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Passo a passo oficial para conexão autônoma de contas por filial
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2">
          <ManualMLContent
            currentTenantName={currentTenantName}
            currentTenantSlug={currentTenantSlug}
            onCloseModal={() => onOpenChange(false)}
            showCloseAction
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
