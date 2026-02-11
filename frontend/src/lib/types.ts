/* ========================================================================
   ProMail — TypeScript Type Definitions
   ======================================================================== */

// ── Auth ──────────────────────────────────────────────────────────────────
export interface User {
  id: number;
  email: string;
  name: string;
  domain: string;
  is_admin: boolean;
  quota: number;
  used_quota: number;
  created_at: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  message: string;
}

// ── Mail ──────────────────────────────────────────────────────────────────
export interface MailFolder {
  name: string;
  display_name: string;
  icon: string;
  count: number;
  unread: number;
}

export interface MailMessage {
  uid: number;
  subject: string;
  from_name: string;
  from_email: string;
  to: string;
  cc: string;
  date: string;
  preview: string;
  flags: string[];
  has_attachments: boolean;
  starred: boolean;
  read: boolean;
}

export interface MailMessageFull extends MailMessage {
  body_html: string;
  body_text: string;
  attachments: Attachment[];
  reply_to: string;
  bcc: string;
}

export interface Attachment {
  filename: string;
  content_type: string;
  size: number;
  index: number;
}

export interface ComposePayload {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  reply_to_uid?: number;
}

export interface MailListResponse {
  messages: MailMessage[];
  total: number;
  page: number;
  per_page: number;
  folder: string;
}

// ── Calendar ──────────────────────────────────────────────────────────────
export interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  color: string;
  location: string;
}

export interface CalendarEventPayload {
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  all_day?: boolean;
  color?: string;
  location?: string;
}

// ── Contacts ──────────────────────────────────────────────────────────────
export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  job_title: string;
  address: string;
  notes: string;
  favorite: boolean;
  avatar_color: string;
  groups: ContactGroup[];
  created_at: string;
}

export interface ContactPayload {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  company?: string;
  job_title?: string;
  address?: string;
  notes?: string;
  favorite?: boolean;
}

export interface ContactGroup {
  id: number;
  name: string;
  count?: number;
}

// ── Admin ─────────────────────────────────────────────────────────────────
export interface Domain {
  id: number;
  name: string;
  active: boolean;
  accounts_count: number;
  aliases_count: number;
  created_at: string;
}

export interface Account {
  id: number;
  email: string;
  name: string;
  domain_id: number;
  domain_name: string;
  quota: number;
  active: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface AccountPayload {
  username: string;
  domain_id: number;
  password: string;
  name: string;
  quota?: number;
  is_admin?: boolean;
}

export interface Alias {
  id: number;
  source: string;
  destination: string;
  domain_id: number;
  domain_name: string;
  active: boolean;
  created_at: string;
}

export interface AliasPayload {
  source: string;
  destination: string;
  domain_id: number;
}

export interface AdminStats {
  active_domains: number;
  active_accounts: number;
  total_aliases: number;
  logins_today: number;
  failed_logins_today: number;
  disk_percent: number;
  disk_total: string;
  disk_free: string;
  uptime: string;
}

export interface ServiceStatus {
  name: string;
  running: boolean;
  display_name: string;
}

export interface LoginLogEntry {
  id: number;
  email: string;
  ip_address: string;
  success: boolean;
  user_agent: string;
  created_at: string;
}

export interface AdminSetting {
  key: string;
  value: string;
  description: string;
}

export interface DashboardData {
  stats: AdminStats;
  services: ServiceStatus[];
  recent_logins: LoginLogEntry[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ── API ───────────────────────────────────────────────────────────────────
export interface ApiError {
  error: string;
  message?: string;
  status?: number;
}
