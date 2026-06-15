export type UserRole = 'boss' | 'terrain' | 'diaspora'
export type Season = 'dry' | 'rainy' | 'all_year'
export type ClientLevel = 'standard' | 'vip' | 'grand_compte'
export type PaymentPref = 'cash' | 'credit' | 'mixed'

export interface Profile {
  id: string
  shop_id: string | null
  role: UserRole
  full_name: string
  phone: string | null
  avatar_url: string | null
  job_title: string | null      // ex: vendeur, caissier, livreur, gestionnaire stock
  salary: number | null         // FCFA/mois
  hire_date: string | null
  is_active: boolean
  created_at: string
}

export interface Shop {
  id: string
  name: string
  owner_id: string
  city: string
  country: string
  created_at: string
}

export interface Product {
  id: string
  shop_id: string
  name: string
  unit: string
  current_price: number
  stock_quantity: number
  alert_threshold: number
  alert_days_without_sale: number
  photo_url?: string | null
  created_at: string
}

export interface Client {
  id: string
  shop_id: string
  name: string
  phone: string | null
  whatsapp: string | null
  level: ClientLevel
  total_debt: number
  address: string | null
  product_preferences: string[]   // produits qu'il achète régulièrement
  preferred_payment: PaymentPref
  notes: string | null
  created_at: string
}

export interface CreditPayment {
  id: string
  client_id: string
  amount: number
  date: string
  note: string | null
  created_at: string
}

export interface Supplier {
  id: string
  shop_id: string
  name: string
  phone: string | null
  whatsapp: string | null
  zone: string | null
  season: Season
  reliability: number             // 1-5
  delivery_days: number           // délai livraison habituel
  min_quantity: number | null     // quantité minimale de commande
  notes: string | null
  created_at: string
  products?: SupplierProduct[]
}

export interface SupplierProduct {
  id: string
  supplier_id: string
  product_id: string
  product?: Product
}

export interface PriceHistory {
  id: string
  supplier_id: string
  product_id: string
  price_per_unit: number
  quality: 1 | 2 | 3 | 4 | 5
  date: string
  season: 'dry' | 'rainy'
  notes: string | null
  product?: Product
  supplier?: Supplier
}

export interface StockEntry {
  id: string
  shop_id: string
  product_id: string
  quantity: number
  cost_per_unit: number
  date: string
  supplier_id: string | null
  created_at: string
  product?: Product
}

export interface Sale {
  id: string
  shop_id: string
  created_by: string
  client_id: string | null
  total_amount: number
  paid_amount: number
  credit_amount: number
  pay_mode?: 'cash' | 'credit' | 'mobile_money'
  date: string
  created_at: string
  items?: SaleItem[]
  client?: Client
  creator?: Profile
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  total: number
  product?: Product
}

export type PriceRequestStatus = 'pending' | 'approved' | 'rejected'

export interface PriceRequest {
  id: string
  shop_id: string
  agent_id: string
  product_id: string | null
  product_name: string
  client_name: string | null
  requested_price: number
  approved_price: number | null
  reason: string | null
  status: PriceRequestStatus
  resolved_by: string | null
  created_at: string
  resolved_at: string | null
  agent?: Pick<Profile, 'full_name' | 'job_title'>
}

export type DestockStatus = 'active' | 'sold_out' | 'closed'

export interface DestockLot {
  id: string
  shop_id: string
  created_by: string
  product_name: string
  unit: string
  location_label: string | null
  quantity: number
  quantity_remaining: number
  base_price: number
  floor_price: number
  window_hours: number
  started_at: string
  status: DestockStatus
  created_at: string
}

export interface DashboardStats {
  revenue_today: number
  revenue_week: number
  revenue_month: number
  total_debt: number
  stock_alerts: number
  sales_today: number
}

export interface SaleItemPayload {
  product_id: string
  quantity: number
  unit_price: number
  total: number
  current_stock?: number   // utilisé côté UI pour valider la quantité dispo
}

export interface SalePayload {
  total_amount: number
  paid_amount: number
  credit_amount: number
  date: string
  pay_mode?: 'cash' | 'credit' | 'mobile_money'
  items: SaleItemPayload[]
  client_name?: string
}
