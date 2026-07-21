import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = ['short_text', 'long_text', 'select', 'multi_select', 'scale', 'date']

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { id: formId, fieldId } = await params
    const body = await req.json()

    const { data: field } = await supabase
        .from('form_fields')
        .select('id, field_type')
        .eq('id', fieldId)
        .eq('form_id', formId)
        .single()
    if (!field) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const patch: Record<string, unknown> = {}

    if (typeof body.label === 'string' && body.label.trim()) {
        patch.label = body.label.trim().slice(0, 200)
    }
    if (typeof body.required === 'boolean') patch.required = body.required
    if (Array.isArray(body.options)) {
        patch.options = body.options.map((o: unknown) => String(o).trim()).filter(Boolean)
    }
    if (typeof body.is_archived === 'boolean') {
        // запрет архивации последнего активного вопроса
        if (body.is_archived) {
            const { count } = await supabase
                .from('form_fields')
                .select('id', { count: 'exact', head: true })
                .eq('form_id', formId)
                .eq('is_archived', false)
                .is('parent_field_id', null)
            if ((count ?? 0) <= 1) {
                return NextResponse.json({ error: 'last_field' }, { status: 400 })
            }
        }
        patch.is_archived = body.is_archived
    }

    // смена типа — только если по полю нет ответов
    if (typeof body.field_type === 'string' && body.field_type !== field.field_type) {
        if (!ALLOWED_TYPES.includes(body.field_type)) {
            return NextResponse.json({ error: 'bad_type' }, { status: 400 })
        }
        const { data: withAnswers } = await supabase
            .from('feedbacks')
            .select('id')
            .eq('form_id', formId)
            .filter('answers', 'cs', `{"${fieldId}": null}`)
            .limit(1)
        // cs-фильтр с null ненадёжен, проверим по-простому: любые фидбеки где ключ есть
        const { data: fbs } = await supabase
            .from('feedbacks')
            .select('answers')
            .eq('form_id', formId)
            .limit(500)
        const hasAnswers = (fbs ?? []).some((fb) => {
            const v = (fb.answers as Record<string, unknown>)[fieldId]
            return v != null && v !== '' && !(Array.isArray(v) && v.length === 0)
        })
        if (hasAnswers) {
            return NextResponse.json({ error: 'has_answers' }, { status: 400 })
        }
        patch.field_type = body.field_type
        patch.scale_min = body.field_type === 'scale' ? 0 : null
        patch.scale_max = body.field_type === 'scale' ? 10 : null
    }

    if (typeof body.allow_photos === 'boolean') patch.allow_photos = body.allow_photos
    if ('show_when' in body) patch.show_when = body.show_when ?? null
    if ('parent_field_id' in body) patch.parent_field_id = body.parent_field_id ?? null

    const { error } = await supabase.from('form_fields').update(patch).eq('id', fieldId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}