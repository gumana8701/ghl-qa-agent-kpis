import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-green-600' :
    score >= 60 ? 'bg-yellow-500' :
    score > 0   ? 'bg-red-600' : 'bg-gray-700'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-white text-xs font-bold ${color}`}>
      {score}
    </span>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 flex flex-col gap-1 border border-gray-800">
      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      <span className={`text-3xl font-bold ${color ?? 'text-white'}`}>{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

export const revalidate = 60

export default async function Dashboard() {
  // QA Scores — last 7 days
  const { data: scores } = await supabase
    .from('qa_scores')
    .select('*')
    .order('id', { ascending: false })
    .limit(100)

  const rows = scores ?? []
  const realCalls = rows.filter((r) => !r.voicemail_flag)
  const voicemails = rows.filter((r) => r.voicemail_flag)
  const avgScore = realCalls.length
    ? Math.round(realCalls.reduce((s, r) => s + (r.overall_score ?? 0), 0) / realCalls.length)
    : 0
  const alerts = rows.filter((r) => r.management_alert)
  const qualified = realCalls.filter((r) => r.lead_qualified === true)

  // Management alerts — ATTEMPTS KPI
  const { data: mgmtAlerts } = await supabase
    .from('management_alerts')
    .select('*')
    .order('id', { ascending: false })
    .limit(50)

  const attemptAlerts = (mgmtAlerts ?? []).filter((a) =>
    (a.summary ?? '').startsWith('ATTEMPTS |')
  )
  const qaAlerts = (mgmtAlerts ?? []).filter((a) =>
    !(a.summary ?? '').startsWith('ATTEMPTS |')
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Case Settlement Now</h1>
          <p className="text-gray-400 text-sm mt-1">QA Agent · Call KPIs · Management Alerts</p>
        </div>
        <span className="text-xs text-gray-500">Auto-refresh every 60s</span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Avg QA Score" value={avgScore} sub={`${realCalls.length} real calls`} color={avgScore >= 70 ? 'text-green-400' : 'text-yellow-400'} />
        <StatCard label="Voicemails" value={voicemails.length} sub={`of ${rows.length} total`} color="text-gray-400" />
        <StatCard label="Qualified Leads" value={qualified.length} sub="from scored calls" color="text-blue-400" />
        <StatCard label="⚠️ Mgmt Alerts" value={alerts.length} sub="bad attitude / violations" color={alerts.length > 0 ? 'text-red-400' : 'text-green-400'} />
      </div>

      {/* KPI Attempt Alerts */}
      {attemptAlerts.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-yellow-400">📞 Call Attempt KPI Failures</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Issue</th>
                </tr>
              </thead>
              <tbody>
                {attemptAlerts.slice(0, 20).map((a) => {
                  const parts = (a.summary ?? '').split(' | ')
                  const name = parts[1] ?? '—'
                  const issue = parts[3] ?? a.summary
                  return (
                    <tr key={a.id} className="border-b border-gray-800/50 hover:bg-gray-800/40">
                      <td className="px-4 py-2 text-gray-400">{a.date}</td>
                      <td className="px-4 py-2 text-white capitalize">{name}</td>
                      <td className="px-4 py-2 text-yellow-300">{issue}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* QA Scores table */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-white">🎯 QA Scores — Last 100 calls</h2>
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Qualified</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Summary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/40">
                  <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{r.date}</td>
                  <td className="px-4 py-2 text-white">{r.contact_name || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${r.call_direction === 'inbound' ? 'bg-blue-900 text-blue-300' : 'bg-purple-900 text-purple-300'}`}>
                      {r.call_direction || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {r.voicemail_flag ? (
                      <span className="text-xs text-gray-500 italic">voicemail</span>
                    ) : (
                      <ScoreBadge score={r.overall_score ?? 0} />
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {r.voicemail_flag ? '—' :
                      r.lead_qualified === true ? <span className="text-green-400 text-xs">✅ Yes</span> :
                      r.lead_qualified === false ? <span className="text-red-400 text-xs">❌ No</span> :
                      <span className="text-gray-500 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-400">{r.duration_min ? `${r.duration_min}m` : '—'}</td>
                  <td className="px-4 py-2 text-gray-400 max-w-xs truncate">{r.summary || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* QA Management Alerts */}
      {qaAlerts.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 text-red-400">🚨 QA Management Alerts</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Summary</th>
                  <th className="px-4 py-3">Top Priorities</th>
                </tr>
              </thead>
              <tbody>
                {qaAlerts.map((a) => (
                  <tr key={a.id} className="border-b border-gray-800/50 hover:bg-gray-800/40">
                    <td className="px-4 py-2 text-gray-400">{a.date}</td>
                    <td className="px-4 py-2"><ScoreBadge score={a.overall_score ?? 0} /></td>
                    <td className="px-4 py-2 text-white max-w-xs truncate">{a.summary}</td>
                    <td className="px-4 py-2 text-yellow-300 text-xs max-w-xs truncate">{a.top_3_priorities}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
