import React from 'react'
import { Link } from 'react-router-dom'
import { Phone, MessageSquare, ShieldCheck, Clock, MapPin } from 'lucide-react'
import { STORE_CONFIG, buildGeneralWhatsAppLink } from '@/lib/storeConfig'
import { AmbicorpFlowLogo } from '@/components/AmbicorpFlowLogo'

export const PublicStoreHeader: React.FC = () => {
  const whatsappUrl = buildGeneralWhatsAppLink()

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          {/* Logo & Store Name */}
          <Link
            to="/loja"
            className="flex items-center gap-3 group min-w-0"
            title="AmbicorpFlow - Início do Catálogo"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                <AmbicorpFlowLogo size="md" variant="light" />
                <span className="hidden sm:inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  Seminovos Corporativos
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate hidden md:block mt-0.5">
                {STORE_CONFIG.tagline}
              </p>
            </div>
          </Link>

          {/* Links de Navegação da Loja */}
          <nav className="hidden md:flex items-center gap-1.5 text-xs font-semibold">
            <Link
              to="/loja"
              className="px-3 py-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Catálogo de Notebooks
            </Link>
            <Link
              to="/loja/corporativo"
              className="px-3 py-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 transition-colors flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Vendas Corporativas & Lotes
            </Link>
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Entrar
            </Link>
          </nav>

          {/* Quick Info & WhatsApp CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden lg:flex flex-col text-right text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1 justify-end">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Equipamentos Revisados e Testados
              </span>
              <span className="text-slate-400 text-[11px] flex items-center gap-1 justify-end">
                <Clock className="w-3 h-3" />
                {STORE_CONFIG.businessHours}
              </span>
            </div>

            <Link
              to="/login"
              className="md:hidden inline-flex items-center px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Entrar
            </Link>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all hover:shadow-md"
              title="Fale com a AmbicorpFlow no WhatsApp"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Fale no WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}

export const PublicStoreFooter: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 mt-20 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-800 text-sm">
          {/* Coluna 1: Sobre */}
          <div className="space-y-3">
            <AmbicorpFlowLogo size="sm" variant="dark" />
            <p className="text-xs text-slate-400 leading-relaxed pt-1">
              Equipamentos corporativos seminovos de linhas profissionais (Dell Latitude, Lenovo
              ThinkPad, HP EliteBook) rigorosamente testados, revisados e prontos para uso imediato.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              Checklist completo de inspeção técnica
            </div>
          </div>

          {/* Coluna 2: Atendimento */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-sm uppercase tracking-wider">
              Atendimento ao Cliente
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>WhatsApp: {STORE_CONFIG.whatsappDisplay}</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{STORE_CONFIG.businessHours}</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{STORE_CONFIG.location}</span>
              </li>
            </ul>
          </div>

          {/* Coluna 3: Garantia e Procedência */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-sm uppercase tracking-wider">
              Garantia & Procedência
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Todos os nossos notebooks passam por diagnóstico completo de bateria, display,
              teclado, portas e desempenho antes de serem anunciados.
            </p>
            <a
              href={buildGeneralWhatsAppLink('Dúvidas sobre garantia')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline"
            >
              Consulte condições de entrega e envio &rarr;
            </a>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <p>
            © {new Date().getFullYear()} {STORE_CONFIG.name}. Todos os direitos reservados.
          </p>
          <p className="text-slate-400">Catálogo de equipamentos disponível para pronta-entrega.</p>
        </div>
      </div>
    </footer>
  )
}
