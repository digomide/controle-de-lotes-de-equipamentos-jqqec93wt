export type MLCustomerOrigin = 'ml' | 'manual' | 'loja' | 'outro'

export interface CustomerNoteEntry {
  date: string
  author: string
  text: string
}

export interface MLCustomer {
  id: string
  name: string
  nickname?: string
  buyer_id?: string
  phone?: string
  email?: string
  document?: string
  address?: string
  raw_address?: any
  origin: MLCustomerOrigin
  notes?: string
  notes_history?: CustomerNoteEntry[]
  next_contact_date?: string | null
  tags?: string[]
  created: string
  updated: string
}

export interface CreateMLCustomerInput {
  name: string
  nickname?: string
  buyer_id?: string
  phone?: string
  email?: string
  document?: string
  address?: string
  origin: MLCustomerOrigin
  notes?: string
  next_contact_date?: string | null
  tags?: string[]
}

export interface UpdateMLCustomerInput {
  name?: string
  nickname?: string
  buyer_id?: string
  phone?: string
  email?: string
  document?: string
  address?: string
  origin?: MLCustomerOrigin
  notes?: string
  notes_history?: CustomerNoteEntry[]
  next_contact_date?: string | null
  tags?: string[]
}
