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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      battles: {
        Row: {
          format: string
          fought_at: string
          id: string
          my_deck_id: string
          opponent_deck_name: string
          opponent_deck_normalized: string | null
          result: string
          tuning_id: string | null
          turn_order: string | null
          user_id: string
        }
        Insert: {
          format?: string
          fought_at?: string
          id?: string
          my_deck_id: string
          opponent_deck_name: string
          opponent_deck_normalized?: string | null
          result: string
          tuning_id?: string | null
          turn_order?: string | null
          user_id: string
        }
        Update: {
          format?: string
          fought_at?: string
          id?: string
          my_deck_id?: string
          opponent_deck_name?: string
          opponent_deck_normalized?: string | null
          result?: string
          tuning_id?: string | null
          turn_order?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battles_my_deck_id_fkey"
            columns: ["my_deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battles_tuning_id_fkey"
            columns: ["tuning_id"]
            isOneToOne: false
            referencedRelation: "deck_tunings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_name_candidates: {
        Row: {
          compare_to: string
          created_at: string
          diff_count: number
          id: string
          raw_name: string
          same_count: number
          status: string
        }
        Insert: {
          compare_to: string
          created_at?: string
          diff_count?: number
          id?: string
          raw_name: string
          same_count?: number
          status?: string
        }
        Update: {
          compare_to?: string
          created_at?: string
          diff_count?: number
          id?: string
          raw_name?: string
          same_count?: number
          status?: string
        }
        Relationships: []
      }
      deck_tunings: {
        Row: {
          created_at: string
          deck_id: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          deck_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          deck_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "deck_tunings_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          created_at: string
          format: string
          id: string
          is_archived: boolean
          name: string
          normalized_name: string | null
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          format?: string
          id?: string
          is_archived?: boolean
          name: string
          normalized_name?: string | null
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          is_archived?: boolean
          name?: string
          normalized_name?: string | null
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      normalization_results: {
        Row: {
          canonical_name: string
          created_at: string
          raw_name: string
        }
        Insert: {
          canonical_name: string
          created_at?: string
          raw_name: string
        }
        Update: {
          canonical_name?: string
          created_at?: string
          raw_name?: string
        }
        Relationships: []
      }
      normalization_votes: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          user_id: string
          vote: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          user_id: string
          vote: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "normalization_votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "deck_name_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "normalization_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opponent_deck_master: {
        Row: {
          category: string
          created_at: string
          format: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          category?: string
          created_at?: string
          format?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          format?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_admin: boolean
          is_guest: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          is_admin?: boolean
          is_guest?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean
          is_guest?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_own_account: { Args: never; Returns: undefined }
      get_environment_deck_shares:
        | {
            Args: { p_days?: number }
            Returns: {
              battle_count: number
              deck_name: string
              share_pct: number
            }[]
          }
        | {
            Args: { p_days?: number; p_format?: string }
            Returns: {
              battle_count: number
              deck_name: string
              share_pct: number
            }[]
          }
      get_opponent_deck_suggestions:
        | {
            Args: never
            Returns: {
              deck_name: string
            }[]
          }
        | {
            Args: { p_format?: string }
            Returns: {
              deck_category: string
              deck_name: string
            }[]
          }
      get_pending_vote_for_user: {
        Args: never
        Returns: {
          candidate_id: string
          compare_to: string
          diff_count: number
          raw_name: string
          same_count: number
        }[]
      }
      get_environment_deck_shares_range: {
        Args: { p_start_date: string; p_end_date: string; p_format?: string }
        Returns: {
          battle_count: number
          deck_name: string
          share_pct: number
        }[]
      }
      submit_normalization_vote: {
        Args: { p_candidate_id: string; p_vote: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
