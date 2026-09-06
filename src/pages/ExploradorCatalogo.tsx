import React, { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Layers, TrendingUp } from 'lucide-react'
import { AnunciosCatalogoTab } from '@/components/AnunciosCatalogoTab'
import { RaioXMercadoTab } from '@/components/RaioXMercadoTab'

export default function ExploradorCatalogo() {
  const [activeTab, setActiveTab] = useState<'catalogo' | 'raiox'>('catalogo')

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6">
      {/* Seletor de Modo Principal */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'catalogo' | 'raiox')}
        className="w-full space-y-6"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              Explorador de Catálogo
              <Badge className="bg-blue-600 text-white text-xs font-semibold">Mercado Livre</Badge>
            </h1>
            <p className="text-xs text-slate-500">
              Mapeie posições no catálogo oficial, dispute a Buy Box e analise a força das famílias
              com dados reais.
            </p>
          </div>

          <TabsList className="grid grid-cols-2 p-1 bg-slate-100 border border-slate-200 rounded-lg w-full sm:w-[420px]">
            <TabsTrigger
              value="catalogo"
              className="text-xs font-bold flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Catálogo & Buy Box
            </TabsTrigger>
            <TabsTrigger
              value="raiox"
              className="text-xs font-bold flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-xs"
            >
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
              Raio-X de Mercado
              <Badge className="bg-amber-400 text-slate-950 text-[9px] px-1.5 py-0 h-4 font-bold">
                Novo
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="catalogo" className="space-y-6 outline-hidden">
          <AnunciosCatalogoTab />
        </TabsContent>

        <TabsContent value="raiox" className="space-y-6 outline-hidden">
          <RaioXMercadoTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
