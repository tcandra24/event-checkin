export type ParticipantCategory = "VIP" | "Umum";
export type ParticipantStatus = "belum_hadir" | "hadir";

export interface Participant {
  id: string;
  name: string;
  phone: string;
  company: string | null;
  category: ParticipantCategory;
  code: string;
  status: ParticipantStatus;
  checked_in_at: string | null;
  wa_sent_at: string | null;
  wa_status: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParticipantInput {
  name: string;
  phone: string;
  company?: string;
  category: ParticipantCategory;
}

export interface BroadcastLog {
  id: string;
  sent_by: string | null;
  message: string;
  target_filter: string;
  total_recipients: number;
  total_success: number;
  total_failed: number;
  created_at: string;
}
