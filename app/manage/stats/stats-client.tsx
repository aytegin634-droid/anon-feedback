'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

type Stats = {
  total: number
  avgService: number | null
  avgFood: number | null
  resolvedRate: number
  byDay: { date: string; count: number }[]
  weeklyTrend: { week: string; service: number | null; food: number | null }[]
  serviceDistribution: { score: number; count: number }[]
  foodDistribution: { score: number; count: number }[]
  greetingCounts: { option: string; count: number }[]
  waitingCounts: { option: string; count: number }[]
  likedCounts: { option: string; count: number }[]
  complaintsService: { text: string; feedbackId: string; date: string }[]
  complaintsFood: { text: string; feedbackId: string; date: string }[]
  byBranch: { branch: string; count: number }[]
}

const BRANCH_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

export default function StatsClient() {
  const [period, setPeriod] = useState('30')
  const [branch, setBranch] = useState('all')
  const [data, setData] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/stats?period=${period}&branch=${encodeURIComponent(branch)}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
  }, [period, branch])

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-800">
            ← Инбокс
          </Link>
          <h1 className="text-sm font-medium">Статистика</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="text-xs border border-neutral-200 rounded px-2 py-1"
          >
            <option value="all">Все филиалы</option>
            <option value="Араванская">Араванская</option>
            <option value="Дом-Быта">Дом-Быта</option>
            <option value="Юго-Восток">Юго-Восток</option>
            <option value="Анар">Анар</option>
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-xs border border-neutral-200 rounded px-2 py-1"
          >
            <option value="7">7 дней</option>
            <option value="30">30 дней</option>
            <option value="90">90 дней</option>
            <option value="all">Всё время</option>
          </select>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {loading || !data ? (
          <div className="text-center text-sm text-neutral-400 py-20">Загружаем…</div>
        ) : data.total === 0 ? (
          <div className="text-center text-sm text-neutral-400 py-20">
            За выбранный период нет отзывов
          </div>
        ) : (
          <>
            {/* Верхние плитки */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Tile label="Всего отзывов" value={data.total} />
              <Tile
                label="Сред. обслуживание"
                value={data.avgService ?? '—'}
                suffix={data.avgService != null ? '/10' : ''}
                color={scoreColor(data.avgService)}
              />
              <Tile
                label="Сред. блюда"
                value={data.avgFood ?? '—'}
                suffix={data.avgFood != null ? '/10' : ''}
                color={scoreColor(data.avgFood)}
              />
              <Tile label="Закрыто" value={`${data.resolvedRate}%`} />
            </div>

            {/* Динамика по дням */}
            <Card title="Отзывы по дням">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#171717" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Тренд средней оценки по неделям */}
            {data.weeklyTrend.length > 1 && (
              <Card title="Тренд средней оценки по неделям">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={data.weeklyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="service"
                      name="Обслуживание"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="food"
                      name="Блюда"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Распределение оценок */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card title="Оценки обслуживания">
                <ScoreHistogram data={data.serviceDistribution} />
              </Card>
              <Card title="Оценки блюд">
                <ScoreHistogram data={data.foodDistribution} />
              </Card>
            </div>

            {/* Пирог по филиалам */}
            {branch === 'all' && data.byBranch.some((b) => b.count > 0) && (
              <Card title="Отзывы по филиалам">
                <div className="grid md:grid-cols-2 gap-4 items-center">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.byBranch.filter((b) => b.count > 0)}
                        dataKey="count"
                        nameKey="branch"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry: any) => `${entry.branch}: ${entry.count}`}
                        labelLine={false}
                      >
                        {data.byBranch.map((_, i) => (
                          <Cell key={i} fill={BRANCH_COLORS[i % BRANCH_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5">
                    {data.byBranch.map((b, i) => (
                      <div key={b.branch} className="flex items-center gap-2 text-sm">
                        <span
                          className="w-3 h-3 rounded"
                          style={{ background: BRANCH_COLORS[i % BRANCH_COLORS.length] }}
                        />
                        <span className="flex-1">{b.branch}</span>
                        <span className="text-neutral-500 font-mono">{b.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* ТОП проблем — multi_select */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card title="Как встретили" subtitle="по упоминаниям">
                <RankedList items={data.greetingCounts} />
              </Card>
              <Card title="Ожидание заказа" subtitle="по упоминаниям">
                <RankedList items={data.waitingCounts} />
              </Card>
              <Card title="Что понравилось" subtitle="по упоминаниям">
                <RankedList items={data.likedCounts} />
              </Card>
            </div>

            {/* Тексты жалоб */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card
                title="Жалобы на обслуживание"
                subtitle={`${data.complaintsService.length} отзывов`}
              >
                <ComplaintList items={data.complaintsService} />
              </Card>
              <Card
                title="Жалобы на блюда"
                subtitle={`${data.complaintsFood.length} отзывов`}
              >
                <ComplaintList items={data.complaintsFood} />
              </Card>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function Tile({
  label, value, suffix, color,
}: {
  label: string
  value: string | number
  suffix?: string
  color?: string
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      <div className="text-xs text-neutral-500 mb-1">{label}</div>
      <div className="text-2xl font-medium" style={color ? { color } : undefined}>
        {value}
        {suffix && <span className="text-base text-neutral-400 font-normal">{suffix}</span>}
      </div>
    </div>
  )
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {subtitle && <span className="text-xs text-neutral-400">{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

function ScoreHistogram({ data }: { data: { score: number; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
        <XAxis dataKey="score" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={scoreBarColor(entry.score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function RankedList({ items }: { items: { option: string; count: number }[] }) {
  if (items.length === 0) {
    return <div className="text-xs text-neutral-400 py-2">Нет данных</div>
  }
  const max = Math.max(...items.map((i) => i.count))
  return (
    <div className="space-y-2">
      {items.slice(0, 10).map((item) => (
        <div key={item.option} className="text-sm">
          <div className="flex justify-between mb-1">
            <span className="text-neutral-700 truncate pr-2">{item.option}</span>
            <span className="text-neutral-500 font-mono text-xs">{item.count}</span>
          </div>
          <div className="h-1.5 bg-neutral-100 rounded">
            <div
              className="h-1.5 bg-neutral-800 rounded"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function ComplaintList({ items }: { items: { text: string; feedbackId: string; date: string }[] }) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) {
    return <div className="text-xs text-neutral-400 py-2">Нет жалоб — хорошо</div>
  }
  const visible = expanded ? items : items.slice(0, 3)
  return (
    <div className="space-y-3">
      {visible.map((item) => (
        <Link
          key={item.feedbackId}
          href={`/admin/${item.feedbackId}`}
          className="block border-l-2 border-red-200 pl-3 py-1 hover:bg-neutral-50 -mx-2 px-2"
        >
          <div className="text-xs text-neutral-400 mb-0.5">
            {new Date(item.date).toLocaleDateString('ru-RU')}
          </div>
          <div className="text-sm text-neutral-800 line-clamp-3 whitespace-pre-wrap">
            {item.text}
          </div>
        </Link>
      ))}
      {items.length > 3 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-neutral-500 hover:underline"
        >
          {expanded ? 'Скрыть' : `Показать ещё ${items.length - 3}`}
        </button>
      )}
    </div>
  )
}

function scoreColor(score: number | null): string | undefined {
  if (score == null) return undefined
  if (score <= 6) return '#dc2626'
  if (score <= 8) return '#d97706'
  return '#16a34a'
}
function scoreBarColor(score: number): string {
  if (score <= 6) return '#fca5a5'
  if (score <= 8) return '#fcd34d'
  return '#86efac'
}