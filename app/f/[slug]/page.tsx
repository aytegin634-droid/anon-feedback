import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { FormField, Venue } from '@/lib/types'
import FeedbackForm from './form'

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: form } = await supabase
    .from('forms')
    .select('id, name, is_system, venue_id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!form) notFound()

  const [{ data: venue }, { data: fields }] = await Promise.all([
    supabase.from('venues').select('*').eq('id', form.venue_id).single<Venue>(),
    supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', form.id)
      .eq('is_archived', false)
      .order('position', { ascending: true }),
  ])

  const activeRoots = (fields ?? []).filter((f) => !f.parent_field_id)
  if (activeRoots.length === 0) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-5">
        <div className="text-center">
          <h1 className="text-xl font-bold text-neutral-900 mb-2">Форма пока не готова</h1>
          <p className="text-sm text-neutral-700">Загляните позже.</p>
        </div>
      </main>
    )
  }

  if (!venue) notFound()

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-xl px-5 py-10">
        <h1 className="text-3xl font-bold text-neutral-900 mb-1">{venue.name}</h1>
        <p className="text-base text-neutral-700 mb-8 font-medium">
          {form.is_system ? 'Честно. Коротко. Важно.' : form.name}
        </p>
        <FeedbackForm
          venue={venue}
          formId={form.id}
          fields={(fields ?? []) as FormField[]}
        />
      </div>
    </main>
  )
}