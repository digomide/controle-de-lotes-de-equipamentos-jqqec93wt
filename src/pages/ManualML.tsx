import React from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTenant } from '@/contexts/TenantContext'
import { ManualMLContent } from '@/components/ManualMLModal'
import { ArrowLeft, Settings, ShoppingBag, BookOpen } from 'lucide-react'

export default function ManualML() {
  const { currentTenant } = useTenant()

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Barra de Navegação Superior / Breadcrumbs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Link to="/configuracoes">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5 text-slate-700 hover:text-slate-900 border-slate-300"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar para Configurações
            </Button>
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-semibold text-slate-500">Ajuda & Manuais</span>
        </div>

        <Link to="/configuracoes">
          <Button
            size="sm"
            className="bg-[#ffe600] hover:bg-[#ebd300] text-slate-950 font-bold text-xs h-8 gap-1.5 shadow-xs"
          >
            <Settings className="w-3.5 h-3.5" />
            Ir para Conectar Conta ML
          </Button>
        </Link>
      </div>

      {/* Cartão Principal do Manual */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ffe600] border border-amber-400 flex items-center justify-center font-bold text-slate-950 shadow-xs">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-bold text-slate-900">
                    Manual de Configuração — Mercado Livre
                  </CardTitle>
                  <Badge className="bg-amber-600 text-white text-[11px] font-semibold">
                    AmbicorpFlow
                  </Badge>
                </div>
                <CardDescription className="text-xs text-slate-600">
                  Documentação oficial para clientes e filiais conectarem suas contas com total
                  isolamento
                </CardDescription>
              </div>
            </div>

            <Link to="/anuncios-ml">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 gap-1.5 border-slate-300 text-slate-700"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-amber-700" />
                Acessar Gestor ML
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <ManualMLContent
            currentTenantName={currentTenant?.name}
            currentTenantSlug={currentTenant?.slug}
          />
        </CardContent>
      </Card>
    </div>
  )
}
