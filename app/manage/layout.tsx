import type { Metadata, Viewport } from 'next'
import PWAInstallPrompt from './pwa-install-prompt'
import ManageSidebar from './manage-header'

export const metadata: Metadata = {
  title: 'Borsok — менеджер',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Borsok',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:flex min-h-screen bg-neutral-50">
      <ManageSidebar />
      <main className="flex-1 min-w-0">
        {children}
      </main>
      <PWAInstallPrompt />
    </div>
  )
}