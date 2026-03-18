import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import ClientDashboard from './ClientDashboard'

export const dynamic = 'force-dynamic'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key)
}

// ── date helpers ──────────────────────────────────────────────────────────────
function getDateRange(range: string, customFrom?: string, customTo?: string): { from: string; to: string; label: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  const today = fmt(now)

  if (range === 'today')     return { from: today, to: today, label: 'Today' }
  if (range === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1)
    const yd = fmt(y)
    return { from: yd, to: yd, label: 'Yesterday' }
  }
  if (range === 'custom' && customFrom && customTo)
    return { from: customFrom, to: customTo, label: `${customFrom} → ${customTo}` }

  const days = range === '7' ? 7 : range === '30' ? 30 : range === '90' ? 90 : null
  if (days) {
    const d = new Date(now); d.setDate(d.getDate() - days)
    return { from: fmt(d), to: today, label: `Last ${days} days` }
  }
  return { from: '2000-01-01', to: today, label: 'All time' }
}

const RANGES = [
  { key: 'today',     label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7',         label: '7 days' },
  { key: '30',        label: '30 days' },
  { key: '90',        label: '90 days' },
  { key: 'all',       label: 'All time' },
]

// ── page ──────────────────────────────────────────────────────────────────────
export default async function Dashboard({
  searchParams,
}: {
  searchParams: { range?: string; from?: string; to?: string }
}) {
  const supabase = getSupabase()
  if (!supabase) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-400 text-lg">⚠️ Missing Supabase env vars — add them in Vercel Settings.</p>
      </div>
    )
  }

  const range      = searchParams?.range ?? '7'
  const customFrom = searchParams?.from
  const customTo   = searchParams?.to
  const { from, to, label: rangeLabel } = getDateRange(range, customFrom, customTo)

  // QA scores — real calls only in date range
  const { data: rawScores } = await supabase
    .from('qa_scores')
    .select('*')
    .eq('voicemail_flag', false)
    .gte('date', from)
    .lte('date', to)
    .order('id', { ascending: false })
    .limit(500)

  // Contact KPI from dedicated table
  const { data: rawKpi } = await supabase
    .from('contact_kpi')
    .select('*')
    .gte('kpi_date', from)
    .lte('kpi_date', to)
    .order('id', { ascending: false })
    .limit(1000)

  const scores = rawScores ?? []
  const kpiRows = rawKpi ?? []

  // Summary stats
  const avgScore  = scores.length
    ? Math.round(scores.reduce((s, r) => s + (r.overall_score ?? 0), 0) / scores.length)
    : 0
  const qualified = scores.filter(r => r.lead_qualified === true).length
  const booked    = scores.filter(r => r.appointment_booked === true).length
  const badFlag   = scores.filter(r => r.bad_attitude_flag === true).length

  // Parse KPI rows — already clean columns, no string parsing needed
  const parsedAttempts = kpiRows.map(a => {
    const contacted = a.contacted === true
    const amDone    = a.am_calls ?? 0
    const amReq     = 3
    const pmDone    = a.pm_calls ?? 0
    const pmReq     = 3
    const name      = a.contact_name || '—'
    const contactId = a.contact_id || ''
    // legacy compat vars (keep same shape for ClientDashboard)
    const amDoneX   = amDone
    const amReqX    = amReq
    const pmDone    = parseInt(pmMatch?.[1] ?? '0')
    return {
      id: a.id,
      date: a.kpi_date ?? '',
      name,
      contactId,
      amDone: amDoneX,
      amReq: amReqX,
      pmDone,
      pmReq,
      amMet: a.kpi_met === true || contacted || amDoneX >= amReqX,
      pmMet: a.kpi_met === true || contacted || pmDone >= pmReq,
      contacted,
    }
  })

  const attemptsMet    = parsedAttempts.filter(r => r.amMet && r.pmMet).length
  const attemptsMissed = parsedAttempts.filter(r => !r.amMet || !r.pmMet).length

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">📋 QA Scorecard</h1>
          <p className="text-gray-400 text-sm mt-1">Case Settlement Now · {rangeLabel}</p>
        </div>

        {/* Date filter pills + custom range */}
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map(r => (
            <Link key={r.key} href={`?range=${r.key}`}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                range === r.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}>
              {r.label}
            </Link>
          ))}
          <form method="GET" className="flex items-center gap-1">
            <input type="hidden" name="range" value="custom" />
            <input type="date" name="from" defaultValue={range === 'custom' ? from : ''}
              className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500" />
            <span className="text-gray-500 text-xs">→</span>
            <input type="date" name="to" defaultValue={range === 'custom' ? to : ''}
              className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500" />
            <button type="submit"
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                range === 'custom'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}>
              Go
            </button>
          </form>
        </div>
      </div>

      {/* ── Avg QA Score pill (static) ── */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 max-w-xs">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Avg QA Score</p>
          <p className={`text-3xl font-bold ${avgScore >= 80 ? 'text-green-400' : avgScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{avgScore}/100</p>
          <p className="text-xs text-gray-600 mt-1">{scores.length} scored calls</p>
        </div>
      </div>

      {/* ── Interactive dashboard (client component) ── */}
      <ClientDashboard
        scores={scores}
        parsedAttempts={parsedAttempts}
        avgScore={avgScore}
        qualified={qualified}
        booked={booked}
        badFlag={badFlag}
        attemptsMet={attemptsMet}
        attemptsMissed={attemptsMissed}
      />

    </div>
  )
}
