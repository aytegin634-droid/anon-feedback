import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = ['short_text', 'long_text', 'select', 'multi_select', 'scale', 'date']

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user ? supabase : null
}

// список полей формы (включая архивные — для полноты картины)
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await requireAuth()
    if (!supabase) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const { id } = await params

    const { data } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', id)
        .order('position')

    // для каждого поля посчитаем, есть ли по нему ответы (нужно для блокировки смены типа)
    const { data: feedbacks } = await supabase
        .from('feedbacks')
        .select('answers')
        .eq('form_id', id)
        .limit(500)

    const answeredFieldIds = new Set<string>()
    for (const fb of feedbacks ?? []) {
        const answers = fb.answers as Record<string, unknown>
        for (const key of Object.keys(answers)) {
            const v = answers[key]
            if (v != null && v !== '' && !(Array.isArray(v) && v.length === 0)) {
                answeredFieldIds.add(key)
            }
        }
    }

    const fields = (data ?? []).map((f) => ({
        ...f,
        has_answers: answeredFieldIds.has(f.id),
    }))

    return NextResponse.json({ fields })
}

// создать вопрос
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await requireAuth()
    if (!supabase) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const { id: formId } = await params

    const body = await req.json()
    const label = (body.label ?? '').toString().trim()
    const fieldType = body.field_type
    const required = !!body.required
    const options = Array.isArray(body.options)
        ? body.options.map((o: unknown) => String(o).trim()).filter(Boolean)
        : []

    if (!label) return NextResponse.json({ error: 'empty_label' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(fieldType)) {
        return NextResponse.json({ error: 'bad_type' }, { status: 400 })
    }
    if ((fieldType === 'select' || fieldType === 'multi_select') && options.length < 2) {
        return NextResponse.json({ error: 'need_options' }, { status: 400 })
    }

    const parentFieldId = body.parent_field_id ?? null
    const showWhen = body.show_when ?? null
    const allowPhotos = !!body.allow_photos

    // валидация условия
    if (parentFieldId) {
        const { data: parent } = await supabase
            .from('form_fields')
            .select('id, field_type, options')
            .eq('id', parentFieldId)
            .eq('form_id', formId)
            .single()
        if (!parent) return NextResponse.json({ error: 'parent_not_found' }, { status: 400 })
        if (!showWhen || typeof showWhen !== 'object') {
            return NextResponse.json({ error: 'need_condition' }, { status: 400 })
        }
    }

    const { data: form } = await supabase
        .from('forms').select('venue_id').eq('id', formId).single()
    if (!form) return NextResponse.json({ error: 'form_not_found' }, { status: 404 })

    const { data: maxPos } = await supabase
        .from('form_fields')
        .select('position')
        .eq('form_id', formId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle()

    const { data, error } = await supabase
        .from('form_fields')
        .insert({
            form_id: formId,
            venue_id: form.venue_id,
            position: (maxPos?.position ?? 0) + 1,
            field_type: fieldType,
            label: label.slice(0, 200),
            options,
            required,
            scale_min: fieldType === 'scale' ? 0 : null,
            scale_max: fieldType === 'scale' ? 10 : null,
            parent_field_id: parentFieldId,
            show_when: showWhen,
            allow_photos: allowPhotos,
            })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ field: data })
}