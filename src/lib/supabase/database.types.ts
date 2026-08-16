/**
 * Hand-written types mirroring supabase/migrations/*.sql.
 *
 * Once a real Supabase project is connected, these can be regenerated
 * automatically with `supabase gen types typescript` — for now they are
 * written by hand to match the migrations exactly, so the app has type
 * safety before a live project exists.
 *
 * The shape below (Row/Insert/Update/Relationships per table, plus Views
 * and Functions at the schema level) matches what @supabase/postgrest-js's
 * `GenericSchema`/`GenericTable` types require — see
 * node_modules/@supabase/postgrest-js/src/types/common/common.ts.
 */

export type UserRole = "student" | "tutor" | "admin";
export type TutorStatus = "pending" | "approved" | "rejected" | "suspended";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          display_name: string;
          avatar_url?: string | null;
        };
        Update: {
          display_name?: string;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      student_profiles: {
        Row: {
          id: string;
          grade_level: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          grade_level?: string | null;
          notes?: string | null;
        };
        Update: {
          grade_level?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      tutor_profiles: {
        Row: {
          id: string;
          status: TutorStatus;
          headline: string | null;
          bio: string | null;
          education: string | null;
          years_experience: number | null;
          application_notes: string | null;
          submitted_at: string | null;
          admin_notes: string | null;
          approved_by: string | null;
          approved_at: string | null;
          status_updated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          status?: TutorStatus;
        };
        Update: {
          headline?: string | null;
          bio?: string | null;
          education?: string | null;
          years_experience?: number | null;
          application_notes?: string | null;
          submitted_at?: string | null;
        };
        Relationships: [];
      };
      subjects: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          name: string;
          category?: string | null;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          category?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      tutor_profile_subjects: {
        Row: {
          tutor_id: string;
          subject_id: string;
          created_at: string;
        };
        Insert: {
          tutor_id: string;
          subject_id: string;
        };
        Update: {
          tutor_id?: string;
          subject_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_set_tutor_status: {
        Args: {
          target_tutor_id: string;
          new_status: TutorStatus;
          note?: string | null;
        };
        Returns: Database["public"]["Tables"]["tutor_profiles"]["Row"];
      };
      is_admin: {
        Args: Record<string, never> | { uid?: string };
        Returns: boolean;
      };
    };
  };
}
