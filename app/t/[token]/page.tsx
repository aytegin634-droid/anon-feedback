import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import ThreadView from './thread-view'

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: feedback } = await supabase
    .from('feedbacks')
    .select('id')
    .eq('anonymous_token', token)
    .single()

  if (!feedback) notFound()

  return <ThreadView token={token} />
}