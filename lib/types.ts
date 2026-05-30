export type FieldType = 'short_text' | 'long_text' | 'select' | 'multi_select' | 'scale' | 'date'

export type ShowWhen =
  | { operator: 'eq'; value: string | number }
  | { operator: 'in'; values: string[] }
  | { operator: 'lt'; value: number }
  | { operator: 'gt'; value: number }
  | { operator: 'lte'; value: number }
  | { operator: 'gte'; value: number }

export type FormField = {
  id: string
  venue_id: string
  position: number
  field_type: FieldType
  label: string
  options: string[]
  required: boolean
  scale_min: number | null
  scale_max: number | null
  parent_field_id: string | null
  show_when: ShowWhen | null
  allow_photos: boolean
}

export type Venue = {
  id: string
  name: string
  slug: string
}

export type Attachment = {
  url: string
  type: string
}

export type Message = {
  id: string
  feedback_id: string
  author: 'guest' | 'manager' | 'system'
  text: string | null
  attachments: Attachment[]
  // legacy для старых сообщений:
  attachment_url: string | null
  attachment_type: string | null
  created_at: string
}

export type Feedback = {
  id: string
  venue_id: string
  anonymous_token: string
  answers: Record<string, unknown>
  status: 'new' | 'in_progress' | 'resolved' | 'archived'
  created_at: string
  last_message_at: string
  unread_for_manager: boolean
  unread_for_guest: boolean
}