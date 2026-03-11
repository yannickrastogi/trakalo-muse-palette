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
      approvals: {
        Row: {
          changes: Json
          id: string
          requested_at: string
          requested_by: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["approval_status"]
          track_id: string
          workspace_id: string
        }
        Insert: {
          changes?: Json
          id?: string
          requested_at?: string
          requested_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          track_id: string
          workspace_id: string
        }
        Update: {
          changes?: Json
          id?: string
          requested_at?: string
          requested_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          track_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          favorite: boolean
          first_name: string
          id: string
          last_name: string | null
          notes: string | null
          phone: string | null
          role: string | null
          tags: string[] | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          favorite?: boolean
          first_name: string
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          role?: string | null
          tags?: string[] | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          favorite?: boolean
          first_name?: string
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          role?: string | null
          tags?: string[] | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      link_downloads: {
        Row: {
          downloaded_at: string
          downloader_email: string | null
          downloader_name: string | null
          id: string
          ip_address: unknown
          link_id: string
          organization: string | null
          role: string | null
          stems_downloaded: string[] | null
          track_name: string | null
          user_agent: string | null
        }
        Insert: {
          downloaded_at?: string
          downloader_email?: string | null
          downloader_name?: string | null
          id?: string
          ip_address?: unknown
          link_id: string
          organization?: string | null
          role?: string | null
          stems_downloaded?: string[] | null
          track_name?: string | null
          user_agent?: string | null
        }
        Update: {
          downloaded_at?: string
          downloader_email?: string | null
          downloader_name?: string | null
          id?: string
          ip_address?: unknown
          link_id?: string
          organization?: string | null
          role?: string | null
          stems_downloaded?: string[] | null
          track_name?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_downloads_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "shared_links"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          approval_id: string | null
          created_at: string
          id: string
          is_read: boolean
          link_id: string | null
          message: string | null
          pitch_id: string | null
          title: string
          track_id: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          approval_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link_id?: string | null
          message?: string | null
          pitch_id?: string | null
          title: string
          track_id?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
          workspace_id: string
        }
        Update: {
          approval_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link_id?: string | null
          message?: string | null
          pitch_id?: string | null
          title?: string
          track_id?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "shared_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_pitch_id_fkey"
            columns: ["pitch_id"]
            isOneToOne: false
            referencedRelation: "pitches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pitches: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          message: string | null
          opened_at: string | null
          recipient_company: string | null
          recipient_email: string | null
          recipient_name: string
          responded_at: string | null
          response_note: string | null
          sent_at: string | null
          sent_by: string | null
          share_link_id: string | null
          status: Database["public"]["Enums"]["pitch_status"]
          subject: string
          track_ids: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          opened_at?: string | null
          recipient_company?: string | null
          recipient_email?: string | null
          recipient_name: string
          responded_at?: string | null
          response_note?: string | null
          sent_at?: string | null
          sent_by?: string | null
          share_link_id?: string | null
          status?: Database["public"]["Enums"]["pitch_status"]
          subject: string
          track_ids?: string[]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          opened_at?: string | null
          recipient_company?: string | null
          recipient_email?: string | null
          recipient_name?: string
          responded_at?: string | null
          response_note?: string | null
          sent_at?: string | null
          sent_by?: string | null
          share_link_id?: string | null
          status?: Database["public"]["Enums"]["pitch_status"]
          subject?: string
          track_ids?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitches_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitches_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "shared_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_tracks: {
        Row: {
          added_at: string
          added_by: string | null
          id: string
          playlist_id: string
          position: number
          track_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          id?: string
          playlist_id: string
          position?: number
          track_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          id?: string
          playlist_id?: string
          position?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_tracks_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_public: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlists_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_links: {
        Row: {
          allow_download: boolean
          created_at: string
          created_by: string | null
          download_quality: string | null
          expires_at: string | null
          id: string
          link_name: string
          link_slug: string
          link_type: string
          message: string | null
          pack_items: Json | null
          password_hash: string | null
          playlist_id: string | null
          share_type: Database["public"]["Enums"]["share_type"]
          status: Database["public"]["Enums"]["link_status"]
          track_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          allow_download?: boolean
          created_at?: string
          created_by?: string | null
          download_quality?: string | null
          expires_at?: string | null
          id?: string
          link_name: string
          link_slug: string
          link_type?: string
          message?: string | null
          pack_items?: Json | null
          password_hash?: string | null
          playlist_id?: string | null
          share_type: Database["public"]["Enums"]["share_type"]
          status?: Database["public"]["Enums"]["link_status"]
          track_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          allow_download?: boolean
          created_at?: string
          created_by?: string | null
          download_quality?: string | null
          expires_at?: string | null
          id?: string
          link_name?: string
          link_slug?: string
          link_type?: string
          message?: string | null
          pack_items?: Json | null
          password_hash?: string | null
          playlist_id?: string | null
          share_type?: Database["public"]["Enums"]["share_type"]
          status?: Database["public"]["Enums"]["link_status"]
          track_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_links_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_links_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stems: {
        Row: {
          bit_depth: number | null
          created_at: string
          duration_sec: number | null
          file_name: string
          file_size_bytes: number | null
          file_url: string
          id: string
          sample_rate: number | null
          stem_type: Database["public"]["Enums"]["stem_type"]
          track_id: string
          uploaded_by: string | null
          workspace_id: string
        }
        Insert: {
          bit_depth?: number | null
          created_at?: string
          duration_sec?: number | null
          file_name: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          sample_rate?: number | null
          stem_type?: Database["public"]["Enums"]["stem_type"]
          track_id: string
          uploaded_by?: string | null
          workspace_id: string
        }
        Update: {
          bit_depth?: number | null
          created_at?: string
          duration_sec?: number | null
          file_name?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          sample_rate?: number | null
          stem_type?: Database["public"]["Enums"]["stem_type"]
          track_id?: string
          uploaded_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stems_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stems_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          artist: string
          audio_url: string | null
          bpm: number | null
          cover_url: string | null
          created_at: string
          duration_sec: number | null
          featuring: string | null
          gender: Database["public"]["Enums"]["track_gender"] | null
          genre: string | null
          id: string
          isrc: string | null
          iswc: string | null
          key: string | null
          labels: string[] | null
          language: string | null
          lyrics: string | null
          mood: string[] | null
          notes: string | null
          publishers: string[] | null
          released_at: string | null
          splits: Json | null
          status: Database["public"]["Enums"]["track_status"]
          title: string
          track_type: Database["public"]["Enums"]["track_type"]
          updated_at: string
          uploaded_by: string | null
          waveform_data: Json | null
          workspace_id: string
        }
        Insert: {
          artist: string
          audio_url?: string | null
          bpm?: number | null
          cover_url?: string | null
          created_at?: string
          duration_sec?: number | null
          featuring?: string | null
          gender?: Database["public"]["Enums"]["track_gender"] | null
          genre?: string | null
          id?: string
          isrc?: string | null
          iswc?: string | null
          key?: string | null
          labels?: string[] | null
          language?: string | null
          lyrics?: string | null
          mood?: string[] | null
          notes?: string | null
          publishers?: string[] | null
          released_at?: string | null
          splits?: Json | null
          status?: Database["public"]["Enums"]["track_status"]
          title: string
          track_type?: Database["public"]["Enums"]["track_type"]
          updated_at?: string
          uploaded_by?: string | null
          waveform_data?: Json | null
          workspace_id: string
        }
        Update: {
          artist?: string
          audio_url?: string | null
          bpm?: number | null
          cover_url?: string | null
          created_at?: string
          duration_sec?: number | null
          featuring?: string | null
          gender?: Database["public"]["Enums"]["track_gender"] | null
          genre?: string | null
          id?: string
          isrc?: string | null
          iswc?: string | null
          key?: string | null
          labels?: string[] | null
          language?: string | null
          lyrics?: string | null
          mood?: string[] | null
          notes?: string | null
          publishers?: string[] | null
          released_at?: string | null
          splits?: Json | null
          status?: Database["public"]["Enums"]["track_status"]
          title?: string
          track_type?: Database["public"]["Enums"]["track_type"]
          updated_at?: string
          uploaded_by?: string | null
          waveform_data?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          id: string
          joined_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          plan: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          plan?: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          plan?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_workspace_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      has_workspace_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "a_r"
        | "assistant"
        | "producer"
        | "songwriter"
        | "musician"
        | "mix_engineer"
        | "mastering_engineer"
        | "publisher"
        | "viewer"
      approval_status: "pending" | "approved" | "rejected"
      link_status: "active" | "expired" | "disabled"
      notification_type:
        | "pitch_opened"
        | "pitch_accepted"
        | "pitch_declined"
        | "track_uploaded"
        | "track_status_changed"
        | "link_opened"
        | "link_downloaded"
        | "approval_requested"
        | "approval_resolved"
        | "member_invited"
        | "member_joined"
        | "comment_added"
      pitch_status: "draft" | "sent" | "opened" | "declined" | "accepted"
      share_type: "stems" | "track" | "playlist" | "pack"
      stem_type:
        | "kick"
        | "snare"
        | "bass"
        | "guitar"
        | "vocal"
        | "synth"
        | "drums"
        | "background_vocal"
        | "fx"
        | "other"
      track_gender: "male" | "female" | "duet" | "n_a"
      track_status: "available" | "on_hold" | "released"
      track_type: "instrumental" | "sample" | "acapella" | "song"
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
      app_role: [
        "admin",
        "manager",
        "a_r",
        "assistant",
        "producer",
        "songwriter",
        "musician",
        "mix_engineer",
        "mastering_engineer",
        "publisher",
        "viewer",
      ],
      approval_status: ["pending", "approved", "rejected"],
      link_status: ["active", "expired", "disabled"],
      notification_type: [
        "pitch_opened",
        "pitch_accepted",
        "pitch_declined",
        "track_uploaded",
        "track_status_changed",
        "link_opened",
        "link_downloaded",
        "approval_requested",
        "approval_resolved",
        "member_invited",
        "member_joined",
        "comment_added",
      ],
      pitch_status: ["draft", "sent", "opened", "declined", "accepted"],
      share_type: ["stems", "track", "playlist", "pack"],
      stem_type: [
        "kick",
        "snare",
        "bass",
        "guitar",
        "vocal",
        "synth",
        "drums",
        "background_vocal",
        "fx",
        "other",
      ],
      track_gender: ["male", "female", "duet", "n_a"],
      track_status: ["available", "on_hold", "released"],
      track_type: ["instrumental", "sample", "acapella", "song"],
    },
  },
} as const
