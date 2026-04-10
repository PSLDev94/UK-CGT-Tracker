import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // If the cookie is updated, update the response
          request.cookies.set({
            name,
            value,
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          supabaseResponse.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          // If the cookie is removed, update the response
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          supabaseResponse.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard')
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup') || request.nextUrl.pathname.startsWith('/forgot-password')
  const isApiDataRoute = request.nextUrl.pathname.startsWith('/api/') && !request.nextUrl.pathname.startsWith('/api/stripe/') && !request.nextUrl.pathname.startsWith('/api/webhooks/') && !request.nextUrl.pathname.startsWith('/api/auth/')

  if ((isProtectedRoute || isApiDataRoute) && !user) {
    if (isApiDataRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // GLOBAL SECURE BILLING GATE (No leaks)
  if ((isProtectedRoute || isApiDataRoute) && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status, trial_end_date')
      .eq('id', user.id)
      .single()

    if (profile) {
      const now = new Date()
      const trialEnd = profile.trial_end_date ? new Date(profile.trial_end_date) : null
      const subStatus = profile.subscription_status || 'trialing'

      // Lockout conditions
      const isExpiredTrial = subStatus === 'trialing' && trialEnd && now > trialEnd
      const isCanceledOrPastDueAndTrialExpired = (subStatus === 'canceled' || subStatus === 'past_due') && (!trialEnd || now > trialEnd)
      const isLockedOut = isExpiredTrial || isCanceledOrPastDueAndTrialExpired

      if (isLockedOut) {
         // Explicit whitelist for managing settings while locked out
         const isSettingsRoute = request.nextUrl.pathname === '/dashboard/settings'
         
         if (isApiDataRoute && !request.nextUrl.pathname.startsWith('/api/settings/')) {
            return NextResponse.json({ error: 'Subscription or trial has expired. Payment required.' }, { status: 402 })
         } else if (isProtectedRoute && !isSettingsRoute) {
            const url = request.nextUrl.clone()
            url.pathname = '/pricing'
            return NextResponse.redirect(url)
         }
      }
    }
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
