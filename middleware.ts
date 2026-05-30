import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isManageRoute = req.nextUrl.pathname.startsWith('/manage')
  const isLoginRoute = req.nextUrl.pathname === '/manage/login'

  if (isManageRoute && !isLoginRoute && !user) {
    return NextResponse.redirect(new URL('/manage/login', req.url))
  }
  if (isLoginRoute && user) {
    return NextResponse.redirect(new URL('/manage', req.url))
  }

  return res
}

export const config = {
  matcher: ['/manage/:path*'],
}