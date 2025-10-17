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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          bisnis: string | null
          catatan: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          nama: string
          phone: string | null
          status: Database["public"]["Enums"]["client_status"] | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          bisnis?: string | null
          catatan?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nama: string
          phone?: string | null
          status?: Database["public"]["Enums"]["client_status"] | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          bisnis?: string | null
          catatan?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nama?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["client_status"] | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      communications: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          follow_up_date: string | null
          id: string
          notes: string
          subject: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          follow_up_date?: string | null
          id?: string
          notes: string
          subject?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          follow_up_date?: string | null
          id?: string
          notes?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          alamat: string | null
          created_at: string
          id: string
          logo_url: string | null
          nama: string
          npwp: string | null
          rekening: string | null
          signature_url: string | null
          updated_at: string
        }
        Insert: {
          alamat?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          nama: string
          npwp?: string | null
          rekening?: string | null
          signature_url?: string | null
          updated_at?: string
        }
        Update: {
          alamat?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          nama?: string
          npwp?: string | null
          rekening?: string | null
          signature_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      finances: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string | null
          kategori: Database["public"]["Enums"]["finance_category"]
          keterangan: string | null
          nominal: number
          tanggal: string
          tipe: Database["public"]["Enums"]["finance_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          kategori: Database["public"]["Enums"]["finance_category"]
          keterangan?: string | null
          nominal: number
          tanggal?: string
          tipe: Database["public"]["Enums"]["finance_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          kategori?: Database["public"]["Enums"]["finance_category"]
          keterangan?: string | null
          nominal?: number
          tanggal?: string
          tipe?: Database["public"]["Enums"]["finance_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finances_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_number: string
          jatuh_tempo: string
          paid_at: string | null
          pdf_url: string | null
          project_id: string
          status: Database["public"]["Enums"]["invoice_status"] | null
          tanggal_terbit: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number: string
          jatuh_tempo: string
          paid_at?: string | null
          pdf_url?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["invoice_status"] | null
          tanggal_terbit?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number?: string
          jatuh_tempo?: string
          paid_at?: string | null
          pdf_url?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["invoice_status"] | null
          tanggal_terbit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          catatan: string | null
          client_id: string | null
          converted_at: string | null
          created_at: string
          created_by: string | null
          id: string
          kontak: string
          nama: string
          status: Database["public"]["Enums"]["lead_status"] | null
          sumber: Database["public"]["Enums"]["lead_source"]
          updated_at: string
        }
        Insert: {
          catatan?: string | null
          client_id?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kontak: string
          nama: string
          status?: Database["public"]["Enums"]["lead_status"] | null
          sumber: Database["public"]["Enums"]["lead_source"]
          updated_at?: string
        }
        Update: {
          catatan?: string | null
          client_id?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kontak?: string
          nama?: string
          status?: Database["public"]["Enums"]["lead_status"] | null
          sumber?: Database["public"]["Enums"]["lead_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string
          deskripsi: string | null
          estimasi_hari: number | null
          fitur: Json | null
          harga: number
          id: string
          is_active: boolean | null
          nama: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deskripsi?: string | null
          estimasi_hari?: number | null
          fitur?: Json | null
          harga: number
          id?: string
          is_active?: boolean | null
          nama: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deskripsi?: string | null
          estimasi_hari?: number | null
          fitur?: Json | null
          harga?: number
          id?: string
          is_active?: boolean | null
          nama?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          developer_id: string | null
          estimasi_hari: number | null
          harga: number
          id: string
          nama_proyek: string
          package_id: string | null
          progress_notes: string | null
          ruang_lingkup: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          tanggal_mulai: string | null
          tanggal_selesai: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          developer_id?: string | null
          estimasi_hari?: number | null
          harga: number
          id?: string
          nama_proyek: string
          package_id?: string | null
          progress_notes?: string | null
          ruang_lingkup?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          tanggal_mulai?: string | null
          tanggal_selesai?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          developer_id?: string | null
          estimasi_hari?: number | null
          harga?: number
          id?: string
          nama_proyek?: string
          package_id?: string | null
          progress_notes?: string | null
          ruang_lingkup?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          tanggal_mulai?: string | null
          tanggal_selesai?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      spks: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          payment_terms: string | null
          pdf_url: string | null
          project_id: string
          spk_number: string
          terms_conditions: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          payment_terms?: string | null
          pdf_url?: string | null
          project_id: string
          spk_number: string
          terms_conditions?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          payment_terms?: string | null
          pdf_url?: string | null
          project_id?: string
          spk_number?: string
          terms_conditions?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
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
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      client_status: "prospek" | "negosiasi" | "deal" | "aktif" | "selesai"
      finance_category:
        | "pendapatan"
        | "operasional"
        | "pajak"
        | "gaji"
        | "hosting"
        | "iklan"
        | "lainnya"
      finance_type: "income" | "expense"
      invoice_status: "draft" | "menunggu_dp" | "lunas" | "overdue"
      lead_source:
        | "facebook"
        | "google"
        | "whatsapp"
        | "website"
        | "referral"
        | "lainnya"
      lead_status: "baru" | "tertarik" | "negosiasi" | "closing" | "gagal"
      project_status:
        | "briefing"
        | "desain"
        | "development"
        | "revisi"
        | "launch"
        | "selesai"
      user_role: "admin" | "cs" | "developer" | "finance"
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
      client_status: ["prospek", "negosiasi", "deal", "aktif", "selesai"],
      finance_category: [
        "pendapatan",
        "operasional",
        "pajak",
        "gaji",
        "hosting",
        "iklan",
        "lainnya",
      ],
      finance_type: ["income", "expense"],
      invoice_status: ["draft", "menunggu_dp", "lunas", "overdue"],
      lead_source: [
        "facebook",
        "google",
        "whatsapp",
        "website",
        "referral",
        "lainnya",
      ],
      lead_status: ["baru", "tertarik", "negosiasi", "closing", "gagal"],
      project_status: [
        "briefing",
        "desain",
        "development",
        "revisi",
        "launch",
        "selesai",
      ],
      user_role: ["admin", "cs", "developer", "finance"],
    },
  },
} as const
