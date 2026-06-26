export type ParticipantStatus = "belum_hadir" | "hadir";
export type RsvpStatus =
  | "belum_konfirmasi"
  | "menunggu_approval"
  | "dikonfirmasi_hadir"
  | "dikonfirmasi_tidak_hadir";

export interface Participant {
  id: string;
  name: string;
  phone: string;
  seat_number: string;
  family_group: string;
  qty: number;
  code: string;
  status: ParticipantStatus;
  checked_in_at: string | null;
  wa_sent_at: string | null;
  wa_status: string | null;
  rsvp_status: RsvpStatus;
  rsvp_qty_response: number | null;
  rsvp_responded_at: string | null;
  rsvp_reviewed_by: string | null;
  rsvp_reviewed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParticipantInput {
  name: string;
  phone: string;
  seat_number: string;
  family_group: string;
  qty: number;
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

export interface EventSettings {
  id: number;
  event_name: string;
  event_address: string;
  ticket_background_url: string | null;
  created_at: string;
  updated_at: string;
}
