export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
          subscription_end_date: string | null
          trial_end_date: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_end_date?: string | null
          trial_end_date?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_end_date?: string | null
          trial_end_date?: string | null
          created_at?: string | null
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          upload_id: string | null
          date: string
          type: string
          ticker: string
          security_name: string | null
          quantity: number
          price_gbp: number
          total_gbp: number
          fees_gbp: number | null
          original_currency: string | null
          fx_rate: number | null
          broker: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          upload_id?: string | null
          date: string
          type: string
          ticker: string
          security_name?: string | null
          quantity: number
          price_gbp: number
          total_gbp: number
          fees_gbp?: number | null
          original_currency?: string | null
          fx_rate?: number | null
          broker?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          upload_id?: string | null
          date?: string
          type?: string
          ticker?: string
          security_name?: string | null
          quantity?: number
          price_gbp?: number
          total_gbp?: number
          fees_gbp?: number | null
          original_currency?: string | null
          fx_rate?: number | null
          broker?: string | null
          created_at?: string | null
        }
      }
      uploads: {
        Row: {
          id: string
          user_id: string
          filename: string
          broker_detected: string | null
          row_count: number | null
          transactions_imported: number | null
          status: string | null
          error_message: string | null
          schema_mapping: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          filename: string
          broker_detected?: string | null
          row_count?: number | null
          transactions_imported?: number | null
          status?: string | null
          error_message?: string | null
          schema_mapping?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          filename?: string
          broker_detected?: string | null
          row_count?: number | null
          transactions_imported?: number | null
          status?: string | null
          error_message?: string | null
          schema_mapping?: Json | null
          created_at?: string | null
        }
      }
      cgt_computations: {
        Row: {
          id: string
          user_id: string
          tax_year: string
          computed_at: string | null
          total_proceeds_gbp: number | null
          total_allowable_cost_gbp: number | null
          total_gain_gbp: number | null
          total_loss_gbp: number | null
          net_gain_gbp: number | null
          annual_exempt_amount_gbp: number | null
          taxable_gain_gbp: number | null
        }
        Insert: {
          id?: string
          user_id: string
          tax_year: string
          computed_at?: string | null
          total_proceeds_gbp?: number | null
          total_allowable_cost_gbp?: number | null
          total_gain_gbp?: number | null
          total_loss_gbp?: number | null
          net_gain_gbp?: number | null
          annual_exempt_amount_gbp?: number | null
          taxable_gain_gbp?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          tax_year?: string
          computed_at?: string | null
          total_proceeds_gbp?: number | null
          total_allowable_cost_gbp?: number | null
          total_gain_gbp?: number | null
          total_loss_gbp?: number | null
          net_gain_gbp?: number | null
          annual_exempt_amount_gbp?: number | null
          taxable_gain_gbp?: number | null
        }
      }
      disposals: {
        Row: {
          id: string
          user_id: string
          tax_year: string
          date: string
          ticker: string
          security_name: string | null
          quantity: number
          proceeds_gbp: number
          allowable_cost_gbp: number
          gain_gbp: number
          matching_rule: string
          notes: string | null
        }
        Insert: {
          id?: string
          user_id: string
          tax_year: string
          date: string
          ticker: string
          security_name?: string | null
          quantity: number
          proceeds_gbp: number
          allowable_cost_gbp: number
          gain_gbp: number
          matching_rule: string
          notes?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          tax_year?: string
          date?: string
          ticker?: string
          security_name?: string | null
          quantity?: number
          proceeds_gbp?: number
          allowable_cost_gbp?: number
          gain_gbp?: number
          matching_rule?: string
          notes?: string | null
        }
      }
      section_104_pools: {
        Row: {
          id: string
          user_id: string
          ticker: string
          total_shares: number | null
          total_allowable_cost_gbp: number | null
          last_updated: string | null
        }
        Insert: {
          id?: string
          user_id: string
          ticker: string
          total_shares?: number | null
          total_allowable_cost_gbp?: number | null
          last_updated?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          ticker?: string
          total_shares?: number | null
          total_allowable_cost_gbp?: number | null
          last_updated?: string | null
        }
      }
      alerts: {
        Row: {
          id: string
          user_id: string
          type: string
          sent_at: string | null
          payload: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          sent_at?: string | null
          payload?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          sent_at?: string | null
          payload?: Json | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
