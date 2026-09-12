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
import EstoqueGeral from './pages/EstoqueGeral'
import Ajustes from './pages/Ajustes'
import Configuracoes from './pages/Configuracoes'
import Usuarios from './pages/Usuarios'
import AnunciosML from './pages/AnunciosML'
import ExploradorCatalogo from './pages/ExploradorCatalogo'
import RadarML from './pages/RadarML'
import LotesEntrada from './pages/LotesEntrada'
import LoteEntradaDetalhe from './pages/LoteEntradaDetalhe'
import LoteInventariar from './pages/LoteInventariar'
import LojaCorporativo from './pages/LojaCorporativo'
import PostInstagram from './pages/PostInstagram'
import PostTikTok from './pages/PostTikTok'
import CotacoesCorporativas from './pages/CotacoesCorporativas'
import Marketing from './pages/Marketing'
import Pedido6849 from './pages/Pedido6849'
import Clientes from './pages/Clientes'
import NotasFiscais from './pages/NotasFiscais'
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

          {/* Rota Utilitária de Impressão do Pedido de Venda Bling (apenas autenticado, fora do layout/menu) */}
          <Route
            path="/pedido-6849"
            element={
              <ProtectedRoute>
                <Pedido6849 />
              </ProtectedRoute>
            }
          />

          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Dashboard */}
            <Route
              path="/"
              element={
                <ProtectedRoute requiredModule="dashboard">
                  <Index />
                </ProtectedRoute>
              }
            />

            {/* Vendas */}
            <Route
              path="/vendas"
              element={
                <ProtectedRoute requiredModule="vendas">
                  <Vendas />
                </ProtectedRoute>
              }
            />

            {/* Notas Fiscais (NF-e) */}
            <Route
              path="/notas-fiscais"
              element={
                <ProtectedRoute requiredModule="notas_fiscais">
                  <NotasFiscais />
                </ProtectedRoute>
              }
            />

            {/* Clientes & Pós-Venda */}
            <Route
              path="/clientes"
              element={
                <ProtectedRoute requiredModule="clientes">
                  <Clientes />
                </ProtectedRoute>
              }
            />

            {/* Lucratividade */}
            <Route
              path="/lucratividade"
              element={
                <ProtectedRoute requiredModule="lucratividade">
                  <LucratividadeLotes />
                </ProtectedRoute>
              }
            />

            {/* Produtos / Catálogo */}
            <Route
              path="/produtos"
              element={
                <ProtectedRoute requiredModule="produtos">
                  <Produtos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/catalogo"
              element={
                <ProtectedRoute requiredModule="produtos">
                  <Produtos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/catalogo/:id"
              element={
                <ProtectedRoute requiredModule="produtos">
                  <CatalogoDetalhe />
                </ProtectedRoute>
              }
            />

            {/* Estoque Geral */}
            <Route
              path="/estoque-geral"
              element={
                <ProtectedRoute requiredModule="estoque_geral">
                  <EstoqueGeral />
                </ProtectedRoute>
              }
            />

            {/* Estoque / Lotes */}
            <Route
              path="/estoque"
              element={
                <ProtectedRoute requiredModule="estoque_lotes">
                  <Estoque />
                </ProtectedRoute>
              }
            />
            <Route
              path="/estoque/:id"
              element={
                <ProtectedRoute requiredModule="estoque_lotes">
                  <CatalogoDetalhe />
                </ProtectedRoute>
              }
            />

            {/* Lotes Compra */}
            <Route
              path="/lotes-entrada"
              element={
                <ProtectedRoute requiredModule="lotes_compra">
                  <LotesEntrada />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lotes-entrada/:id"
              element={
                <ProtectedRoute requiredModule="lotes_compra">
                  <LoteEntradaDetalhe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lotes-entrada/:id/inventariar"
              element={
                <ProtectedRoute requiredModule="lotes_compra">
                  <LoteInventariar />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lotes/:id"
              element={
                <ProtectedRoute requiredModule="lotes_compra">
                  <CatalogoDetalhe />
                </ProtectedRoute>
              }
            />

            {/* Ajustes de Estoque */}
            <Route
              path="/ajustes"
              element={
                <ProtectedRoute requiredModule="ajustes">
                  <Ajustes />
                </ProtectedRoute>
              }
            />

            {/* Marketing & Redes */}
            <Route
              path="/marketing"
              element={
                <ProtectedRoute requiredModule="marketing">
                  <Marketing />
                </ProtectedRoute>
              }
            />
            <Route
              path="/post-instagram"
              element={
                <ProtectedRoute requiredModule="post_instagram">
                  <PostInstagram />
                </ProtectedRoute>
              }
            />
            <Route
              path="/post-tiktok"
              element={
                <ProtectedRoute requiredModule="post_tiktok">
                  <PostTikTok />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cotacoes"
              element={
                <ProtectedRoute requiredModule="cotacoes">
                  <CotacoesCorporativas />
                </ProtectedRoute>
              }
            />

            {/* Configurações & Usuários (Admin) */}
            <Route
              path="/configuracoes"
              element={
                <ProtectedRoute requireAdmin requiredModule="configuracoes">
                  <Configuracoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute requireAdmin requiredModule="usuarios">
                  <Usuarios />
                </ProtectedRoute>
              }
            />

            {/* Mercado Livre e Concorrência */}
            <Route
              path="/explorador-catalogo"
              element={
                <ProtectedRoute requiredModule="explorador_catalogo">
                  <ExploradorCatalogo />
                </ProtectedRoute>
              }
            />
            <Route
              path="/anuncios-ml"
              element={
                <ProtectedRoute requiredModule="gestor_ml">
                  <AnunciosML />
                </ProtectedRoute>
              }
            />
            <Route
              path="/radar-ml"
              element={
                <ProtectedRoute requiredModule="radar_ml">
                  <RadarML />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
