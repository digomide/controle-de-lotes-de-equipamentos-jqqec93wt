import React, { useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Layers,
  SlidersHorizontal,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  Search,
  Boxes,
  ShieldAlert,
  UserCheck,
  ShoppingBag,
  Instagram,
  Building2,
  Megaphone,
  Video,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { user, logout, isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const navItems = [
    { title: 'Dashboard', path: '/', icon: LayoutDashboard },
    { title: 'Lotes de Entrada', path: '/lotes-entrada', icon: Boxes },
    { title: 'Lucratividade Lotes', path: '/lucratividade', icon: SlidersHorizontal },
    { title: 'Catálogo de Notebooks', path: '/produtos', icon: Package },
    { title: 'Marketing', path: '/marketing', icon: Megaphone },
    { title: 'Anúncios ML', path: '/anuncios-ml', icon: ShoppingBag },
    { title: 'Post Insta', path: '/post-instagram', icon: Instagram },
    { title: 'Post TikTok', path: '/post-tiktok', icon: Video },
    { title: 'Cotações Corporativas', path: '/cotacoes', icon: Building2 },
    { title: 'Vendas', path: '/vendas', icon: ShoppingCart },
    { title: 'Estoque / Lotes', path: '/estoque', icon: Layers },
    { title: 'Ajustes', path: '/ajustes', icon: SlidersHorizontal },
    { title: 'Configurações', path: '/configuracoes', icon: Settings },
  ]

  const getPageTitle = () => {
    const p = location.pathname
    if (p === '/') return 'Dashboard Geral'
    if (p.includes('/inventariar')) return 'Ficha de Inventário'
    if (p.startsWith('/lucratividade')) return 'Relatório de Lucratividade por Lote'
    if (p.startsWith('/lotes-entrada/')) return 'Detalhes do Lote de Entrada'
    if (p.startsWith('/lotes-entrada')) return 'Lotes de Entrada'
    if (p.startsWith('/vendas')) return 'Gestão de Vendas'
    if (p.startsWith('/marketing')) return 'Módulo de Marketing Automatizado'
    if (p.startsWith('/anuncios-ml')) return 'Anúncios Mercado Livre (Visualização)'
    if (p.startsWith('/post-instagram')) return 'Estúdio de Post para Instagram'
    if (p.startsWith('/post-tiktok')) return 'Estúdio de Post TikTok & Seller Center'
    if (p.startsWith('/cotacoes')) return 'Cotações Corporativas & Lotes'
    if (p.startsWith('/catalogo/')) return 'Detalhes do Equipamento'
    if (p.startsWith('/produtos') || p.startsWith('/catalogo')) return 'Catálogo de Equipamentos'
    if (p.startsWith('/estoque')) return 'Controle de Lotes & Estoque'
    if (p.startsWith('/ajustes')) return 'Ajuste de Inventário & Divergências'
    if (p.startsWith('/configuracoes')) return 'Configurações do Sistema'
    return 'LoteEquip Gestão'
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/estoque?busca=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  const renderNavLinks = (onItemClick?: () => void) => (
    <nav className="space-y-1.5 px-2">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive =
          item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)

        return (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onItemClick}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60',
            )}
            title={collapsed ? item.title : undefined}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {(!collapsed || onItemClick) && <span>{item.title}</span>}
          </NavLink>
        )
      })}
    </nav>
  )

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 select-none z-30',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg flex-shrink-0">
              <Boxes className="w-6 h-6" />
            </div>
            {!collapsed && (
              <div className="leading-tight truncate">
                <span className="font-bold text-white text-base tracking-tight block truncate">
                  LoteEquip
                </span>
                <span className="text-xs text-slate-400 block truncate">Controle de Lotes</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 py-4 overflow-y-auto">{renderNavLinks()}</div>

        {/* User preview bottom sidebar */}
        <div className="p-3 border-t border-slate-800">
          <div
            className={cn(
              'flex items-center gap-3 p-2 rounded-lg bg-slate-800/50 text-slate-300',
              collapsed && 'justify-center p-2',
            )}
          >
            <div className="w-9 h-9 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 border border-slate-600">
              {user?.name?.slice(0, 2) || 'US'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5 py-0 h-4 border-none font-normal',
                      isAdmin ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-300',
                    )}
                  >
                    {isAdmin ? 'Admin' : 'Vendas'}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-20">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Sheet Trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-slate-600">
                  <Menu className="w-5 h-5" />
                  <span className="sr-only">Abrir menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-72 p-0 bg-slate-900 border-slate-800 text-white"
              >
                <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <Boxes className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-base">LoteEquip</h2>
                    <p className="text-xs text-slate-400">Controle de Lotes</p>
                  </div>
                </div>
                <div className="py-6">{renderNavLinks(() => setMobileOpen(false))}</div>
                <div className="absolute bottom-4 left-4 right-4 p-3 bg-slate-800 rounded-lg">
                  <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMobileOpen(false)
                      logout()
                    }}
                    className="w-full mt-2 text-rose-400 hover:text-rose-300 hover:bg-slate-700 justify-start h-8 px-2"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-2" />
                    Sair da Conta
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Equipment Search */}
            <form onSubmit={handleSearchSubmit} className="hidden sm:flex relative items-center">
              <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
              <Input
                type="search"
                placeholder="Buscar lote, SKU ou equipamento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 h-9 w-60 lg:w-72 bg-slate-50 border-slate-200 text-sm focus:bg-white transition-colors"
              />
            </form>

            <NavLink to="/lotes-entrada" className="hidden sm:flex">
              <Button
                size="sm"
                className="bg-[#d9532f] hover:bg-[#c24624] text-white text-xs h-9 font-medium shadow-xs gap-1.5"
              >
                <Boxes className="w-4 h-4" />+ Lote de Entrada
              </Button>
            </NavLink>
            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative flex items-center gap-2 pl-2 pr-3 h-9 rounded-full hover:bg-slate-100"
                >
                  <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase">
                    {user?.name?.slice(0, 2) || 'US'}
                  </div>
                  <span className="hidden md:inline text-xs font-medium text-slate-700 max-w-[120px] truncate">
                    {user?.name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-semibold text-slate-900 truncate">{user?.name}</div>
                  <div className="text-xs text-slate-500 font-normal truncate">{user?.email}</div>
                  <div className="mt-1">
                    <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                      {isAdmin ? (
                        <ShieldAlert className="w-3 h-3 mr-1 text-amber-600" />
                      ) : (
                        <UserCheck className="w-3 h-3 mr-1 text-emerald-600" />
                      )}
                      {isAdmin ? 'Administrador' : 'Membro de Vendas'}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate('/configuracoes')}
                  className="cursor-pointer"
                >
                  <Settings className="w-4 h-4 mr-2 text-slate-500" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Encerrar Sessão
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Dynamic Page Outlet with scroll */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation for quick access */}
        <div className="md:hidden flex items-center justify-around bg-white border-t border-slate-200 py-2 px-1 z-30">
          <NavLink
            to="/"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 text-[11px] font-medium py-1 px-2 rounded',
                isActive ? 'text-slate-900 font-bold' : 'text-slate-500',
              )
            }
          >
            <LayoutDashboard className="w-4 h-4" />
            Início
          </NavLink>
          <NavLink
            to="/lotes-entrada"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 text-[11px] font-medium py-1 px-2 rounded',
                isActive ? 'text-orange-600 font-bold' : 'text-slate-500',
              )
            }
          >
            <Boxes className="w-4 h-4" />
            Lotes
          </NavLink>
          <NavLink
            to="/produtos"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 text-[11px] font-medium py-1 px-2 rounded',
                isActive ? 'text-slate-900 font-bold' : 'text-slate-500',
              )
            }
          >
            <Package className="w-4 h-4" />
            Catálogo
          </NavLink>
          <NavLink
            to="/marketing"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 text-[11px] font-medium py-1 px-2 rounded',
                isActive ? 'text-emerald-600 font-bold' : 'text-slate-500',
              )
            }
          >
            <Megaphone className="w-4 h-4" />
            Marketing
          </NavLink>
          <NavLink
            to="/post-instagram"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 text-[11px] font-medium py-1 px-2 rounded',
                isActive ? 'text-rose-600 font-bold' : 'text-slate-500',
              )
            }
          >
            <Instagram className="w-4 h-4" />
            Insta
          </NavLink>
          <NavLink
            to="/post-tiktok"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 text-[11px] font-medium py-1 px-2 rounded',
                isActive ? 'text-cyan-600 font-bold' : 'text-slate-500',
              )
            }
          >
            <Video className="w-4 h-4" />
            TikTok
          </NavLink>
          <NavLink
            to="/cotacoes"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 text-[11px] font-medium py-1 px-2 rounded',
                isActive ? 'text-emerald-600 font-bold' : 'text-slate-500',
              )
            }
          >
            <Building2 className="w-4 h-4" />
            Cotações
          </NavLink>
          <NavLink
            to="/estoque"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 text-[11px] font-medium py-1 px-2 rounded',
                isActive ? 'text-slate-900 font-bold' : 'text-slate-500',
              )
            }
          >
            <Layers className="w-4 h-4" />
            Lotes
          </NavLink>
          <NavLink
            to="/ajustes"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 text-[11px] font-medium py-1 px-2 rounded',
                isActive ? 'text-slate-900 font-bold' : 'text-slate-500',
              )
            }
          >
            <SlidersHorizontal className="w-4 h-4" />
            Ajustes
          </NavLink>
        </div>
      </div>
    </div>
  )
}
