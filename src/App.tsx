/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Index from './pages/Index'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'
import Login from './pages/Login'
import LojaPublica from './pages/LojaPublica'
import LojaDetalhe from './pages/LojaDetalhe'
import LojaPedidoConcluido from './pages/LojaPedidoConcluido'
import Vendas from './pages/Vendas'
import Produtos from './pages/Produtos'
import CatalogoDetalhe from './pages/CatalogoDetalhe'
import LucratividadeLotes from './pages/LucratividadeLotes'
import Estoque from './pages/Estoque'
import Ajustes from './pages/Ajustes'
import Configuracoes from './pages/Configuracoes'
import AnunciosML from './pages/AnunciosML'
import LotesEntrada from './pages/LotesEntrada'
import LoteEntradaDetalhe from './pages/LoteEntradaDetalhe'
import LoteInventariar from './pages/LoteInventariar'
import LojaCorporativo from './pages/LojaCorporativo'
import PostInstagram from './pages/PostInstagram'
import PostTikTok from './pages/PostTikTok'
import CotacoesCorporativas from './pages/CotacoesCorporativas'
import Marketing from './pages/Marketing'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'

// ONLY IMPORT AND RENDER WORKING PAGES, NEVER ADD PLACEHOLDER COMPONENTS OR PAGES IN THIS FILE
// AVOID REMOVING ANY CONTEXT PROVIDERS FROM THIS FILE (e.g. TooltipProvider, Toaster, Sonner)

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Rotas Públicas da Loja (Sem Login / Fora do Layout Privado) */}
          <Route path="/loja" element={<LojaPublica />} />
          <Route path="/loja/corporativo" element={<LojaCorporativo />} />
          <Route path="/loja/pedido-concluido" element={<LojaPedidoConcluido />} />
          <Route path="/loja/:id" element={<LojaDetalhe />} />

          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Index />} />
            <Route path="/vendas" element={<Vendas />} />
            <Route path="/lucratividade" element={<LucratividadeLotes />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/catalogo" element={<Produtos />} />
            <Route path="/catalogo/:id" element={<CatalogoDetalhe />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/estoque/:id" element={<CatalogoDetalhe />} />
            <Route path="/lotes-entrada" element={<LotesEntrada />} />
            <Route path="/lotes-entrada/:id" element={<LoteEntradaDetalhe />} />
            <Route path="/lotes-entrada/:id/inventariar" element={<LoteInventariar />} />
            <Route path="/lotes/:id" element={<CatalogoDetalhe />} />
            <Route path="/ajustes" element={<Ajustes />} />
            <Route path="/marketing" element={<Marketing />} />
            <Route path="/post-instagram" element={<PostInstagram />} />
            <Route path="/post-tiktok" element={<PostTikTok />} />
            <Route path="/cotacoes" element={<CotacoesCorporativas />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/anuncios-ml" element={<AnunciosML />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
