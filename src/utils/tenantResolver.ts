/**
 * Utilitário de detecção e resolução de Tenant baseado no Hostname
 *
 * Suporta:
 * 1. Subdomínio customizado de produção: {slug}.ambicorp.com.br
 *    - Se o host for "cliente1.ambicorp.com.br" -> slug "cliente1"
 *    - Se o host for "www.ambicorp.com.br", "ambicorp.com.br" ou "app.ambicorp.com.br" -> tenant mestre "ambicorp"
 * 2. Ambiente de Preview / Dev / Localhost:
 *    - Detecta parâmetro de URL ?tenant={slug} ou localStorage 'ambicorp_active_tenant_slug'
 *    - Fallback padrão: "ambicorp" (tenant mestre)
 */

export const ROOT_DOMAINS = [
  'ambicorp.com.br',
  'www.ambicorp.com.br',
  'app.ambicorp.com.br',
  'localhost',
]

export const TENANT_STORAGE_KEY = 'ambicorp_active_tenant_id'

export interface HostTenantResolution {
  slug: string | null
  isSubdomain: boolean
  hostname: string
  source: 'subdomain' | 'query' | 'storage' | 'default_master'
}

export function resolveTenantFromHost(): HostTenantResolution {
  if (typeof window === 'undefined') {
    return {
      slug: 'ambicorp',
      isSubdomain: false,
      hostname: '',
      source: 'default_master',
    }
  }

  const hostname = window.location.hostname.toLowerCase()

  // 1. Checar query string na URL (?tenant=slug)
  const params = new URLSearchParams(window.location.search)
  const queryTenant = params.get('tenant')?.trim().toLowerCase()
  if (queryTenant) {
    return {
      slug: queryTenant,
      isSubdomain: false,
      hostname,
      source: 'query',
    }
  }

  // 2. Análise de subdomínio real para domínios da Ambicorp ou genéricos com 3+ partes
  // Ex: cliente1.ambicorp.com.br
  if (hostname.endsWith('.ambicorp.com.br')) {
    const sub = hostname.replace('.ambicorp.com.br', '').trim()
    if (sub && sub !== 'www' && sub !== 'app' && sub !== 'api') {
      return {
        slug: sub,
        isSubdomain: true,
        hostname,
        source: 'subdomain',
      }
    }
  }

  // 3. Checar storage prévio (ex: super-admin alternou de tenant ou usuário selecionou na tela de login)
  try {
    const stored = localStorage.getItem(TENANT_STORAGE_KEY)?.trim()
    if (stored) {
      return {
        slug: null, // o id está no storage, contexto cuidará do lookup
        isSubdomain: false,
        hostname,
        source: 'storage',
      }
    }
  } catch {
    /* intentionally ignored */
  }

  // 4. Default tenant mestre
  return {
    slug: 'ambicorp',
    isSubdomain: false,
    hostname,
    source: 'default_master',
  }
}

/**
 * Formata o endereço de subdomínio esperado para um cliente
 */
export function formatTenantDomain(slug: string): string {
  const clean = (slug || '').trim().toLowerCase()
  return `${clean}.ambicorp.com.br`
}
