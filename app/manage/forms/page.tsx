import { createClient } from '@/lib/supabase/server'
import FormsClient from './forms-client'

export default async function FormsPage() {
  const supabase = await createClient()
  const { data: forms } = await supabase
    .from('forms')
    .select('id, name, slug, is_system, is_active, created_at')
    .order('is_system', { ascending: false })
    .order('created_at')
  return <FormsClient initial={forms ?? []} />
}