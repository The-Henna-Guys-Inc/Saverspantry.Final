export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      meal_plans: {
        Row: {
          created_at: string
          household_id: string | null
          id: string
          plan: Json
          updated_at: string
          user_id: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          household_id?: string | null
          id?: string
          plan: Json
          updated_at?: string
          user_id: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          household_id?: string | null
          id?: string
          plan?: Json
          updated_at?: string
          user_id?: string
          week_start_date?: string
        }
        Relationships: []
      }
      pantry_items: {
        Row: {
          category: string | null
          created_at: string
          expires_on: string | null
          household_id: string | null
          id: string
          item: string
          quantity: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          expires_on?: string | null
          household_id?: string | null
          id?: string
          item: string
          quantity?: number
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          expires_on?: string | null
          household_id?: string | null
          id?: string
          item?: string
          quantity?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          dietary_prefs: Json
          display_name: string | null
          household_size: number
          id: string
          search_radius_miles: number
          show_specialty_stores: boolean
          subscription_expires_at: string | null
          subscription_tier: string
          updated_at: string
          user_id: string
          zip_code: string | null
        }
        Insert: {
          created_at?: string
          dietary_prefs?: Json
          display_name?: string | null
          household_size?: number
          id?: string
          search_radius_miles?: number
          show_specialty_stores?: boolean
          subscription_expires_at?: string | null
          subscription_tier?: string
          updated_at?: string
          user_id: string
          zip_code?: string | null
        }
        Update: {
          created_at?: string
          dietary_prefs?: Json
          display_name?: string | null
          household_size?: number
          id?: string
          search_radius_miles?: number
          show_specialty_stores?: boolean
          subscription_expires_at?: string | null
          subscription_tier?: string
          updated_at?: string
          user_id?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      sale_confirmations: {
        Row: {
          confirmed_at: string
          id: string
          sale_observation_id: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string
          id?: string
          sale_observation_id: string
          user_id: string
        }
        Update: {
          confirmed_at?: string
          id?: string
          sale_observation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_confirmations_sale_observation_id_fkey"
            columns: ["sale_observation_id"]
            isOneToOne: false
            referencedRelation: "sale_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_flags: {
        Row: {
          flagged_at: string
          id: string
          notes: string | null
          reason: string
          sale_observation_id: string
          user_id: string
        }
        Insert: {
          flagged_at?: string
          id?: string
          notes?: string | null
          reason: string
          sale_observation_id: string
          user_id: string
        }
        Update: {
          flagged_at?: string
          id?: string
          notes?: string | null
          reason?: string
          sale_observation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_flags_sale_observation_id_fkey"
            columns: ["sale_observation_id"]
            isOneToOne: false
            referencedRelation: "sale_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_observations: {
        Row: {
          city: string | null
          confirmation_count: number
          created_at: string
          ends_at: string
          flag_count: number
          food_name: string
          id: string
          moderation_status: string
          pack_size: string | null
          photo_url: string | null
          region: string | null
          regular_price_usd: number | null
          sale_price_usd: number
          savings_pct: number | null
          source: string
          starts_at: string
          store_chain: string | null
          store_id: string | null
          store_name: string
          submitted_by_user_id: string | null
          title: string
        }
        Insert: {
          city?: string | null
          confirmation_count?: number
          created_at?: string
          ends_at: string
          flag_count?: number
          food_name: string
          id?: string
          moderation_status?: string
          pack_size?: string | null
          photo_url?: string | null
          region?: string | null
          regular_price_usd?: number | null
          sale_price_usd: number
          savings_pct?: number | null
          source?: string
          starts_at?: string
          store_chain?: string | null
          store_id?: string | null
          store_name: string
          submitted_by_user_id?: string | null
          title: string
        }
        Update: {
          city?: string | null
          confirmation_count?: number
          created_at?: string
          ends_at?: string
          flag_count?: number
          food_name?: string
          id?: string
          moderation_status?: string
          pack_size?: string | null
          photo_url?: string | null
          region?: string | null
          regular_price_usd?: number | null
          sale_price_usd?: number
          savings_pct?: number | null
          source?: string
          starts_at?: string
          store_chain?: string | null
          store_id?: string | null
          store_name?: string
          submitted_by_user_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_observations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "specialty_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_lookups: {
        Row: {
          created_at: string
          household_id: string | null
          id: string
          query: string
          result: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id?: string | null
          id?: string
          query: string
          result: Json
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string | null
          id?: string
          query?: string
          result?: Json
          user_id?: string
        }
        Relationships: []
      }
      saved_recipes: {
        Row: {
          created_at: string
          household_id: string | null
          id: string
          recipe: Json
          source: string
          source_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id?: string | null
          id?: string
          recipe: Json
          source?: string
          source_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string | null
          id?: string
          recipe?: Json
          source?: string
          source_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      saved_swaps: {
        Row: {
          created_at: string
          food: string
          household_id: string | null
          id: string
          result: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          food: string
          household_id?: string | null
          id?: string
          result: Json
          user_id: string
        }
        Update: {
          created_at?: string
          food?: string
          household_id?: string | null
          id?: string
          result?: Json
          user_id?: string
        }
        Relationships: []
      }
      specialty_stores: {
        Row: {
          address: string | null
          chain_name: string | null
          city: string | null
          country: string | null
          created_at: string
          cuisine_specialties: string[]
          curation_source: string
          description: string | null
          google_place_id: string | null
          google_rating: number | null
          google_rating_count: number | null
          id: string
          last_synced_at: string | null
          latitude: number | null
          longitude: number | null
          name: string
          price_tier: string
          region: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          chain_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          cuisine_specialties?: string[]
          curation_source?: string
          description?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_rating_count?: number | null
          id?: string
          last_synced_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          price_tier?: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          chain_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          cuisine_specialties?: string[]
          curation_source?: string
          description?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_rating_count?: number | null
          id?: string
          last_synced_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          price_tier?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      store_visits: {
        Row: {
          created_at: string
          id: string
          store_id: string
          user_id: string
          user_note: string | null
          user_rating: number | null
          visited_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          user_id: string
          user_note?: string | null
          user_rating?: number | null
          visited_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          user_id?: string
          user_note?: string | null
          user_rating?: number | null
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_visits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "specialty_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          created_at: string
          food_name: string
          id: string
          min_savings_pct: number
          min_savings_usd: number
          snoozed_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          food_name: string
          id?: string
          min_savings_pct?: number
          min_savings_usd?: number
          snoozed_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          food_name?: string
          id?: string
          min_savings_pct?: number
          min_savings_usd?: number
          snoozed_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "household_owner" | "household_member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "household_owner", "household_member"],
    },
  },
} as const
