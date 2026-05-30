import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function loginUrl(req?: Request) {
  return new URL(
    '/manage/login',
    process.env.NEXT_PUBLIC_SITE_URL ?? req?.url ?? 'http://localhost:3000'
  )
}

export async function POST(req: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // 303 заставит браузер использовать GET на следующем шаге
  // и не пытаться повторить POST при кнопке "Назад"
  return NextResponse.redirect(loginUrl(req), 303)
}

export async function GET() {
  // если пользователь по ошибке окажется здесь через back-кнопку — отправим на логин
  return NextResponse.redirect(loginUrl(), 303)
}