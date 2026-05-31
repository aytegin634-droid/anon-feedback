'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Неверный email или пароль')
      setLoading(false)
      return
    }
    // полная перезагрузка гарантирует, что cookie сессии уже установлен
    // при следующем запросе и middleware его увидит
    window.location.href = '/manage'
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border-2 border-neutral-200 p-6 w-full max-w-sm space-y-4 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Borsok</h1>
          <p className="text-sm font-medium text-neutral-700 mt-0.5">Вход для менеджера</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-neutral-800 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border-2 border-neutral-200 rounded-lg px-3 py-2.5 text-base text-neutral-900 focus:outline-none focus:border-amber-500 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-neutral-800 mb-1.5">Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border-2 border-neutral-200 rounded-lg px-3 py-2.5 text-base text-neutral-900 focus:outline-none focus:border-amber-500 transition"
          />
        </div>
        {error && (
          <div className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-3 text-base font-semibold disabled:opacity-50 transition"
        >
          {loading ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </main>
  )
}