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
      artist_aliases: {
        Row: {
          alias_name: string
          contact_ids: string[]
          created_at: string | null
          created_by: string | null
          id: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          alias_name: string
          contact_ids?: string[]
          created_at?: string | null
          created_by?: string | null
          id?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          alias_name?: string
          contact_ids?: string[]
          created_at?: string | null
          created_by?: string | null
          id?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_aliases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      beta_passes: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string | null
          granted_by: string | null
          id: string
          notes: string | null
          pass_type: string
          plan_granted: string
          redeemed_at: string | null
          redeemed_by: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          notes?: string | null
          pass_type: string
          plan_granted?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          notes?: string | null
          pass_type?: string
          plan_granted?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string | null
        }
        Relationships: []
      }
      catalog_shares: {
        Row: {
          access_level: string
          created_at: string | null
          id: string
          playlist_id: string | null
          revoked_at: string | null
          shared_by: string
          source_workspace_id: string
          status: string
          target_workspace_id: string
          track_id: string | null
        }
        Insert: {
          access_level?: string
          created_at?: string | null
          id?: string
          playlist_id?: string | null
          revoked_at?: string | null
          shared_by: string
          source_workspace_id: string
          status?: string
          target_workspace_id: string
          track_id?: string | null
        }
        Update: {
          access_level?: string
          created_at?: string | null
          id?: string
          playlist_id?: string | null
          revoked_at?: string | null
          shared_by?: string
          source_workspace_id?: string
          status?: string
          target_workspace_id?: string
          track_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_shares_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_shares_source_workspace_id_fkey"
            columns: ["source_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_shares_target_workspace_id_fkey"
            columns: ["target_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_shares_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          city: string | null
          company: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          favorite: boolean
          first_name: string
          id: string
          ipi: string | null
          last_name: string | null
          notes: string | null
          phone: string | null
          pro: string[] | null
          publisher: string | null
          role: string | null
          stage_name: string | null
          tags: string[] | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          favorite?: boolean
          first_name: string
          id?: string
          ipi?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          pro?: string[] | null
          publisher?: string | null
          role?: string | null
          stage_name?: string | null
          tags?: string[] | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          favorite?: boolean
          first_name?: string
          id?: string
          ipi?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          pro?: string[] | null
          publisher?: string | null
          role?: string | null
          stage_name?: string | null
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
      credit_purchases: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          price_cents: number
          status: string | null
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          price_cents: number
          status?: string | null
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          price_cents?: number
          status?: string | null
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          access_level: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          first_name: string | null
          id: string
          invited_by: string
          last_name: string | null
          professional_title: string | null
          role: string | null
          status: string | null
          token: string
          workspace_id: string
        }
        Insert: {
          access_level?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          first_name?: string | null
          id?: string
          invited_by: string
          last_name?: string | null
          professional_title?: string | null
          role?: string | null
          status?: string | null
          token: string
          workspace_id: string
        }
        Update: {
          access_level?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          first_name?: string | null
          id?: string
          invited_by?: string
          last_name?: string | null
          professional_title?: string | null
          role?: string | null
          status?: string | null
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leak_traces: {
        Row: {
          confidence: number | null
          created_at: string | null
          file_name: string
          hash_hex: string | null
          id: string
          ip_source: string | null
          leaker_ip: string | null
          link_id: string | null
          match: boolean | null
          raw_payload: string | null
          user_id: string
          visitor_email: string | null
          visitor_name: string | null
          workspace_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          file_name: string
          hash_hex?: string | null
          id?: string
          ip_source?: string | null
          leaker_ip?: string | null
          link_id?: string | null
          match?: boolean | null
          raw_payload?: string | null
          user_id: string
          visitor_email?: string | null
          visitor_name?: string | null
          workspace_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          file_name?: string
          hash_hex?: string | null
          id?: string
          ip_source?: string | null
          leaker_ip?: string | null
          link_id?: string | null
          match?: boolean | null
          raw_payload?: string | null
          user_id?: string
          visitor_email?: string | null
          visitor_name?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leak_traces_workspace_id_fkey"
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
          visitor_ip: string | null
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
          visitor_ip?: string | null
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
          visitor_ip?: string | null
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
      link_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          link_id: string | null
          track_id: string | null
          visitor_email: string | null
          visitor_ip: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          link_id?: string | null
          track_id?: string | null
          visitor_email?: string | null
          visitor_ip?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          link_id?: string | null
          track_id?: string | null
          visitor_email?: string | null
          visitor_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_events_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "shared_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_events_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_requests: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          owner_workspace_id: string
          requester_company: string | null
          requester_email: string | null
          requester_name: string | null
          requester_user_id: string
          requester_workspace_id: string | null
          resolved_at: string | null
          status: string
          track_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          owner_workspace_id: string
          requester_company?: string | null
          requester_email?: string | null
          requester_name?: string | null
          requester_user_id: string
          requester_workspace_id?: string | null
          resolved_at?: string | null
          status?: string
          track_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          owner_workspace_id?: string
          requester_company?: string | null
          requester_email?: string | null
          requester_name?: string | null
          requester_user_id?: string
          requester_workspace_id?: string | null
          resolved_at?: string | null
          status?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_requests_owner_workspace_id_fkey"
            columns: ["owner_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_requests_requester_workspace_id_fkey"
            columns: ["requester_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_requests_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          comments: boolean | null
          link_activity: boolean | null
          new_member_joined: boolean | null
          signatures: boolean | null
          track_uploads: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comments?: boolean | null
          link_activity?: boolean | null
          new_member_joined?: boolean | null
          signatures?: boolean | null
          track_uploads?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comments?: boolean | null
          link_activity?: boolean | null
          new_member_joined?: boolean | null
          signatures?: boolean | null
          track_uploads?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      profiles: {
        Row: {
          avatar_url: string | null
          email: string | null
          full_name: string | null
          id: string
          onboarding_complete: boolean
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          onboarding_complete?: boolean
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_complete?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          id: string
          key: string
          request_count: number
          window_start: string
        }
        Insert: {
          id?: string
          key: string
          request_count?: number
          window_start?: string
        }
        Update: {
          id?: string
          key?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      shared_links: {
        Row: {
          allow_download: boolean
          allow_save: boolean
          created_at: string
          created_by: string | null
          download_quality: string | null
          expires_at: string | null
          gate_screen_enabled: boolean
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
          watermarking_enabled: boolean
          workspace_id: string
        }
        Insert: {
          allow_download?: boolean
          allow_save?: boolean
          created_at?: string
          created_by?: string | null
          download_quality?: string | null
          expires_at?: string | null
          gate_screen_enabled?: boolean
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
          watermarking_enabled?: boolean
          workspace_id: string
        }
        Update: {
          allow_download?: boolean
          allow_save?: boolean
          created_at?: string
          created_by?: string | null
          download_quality?: string | null
          expires_at?: string | null
          gate_screen_enabled?: boolean
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
          watermarking_enabled?: boolean
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
      signature_requests: {
        Row: {
          collaborator_email: string
          collaborator_name: string
          created_at: string
          id: string
          ipi: string | null
          pro: string | null
          publisher: string | null
          role: string
          signature_data: string | null
          signed_at: string | null
          signed_externally: boolean
          split_share: number
          status: string
          token: string
          track_id: string
        }
        Insert: {
          collaborator_email: string
          collaborator_name: string
          created_at?: string
          id?: string
          ipi?: string | null
          pro?: string | null
          publisher?: string | null
          role?: string
          signature_data?: string | null
          signed_at?: string | null
          signed_externally?: boolean
          split_share?: number
          status?: string
          token: string
          track_id: string
        }
        Update: {
          collaborator_email?: string
          collaborator_name?: string
          created_at?: string
          id?: string
          ipi?: string | null
          pro?: string | null
          publisher?: string | null
          role?: string
          signature_data?: string | null
          signed_at?: string | null
          signed_externally?: boolean
          split_share?: number
          status?: string
          token?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_requests_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visits: {
        Row: {
          created_at: string
          id: string
          path: string
          referrer: string | null
          referrer_domain: string | null
          session_id: string | null
          source: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path?: string
          referrer?: string | null
          referrer_domain?: string | null
          session_id?: string | null
          source?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          referrer?: string | null
          referrer_domain?: string | null
          session_id?: string | null
          source?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Relationships: []
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
      studio_submissions: {
        Row: {
          artist_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          ipi_number: string | null
          justification: string | null
          pro_name: string | null
          proposed_split: number
          publisher_name: string | null
          roles: string[] | null
          status: string
          track_id: string
        }
        Insert: {
          artist_name?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          ipi_number?: string | null
          justification?: string | null
          pro_name?: string | null
          proposed_split?: number
          publisher_name?: string | null
          roles?: string[] | null
          status?: string
          track_id: string
        }
        Update: {
          artist_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          ipi_number?: string | null
          justification?: string | null
          pro_name?: string | null
          proposed_split?: number
          publisher_name?: string | null
          roles?: string[] | null
          status?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_submissions_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          ai_credits_monthly_used: number | null
          ai_credits_purchased: number | null
          ai_credits_reset_at: string | null
          beta_pass_id: string | null
          billing_cycle: string | null
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          pitches_sent_this_month: number | null
          plan: string
          smart_ar_queries_this_month: number | null
          storage_bytes_used: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          tracks_uploaded_count: number | null
          trial_ends_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_credits_monthly_used?: number | null
          ai_credits_purchased?: number | null
          ai_credits_reset_at?: string | null
          beta_pass_id?: string | null
          billing_cycle?: string | null
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          pitches_sent_this_month?: number | null
          plan?: string
          smart_ar_queries_this_month?: number | null
          storage_bytes_used?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tracks_uploaded_count?: number | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_credits_monthly_used?: number | null
          ai_credits_purchased?: number | null
          ai_credits_reset_at?: string | null
          beta_pass_id?: string | null
          billing_cycle?: string | null
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          pitches_sent_this_month?: number | null
          plan?: string
          smart_ar_queries_this_month?: number | null
          storage_bytes_used?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tracks_uploaded_count?: number | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_beta_pass_id_fkey"
            columns: ["beta_pass_id"]
            isOneToOne: false
            referencedRelation: "beta_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      track_comments: {
        Row: {
          author_email: string | null
          author_name: string
          author_type: string
          content: string
          created_at: string
          id: string
          is_edited: boolean
          shared_link_id: string | null
          timestamp_sec: number
          track_id: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          author_email?: string | null
          author_name: string
          author_type?: string
          content: string
          created_at?: string
          id?: string
          is_edited?: boolean
          shared_link_id?: string | null
          timestamp_sec?: number
          track_id: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          author_email?: string | null
          author_name?: string
          author_type?: string
          content?: string
          created_at?: string
          id?: string
          is_edited?: boolean
          shared_link_id?: string | null
          timestamp_sec?: number
          track_id?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "track_comments_shared_link_id_fkey"
            columns: ["shared_link_id"]
            isOneToOne: false
            referencedRelation: "shared_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_comments_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_comments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      track_documents: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          name: string
          status: Database["public"]["Enums"]["document_status"]
          track_id: string
          updated_at: string | null
          uploaded_by: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type?: string
          name: string
          status?: Database["public"]["Enums"]["document_status"]
          track_id: string
          updated_at?: string | null
          uploaded_by: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          name?: string
          status?: Database["public"]["Enums"]["document_status"]
          track_id?: string
          updated_at?: string | null
          uploaded_by?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_documents_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      track_ratings: {
        Row: {
          created_at: string | null
          id: string
          rating: number
          track_id: string
          updated_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          rating: number
          track_id: string
          updated_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          rating?: number
          track_id?: string
          updated_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_ratings_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_ratings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      track_versions: {
        Row: {
          audio_preview_url: string | null
          audio_url: string | null
          chapters: Json | null
          created_at: string | null
          created_by: string | null
          duration_sec: number | null
          id: string
          is_active: boolean | null
          notes: string | null
          sonic_dna: Json | null
          track_id: string
          version_name: string
          version_number: number
          waveform_data: Json | null
        }
        Insert: {
          audio_preview_url?: string | null
          audio_url?: string | null
          chapters?: Json | null
          created_at?: string | null
          created_by?: string | null
          duration_sec?: number | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          sonic_dna?: Json | null
          track_id: string
          version_name?: string
          version_number?: number
          waveform_data?: Json | null
        }
        Update: {
          audio_preview_url?: string | null
          audio_url?: string | null
          chapters?: Json | null
          created_at?: string | null
          created_by?: string | null
          duration_sec?: number | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          sonic_dna?: Json | null
          track_id?: string
          version_name?: string
          version_number?: number
          waveform_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "track_versions_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          album: string | null
          artist: string
          audio_preview_url: string | null
          audio_url: string | null
          bpm: number | null
          chapters: Json | null
          copyright: string | null
          cover_url: string | null
          created_at: string
          credits: Json | null
          duration_sec: number | null
          explicit: boolean | null
          featuring: string | null
          file_size_bytes: number | null
          gender: Database["public"]["Enums"]["track_gender"] | null
          genre: string[] | null
          has_versions: boolean | null
          id: string
          is_marketplace_public: boolean
          isrc: string | null
          iswc: string | null
          key: string | null
          labels: string[] | null
          language: string | null
          lyrics: string | null
          lyrics_segments: Json | null
          marketplace_published_at: string | null
          mood: string[] | null
          notes: string | null
          production_stage: string | null
          publishers: string[] | null
          qr_token: string | null
          released_at: string | null
          sonic_dna: Json | null
          splits: Json | null
          status: Database["public"]["Enums"]["track_status"]
          tags: Json | null
          title: string
          track_type: Database["public"]["Enums"]["track_type"]
          upc: string | null
          updated_at: string
          uploaded_by: string | null
          version_count: number | null
          video_filename: string | null
          video_url: string | null
          video_visible_on_share: boolean | null
          waveform_data: Json | null
          workspace_id: string
        }
        Insert: {
          album?: string | null
          artist: string
          audio_preview_url?: string | null
          audio_url?: string | null
          bpm?: number | null
          chapters?: Json | null
          copyright?: string | null
          cover_url?: string | null
          created_at?: string
          credits?: Json | null
          duration_sec?: number | null
          explicit?: boolean | null
          featuring?: string | null
          file_size_bytes?: number | null
          gender?: Database["public"]["Enums"]["track_gender"] | null
          genre?: string[] | null
          has_versions?: boolean | null
          id?: string
          is_marketplace_public?: boolean
          isrc?: string | null
          iswc?: string | null
          key?: string | null
          labels?: string[] | null
          language?: string | null
          lyrics?: string | null
          lyrics_segments?: Json | null
          marketplace_published_at?: string | null
          mood?: string[] | null
          notes?: string | null
          production_stage?: string | null
          publishers?: string[] | null
          qr_token?: string | null
          released_at?: string | null
          sonic_dna?: Json | null
          splits?: Json | null
          status?: Database["public"]["Enums"]["track_status"]
          tags?: Json | null
          title: string
          track_type?: Database["public"]["Enums"]["track_type"]
          upc?: string | null
          updated_at?: string
          uploaded_by?: string | null
          version_count?: number | null
          video_filename?: string | null
          video_url?: string | null
          video_visible_on_share?: boolean | null
          waveform_data?: Json | null
          workspace_id: string
        }
        Update: {
          album?: string | null
          artist?: string
          audio_preview_url?: string | null
          audio_url?: string | null
          bpm?: number | null
          chapters?: Json | null
          copyright?: string | null
          cover_url?: string | null
          created_at?: string
          credits?: Json | null
          duration_sec?: number | null
          explicit?: boolean | null
          featuring?: string | null
          file_size_bytes?: number | null
          gender?: Database["public"]["Enums"]["track_gender"] | null
          genre?: string[] | null
          has_versions?: boolean | null
          id?: string
          is_marketplace_public?: boolean
          isrc?: string | null
          iswc?: string | null
          key?: string | null
          labels?: string[] | null
          language?: string | null
          lyrics?: string | null
          lyrics_segments?: Json | null
          marketplace_published_at?: string | null
          mood?: string[] | null
          notes?: string | null
          production_stage?: string | null
          publishers?: string[] | null
          qr_token?: string | null
          released_at?: string | null
          sonic_dna?: Json | null
          splits?: Json | null
          status?: Database["public"]["Enums"]["track_status"]
          tags?: Json | null
          title?: string
          track_type?: Database["public"]["Enums"]["track_type"]
          upc?: string | null
          updated_at?: string
          uploaded_by?: string | null
          version_count?: number | null
          video_filename?: string | null
          video_url?: string | null
          video_visible_on_share?: boolean | null
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
      waitlist: {
        Row: {
          created_at: string | null
          email: string
          id: string
          invitation_sent_by: string | null
          invited_at: string | null
          name: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          invitation_sent_by?: string | null
          invited_at?: string | null
          name?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          invitation_sent_by?: string | null
          invited_at?: string | null
          name?: string | null
        }
        Relationships: []
      }
      watermark_payloads: {
        Row: {
          created_at: string | null
          hash_hex: string
          link_id: string | null
          raw_payload: string
          visitor_email: string | null
          visitor_name: string | null
        }
        Insert: {
          created_at?: string | null
          hash_hex: string
          link_id?: string | null
          raw_payload: string
          visitor_email?: string | null
          visitor_name?: string | null
        }
        Update: {
          created_at?: string | null
          hash_hex?: string
          link_id?: string | null
          raw_payload?: string
          visitor_email?: string | null
          visitor_name?: string | null
        }
        Relationships: []
      }
      whitelisted_emails: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          access_level: string
          id: string
          joined_at: string
          professional_title: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          access_level?: string
          id?: string
          joined_at?: string
          professional_title?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          access_level?: string
          id?: string
          joined_at?: string
          professional_title?: string | null
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
          bio: string | null
          brand_color: string | null
          created_at: string
          epk_url: string | null
          hero_focal_point: string | null
          hero_image_url: string | null
          hero_position: number | null
          id: string
          is_personal: boolean | null
          logo_url: string | null
          name: string
          owner_id: string
          plan: string
          settings: Json
          slug: string
          social_apple: string | null
          social_facebook: string | null
          social_instagram: string | null
          social_spotify: string | null
          social_tiktok: string | null
          social_website: string | null
          social_x: string | null
          social_youtube: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          brand_color?: string | null
          created_at?: string
          epk_url?: string | null
          hero_focal_point?: string | null
          hero_image_url?: string | null
          hero_position?: number | null
          id?: string
          is_personal?: boolean | null
          logo_url?: string | null
          name: string
          owner_id: string
          plan?: string
          settings?: Json
          slug: string
          social_apple?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_spotify?: string | null
          social_tiktok?: string | null
          social_website?: string | null
          social_x?: string | null
          social_youtube?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          brand_color?: string | null
          created_at?: string
          epk_url?: string | null
          hero_focal_point?: string | null
          hero_image_url?: string | null
          hero_position?: number | null
          id?: string
          is_personal?: boolean | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          plan?: string
          settings?: Json
          slug?: string
          social_apple?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_spotify?: string | null
          social_tiktok?: string | null
          social_website?: string | null
          social_x?: string | null
          social_youtube?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_contact_manual: {
        Args: {
          _city?: string
          _company?: string
          _country?: string
          _email?: string
          _first_name: string
          _ipi?: string
          _last_name?: string
          _phone?: string
          _pro?: string[]
          _publisher?: string
          _role?: string
          _stage_name?: string
          _user_id: string
          _workspace_id: string
        }
        Returns: string
      }
      add_contact_manual_legacy_v0: {
        Args: {
          _city?: string
          _company?: string
          _country?: string
          _email?: string
          _first_name: string
          _ipi?: string
          _last_name?: string
          _phone?: string
          _pro?: string[]
          _publisher?: string
          _role?: string
          _stage_name?: string
          _user_id: string
          _workspace_id: string
        }
        Returns: string
      }
      add_playlist_tracks: {
        Args: { _playlist_id: string; _track_ids: string[]; _user_id: string }
        Returns: undefined
      }
      add_playlist_tracks_legacy_v0: {
        Args: { _playlist_id: string; _track_ids: string[]; _user_id: string }
        Returns: undefined
      }
      add_to_whitelist: {
        Args: { _email: string; _user_id: string }
        Returns: undefined
      }
      add_track_comment: {
        Args: {
          _author_email: string
          _author_name: string
          _author_type: string
          _content: string
          _timestamp_sec: number
          _track_id: string
          _workspace_id?: string
        }
        Returns: string
      }
      add_track_comment_legacy_v0: {
        Args: {
          _content: string
          _shared_link_id?: string
          _timecode?: number
          _track_id: string
          _user_id: string
          _visitor_email?: string
          _visitor_name?: string
        }
        Returns: string
      }
      add_track_version: {
        Args: {
          _audio_preview_url: string
          _audio_url: string
          _duration_sec: number
          _notes: string
          _sonic_dna: Json
          _track_id: string
          _user_id: string
          _version_name: string
          _waveform_data: Json
          _workspace_id: string
        }
        Returns: string
      }
      assert_caller: { Args: { _user_id: string }; Returns: undefined }
      bulk_update_tracks: {
        Args: { _track_ids: string[]; _updates: Json; _user_id: string }
        Returns: number
      }
      check_rate_limit: {
        Args: { _key: string; _max_requests: number; _window_seconds: number }
        Returns: boolean
      }
      check_upload_allowed: {
        Args: { _file_size_bytes: number }
        Returns: Json
      }
      clean_revoked_playlist_tracks: {
        Args: {
          _source_workspace_id: string
          _target_workspace_id: string
          _track_id?: string
        }
        Returns: undefined
      }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      create_notification: {
        Args: {
          _actor_user_id: string
          _approval_id?: string
          _link_id?: string
          _message?: string
          _pitch_id?: string
          _target_user_id: string
          _title: string
          _track_id?: string
          _type: string
          _workspace_id: string
        }
        Returns: string
      }
      create_pitch: {
        Args: {
          _message?: string
          _recipient_company?: string
          _recipient_email?: string
          _recipient_name: string
          _sent_at?: string
          _status?: string
          _subject?: string
          _track_ids?: string[]
          _user_id: string
          _workspace_id: string
        }
        Returns: string
      }
      create_pitch_legacy_v0: {
        Args: {
          _message?: string
          _recipient_company?: string
          _recipient_email?: string
          _recipient_name: string
          _sent_at?: string
          _status?: string
          _subject?: string
          _track_ids?: string[]
          _user_id: string
          _workspace_id: string
        }
        Returns: string
      }
      create_playlist: {
        Args: {
          _cover_url?: string
          _description?: string
          _name: string
          _user_id: string
          _workspace_id: string
        }
        Returns: string
      }
      create_playlist_legacy_v0: {
        Args: {
          _cover_url?: string
          _description?: string
          _name: string
          _user_id: string
          _workspace_id: string
        }
        Returns: string
      }
      create_shared_link: {
        Args: {
          _allow_download?: boolean
          _allow_save?: boolean
          _download_quality?: string
          _expires_at?: string
          _gate_screen_enabled?: boolean
          _link_name?: string
          _link_slug?: string
          _link_type?: string
          _message?: string
          _pack_items?: string
          _password_hash?: string
          _playlist_id?: string
          _share_type: string
          _track_id?: string
          _user_id: string
          _watermarking_enabled?: boolean
          _workspace_id: string
        }
        Returns: Json
      }
      create_shared_link_legacy_v0: {
        Args: {
          _allow_download?: boolean
          _allow_save?: boolean
          _download_quality?: string
          _expires_at?: string
          _gate_screen_enabled?: boolean
          _link_name?: string
          _link_slug?: string
          _link_type?: string
          _message?: string
          _pack_items?: string
          _password_hash?: string
          _playlist_id?: string
          _share_type: string
          _track_id?: string
          _user_id: string
          _watermarking_enabled?: boolean
          _workspace_id: string
        }
        Returns: Json
      }
      create_workspace_with_member: {
        Args: { _description?: string; _name: string; _user_id?: string }
        Returns: string
      }
      delete_artist_alias: {
        Args: { _alias_id: string; _user_id: string; _workspace_id: string }
        Returns: undefined
      }
      delete_contact: {
        Args: { _contact_id: string; _user_id: string }
        Returns: undefined
      }
      delete_contacts: {
        Args: { _ids: string[]; _user_id: string; _workspace_id: string }
        Returns: undefined
      }
      delete_leak_trace: {
        Args: { _trace_id: string; _user_id: string }
        Returns: boolean
      }
      delete_playlist: {
        Args: { _playlist_id: string; _user_id: string }
        Returns: undefined
      }
      delete_playlist_legacy_v0: {
        Args: { _playlist_id: string; _user_id: string }
        Returns: undefined
      }
      delete_stem: {
        Args: { _stem_id: string; _user_id: string }
        Returns: undefined
      }
      delete_stem_legacy_v0: {
        Args: { _stem_id: string; _user_id: string }
        Returns: undefined
      }
      delete_track: {
        Args: { _track_id: string; _user_id: string }
        Returns: undefined
      }
      delete_track_comment: {
        Args: { _comment_id: string; _user_id: string }
        Returns: undefined
      }
      delete_track_comment_via_token: {
        Args: { _comment_id: string; _shared_link_token: string }
        Returns: undefined
      }
      delete_track_document: {
        Args: { _doc_id: string; _user_id: string }
        Returns: undefined
      }
      delete_track_document_legacy_v0: {
        Args: { _doc_id: string; _user_id: string }
        Returns: undefined
      }
      delete_track_legacy_v0: {
        Args: { _track_id: string; _user_id: string }
        Returns: undefined
      }
      delete_track_version: {
        Args: {
          _track_id: string
          _user_id: string
          _version_id: string
          _workspace_id: string
        }
        Returns: undefined
      }
      delete_track_video: {
        Args: { _track_id: string; _user_id: string; _workspace_id: string }
        Returns: undefined
      }
      delete_workspace: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: undefined
      }
      edit_track_comment: {
        Args: { _comment_id: string; _new_content: string; _user_id: string }
        Returns: undefined
      }
      get_admin_overview: { Args: { _user_id: string }; Returns: Json }
      get_artist_aliases: {
        Args: { _workspace_id: string }
        Returns: {
          alias_name: string
          contact_ids: string[]
          created_at: string
          created_by: string
          id: string
          updated_at: string
          workspace_id: string
        }[]
      }
      get_contacts_engagement: {
        Args: { _workspace_id: string }
        Returns: {
          contact_id: string
          email: string
          last_interaction: string
          total_downloads: number
          total_plays: number
          tracks_engaged: number
        }[]
      }
      get_my_subscription: { Args: never; Returns: Json }
      get_playlist_tracks_for_shared_link: {
        Args: { _slug: string }
        Returns: {
          artist: string
          audio_url: string
          bpm: number
          chapters: Json
          cover_url: string
          credits: Json
          duration_sec: number
          featuring: string
          genre: string[]
          id: string
          key: string
          lyrics: string
          lyrics_segments: Json
          mood: string[]
          position: number
          splits: Json
          title: string
          video_url: string
          video_visible_on_share: boolean
          waveform_data: Json
        }[]
      }
      get_shared_link_by_id: {
        Args: { _link_id: string }
        Returns: {
          allow_download: boolean
          allow_save: boolean
          created_at: string
          download_quality: string
          expires_at: string
          gate_screen_enabled: boolean
          has_password: boolean
          id: string
          link_name: string
          link_slug: string
          link_type: string
          message: string
          pack_items: Json
          playlist_id: string
          share_type: string
          status: string
          track_id: string
          watermarking_enabled: boolean
          workspace_id: string
        }[]
      }
      get_shared_link_by_slug: {
        Args: { _slug: string }
        Returns: {
          allow_download: boolean
          allow_save: boolean
          created_at: string
          download_quality: string
          expires_at: string
          gate_screen_enabled: boolean
          has_password: boolean
          id: string
          link_name: string
          link_slug: string
          link_type: string
          message: string
          pack_items: Json
          playlist_id: string
          share_type: string
          status: string
          track_id: string
          watermarking_enabled: boolean
          workspace_id: string
        }[]
      }
      get_shared_playlist_tracks: {
        Args: { _playlist_id: string; _target_workspace_id: string }
        Returns: {
          album: string | null
          artist: string
          audio_preview_url: string | null
          audio_url: string | null
          bpm: number | null
          chapters: Json | null
          copyright: string | null
          cover_url: string | null
          created_at: string
          credits: Json | null
          duration_sec: number | null
          explicit: boolean | null
          featuring: string | null
          file_size_bytes: number | null
          gender: Database["public"]["Enums"]["track_gender"] | null
          genre: string[] | null
          has_versions: boolean | null
          id: string
          is_marketplace_public: boolean
          isrc: string | null
          iswc: string | null
          key: string | null
          labels: string[] | null
          language: string | null
          lyrics: string | null
          lyrics_segments: Json | null
          marketplace_published_at: string | null
          mood: string[] | null
          notes: string | null
          production_stage: string | null
          publishers: string[] | null
          qr_token: string | null
          released_at: string | null
          sonic_dna: Json | null
          splits: Json | null
          status: Database["public"]["Enums"]["track_status"]
          tags: Json | null
          title: string
          track_type: Database["public"]["Enums"]["track_type"]
          upc: string | null
          updated_at: string
          uploaded_by: string | null
          version_count: number | null
          video_filename: string | null
          video_url: string | null
          video_visible_on_share: boolean | null
          waveform_data: Json | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tracks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_shared_workspace_playlists: {
        Args: { _workspace_id: string }
        Returns: {
          access_level: string
          created_at: string
          direction: string
          playlist_id: string
          playlist_name: string
          share_id: string
          source_workspace_id: string
          source_workspace_name: string
          status: string
          target_workspace_id: string
          target_workspace_name: string
          track_count: number
        }[]
      }
      get_shared_workspace_tracks: {
        Args: { _source_workspace_id: string; _target_workspace_id: string }
        Returns: {
          album: string | null
          artist: string
          audio_preview_url: string | null
          audio_url: string | null
          bpm: number | null
          chapters: Json | null
          copyright: string | null
          cover_url: string | null
          created_at: string
          credits: Json | null
          duration_sec: number | null
          explicit: boolean | null
          featuring: string | null
          file_size_bytes: number | null
          gender: Database["public"]["Enums"]["track_gender"] | null
          genre: string[] | null
          has_versions: boolean | null
          id: string
          is_marketplace_public: boolean
          isrc: string | null
          iswc: string | null
          key: string | null
          labels: string[] | null
          language: string | null
          lyrics: string | null
          lyrics_segments: Json | null
          marketplace_published_at: string | null
          mood: string[] | null
          notes: string | null
          production_stage: string | null
          publishers: string[] | null
          qr_token: string | null
          released_at: string | null
          sonic_dna: Json | null
          splits: Json | null
          status: Database["public"]["Enums"]["track_status"]
          tags: Json | null
          title: string
          track_type: Database["public"]["Enums"]["track_type"]
          upc: string | null
          updated_at: string
          uploaded_by: string | null
          version_count: number | null
          video_filename: string | null
          video_url: string | null
          video_visible_on_share: boolean | null
          waveform_data: Json | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tracks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_signature_agreement_by_token: {
        Args: { _token: string }
        Returns: Json
      }
      get_track_by_qr_token: {
        Args: { _qr_token: string }
        Returns: {
          artist: string
          cover_url: string
          id: string
          title: string
          workspace_id: string
        }[]
      }
      get_track_comments: {
        Args: { _track_id: string; _workspace_id?: string }
        Returns: {
          author_email: string | null
          author_name: string
          author_type: string
          content: string
          created_at: string
          id: string
          is_edited: boolean
          shared_link_id: string | null
          timestamp_sec: number
          track_id: string
          updated_at: string | null
          workspace_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "track_comments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_track_for_shared_link: {
        Args: { _slug: string }
        Returns: {
          album: string
          artist: string
          audio_url: string
          bpm: number
          chapters: Json
          copyright: string
          cover_url: string
          credits: Json
          duration_sec: number
          explicit: boolean
          featuring: string
          gender: string
          genre: string[]
          id: string
          isrc: string
          key: string
          labels: string[]
          language: string
          lyrics: string
          lyrics_segments: Json
          mood: string[]
          publishers: string[]
          released_at: string
          sonic_dna: Json
          splits: Json
          title: string
          total_shares: number
          video_url: string
          video_visible_on_share: boolean
          waveform_data: Json
        }[]
      }
      get_track_rating_stats: {
        Args: { _track_id: string; _user_id: string; _workspace_id: string }
        Returns: Json
      }
      get_user_workspaces: {
        Args: { _user_id: string }
        Returns: {
          bio: string
          brand_color: string
          created_at: string
          epk_url: string
          hero_focal_point: string
          hero_image_url: string
          hero_position: number
          id: string
          is_personal: boolean
          logo_url: string
          name: string
          owner_id: string
          plan: string
          settings: Json
          slug: string
          social_apple: string
          social_facebook: string
          social_instagram: string
          social_spotify: string
          social_tiktok: string
          social_website: string
          social_x: string
          social_youtube: string
        }[]
      }
      get_visit_stats: {
        Args: { _days?: number; _user_id: string }
        Returns: Json
      }
      get_waitlist_signups_30d: { Args: { _user_id: string }; Returns: Json }
      get_workspace_branding_for_shared_link: {
        Args: { _slug: string }
        Returns: {
          bio: string
          brand_color: string
          epk_url: string
          hero_focal_point: string
          hero_image_url: string
          hero_position: number
          logo_url: string
          name: string
          slug: string
          social_apple: string
          social_facebook: string
          social_instagram: string
          social_spotify: string
          social_tiktok: string
          social_website: string
          social_x: string
          social_youtube: string
        }[]
      }
      get_workspace_catalog_shares: {
        Args: { _workspace_id: string }
        Returns: {
          access_level: string
          created_at: string
          id: string
          source_workspace_id: string
          source_workspace_name: string
          status: string
          target_workspace_id: string
          track_id: string
        }[]
      }
      get_workspace_epk_by_slug: {
        Args: { _workspace_slug: string }
        Returns: string
      }
      has_any_workspace_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      has_workspace_access_level: {
        Args: { _min_level: string; _user_id: string; _workspace_id: string }
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
      insert_approval: {
        Args: {
          _send_type: string
          _team_id: string
          _track_id: string
          _user_id: string
          _workspace_id: string
        }
        Returns: string
      }
      insert_approval_legacy_v0: {
        Args: {
          _send_type: string
          _team_id?: string
          _track_id: string
          _user_id: string
          _workspace_id: string
        }
        Returns: string
      }
      insert_catalog_share: {
        Args: {
          _access_level: string
          _source_workspace_id: string
          _target_workspace_id: string
          _track_id: string
          _user_id: string
        }
        Returns: string
      }
      insert_catalog_share_legacy_v0: {
        Args: {
          _access_level?: string
          _source_workspace_id: string
          _target_workspace_id: string
          _track_id: string
          _user_id: string
        }
        Returns: string
      }
      insert_stem: {
        Args: {
          _file_size: number
          _file_url: string
          _name: string
          _stem_type: string
          _track_id: string
          _user_id: string
        }
        Returns: string
      }
      insert_track: {
        Args: {
          _artist?: string
          _audio_preview_url?: string
          _audio_url?: string
          _bpm?: number
          _cover_art_url?: string
          _duration_sec?: number
          _featuring?: string
          _gender?: string
          _genre?: string[]
          _isrc?: string
          _key?: string
          _labels?: string[]
          _language?: string
          _lyrics?: string
          _mood?: string[]
          _notes?: string
          _publishers?: string[]
          _released_at?: string
          _splits?: Json
          _status?: string
          _title: string
          _type?: string
          _user_id: string
          _waveform_data?: Json
          _workspace_id: string
        }
        Returns: string
      }
      insert_track_document: {
        Args: {
          _doc_type?: string
          _file_name?: string
          _file_path: string
          _file_size?: number
          _mime_type?: string
          _name: string
          _track_id: string
          _user_id: string
        }
        Returns: string
      }
      insert_track_document_legacy_v0: {
        Args: {
          _doc_type?: string
          _file_name?: string
          _file_path: string
          _file_size?: number
          _mime_type?: string
          _name: string
          _track_id: string
          _user_id: string
        }
        Returns: string
      }
      is_email_whitelisted: { Args: { _email: string }; Returns: boolean }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      list_all_contacts: {
        Args: {
          _limit?: number
          _offset?: number
          _search?: string
          _user_id: string
        }
        Returns: Json
      }
      list_all_users: {
        Args: {
          _limit?: number
          _offset?: number
          _search?: string
          _user_id: string
        }
        Returns: Json
      }
      list_waitlist_signups: {
        Args: {
          _limit?: number
          _offset?: number
          _search?: string
          _user_id: string
        }
        Returns: Json
      }
      log_audit_event: {
        Args: {
          _action: string
          _metadata: Json
          _resource_id: string
          _resource_type: string
          _user_id: string
        }
        Returns: undefined
      }
      log_site_visit: {
        Args: {
          _path?: string
          _referrer?: string
          _session_id?: string
          _utm_campaign?: string
          _utm_medium?: string
          _utm_source?: string
          _visitor_id?: string
        }
        Returns: undefined
      }
      mark_onboarding_complete: {
        Args: { _user_id: string }
        Returns: undefined
      }
      mark_splits_signed_externally: {
        Args: { _track_id: string; _user_id: string }
        Returns: number
      }
      mark_waitlist_invited: {
        Args: { _email: string; _user_id: string }
        Returns: undefined
      }
      mark_workspace_personal: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: undefined
      }
      remove_track_from_trakalog: {
        Args: { _track_id: string; _user_id: string }
        Returns: undefined
      }
      remove_track_from_trakalog_legacy_v0: {
        Args: { _track_id: string; _user_id: string }
        Returns: undefined
      }
      remove_workspace_member: {
        Args: {
          _member_user_id: string
          _user_id: string
          _workspace_id: string
        }
        Returns: undefined
      }
      replace_playlist_tracks: {
        Args: { _playlist_id: string; _track_ids: string[]; _user_id: string }
        Returns: undefined
      }
      replace_playlist_tracks_legacy_v0: {
        Args: { _playlist_id: string; _track_ids: string[]; _user_id: string }
        Returns: undefined
      }
      request_track_access: {
        Args: {
          _message?: string
          _requester_company?: string
          _requester_email?: string
          _requester_name?: string
          _track_id: string
          _user_id: string
          _workspace_id: string
        }
        Returns: string
      }
      require_workspace_access_level: {
        Args: { _min_level: string; _user_id: string; _workspace_id: string }
        Returns: undefined
      }
      revoke_catalog_share: {
        Args: { _share_id: string; _user_id: string }
        Returns: undefined
      }
      revoke_catalog_share_legacy_v0: {
        Args: { _share_id: string; _user_id: string }
        Returns: undefined
      }
      save_track_to_trakalog: {
        Args: {
          _source_workspace_id: string
          _target_workspace_id: string
          _track_id: string
          _user_id: string
        }
        Returns: string
      }
      save_track_to_trakalog_legacy_v0: {
        Args: {
          _source_workspace_id: string
          _target_workspace_id: string
          _track_id: string
          _user_id: string
        }
        Returns: string
      }
      search_marketplace_tracks: {
        Args: {
          _bpm_max?: number
          _bpm_min?: number
          _genre?: string[]
          _key?: string
          _limit?: number
          _mood?: string[]
          _offset?: number
          _q?: string
          _type?: string
        }
        Returns: {
          artist: string
          audio_preview_url: string
          bpm: number
          cover_url: string
          duration_sec: number
          featuring: string
          genre: string[]
          id: string
          key: string
          marketplace_published_at: string
          mood: string[]
          production_stage: string
          title: string
          track_type: string
          waveform_data: Json
          workspace_id: string
          workspace_name: string
        }[]
      }
      set_track_marketplace_public: {
        Args: {
          _public: boolean
          _track_id: string
          _user_id: string
          _workspace_id: string
        }
        Returns: undefined
      }
      set_track_version_active: {
        Args: {
          _track_id: string
          _user_id: string
          _version_id: string
          _workspace_id: string
        }
        Returns: undefined
      }
      share_playlist_with_workspace: {
        Args: {
          _access_level: string
          _playlist_id: string
          _source_workspace_id: string
          _target_workspace_id: string
          _user_id: string
        }
        Returns: string
      }
      sign_agreement_via_token: {
        Args: { _signature_data: string; _token: string }
        Returns: Json
      }
      storage_path_workspace_id: { Args: { _path: string }; Returns: string }
      toggle_track_video_visibility: {
        Args: {
          _track_id: string
          _user_id: string
          _visible: boolean
          _workspace_id: string
        }
        Returns: undefined
      }
      unmark_splits_signed_externally: {
        Args: { _track_id: string; _user_id: string }
        Returns: number
      }
      update_approval_status: {
        Args: {
          _approval_id: string
          _note: string
          _status: string
          _user_id: string
        }
        Returns: undefined
      }
      update_approval_status_legacy_v0: {
        Args: {
          _approval_id: string
          _note?: string
          _status: string
          _user_id: string
        }
        Returns: undefined
      }
      update_contact: {
        Args: {
          _city?: string
          _company?: string
          _contact_id: string
          _country?: string
          _email?: string
          _first_name?: string
          _ipi?: string
          _last_name?: string
          _phone?: string
          _pro?: string[]
          _publisher?: string
          _role?: string
          _stage_name?: string
          _user_id: string
          _workspace_id: string
        }
        Returns: string
      }
      update_contact_legacy_v0: {
        Args: {
          _city?: string
          _company?: string
          _contact_id: string
          _country?: string
          _email?: string
          _first_name?: string
          _ipi?: string
          _last_name?: string
          _phone?: string
          _pro?: string[]
          _publisher?: string
          _role?: string
          _stage_name?: string
          _user_id: string
          _workspace_id: string
        }
        Returns: string
      }
      update_member_role: {
        Args: {
          _access_level: string
          _member_user_id: string
          _professional_title?: string
          _user_id: string
          _workspace_id: string
        }
        Returns: undefined
      }
      update_pitch_share_link: {
        Args: {
          _contact_id?: string
          _pitch_id: string
          _share_link_id?: string
          _user_id: string
          _workspace_id: string
        }
        Returns: undefined
      }
      update_playlist: {
        Args: {
          _cover_url?: string
          _description?: string
          _name?: string
          _playlist_id: string
          _user_id: string
        }
        Returns: undefined
      }
      update_playlist_legacy_v0: {
        Args: {
          _cover_url?: string
          _description?: string
          _name?: string
          _playlist_id: string
          _user_id: string
        }
        Returns: undefined
      }
      update_shared_link_status: {
        Args: { _disabled: boolean; _link_id: string; _user_id: string }
        Returns: undefined
      }
      update_shared_link_status_legacy_v0: {
        Args: { _disabled: boolean; _link_id: string; _user_id: string }
        Returns: undefined
      }
      update_stem_type: {
        Args: { _stem_id: string; _stem_type: string; _user_id: string }
        Returns: undefined
      }
      update_stem_type_legacy_v0: {
        Args: { _stem_id: string; _stem_type: string; _user_id: string }
        Returns: undefined
      }
      update_studio_submission_status: {
        Args: { _status: string; _submission_id: string; _user_id: string }
        Returns: undefined
      }
      update_studio_submission_status_legacy_v0: {
        Args: { _status: string; _submission_id: string; _user_id: string }
        Returns: undefined
      }
      update_track: {
        Args: { _track_id: string; _updates: Json; _user_id: string }
        Returns: undefined
      }
      update_track_comment_via_token: {
        Args: {
          _comment_id: string
          _new_content: string
          _shared_link_token: string
        }
        Returns: undefined
      }
      update_track_document_status: {
        Args: { _doc_id: string; _status: string; _user_id: string }
        Returns: undefined
      }
      update_track_document_status_legacy_v0: {
        Args: { _doc_id: string; _status: string; _user_id: string }
        Returns: undefined
      }
      update_track_version_chapters: {
        Args: {
          _chapters: Json
          _track_id: string
          _user_id: string
          _version_id: string
          _workspace_id: string
        }
        Returns: undefined
      }
      update_track_version_notes: {
        Args: {
          _notes: string
          _track_id: string
          _user_id: string
          _version_id: string
          _workspace_id: string
        }
        Returns: undefined
      }
      update_track_version_waveform: {
        Args: {
          _duration_sec: number
          _track_id: string
          _user_id: string
          _version_id: string
          _waveform_data: Json
          _workspace_id: string
        }
        Returns: undefined
      }
      update_track_video: {
        Args: {
          _track_id: string
          _user_id: string
          _video_filename: string
          _video_url: string
          _workspace_id: string
        }
        Returns: undefined
      }
      update_user_profile: {
        Args: {
          _avatar_url: string
          _bio: string
          _first_name: string
          _last_name: string
          _phone: string
          _user_id: string
        }
        Returns: undefined
      }
      update_workspace_branding: {
        Args: {
          _bio?: string
          _brand_color?: string
          _epk_url?: string
          _hero_focal_point?: string
          _hero_image_url?: string
          _hero_position?: number
          _logo_url?: string
          _social_apple?: string
          _social_facebook?: string
          _social_instagram?: string
          _social_spotify?: string
          _social_tiktok?: string
          _social_website?: string
          _social_x?: string
          _social_youtube?: string
          _user_id: string
          _workspace_id: string
        }
        Returns: undefined
      }
      update_workspace_member: {
        Args: {
          _access_level?: string
          _member_id: string
          _professional_title?: string
          _user_id: string
          _workspace_id: string
        }
        Returns: undefined
      }
      update_workspace_name: {
        Args: { _name: string; _user_id: string; _workspace_id: string }
        Returns: undefined
      }
      update_workspace_name_legacy_v0: {
        Args: { _name: string; _user_id: string; _workspace_id: string }
        Returns: undefined
      }
      update_workspace_settings: {
        Args: { _settings: Json; _user_id: string; _workspace_id: string }
        Returns: undefined
      }
      update_workspace_settings_legacy_v0: {
        Args: { _settings: Json; _user_id: string; _workspace_id: string }
        Returns: undefined
      }
      update_workspace_slug: {
        Args: { _slug: string; _user_id: string; _workspace_id: string }
        Returns: undefined
      }
      update_workspace_slug_legacy_v0: {
        Args: { _slug: string; _user_id: string; _workspace_id: string }
        Returns: undefined
      }
      upsert_artist_alias: {
        Args: {
          _alias_id: string
          _alias_name: string
          _contact_ids: string[]
          _user_id: string
          _workspace_id: string
        }
        Returns: string
      }
      upsert_contact: {
        Args: {
          _city?: string
          _company?: string
          _country?: string
          _email?: string
          _first_name: string
          _ipi?: string
          _last_name: string
          _phone?: string
          _pro?: string[]
          _publisher?: string
          _role?: string
          _stage_name?: string
          _user_id: string
          _workspace_id: string
        }
        Returns: string
      }
      upsert_notification_preferences: {
        Args: { _preferences: Json; _user_id: string }
        Returns: undefined
      }
      upsert_track_rating: {
        Args: {
          _rating: number
          _track_id: string
          _user_id: string
          _workspace_id: string
        }
        Returns: undefined
      }
      write_audit_log: {
        Args: {
          _action: string
          _entity_id: string
          _entity_type: string
          _metadata: string
          _user_id: string
          _workspace_id: string
        }
        Returns: undefined
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
      document_status: "draft" | "pending" | "signed"
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
        | "access_requested"
        | "access_granted"
        | "access_declined"
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
      document_status: ["draft", "pending", "signed"],
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
        "access_requested",
        "access_granted",
        "access_declined",
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
