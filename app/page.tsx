import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key)
}

// ── helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 80) return 'text-green-400'
  if (s >= 60) return 'text-yellow-400'
  if (s > 0)  return 'text-red-400'
  return 'text-gray-500'
}

function scoreBg(s: number) {
  if (s >= 80) return 'bg-green-500'
  if (s >= 60) return 'bg-yellow-500'
  if (s > 0)  return 'bg-red-500'
  return 'bg-gray-700'
}

function Bar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${scoreBg(pct)}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function KpiPill({ met }: { met: boolean }) {
  return met
    ? <span className="text-xs px-2 py-0.5 bg-green-900 text-green-300 rounded-full font-medium">✅ Met</span>
    : <span className="text-xs px-2 py-0.5 bg-red-900 text-red-300 rounded-full font-medium">❌ Missed</span>
}

// ── criteria labels ───────────────────────────────────────────────────────────
const CRITERIA: { key: string; label: string; max: number }[] = [
  { key: 'followed_qualification_script',      label: 'Followed Script',         max: 10 },
  { key: 'asked_all_qualification_questions',  label: 'Asked All Questions',      max: 10 },
  { key: 'call_flow_control',                  label: 'Call Flow Control',        max: 10 },
  { key: 'objection_handling',                 label: 'Objection Handling',       max: 10 },
  { key: 'proper_dq_qualification_decision',   label: 'DQ Decision',              max: 10 },
  { key: 'booking_attempt',                    label: 'Booking Attempt',          max: 10 },
]

// ── page ─────────────────────────────────────────────────────────────────────
export default async function Dashboard() {
  const supabase = getSupabase()
  if (!supabase) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-400 text-lg">⚠️ Missing Supabase env vars — add them in Vercel Settings.</p>
      </div>
    )
  }

  // QA scores — real calls only (non-voicemail)
  const { data: rawScores } = await supabase
    .from('qa_scores')
    .select('*')
    .eq('voicemail_flag', false)
    .order('id', { ascending: false })
    .limit(50)

  // Management alerts — attempt KPI entries
  const { data: rawAlerts } = await supabase
    .from('management_alerts')
    .select('*')
    .order('id', { ascending: false })
    .limit(100)

  const scores   = rawScores  ?? []
  const alerts   = rawAlerts  ?? []

  const attemptRows = alerts.filter(a => (a.summary ?? '').startsWith('ATTEMPTS |'))
  const qaAlertRows = alerts.filter(a => a.management_alert === true || (!(a.summary ?? '').startsWith('ATTEMPTS |') && a.overall_score > 0))

  // Summary stats
  const avgScore  = scores.length
    ? Math.round(scores.reduce((s, r) => s + (r.overall_score ?? 0), 0) / scores.length)
    : 0
  const qualified = scores.filter(r => r.lead_qualified === true).length
  const booked    = scores.filter(r => r.appointment_booked === true).length
  const badFlag   = scores.filter(r => r.bad_attitude_flag === true).length

  // Parse attempt KPI rows
  // summary format: "ATTEMPTS | name | contactId | AM:2/3 PM:1/3"
  const parsedAttempts = attemptRows.map(a => {
    const parts     = (a.summary ?? '').split(' | ')
    const name      = parts[1]?.trim() ?? '—'
    const contactId = parts[2]?.trim() ?? ''
    const rest      = parts[3]?.trim() ?? ''
    const amMatch = rest.match(/AM:(\d+)\/(\d+)/)
    const pmMatch = rest.match(/PM:(\d+)\/(\d+)/)
    const amDone = parseInt(amMatch?.[1] ?? '0')
    const amReq  = parseInt(amMatch?.[2] ?? '3')
    const pmDone = parseInt(pmMatch?.[1] ?? '0')
    const pmReq  = parseInt(pmMatch?.[2] ?? '3')
    return { id: a.id, date: a.date, name, contactId, amDone, amReq, pmDone, pmReq,
             amMet: amDone >= amReq, pmMet: pmDone >= pmReq }
  })

  const attemptsMet    = parsedAttempts.filter(r => r.amMet && r.pmMet).length
  const attemptsMissed = parsedAttempts.filter(r => !r.amMet || !r.pmMet).length

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-white">📋 QA Scorecard</h1>
        <p className="text-gray-400 text-sm mt-1">Case Settlement Now — Agent Performance Dashboard</p>
      </div>

      {/* ── Summary row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg QA Score',       value: `${avgScore}/100`,   color: scoreColor(avgScore),   sub: `${scores.length} scored calls` },
          { label: 'Qualified Leads',     value: qualified,            color: 'text-blue-400',        sub: `of ${scores.length} real calls` },
          { label: 'Appointments Booked', value: booked,               color: 'text-green-400',       sub: 'from scored calls' },
          { label: '⚠️ Bad Attitude',     value: badFlag,              color: badFlag ? 'text-red-400' : 'text-gray-400', sub: 'flags raised' },
        ].map(c => (
          <div key={c.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{c.label}</p>
            <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-600 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ── QA Scorecards ── */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">🎯 QA Scorecards — Real Interactions</h2>

        {scores.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">
            No scored calls yet. Voicemail/no-answer calls are excluded.
          </div>
        ) : (
          <div className="space-y-4">
            {scores.map(r => (
              <div key={r.id} className={`bg-gray-900 rounded-xl border p-5 ${r.management_alert ? 'border-red-700' : 'border-gray-800'}`}>
                {/* Card header */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.contact_id ? (
                        <a href={`https://app.leadconnectorhq.com/contacts/detail/${r.contact_id}`}
                           target="_blank" rel="noopener noreferrer"
                           className="font-semibold text-blue-400 hover:text-blue-300 hover:underline text-base">
                          {r.contact_name || 'Unknown'} ↗
                        </a>
                      ) : (
                        <span className="font-semibold text-white text-base">{r.contact_name || 'Unknown'}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.call_direction === 'inbound' ? 'bg-blue-900 text-blue-300' : 'bg-purple-900 text-purple-300'}`}>
                        {r.call_direction || '—'}
                      </span>
                      {r.bad_attitude_flag && <span className="text-xs px-2 py-0.5 bg-red-900 text-red-300 rounded-full">🚨 Bad Attitude</span>}
                      {r.management_alert  && <span className="text-xs px-2 py-0.5 bg-orange-900 text-orange-300 rounded-full">⚠️ Mgmt Alert</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{r.date} · {r.duration_min ? `${r.duration_min} min` : '—'} · {r.phone || '—'}</p>
                  </div>
                  {/* Big score */}
                  <div className="text-right">
                    <span className={`text-4xl font-black ${scoreColor(r.overall_score ?? 0)}`}>{r.overall_score ?? 0}</span>
                    <span className="text-gray-500 text-sm">/100</span>
                  </div>
                </div>

                {/* Criteria bars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {CRITERIA.map(c => {
                    const val = r[c.key] ?? 0
                    return (
                      <div key={c.key}>
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>{c.label}</span>
                          <span className={scoreColor(val * 10)}>{val}/{c.max}</span>
                        </div>
                        <Bar value={val} max={c.max} />
                      </div>
                    )
                  })}
                </div>

                {/* Outcome pills */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.lead_qualified ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'}`}>
                    {r.lead_qualified ? '✅ Qualified' : '❌ Not Qualified'}
                  </span>
                  {r.dq_reason && <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full">DQ: {r.dq_reason}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.appointment_booked ? 'bg-blue-900 text-blue-300' : 'bg-gray-800 text-gray-400'}`}>
                    {r.appointment_booked ? '📅 Booked' : 'No Booking'}
                  </span>
                </div>

                {/* Summary */}
                {r.summary && (
                  <p className="text-xs text-gray-400 border-t border-gray-800 pt-3 leading-relaxed">{r.summary}</p>
                )}
                {r.top_3_priorities && (
                  <p className="text-xs text-yellow-500 mt-1">🎯 {r.top_3_priorities}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Call Attempt KPI ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">📞 Call Attempt KPI <span className="text-sm text-gray-500 font-normal">(3 AM + 3 PM per lead)</span></h2>
          <div className="flex gap-3 text-sm">
            <span className="text-green-400 font-medium">✅ Met: {attemptsMet}</span>
            <span className="text-red-400 font-medium">❌ Missed: {attemptsMissed}</span>
          </div>
        </div>

        {parsedAttempts.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">
            No attempt data yet.
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">AM Calls</th>
                  <th className="px-4 py-3">PM Calls</th>
                  <th className="px-4 py-3">KPI</th>
                </tr>
              </thead>
              <tbody>
                {parsedAttempts.map(r => (
                  <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/40">
                    <td className="px-4 py-3">
                      {r.contactId ? (
                        <a href={`https://app.leadconnectorhq.com/contacts/detail/${r.contactId}`}
                           target="_blank" rel="noopener noreferrer"
                           className="text-blue-400 hover:text-blue-300 hover:underline capitalize">
                          {r.name} ↗
                        </a>
                      ) : (
                        <span className="text-white capitalize">{r.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{r.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={r.amMet ? 'text-green-400' : 'text-red-400'}>
                          {r.amDone}/{r.amReq}
                        </span>
                        <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${r.amMet ? 'bg-green-500' : 'bg-red-500'}`}
                               style={{ width: `${Math.min(100,(r.amDone/r.amReq)*100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={r.pmMet ? 'text-green-400' : 'text-red-400'}>
                          {r.pmDone}/{r.pmReq}
                        </span>
                        <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${r.pmMet ? 'bg-green-500' : 'bg-red-500'}`}
                               style={{ width: `${Math.min(100,(r.pmDone/r.pmReq)*100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><KpiPill met={r.amMet && r.pmMet} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}
