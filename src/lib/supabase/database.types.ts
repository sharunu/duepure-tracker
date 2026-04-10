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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      battles: {
        Row: {
          format: string
          fought_at: string
          id: string
          my_deck_id: string
          opponent_deck_name: string
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
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          format?: string
          id?: string
          is_archived?: boolean
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          is_archived?: boolean
          name?: string
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
      discord_connections: {
        Row: {
          access_token: string
          created_at: string
          discord_id: string
          discord_username: string
          id: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          discord_id: string
          discord_username: string
          id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          discord_id?: string
          discord_username?: string
          id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discord_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          category: string
          created_at: string | null
          id: string
          message: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          message: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          message?: string
          user_id?: string | null
        }
        Relationships: []
      }
      opponent_deck_master: {
        Row: {
          admin_bonus_count: number
          category: string
          created_at: string
          format: string
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          sort_order: number
        }
        Insert: {
          admin_bonus_count?: number
          category?: string
          created_at?: string
          format?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          sort_order?: number
        }
        Update: {
          admin_bonus_count?: number
          category?: string
          created_at?: string
          format?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      opponent_deck_settings: {
        Row: {
          disable_period_days: number
          format: string
          id: string
          major_threshold: number
          management_mode: string
          minor_threshold: number
          updated_at: string
          usage_period_days: number
        }
        Insert: {
          disable_period_days?: number
          format: string
          id?: string
          major_threshold?: number
          management_mode?: string
          minor_threshold?: number
          updated_at?: string
          usage_period_days?: number
        }
        Update: {
          disable_period_days?: number
          format?: string
          id?: string
          major_threshold?: number
          management_mode?: string
          minor_threshold?: number
          updated_at?: string
          usage_period_days?: number
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
      team_members: {
        Row: {
          discord_username: string
          hidden_at: string | null
          id: string
          joined_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          discord_username: string
          hidden_at?: string | null
          id?: string
          joined_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          discord_username?: string
          hidden_at?: string | null
          id?: string
          joined_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          discord_guild_id: string
          icon_url: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discord_guild_id: string
          icon_url?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discord_guild_id?: string
          icon_url?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_add_opponent_deck: {
        Args: { p_deck_name: string; p_format: string }
        Returns: undefined
      }
      delete_own_account: { Args: never; Returns: undefined }
      get_deck_trend_range: {
        Args: {
          p_end_date: string
          p_format?: string
          p_start_date: string
          p_user_id?: string
        }
        Returns: {
          battle_count: number
          deck_name: string
          period_start: string
          share_pct: number
        }[]
      }
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
      get_environment_deck_shares_range: {
        Args: { p_end_date: string; p_format?: string; p_start_date: string }
        Returns: {
          battle_count: number
          deck_name: string
          share_pct: number
        }[]
      }
      get_global_deck_detail_stats: {
        Args: {
          p_deck_name: string
          p_end_date?: string
          p_format?: string
          p_start_date?: string
        }
        Returns: {
          first_losses: number
          first_total: number
          first_wins: number
          losses: number
          opponent_name: string
          second_losses: number
          second_total: number
          second_wins: number
          total: number
          unknown_losses: number
          unknown_total: number
          unknown_wins: number
          wins: number
        }[]
      }
      get_global_my_deck_stats_range: {
        Args: { p_end_date: string; p_format?: string; p_start_date: string }
        Returns: {
          deck_name: string
          losses: number
          total: number
          win_rate: number
          wins: number
        }[]
      }
      get_global_opponent_deck_detail_stats: {
        Args: {
          p_end_date?: string
          p_format?: string
          p_opponent_deck_name: string
          p_start_date?: string
        }
        Returns: {
          first_losses: number
          first_total: number
          first_wins: number
          losses: number
          my_deck_name: string
          second_losses: number
          second_total: number
          second_wins: number
          total: number
          unknown_losses: number
          unknown_total: number
          unknown_wins: number
          wins: number
        }[]
      }
      get_global_opponent_deck_stats_range: {
        Args: { p_end_date: string; p_format?: string; p_start_date: string }
        Returns: {
          deck_name: string
          losses: number
          total: number
          win_rate: number
          wins: number
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
      get_personal_environment_shares_range: {
        Args: { p_end_date: string; p_format?: string; p_start_date: string }
        Returns: {
          battle_count: number
          deck_name: string
          share_pct: number
        }[]
      }
      get_team_deck_detail_stats: {
        Args: {
          p_deck_name: string
          p_end_date?: string
          p_format?: string
          p_start_date?: string
          p_team_id: string
          p_user_id?: string
        }
        Returns: {
          first_losses: number
          first_total: number
          first_wins: number
          losses: number
          opponent_name: string
          second_losses: number
          second_total: number
          second_wins: number
          total: number
          tuning_name: string
          unknown_losses: number
          unknown_total: number
          unknown_wins: number
          wins: number
        }[]
      }
      get_team_deck_trend_range: {
        Args: {
          p_end_date?: string
          p_format?: string
          p_start_date?: string
          p_team_id: string
          p_user_id?: string
        }
        Returns: {
          battle_count: number
          deck_name: string
          period_start: string
          share_pct: number
        }[]
      }
      get_team_members: {
        Args: { p_team_id: string }
        Returns: {
          discord_username: string
          user_id: string
        }[]
      }
      get_team_my_deck_stats_range: {
        Args: {
          p_end_date?: string
          p_format?: string
          p_start_date?: string
          p_team_id: string
          p_user_id?: string
        }
        Returns: {
          deck_name: string
          losses: number
          total: number
          win_rate: number
          wins: number
        }[]
      }
      get_team_opponent_deck_detail_stats: {
        Args: {
          p_end_date?: string
          p_format?: string
          p_opponent_deck_name: string
          p_start_date?: string
          p_team_id: string
          p_user_id?: string
        }
        Returns: {
          first_losses: number
          first_total: number
          first_wins: number
          losses: number
          my_deck_name: string
          second_losses: number
          second_total: number
          second_wins: number
          total: number
          unknown_losses: number
          unknown_total: number
          unknown_wins: number
          wins: number
        }[]
      }
      get_team_opponent_deck_stats_range: {
        Args: {
          p_end_date?: string
          p_format?: string
          p_start_date?: string
          p_team_id: string
          p_user_id?: string
        }
        Returns: {
          deck_name: string
          losses: number
          total: number
          win_rate: number
          wins: number
        }[]
      }
      is_team_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      recalculate_opponent_decks: {
        Args: { p_format: string }
        Returns: undefined
      }
      run_daily_opponent_deck_batch: { Args: never; Returns: undefined }
      sync_team_membership: {
        Args: { p_discord_username: string; p_guilds: Json; p_user_id: string }
        Returns: undefined
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
