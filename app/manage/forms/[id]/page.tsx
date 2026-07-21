import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FormEditorClient from './form-editor-client'

export default async function FormEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: form } = await supabase
    .from('forms')
    .select('id, name, slug, is_system')
    .eq('id', id)
    .single()
  if (!form) notFound()
  return <FormEditorClient form={form} />
}