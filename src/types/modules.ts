import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Layers,
  SlidersHorizontal,
  Settings,
  Boxes,
  Users,
  ShoppingBag,
  Instagram,
  Building2,
  Megaphone,
  Video,
  Radar,
  Compass,
  Store,
  FileCheck,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'

export type AppModuleId =
  | 'dashboard'
  | 'lotes_compra'
  | 'lucratividade'
  | 'explorador_catalogo'
  | 'gestor_ml'
  | 'produtos'
  | 'marketing'
  | 'clientes'
  | 'radar_ml'
  | 'post_instagram'
  | 'post_tiktok'
  | 'cotacoes'
  | 'vendas'
  | 'estoque_geral'
  | 'estoque_lotes'
  | 'ajustes'
  | 'notas_fiscais'
  | 'contesta_reputacao'
  | 'usuarios'
  | 'configuracoes'
  | 'loja'

export interface AppModuleDefinition {
  id: AppModuleId
  label: string
  description: string
  category: 'operacao' | 'vendas_mkt' | 'estoque_produtos' | 'sistema'
  icon: LucideIcon
  paths: string[] // rotas abrangidas
  adminOnly?: boolean
}

export const APP_MODULES: AppModuleDefinition[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Visão geral do negócio, métricas financeiras e resumos',
    category: 'operacao',
    icon: LayoutDashboard,
    paths: ['/'],
  },
  {
    id: 'vendas',
    label: 'Vendas',
    description: 'Gestão de vendas, pedidos concluídos e comprovantes Bling',
    category: 'operacao',
    icon: ShoppingCart,
    paths: ['/vendas', '/pedido-6849'],
  },
  {
    id: 'contesta_reputacao',
    label: 'Contestação de Reputação',
    description: 'Gestão de exclusões de reputação do Mercado Livre e defesas para atendimento',
    category: 'operacao',
    icon: ShieldAlert,
    paths: ['/contesta-reputacao'],
  },
  {
    id: 'clientes',
    label: 'Clientes & Pós-Venda',
    description: 'CRM simples de compradores ML e manuais, histórico e pós-venda',
    category: 'vendas_mkt',
    icon: Users,
    paths: ['/clientes'],
  },
  {
    id: 'produtos',
    label: 'Produtos / Catálogo',
    description: 'Cadastro de notebooks, fichas técnicas e etiquetas',
    category: 'estoque_produtos',
    icon: Package,
    paths: ['/produtos', '/catalogo'],
  },
  {
    id: 'lotes_compra',
    label: 'Lotes / Compras',
    description: 'Compra de lotes de entrada, conferência e inventariação',
    category: 'estoque_produtos',
    icon: Boxes,
    paths: ['/lotes-entrada', '/lotes'],
  },
  {
    id: 'estoque_geral',
    label: 'Estoque Geral',
    description: 'Controle de peças, acessórios, carregadores e movimentações',
    category: 'estoque_produtos',
    icon: Boxes,
    paths: ['/estoque-geral'],
  },
  {
    id: 'estoque_lotes',
    label: 'Lotes / Estoque',
    description: 'Controle físico de equipamentos por lote e localização',
    category: 'estoque_produtos',
    icon: Layers,
    paths: ['/estoque'],
  },
  {
    id: 'explorador_catalogo',
    label: 'Explorador de Catálogo / Raio-X',
    description: 'Explorador de concorrência, Raio-X de mercado e Coletor',
    category: 'vendas_mkt',
    icon: Compass,
    paths: ['/explorador-catalogo'],
  },
  {
    id: 'gestor_ml',
    label: 'Gestor Mercado Livre',
    description: 'Gerenciamento de anúncios vinculados e publicações ML',
    category: 'vendas_mkt',
    icon: ShoppingBag,
    paths: ['/anuncios-ml'],
  },
  {
    id: 'radar_ml',
    label: 'Radar ML',
    description: 'Monitoramento contínuo de concorrência e preços no ML',
    category: 'vendas_mkt',
    icon: Radar,
    paths: ['/radar-ml'],
  },
  {
    id: 'lucratividade',
    label: 'Lucratividade Lotes',
    description: 'Análise de margens, custos e retorno por lote de compra',
    category: 'operacao',
    icon: SlidersHorizontal,
    paths: ['/lucratividade'],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description: 'Campanhas automatizadas via WhatsApp e gestão de contatos',
    category: 'vendas_mkt',
    icon: Megaphone,
    paths: ['/marketing'],
  },
  {
    id: 'post_instagram',
    label: 'Marketing / Post Instagram',
    description: 'Estúdio de criação de posts e legendas para Instagram',
    category: 'vendas_mkt',
    icon: Instagram,
    paths: ['/post-instagram'],
  },
  {
    id: 'post_tiktok',
    label: 'Marketing / Post TikTok',
    description: 'Estúdio de criação de vídeos e legendas para TikTok',
    category: 'vendas_mkt',
    icon: Video,
    paths: ['/post-tiktok'],
  },
  {
    id: 'cotacoes',
    label: 'Cotações Corporativas',
    description: 'Gestão de leads e cotações B2B para revendedores',
    category: 'vendas_mkt',
    icon: Building2,
    paths: ['/cotacoes'],
  },
  {
    id: 'loja',
    label: 'Loja',
    description: 'Visualização da vitrine online pública e corporativa',
    category: 'vendas_mkt',
    icon: Store,
    paths: ['/loja'],
  },
  {
    id: 'ajustes',
    label: 'Ajustes',
    description: 'Ajuste de inventário físico, divergências e perdas',
    category: 'operacao',
    icon: SlidersHorizontal,
    paths: ['/ajustes'],
  },
  {
    id: 'notas_fiscais',
    label: 'Notas Fiscais (NF-e)',
    description: 'Emissor próprio de NF-e via Focus NFe, DANFE e status SEFAZ',
    category: 'vendas_mkt',
    icon: FileCheck,
    paths: ['/notas-fiscais'],
  },
  {
    id: 'usuarios',
    label: 'Usuários & Acessos',
    description: 'Gestão de usuários, senhas e permissões individuais por módulo',
    category: 'sistema',
    icon: Users,
    paths: ['/usuarios'],
    adminOnly: true,
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    description: 'Parâmetros de integrações (ML, MP, Kabum) e sistema',
    category: 'sistema',
    icon: Settings,
    paths: ['/configuracoes'],
    adminOnly: true,
  },
]

export const ALL_MODULE_IDS: AppModuleId[] = APP_MODULES.map((m) => m.id)

export const DEFAULT_MEMBER_MODULE_IDS: AppModuleId[] = ['dashboard', 'vendas']

/**
 * Retorna o ID do módulo associado a uma rota específica do sistema.
 */
export function getModuleIdByPath(pathname: string): AppModuleId | null {
  // Rotas especiais / públicas / utilitárias
  if (pathname.startsWith('/loja')) return 'loja'
  if (pathname === '/pedido-6849') return 'vendas'
  if (pathname === '/proposta-imovel') return null
  if (pathname === '/termo-reembolso') return null

  // Rotas diretas ou prefixadas
  if (pathname === '/') return 'dashboard'
  if (pathname.startsWith('/contesta-reputacao')) return 'contesta_reputacao'
  if (pathname.startsWith('/vendas')) return 'vendas'
  if (pathname.startsWith('/lucratividade')) return 'lucratividade'
  if (pathname.startsWith('/produtos') || pathname.startsWith('/catalogo')) return 'produtos'
  if (pathname.startsWith('/lotes-entrada') || pathname.startsWith('/lotes')) return 'lotes_compra'
  if (pathname.startsWith('/estoque-geral')) return 'estoque_geral'
  if (pathname.startsWith('/estoque')) return 'estoque_lotes'
  if (pathname.startsWith('/explorador-catalogo')) return 'explorador_catalogo'
  if (pathname.startsWith('/anuncios-ml')) return 'gestor_ml'
  if (pathname.startsWith('/clientes')) return 'clientes'
  if (pathname.startsWith('/radar-ml')) return 'radar_ml'
  if (pathname.startsWith('/post-instagram')) return 'post_instagram'
  if (pathname.startsWith('/post-tiktok')) return 'post_tiktok'
  if (pathname.startsWith('/cotacoes')) return 'cotacoes'
  if (pathname.startsWith('/marketing')) return 'marketing'
  if (pathname.startsWith('/notas-fiscais')) return 'notas_fiscais'
  if (pathname.startsWith('/ajustes')) return 'ajustes'
  if (pathname.startsWith('/usuarios')) return 'usuarios'
  if (pathname.startsWith('/configuracoes')) return 'configuracoes'

  return null
}
