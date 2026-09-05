import React, { useState } from 'react'
import {
  Send,
  Users,
  Settings,
  Sparkles,
  Instagram,
  PhoneCall,
  Layers,
  ArrowUpRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { MarketingCampaignsTab } from '@/components/MarketingCampaignsTab'
import { MarketingContactsTab } from '@/components/MarketingContactsTab'
import { MarketingSettingsTab } from '@/components/MarketingSettingsTab'

export default function Marketing() {
  const [activeTab, setActiveTab] = useState<string>('campanhas')

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header Principal da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-teal-700 text-white rounded-xl shadow-xs">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Módulo de Marketing Automatizado
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Disparos oficiais via WhatsApp Meta Cloud API, gestão da base de revendedores e
              integração com o Instagram.
            </p>
          </div>
        </div>

        {/* Atalhos Rápidos */}
        <div className="flex items-center gap-2">
          <Link to="/post-instagram">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-9 border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5"
            >
              <Instagram className="w-3.5 h-3.5 text-rose-500" />
              Estúdio de Post
            </Button>
          </Link>

          <Link to="/loja" target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-9 border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5"
            >
              <span>Ver Loja</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs Principais */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-200/70 p-1 rounded-xl h-10">
          <TabsTrigger
            value="campanhas"
            className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 gap-1.5"
          >
            <Send className="w-3.5 h-3.5 text-emerald-600" />
            Campanhas
          </TabsTrigger>

          <TabsTrigger
            value="contatos"
            className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 gap-1.5"
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            Base de Contatos
          </TabsTrigger>

          <TabsTrigger
            value="configuracoes"
            className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 gap-1.5"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600" />
            Configurações de Integração
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campanhas" className="mt-0 focus-visible:outline-hidden">
          <MarketingCampaignsTab />
        </TabsContent>

        <TabsContent value="contatos" className="mt-0 focus-visible:outline-hidden">
          <MarketingContactsTab />
        </TabsContent>

        <TabsContent value="configuracoes" className="mt-0 focus-visible:outline-hidden">
          <MarketingSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
