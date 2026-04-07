'use client'

import { useState } from 'react'

// ── helpers ───────────────────────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 80) return 'text-green-400'
  if (s >= 60) return 'text-yellow-400'
  if (s > 0)   return 'text-red-400'
  return 'text-gray-500'
}
function scoreBg(s: number) {
  if (s >= 80) return 'bg-green-500'
  if (s >= 60) return 'bg-yellow-500'
  if (s > 0)   return 'bg-red-500'
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
function KpiPill({ status }: { status: string }) {
  if (status === 'ANSWERED')
    return <span className="text-xs px-2 py-0.5 bg-blue-900 text-blue-300 rounded-full font-medium">📞 ANSWERED</span>
  if (status === 'COMPLETE')
    return <span className="text-xs px-2 py-0.5 bg-green-900 text-green-300 rounded-full font-medium">✅ COMPLETE</span>
  if (status === 'FAIL')
    return <span className="text-xs px-2 py-0.5 bg-red-900 text-red-300 rounded-full font-medium">❌ FAIL</span>
  return <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full font-medium">⏳ {status}</span>
}

const CRITERIA: { key: string; label: string; max: number }[] = [
  { key: 'followed_qualification_script',     label: 'Followed Script',    max: 10 },
  { key: 'asked_all_qualification_questions', label: 'Asked All Questions', max: 10 },
  { key: 'call_flow_control',                 label: 'Call Flow Control',   max: 10 },
  { key: 'objection_handling',                label: 'Objection Handling',  max: 10 },
  { key: 'proper_dq_qualification_decision',  label: 'DQ Decision',         max: 10 },
  { key: 'booking_attempt',                   label: 'Booking Attempt',     max: 10 },
]

const GHL_LOC = 'OEvyZgDZMvPWYEYrBTxR'

function BucketCell({ done, req }: { done: number; req: number }) {
  const met = done >= req
  return (
    <div className="flex items-center gap-2">
      <span className={met ? 'text-green-400' : 'text-red-400'}>{done}/{req}</span>
      <div className="w-14 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${met ? 'bg-green-500' : 'bg-red-500'}`}
             style={{ width: `${Math.min(100,(done/req)*100)}%` }} />
      </div>
    </div>
  )
}

// ── types ─────────────────────────────────────────────────────────────────────
type Score = Record<string, any>
type AttemptRow = {
  id: number; date: string; name: string; contactId: string;
  morningDone: number; afternoonDone: number; eveningDone: number;
  contacted: boolean; status: string; createdBucket: string; kpiReason: string;
  // legacy
  amDone: number; amReq: number; pmDone: number; pmReq: number;
  amMet: boolean; pmMet: boolean;
}

type Props = {
  scores: Score[]
  parsedAttempts: AttemptRow[]
  avgScore: number
  qualified: number
  booked: number
  badFlag: number
  attemptsMet: number
  attemptsMissed: number
  attemptsAnswered: number
  attemptsComplete: number
}

// ── QA Scorecard (single call) ────────────────────────────────────────────────
function ScorecardCard({ r, onBack }: { r: Score; onBack?: () => void }) {
  return (
    <div className={`bg-gray-800 rounded-xl border p-4 ${r.management_alert ? 'border-red-700' : 'border-gray-700'}`}>
      {onBack && (
        <button onClick={onBack} className="text-xs text-gray-400 hover:text-white mb-3 flex items-center gap-1">
          ← Back to calls
        </button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-semibold text-white">{r.contact_name || '—'}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${r.call_direction === 'inbound' ? 'bg-blue-900 text-blue-300' : 'bg-purple-900 text-purple-300'}`}>
              {r.call_direction || '—'}
            </span>
            {r.bad_attitude_flag && <span className="text-xs px-2 py-0.5 bg-red-900 text-red-300 rounded-full">🚨 Bad Attitude</span>}
            {r.management_alert  && <span className="text-xs px-2 py-0.5 bg-orange-900 text-orange-300 rounded-full">⚠️ Mgmt Alert</span>}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {r.date} · {r.duration_min ? `${r.duration_min} min` : '—'}
            {r.agent_name ? ` · 👤 ${r.agent_name}` : ''}
          </p>
        </div>
        <div className="text-right">
          <span className={`text-3xl font-black ${scoreColor(r.overall_score ?? 0)}`}>{r.overall_score ?? 0}</span>
          <span className="text-gray-500 text-xs">/100</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
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

      <div className="flex flex-wrap gap-2 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${r.lead_qualified ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
          {r.lead_qualified ? '✅ Qualified' : '❌ Not Qualified'}
        </span>
        {r.dq_reason && <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded-full">DQ: {r.dq_reason}</span>}
        <span className={`text-xs px-2 py-0.5 rounded-full ${r.appointment_booked ? 'bg-blue-900 text-blue-300' : 'bg-gray-700 text-gray-400'}`}>
          {r.appointment_booked ? '📅 Booked' : 'No Booking'}
        </span>
      </div>

      {r.summary && (
        <p className="text-xs text-gray-400 border-t border-gray-700 pt-2 leading-relaxed">{r.summary}</p>
      )}
      {r.top_3_priorities && (
        <p className="text-xs text-yellow-500 mt-1">🎯 {r.top_3_priorities}</p>
      )}
    </div>
  )
}

// ── Agent Call List ───────────────────────────────────────────────────────────
function AgentCallList({
  agentName, calls, onBack, onSelectCall
}: {
  agentName: string
  calls: Score[]
  onBack: () => void
  onSelectCall: (call: Score) => void
}) {
  const sorted = [...calls].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  return (
    <div>
      <button onClick={onBack} className="text-xs text-gray-400 hover:text-white mb-4 flex items-center gap-1">
        ← Back to all agents
      </button>
      <h3 className="text-white font-semibold text-base mb-1">👤 {agentName}</h3>
      <p className="text-xs text-gray-500 mb-4">{calls.length} call{calls.length !== 1 ? 's' : ''} scored — click a row for details</p>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Flags</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => (
              <tr
                key={c.id}
                onClick={() => onSelectCall(c)}
                className="border-b border-gray-800/50 hover:bg-gray-800/60 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-gray-400">{c.date || '—'}</td>
                <td className="px-4 py-3 text-white">{c.contact_name || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.call_direction === 'inbound' ? 'bg-blue-900 text-blue-300' : 'bg-purple-900 text-purple-300'}`}>
                    {c.call_direction || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">{c.duration_min ? `${c.duration_min} min` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`font-bold ${scoreColor(c.overall_score ?? 0)}`}>{c.overall_score ?? 0}</span>
                  <span className="text-gray-600 text-xs">/100</span>
                </td>
                <td className="px-4 py-3 flex gap-1 flex-wrap">
                  {c.voicemail_flag  && <span className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded">VM</span>}
                  {c.bad_attitude_flag && <span className="text-xs px-1.5 py-0.5 bg-red-900 text-red-300 rounded">🚨</span>}
                  {c.management_alert  && <span className="text-xs px-1.5 py-0.5 bg-orange-900 text-orange-300 rounded">⚠️</span>}
                  {!c.voicemail_flag && !c.bad_attitude_flag && !c.management_alert && <span className="text-gray-600 text-xs">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Side Drawer (KPI Table) ───────────────────────────────────────────────────
function Drawer({ attempt, scores, onClose }: { attempt: AttemptRow; scores: Score[]; onClose: () => void }) {
  const contactScores = scores.filter(s => s.contact_id === attempt.contactId)

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-xl bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div>
            <h2 className="font-semibold text-white text-lg capitalize">{attempt.name}</h2>
            <p className="text-xs text-gray-500">{attempt.date} · KPI {attempt.amMet && attempt.pmMet ? '✅ Met' : '❌ Missed'}</p>
          </div>
          <div className="flex items-center gap-3">
            {attempt.contactId && (
              <a
                href={`https://app.gohighlevel.com/v2/location/${GHL_LOC}/contacts/detail/${attempt.contactId}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
              >
                Go to Contact ↗
              </a>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
          </div>
        </div>
        <div className="px-5 py-3 border-b border-gray-800 flex gap-6 text-sm">
          <div>
            <p className="text-gray-500 text-xs">AM Calls</p>
            {attempt.contacted
              ? <p className="text-green-400 font-medium">✅ Contacted</p>
              : <p className={attempt.amMet ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>{attempt.amDone}/{attempt.amReq}</p>
            }
          </div>
          <div>
            <p className="text-gray-500 text-xs">PM Calls</p>
            {attempt.contacted
              ? <p className="text-green-400 font-medium">✅ Contacted</p>
              : <p className={attempt.pmMet ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>{attempt.pmDone}/{attempt.pmReq}</p>
            }
          </div>
          <div>
            <p className="text-gray-500 text-xs">QA Calls scored</p>
            <p className="text-white font-medium">{contactScores.length}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {contactScores.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              <p>No QA scores for this contact</p>
              <p className="text-xs mt-1 text-gray-600">Calls are scored overnight by the QA Agent</p>
            </div>
          ) : (
            contactScores.map(s => <ScorecardCard key={s.id} r={s} />)
          )}
        </div>
      </div>
    </>
  )
}

// ── Stat Drill-Down Card ─────────────────────────────────────────────────────
type StatKind = 'qualified' | 'booked' | 'badAttitude' | null

function StatDrillCard({
  kind, label, value, sub,
  theme, calls, onClose,
}: {
  kind: StatKind
  label: string
  value: number
  sub: string
  theme: { border: string; bg: string; text: string; pillBg: string; pillText: string }
  calls: Score[]
  onClose: () => void
}) {
  const [selectedCall, setSelectedCall] = useState<Score | null>(null)

  return (
    <div className={`rounded-xl border-2 ${theme.border} ${theme.bg} overflow-hidden`}>
      {/* Card header — always visible */}
      <button
        onClick={onClose}
        className="w-full flex items-center justify-between px-5 py-4 hover:brightness-110 transition-all"
      >
        <div className="text-left">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
          <p className={`text-3xl font-bold ${theme.text}`}>{value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
        </div>
        <span className="text-gray-500 text-lg">▲</span>
      </button>

      {/* Expanded list */}
      <div className={`border-t ${theme.border} px-4 pb-4`}>
        {selectedCall ? (
          <div className="pt-3">
            <ScorecardCard r={selectedCall} onBack={() => setSelectedCall(null)} />
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 py-2">Click a row to see the scorecard</p>
            <div className="space-y-1">
              {calls.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCall(c)}
                  className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-800/60 transition-colors"
                >
                  <div>
                    <span className="text-white text-sm">{c.contact_name || '—'}</span>
                    <span className="text-gray-500 text-xs ml-2">{c.date}</span>
                    {c.agent_name && c.agent_name !== 'Unassigned' && (
                      <span className="text-gray-600 text-xs ml-2">· 👤 {c.agent_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${theme.text}`}>{c.overall_score ?? 0}</span>
                    <span className="text-gray-600 text-xs">/100</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${theme.pillBg} ${theme.pillText}`}>
                      {c.call_direction || '—'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main Client Dashboard ─────────────────────────────────────────────────────
export default function ClientDashboard({
  scores, parsedAttempts, avgScore, qualified, booked, badFlag,
  attemptsMet, attemptsMissed, attemptsAnswered, attemptsComplete
}: Props) {
  const [selectedAttempt, setSelectedAttempt] = useState<AttemptRow | null>(null)

  // ── Stat card drill-down state ────────────────────────────────────────────
  const [openStat, setOpenStat] = useState<StatKind>(null)

  const qualifiedCalls   = scores.filter(r => r.lead_qualified === true)
  const bookedCalls      = scores.filter(r => r.appointment_booked === true)
  const badAttitudeCalls = scores.filter(r => r.bad_attitude_flag === true)

  const statCards = [
    {
      kind: 'qualified' as StatKind,
      label: 'Qualified Leads',
      value: qualified,
      sub: `of ${scores.length} real calls`,
      calls: qualifiedCalls,
      theme: {
        border: 'border-blue-700',
        bg: 'bg-blue-950/40',
        text: 'text-blue-400',
        pillBg: 'bg-blue-900',
        pillText: 'text-blue-300',
      },
    },
    {
      kind: 'booked' as StatKind,
      label: 'Appointments Booked',
      value: booked,
      sub: 'from scored calls',
      calls: bookedCalls,
      theme: {
        border: 'border-green-700',
        bg: 'bg-green-950/40',
        text: 'text-green-400',
        pillBg: 'bg-green-900',
        pillText: 'text-green-300',
      },
    },
    {
      kind: 'badAttitude' as StatKind,
      label: '⚠️ Bad Attitude',
      value: badFlag,
      sub: 'flags raised',
      calls: badAttitudeCalls,
      theme: {
        border: 'border-red-700',
        bg: 'bg-red-950/40',
        text: badFlag ? 'text-red-400' : 'text-gray-400',
        pillBg: 'bg-red-900',
        pillText: 'text-red-300',
      },
    },
  ]

  // ── Agent QA state ────────────────────────────────────────────────────────
  const [hiddenAgents, setHiddenAgents] = useState<Set<string>>(new Set())
  const [showAgentFilter, setShowAgentFilter] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [selectedCall, setSelectedCall] = useState<Score | null>(null)

  // Build agent stats from all scores
  type AgentStat = { name: string; calls: number; totalScore: number; qualified: number; booked: number; badFlag: number; callList: Score[] }
  const agentMap: Record<string, AgentStat> = {}
  for (const r of scores) {
    const agent = (r.agent_name && r.agent_name !== 'Unassigned' && r.agent_name !== 'Pending') ? r.agent_name : null
    if (!agent) continue
    if (!agentMap[agent]) agentMap[agent] = { name: agent, calls: 0, totalScore: 0, qualified: 0, booked: 0, badFlag: 0, callList: [] }
    agentMap[agent].calls++
    agentMap[agent].totalScore += r.overall_score ?? 0
    if (r.lead_qualified)     agentMap[agent].qualified++
    if (r.appointment_booked) agentMap[agent].booked++
    if (r.bad_attitude_flag)  agentMap[agent].badFlag++
    agentMap[agent].callList.push(r)
  }
  const allAgents = Object.values(agentMap).sort((a, b) => b.calls - a.calls)
  const visibleAgents = allAgents.filter(a => !hiddenAgents.has(a.name))

  function toggleAgent(name: string) {
    setHiddenAgents(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="space-y-8">

      {/* ── Interactive Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(card => {
          const isOpen = openStat === card.kind
          if (isOpen) {
            return (
              <div key={card.kind} className="sm:col-span-3">
                <StatDrillCard
                  kind={card.kind}
                  label={card.label}
                  value={card.value}
                  sub={card.sub}
                  theme={card.theme}
                  calls={card.calls}
                  onClose={() => setOpenStat(null)}
                />
              </div>
            )
          }
          return (
            <button
              key={card.kind}
              onClick={() => setOpenStat(card.kind)}
              className={`rounded-xl border-2 ${card.theme.border} ${card.theme.bg} p-4 text-left hover:brightness-110 transition-all`}
            >
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">{card.label}</p>
              <p className={`text-3xl font-bold ${card.theme.text}`}>{card.value}</p>
              <p className="text-xs text-gray-500 mt-1">{card.sub}</p>
              <p className="text-xs text-gray-600 mt-2">Click to expand ▼</p>
            </button>
          )
        })}
      </div>

      {/* ── Agent QA Performance ── */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-white">👤 Agent QA Performance</h2>
          {allAgents.length > 0 && !selectedAgent && !selectedCall && (
            <button
              onClick={() => setShowAgentFilter(v => !v)}
              className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors"
            >
              {showAgentFilter ? 'Hide Filter ▲' : `Filter Agents ▼ ${hiddenAgents.size > 0 ? `(${hiddenAgents.size} hidden)` : ''}`}
            </button>
          )}
          {(selectedAgent || selectedCall) && (
            <button
              onClick={() => { setSelectedAgent(null); setSelectedCall(null) }}
              className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors"
            >
              ← All Agents
            </button>
          )}
        </div>

        {/* Agent filter checkboxes */}
        {showAgentFilter && !selectedAgent && !selectedCall && allAgents.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
            <p className="text-xs text-gray-500 mb-3">Check agents to show in the view below. All are available.</p>
            <div className="flex flex-wrap gap-3">
              {allAgents.map(a => (
                <label key={a.name} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!hiddenAgents.has(a.name)}
                    onChange={() => toggleAgent(a.name)}
                    className="accent-orange-500 w-4 h-4"
                  />
                  <span className={`text-sm ${hiddenAgents.has(a.name) ? 'text-gray-600' : 'text-gray-200'}`}>
                    {a.name}
                    <span className="text-gray-600 text-xs ml-1">({a.calls})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Call detail view */}
        {selectedCall ? (
          <ScorecardCard r={selectedCall} onBack={() => setSelectedCall(null)} />
        ) : selectedAgent ? (
          /* Agent call list */
          <AgentCallList
            agentName={selectedAgent}
            calls={agentMap[selectedAgent]?.callList ?? []}
            onBack={() => setSelectedAgent(null)}
            onSelectCall={(call) => setSelectedCall(call)}
          />
        ) : allAgents.length === 0 ? (
          /* No data */
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center text-gray-500">
            No QA scores with agent data yet in this period.
            <p className="text-xs mt-1 text-gray-600">The QA Agent needs to process real calls (non-voicemail) with agent_name assigned.</p>
          </div>
        ) : (
          /* Agent cards grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {visibleAgents.map(a => {
              const avg = a.calls ? Math.round(a.totalScore / a.calls) : 0
              return (
                <div
                  key={a.name}
                  onClick={() => setSelectedAgent(a.name)}
                  className={`bg-gray-900 rounded-xl p-4 border cursor-pointer hover:border-gray-600 transition-all ${a.badFlag > 0 ? 'border-red-800' : 'border-gray-800'}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-white">{a.name}</p>
                      <p className="text-xs text-gray-500">{a.calls} call{a.calls !== 1 ? 's' : ''} scored</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-2xl font-black ${scoreColor(avg)}`}>{avg}</span>
                      <span className="text-sm text-gray-500">/100</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full ${scoreBg(avg)}`} style={{ width: `${avg}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="text-green-400">✅ {a.qualified} qualified</span>
                    <span className="text-blue-400">📅 {a.booked} booked</span>
                    {a.badFlag > 0 && <span className="text-red-400">🚨 {a.badFlag} flag{a.badFlag !== 1 ? 's' : ''}</span>}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">Click to see calls →</p>
                </div>
              )
            })}
            {visibleAgents.length === 0 && allAgents.length > 0 && (
              <div className="col-span-3 text-center text-gray-500 py-6 text-sm">
                All agents are hidden. Use the filter to show them.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Call Attempt KPI ── */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold text-white">
              📞 Call Attempt KPI
              <span className="text-sm text-gray-500 font-normal ml-2">(2 Morning + 2 Afternoon + 2 Evening)</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Click a row to see QA scorecards for that contact</p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="text-blue-400 font-medium">📞 Answered: {attemptsAnswered}</span>
            <span className="text-green-400 font-medium">✅ Complete: {attemptsComplete}</span>
            <span className="text-red-400 font-medium">❌ Fail: {attemptsMissed}</span>
          </div>
        </div>

        {parsedAttempts.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">
            No attempt data in this period.
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">🌅 Morning</th>
                  <th className="px-4 py-3">☀️ Afternoon</th>
                  <th className="px-4 py-3">🌆 Evening</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsedAttempts.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedAttempt(r)}
                    className="border-b border-gray-800/50 hover:bg-gray-800/60 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-white capitalize">{r.name}</span>
                      {r.contactId && <span className="ml-1 text-xs text-gray-600">↗</span>}
                      {r.createdBucket && <span className="ml-2 text-xs text-gray-600">({r.createdBucket})</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{r.date}</td>
                    <td className="px-4 py-3">
                      {r.status === 'ANSWERED' ? <span className="text-blue-400 text-xs">📞</span> : (
                        <BucketCell done={r.morningDone} req={2} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'ANSWERED' ? <span className="text-blue-400 text-xs">📞</span> : (
                        <BucketCell done={r.afternoonDone} req={2} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'ANSWERED' ? <span className="text-blue-400 text-xs">📞</span> : (
                        <div className="flex items-center gap-2">
                          <span className={r.eveningDone >= 2 ? 'text-green-400' : 'text-red-400'}>{r.eveningDone}/2</span>
                          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${r.eveningDone >= 2 ? 'bg-green-500' : 'bg-red-500'}`}
                                 style={{ width: `${Math.min(100,(r.eveningDone/2)*100)}%` }} />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <KpiPill status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Side Drawer (KPI) ── */}
      {selectedAttempt && (
        <Drawer
          attempt={selectedAttempt}
          scores={scores}
          onClose={() => setSelectedAttempt(null)}
        />
      )}
    </div>
  )
}
