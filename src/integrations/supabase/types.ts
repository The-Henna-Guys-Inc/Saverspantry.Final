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
      account_deletion_requests: {
        Row: {
          cancelled_at: string | null
          created_at: string
          id: string
          purged_at: string | null
          reason: string | null
          requested_at: string
          scheduled_purge_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          purged_at?: string | null
          reason?: string | null
          requested_at?: string
          scheduled_purge_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          purged_at?: string | null
          reason?: string | null
          requested_at?: string
          scheduled_purge_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_session_settings: {
        Row: {
          id: boolean
          idle_timeout_minutes: number
          session_max_hours: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          idle_timeout_minutes?: number
          session_max_hours?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          idle_timeout_minutes?: number
          session_max_hours?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_feedback: {
        Row: {
          comment: string | null
          context: Json
          created_at: string
          feature: string
          id: string
          rating: string
          source_id: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          context?: Json
          created_at?: string
          feature: string
          id?: string
          rating: string
          source_id?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          context?: Json
          created_at?: string
          feature?: string
          id?: string
          rating?: string
          source_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_response_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          function_name: string
          hit_count: number
          response: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          function_name: string
          hit_count?: number
          response: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          function_name?: string
          hit_count?: number
          response?: Json
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          cached: boolean
          completion_tokens: number
          cost_estimate_usd: number
          created_at: string
          error: string | null
          function_name: string
          id: string
          latency_ms: number | null
          model: string | null
          prompt_tokens: number
          status: string
          total_tokens: number
          user_id: string | null
        }
        Insert: {
          cached?: boolean
          completion_tokens?: number
          cost_estimate_usd?: number
          created_at?: string
          error?: string | null
          function_name: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number
          status?: string
          total_tokens?: number
          user_id?: string | null
        }
        Update: {
          cached?: boolean
          completion_tokens?: number
          cost_estimate_usd?: number
          created_at?: string
          error?: string | null
          function_name?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number
          status?: string
          total_tokens?: number
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_snapshots: {
        Row: {
          by_category: Json
          created_at: string
          id: string
          meal_plan_count: number
          sale_count: number
          swap_count: number
          total_savings_usd: number
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          by_category?: Json
          created_at?: string
          id?: string
          meal_plan_count?: number
          sale_count?: number
          swap_count?: number
          total_savings_usd?: number
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          by_category?: Json
          created_at?: string
          id?: string
          meal_plan_count?: number
          sale_count?: number
          swap_count?: number
          total_savings_usd?: number
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      bulk_buy_candidates: {
        Row: {
          best_store_type: string | null
          bulk_pack_size: string
          bulk_unit_price_usd: number
          confidence: string
          created_at: string
          cuisine_tags: string[]
          est_savings_pct: number
          food_name: string
          id: string
          notes: string | null
          shelf_life_days: number
          source: string
          storage_tip: string | null
          typical_unit_price_usd: number
          updated_at: string
        }
        Insert: {
          best_store_type?: string | null
          bulk_pack_size: string
          bulk_unit_price_usd: number
          confidence?: string
          created_at?: string
          cuisine_tags?: string[]
          est_savings_pct: number
          food_name: string
          id?: string
          notes?: string | null
          shelf_life_days: number
          source?: string
          storage_tip?: string | null
          typical_unit_price_usd: number
          updated_at?: string
        }
        Update: {
          best_store_type?: string | null
          bulk_pack_size?: string
          bulk_unit_price_usd?: number
          confidence?: string
          created_at?: string
          cuisine_tags?: string[]
          est_savings_pct?: number
          food_name?: string
          id?: string
          notes?: string | null
          shelf_life_days?: number
          source?: string
          storage_tip?: string | null
          typical_unit_price_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      city_waitlist: {
        Row: {
          city: string
          created_at: string
          email: string
          id: string
          notes: string | null
          source: string
          state: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          city: string
          created_at?: string
          email: string
          id?: string
          notes?: string | null
          source?: string
          state: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
          source?: string
          state?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          download_url: string | null
          error: string | null
          expires_at: string | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          download_url?: string | null
          error?: string | null
          expires_at?: string | null
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          download_url?: string | null
          error?: string | null
          expires_at?: string | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      flyer_extraction_batches: {
        Row: {
          admin_user_id: string | null
          ai_cost_usd: number
          approved_items_count: number
          completed_at: string | null
          created_at: string
          extracted_items_count: number
          extraction_notes: string | null
          extraction_status: string
          file_hash: string | null
          file_type: string
          flyer_valid_from: string | null
          flyer_valid_until: string | null
          id: string
          original_filename: string
          page_count: number
          source_email_id: string | null
          store_id: string
          stored_file_url: string
        }
        Insert: {
          admin_user_id?: string | null
          ai_cost_usd?: number
          approved_items_count?: number
          completed_at?: string | null
          created_at?: string
          extracted_items_count?: number
          extraction_notes?: string | null
          extraction_status?: string
          file_hash?: string | null
          file_type: string
          flyer_valid_from?: string | null
          flyer_valid_until?: string | null
          id?: string
          original_filename: string
          page_count?: number
          source_email_id?: string | null
          store_id: string
          stored_file_url: string
        }
        Update: {
          admin_user_id?: string | null
          ai_cost_usd?: number
          approved_items_count?: number
          completed_at?: string | null
          created_at?: string
          extracted_items_count?: number
          extraction_notes?: string | null
          extraction_status?: string
          file_hash?: string | null
          file_type?: string
          flyer_valid_from?: string | null
          flyer_valid_until?: string | null
          id?: string
          original_filename?: string
          page_count?: number
          source_email_id?: string | null
          store_id?: string
          stored_file_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "flyer_extraction_batches_source_email_id_fkey"
            columns: ["source_email_id"]
            isOneToOne: false
            referencedRelation: "promo_email_ingestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flyer_extraction_batches_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "specialty_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          code: string
          created_at: string
          expires_at: string
          household_id: string
          id: string
          invited_by_user_id: string
          invited_email: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          code: string
          created_at?: string
          expires_at?: string
          household_id: string
          id?: string
          invited_by_user_id: string
          invited_email?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          code?: string
          created_at?: string
          expires_at?: string
          household_id?: string
          id?: string
          invited_by_user_id?: string
          invited_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          household_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          household_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      known_google_places: {
        Row: {
          first_seen_at: string
          google_place_id: string
          last_seen_at: string
        }
        Insert: {
          first_seen_at?: string
          google_place_id: string
          last_seen_at?: string
        }
        Update: {
          first_seen_at?: string
          google_place_id?: string
          last_seen_at?: string
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          content_md: string
          created_at: string
          doc_type: string
          id: string
          is_active: boolean
          published_at: string
          title: string
          version: number
        }
        Insert: {
          content_md: string
          created_at?: string
          doc_type: string
          id?: string
          is_active?: boolean
          published_at?: string
          title: string
          version: number
        }
        Update: {
          content_md?: string
          created_at?: string
          doc_type?: string
          id?: string
          is_active?: boolean
          published_at?: string
          title?: string
          version?: number
        }
        Relationships: []
      }
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          metadata: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_search_events: {
        Row: {
          created_at: string
          id: string
          normalized_query: string
          query: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          normalized_query: string
          query: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          normalized_query?: string
          query?: string
          user_id?: string | null
        }
        Relationships: []
      }
      operational_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string | null
          metadata: Json
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      pantry_consumption_log: {
        Row: {
          days_to_expiry: number | null
          expires_on: string | null
          household_id: string | null
          id: string
          item_name: string
          pantry_item_id: string | null
          quantity_used: number
          unit: string | null
          used_at: string
          user_id: string
          was_before_expiry: boolean | null
        }
        Insert: {
          days_to_expiry?: number | null
          expires_on?: string | null
          household_id?: string | null
          id?: string
          item_name: string
          pantry_item_id?: string | null
          quantity_used?: number
          unit?: string | null
          used_at?: string
          user_id: string
          was_before_expiry?: boolean | null
        }
        Update: {
          days_to_expiry?: number | null
          expires_on?: string | null
          household_id?: string | null
          id?: string
          item_name?: string
          pantry_item_id?: string | null
          quantity_used?: number
          unit?: string | null
          used_at?: string
          user_id?: string
          was_before_expiry?: boolean | null
        }
        Relationships: []
      }
      pantry_items: {
        Row: {
          barcode: string | null
          category: string | null
          created_at: string
          expires_on: string | null
          household_id: string | null
          id: string
          image_url: string | null
          item: string
          location: string
          low_stock_threshold: number | null
          quantity: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          created_at?: string
          expires_on?: string | null
          household_id?: string | null
          id?: string
          image_url?: string | null
          item: string
          location?: string
          low_stock_threshold?: number | null
          quantity?: number
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          category?: string | null
          created_at?: string
          expires_on?: string | null
          household_id?: string | null
          id?: string
          image_url?: string | null
          item?: string
          location?: string
          low_stock_threshold?: number | null
          quantity?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pantry_locations: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      places_search_cache: {
        Row: {
          cuisine: string
          geo_cell: string
          id: string
          lat: number
          lng: number
          radius_miles: number
          result_count: number
          searched_at: string
        }
        Insert: {
          cuisine: string
          geo_cell: string
          id?: string
          lat: number
          lng: number
          radius_miles: number
          result_count?: number
          searched_at?: string
        }
        Update: {
          cuisine?: string
          geo_cell?: string
          id?: string
          lat?: number
          lng?: number
          radius_miles?: number
          result_count?: number
          searched_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_household_id: string | null
          created_at: string
          cuisine_filter_enabled: boolean
          cuisine_preferences: string[]
          deletion_pending_at: string | null
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
          active_household_id?: string | null
          created_at?: string
          cuisine_filter_enabled?: boolean
          cuisine_preferences?: string[]
          deletion_pending_at?: string | null
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
          active_household_id?: string | null
          created_at?: string
          cuisine_filter_enabled?: boolean
          cuisine_preferences?: string[]
          deletion_pending_at?: string | null
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
      promo_email_ingestions: {
        Row: {
          attachment_count: number
          body_text_excerpt: string | null
          created_at: string
          detected_address: string | null
          detected_zip: string | null
          from_address: string
          from_domain: string
          id: string
          match_confidence: string
          match_method: string | null
          matched_store_id: string | null
          notes: string | null
          raw_storage_path: string | null
          received_at: string
          status: string
          subject: string | null
          to_address: string | null
          updated_at: string
        }
        Insert: {
          attachment_count?: number
          body_text_excerpt?: string | null
          created_at?: string
          detected_address?: string | null
          detected_zip?: string | null
          from_address: string
          from_domain: string
          id?: string
          match_confidence?: string
          match_method?: string | null
          matched_store_id?: string | null
          notes?: string | null
          raw_storage_path?: string | null
          received_at?: string
          status?: string
          subject?: string | null
          to_address?: string | null
          updated_at?: string
        }
        Update: {
          attachment_count?: number
          body_text_excerpt?: string | null
          created_at?: string
          detected_address?: string | null
          detected_zip?: string | null
          from_address?: string
          from_domain?: string
          id?: string
          match_confidence?: string
          match_method?: string | null
          matched_store_id?: string | null
          notes?: string | null
          raw_storage_path?: string | null
          received_at?: string
          status?: string
          subject?: string | null
          to_address?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_email_ingestions_matched_store_id_fkey"
            columns: ["matched_store_id"]
            isOneToOne: false
            referencedRelation: "specialty_stores"
            referencedColumns: ["id"]
          },
        ]
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
          address: string | null
          approved_at: string | null
          approved_by_admin_id: string | null
          category: string | null
          city: string | null
          confirmation_count: number
          created_at: string
          ends_at: string
          extraction_batch_id: string | null
          flag_count: number
          food_name: string
          google_maps_url: string | null
          id: string
          moderation_notes: string | null
          moderation_status: string
          pack_size: string | null
          photo_url: string | null
          region: string | null
          regular_price_usd: number | null
          sale_price_usd: number
          savings_pct: number | null
          source: string
          source_flyer_url: string | null
          starts_at: string
          store_chain: string | null
          store_id: string | null
          store_name: string
          submitted_by_user_id: string | null
          title: string
        }
        Insert: {
          address?: string | null
          approved_at?: string | null
          approved_by_admin_id?: string | null
          category?: string | null
          city?: string | null
          confirmation_count?: number
          created_at?: string
          ends_at: string
          extraction_batch_id?: string | null
          flag_count?: number
          food_name: string
          google_maps_url?: string | null
          id?: string
          moderation_notes?: string | null
          moderation_status?: string
          pack_size?: string | null
          photo_url?: string | null
          region?: string | null
          regular_price_usd?: number | null
          sale_price_usd: number
          savings_pct?: number | null
          source?: string
          source_flyer_url?: string | null
          starts_at?: string
          store_chain?: string | null
          store_id?: string | null
          store_name: string
          submitted_by_user_id?: string | null
          title: string
        }
        Update: {
          address?: string | null
          approved_at?: string | null
          approved_by_admin_id?: string | null
          category?: string | null
          city?: string | null
          confirmation_count?: number
          created_at?: string
          ends_at?: string
          extraction_batch_id?: string | null
          flag_count?: number
          food_name?: string
          google_maps_url?: string | null
          id?: string
          moderation_notes?: string | null
          moderation_status?: string
          pack_size?: string | null
          photo_url?: string | null
          region?: string | null
          regular_price_usd?: number | null
          sale_price_usd?: number
          savings_pct?: number | null
          source?: string
          source_flyer_url?: string | null
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
      savings_events: {
        Row: {
          amount_usd: number
          category: string
          created_at: string
          food_name: string | null
          household_id: string | null
          id: string
          metadata: Json
          occurred_at: string
          source_id: string | null
          user_id: string
        }
        Insert: {
          amount_usd?: number
          category: string
          created_at?: string
          food_name?: string | null
          household_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          source_id?: string | null
          user_id: string
        }
        Update: {
          amount_usd?: number
          category?: string
          created_at?: string
          food_name?: string | null
          household_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          source_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      specialty_stores: {
        Row: {
          active: boolean
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
          phone: string | null
          price_tier: string
          region: string | null
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          active?: boolean
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
          phone?: string | null
          price_tier?: string
          region?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          active?: boolean
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
          phone?: string | null
          price_tier?: string
          region?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      store_email_aliases: {
        Row: {
          chain_name: string | null
          created_at: string
          created_by: string | null
          id: string
          match_type: string
          match_value: string
          notes: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          chain_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          match_type: string
          match_value: string
          notes?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          chain_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          match_type?: string
          match_value?: string
          notes?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_email_aliases_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "specialty_stores"
            referencedColumns: ["id"]
          },
        ]
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
      support_ticket_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          internal_note: boolean
          sender_role: string
          sender_user_id: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          internal_note?: boolean
          sender_role?: string
          sender_user_id: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          internal_note?: boolean
          sender_role?: string
          sender_user_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          id: string
          last_message_at: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usda_food_plans: {
        Row: {
          age_max: number | null
          age_min: number | null
          created_at: string
          household_type: string
          id: string
          monthly_cost_usd: number
          plan: string
          report_month: string
          sex: string | null
          source_url: string | null
          weekly_cost_usd: number | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          created_at?: string
          household_type: string
          id?: string
          monthly_cost_usd: number
          plan: string
          report_month: string
          sex?: string | null
          source_url?: string | null
          weekly_cost_usd?: number | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          created_at?: string
          household_type?: string
          id?: string
          monthly_cost_usd?: number
          plan?: string
          report_month?: string
          sex?: string | null
          source_url?: string | null
          weekly_cost_usd?: number | null
        }
        Relationships: []
      }
      usda_sync_log: {
        Row: {
          error_message: string | null
          id: string
          ran_at: string
          report_month: string | null
          rows_imported: number | null
          source_url: string | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          ran_at?: string
          report_month?: string | null
          rows_imported?: number | null
          source_url?: string | null
          status: string
          triggered_by?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          ran_at?: string
          report_month?: string | null
          rows_imported?: number | null
          source_url?: string | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      user_deal_submissions: {
        Row: {
          deal_observation_id: string | null
          id: string
          ip_address: string | null
          submitted_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          deal_observation_id?: string | null
          id?: string
          ip_address?: string | null
          submitted_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          deal_observation_id?: string | null
          id?: string
          ip_address?: string | null
          submitted_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_deal_submissions_deal_observation_id_fkey"
            columns: ["deal_observation_id"]
            isOneToOne: false
            referencedRelation: "sale_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_legal_acceptances: {
        Row: {
          accepted_at: string
          doc_type: string
          document_id: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
          version: number
        }
        Insert: {
          accepted_at?: string
          doc_type: string
          document_id: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
          version: number
        }
        Update: {
          accepted_at?: string
          doc_type?: string
          document_id?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_legal_acceptances_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
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
      get_invite_by_code: {
        Args: { _code: string }
        Returns: {
          accepted_at: string
          expires_at: string
          household_id: string
          id: string
        }[]
      }
      get_session_timeout_settings: {
        Args: never
        Returns: {
          idle_timeout_minutes: number
          session_max_hours: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_household_member: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      is_household_owner: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      record_alert: {
        Args: {
          _alert_type: string
          _dedupe_minutes?: number
          _message: string
          _metadata?: Json
          _severity: string
          _title: string
        }
        Returns: string
      }
      top_nutrition_searches: {
        Args: { _limit?: number }
        Returns: {
          count: number
          query: string
        }[]
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
