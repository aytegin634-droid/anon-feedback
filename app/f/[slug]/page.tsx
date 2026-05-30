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

  const { data: venue } = await supabase
    .from('venues')
    .select('*')
    .eq('slug', slug)
    .single<Venue>()

  if (!venue) notFound()

  const { data: fields } = await supabase
    .from('form_fields')
    .select('*')
    .eq('venue_id', venue.id)
    .eq('is_archived', false)
    .order('position', { ascending: true })

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-xl px-5 py-10">
        <h1 className="text-3xl font-bold text-neutral-900 mb-1">{venue.name}</h1>
        <p className="text-base text-neutral-700 mb-8 font-medium">Честно. Коротко. Важно.</p>
        <FeedbackForm venue={venue} fields={(fields ?? []) as FormField[]} />
      </div>
    </main>
  )
}