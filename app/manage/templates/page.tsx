import { createClient } from '@/lib/supabase/server'
import TemplatesClient from './templates-client'

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: fields } = await supabase
    .from('form_fields')
    .select('id, label, field_type, options, position')
    .eq('venue_id', '00000000-0000-0000-0000-000000000001')
    .in('field_type', ['scale', 'select', 'multi_select'])
    .eq('is_archived', false)
    .order('position')

  return <TemplatesClient conditionFields={fields ?? []} />
}