export interface KabumSettings {
  id?: string
  api_key: string
  api_url: string
  environment: 'production' | 'homologation'
  shop_id?: string
  shop_name?: string
  currency?: string
  last_test_status?: 'success' | 'error' | 'pending' | null
  last_test_message?: string
  last_tested_at?: string
  notes?: string
  created?: string
  updated?: string
}

export interface KabumCategoryRecord {
  id: string
  category_id: string
  name: string
  parent_id?: string
  family_id?: string
  family_name?: string
  subfamily_id?: string
  subfamily_name?: string
  full_path?: string
  level?: number
  is_leaf?: boolean
  created?: string
  updated?: string
}

export interface KabumCategoryNode {
  code: string
  label: string
  parent_code?: string
  level: number
  children?: KabumCategoryNode[]
  is_leaf?: boolean
}

export interface KabumSyncJob {
  id: string
  job_type:
    | 'price_stock_sync'
    | 'product_publish'
    | 'order_sync'
    | 'category_sync'
    | 'test_connection'
  status: 'pending' | 'processing' | 'done' | 'error' | 'dormant'
  product_id?: string
  payload?: any
  result?: any
  error_message?: string
  mirakl_import_id?: string
  requested_by?: string
  created?: string
  updated?: string
}

export interface KabumTestResult {
  ok: boolean
  message: string
  shop?: {
    shop_id?: string | number
    shop_name?: string
    currency_iso_code?: string
    operator_internal_id?: string
    state?: string
    [key: string]: any
  }
}
