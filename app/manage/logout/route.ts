import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Возвращаем на логин того же адреса, с которого пришли: сайт открыт и на своём домене,
// и на *.vercel.app — вход (cookie) у каждого адреса свой.
function loginUrl(req: Request) {
  return new URL('/manage/login', req.url)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // 303 заставит браузер использовать GET на следующем шаге
  // и не пытаться повторить POST при кнопке "Назад"
  return NextResponse.redirect(loginUrl(req), 303)
}

export async function GET(req: Request) {
  // если пользователь по ошибке окажется здесь через back-кнопку — отправим на логин
  return NextResponse.redirect(loginUrl(req), 303)
}
