'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'always',
  })
}

export function CSPostHogProvider({ children }: { children: React.ReactNode }) {
  if (typeof window !== 'undefined') {
    console.log('PostHog provider mounted, key:', process.env.NEXT_PUBLIC_POSTHOG_KEY ? 'Present' : 'Missing');
    posthog.capture('client_mounted');
  }
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
