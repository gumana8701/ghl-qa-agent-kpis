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
  if (status === 'NOT_ANSWERED')
    return <span className="text-xs px-2 py-0.5 bg-orange-900 text-orange-300 rounded-full font-medium">📵 NOT ANSWERED</span>
  if (status === 'FAIL')
    return <span className="text-xs px-2 py-0.5 bg-red-900 text-red-300 rounded-full font-medium">❌ FAIL</span>
  return <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full font-medium">⏳ {status}</span>
}

const CRITERIA: { key: string; label: string; max: number }[] = [
  { key: 'followed_qualification_script',     label: 'Followed Script',    max: 100 },
  { key: 'asked_all_qualification_questions', label: 'Asked All Questions', max: 100 },
  { key: 'call_flow_control',                 label: 'Call Flow Control',   max: 100 },
  { key: 'objection_handling',                label: 'Objection Handling',  max: 100 },
  { key: 'proper_dq_qualification_decision',  label: 'DQ Decision',         max: 100 },
  { key: 'booking_attempt',                   label: 'Booking Attempt',     max: 100 },
]

const GHL_LOC = 'OEvyZgDZMvPWYEYrBTxR'


// ── 3-day follow-up helpers (all times shown in Central Time) ────────────────
const DAY_REQ = 6 // required human attempts per day (Day 1/2/3 after lead entry)

function ctFmt(iso: string, opts: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', { timeZone: 'America/Chicago', ...opts })
}
function ctDateStr(iso: string): string {
  return ctFmt(iso, { year: 'numeric', month: '2-digit', day: '2-digit' })
}
function ctTimeStr(iso: string): string {
  return ctFmt(iso, { hour: 'numeric', minute: '2-digit', hour12: true })
}
// "45m ago" / "3h ago" / "2d ago" — relative to now
function sinceLabel(iso: string): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (isNaN(ms) || ms < 0) return ''
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  return `${d}d ago`
}
// Which follow-up day (1..3) a given attempt falls on, relative to entry (CT calendar days)
function ctDayKey(iso: string): string {
  return ctFmt(iso, { year: 'numeric', month: '2-digit', day: '2-digit' })
}
function followupDayIndex(attemptIso: string, entryIso: string): number {
  const entry = new Date(entryIso); const t = new Date(attemptIso)
  if (isNaN(entry.getTime()) || isNaN(t.getTime())) return 0
  const dayMs = 24 * 3600 * 1000
  for (let i = 0; i < 3; i++) {
    if (ctDayKey(new Date(entry.getTime() + i * dayMs).toISOString()) === ctDayKey(attemptIso)) return i
  }
  return t > entry ? 2 : 0
}
// Label for follow-up day i (0-based) relative to entry: "Aug 6" style + Today/Tomorrow
function followupDayLabel(entryIso: string, i: number): string {
  if (!entryIso) return `Day ${i + 1}`
  const d = new Date(new Date(entryIso).getTime() + i * 24 * 3600 * 1000)
  const todayKey = ctDayKey(new Date().toISOString())
  const key = ctDayKey(d.toISOString())
  const short = d.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' })
  return key === todayKey ? `${short} (today)` : short
}
// Whether follow-up day i (0-based) is still in the future (CT)
function dayIsFuture(entryIso: string, i: number): boolean {
  if (!entryIso) return false
  const d = new Date(new Date(entryIso).getTime() + i * 24 * 3600 * 1000)
  return ctDayKey(d.toISOString()) > ctDayKey(new Date().toISOString())
}

// One "Day N" cell: dots for clustered attempts + n/6
function DayCell({ done, future, times }: { done: number; future: boolean; times: string[] }) {
  if (future) return <span className="text-gray-600 text-xs">upcoming</span>
  const met = done >= DAY_REQ
  const dots = []
  for (let i = 0; i < DAY_REQ; i++) {
    dots.push(
      <span key={i} title={times[i] ? ctTimeStr(times[i]) + ' CT' : ''}
        className={`inline-block w-2 h-2 rounded-full ${i < done ? (met ? 'bg-green-400' : 'bg-blue-400') : 'bg-gray-700'}`} />
    )
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">{dots}</div>
      <span className={`text-xs ${met ? 'text-green-400' : done > 0 ? 'text-blue-300' : 'text-gray-500'}`}>{done}/{DAY_REQ}</span>
    </div>
  )
}

// ── types ─────────────────────────────────────────────────────────────────────
type Score = Record<string, any>
type AttemptRow = {
  id: number; date: string; name: string; contactId: string;
  day1Done: number; day2Done: number; day3Done: number; totalDone: number;
  attemptTimes: string[]; entryIso: string; windowEndIso: string;
  contacted: boolean; status: string; createdBucket: string; kpiReason: string;
  completionPct: number; contactDurationSec: number;
  // legacy
  morningDone: number; afternoonDone: number; eveningDone: number;
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
                <span className={scoreColor(val)}>{val}/{c.max}</span>
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

  const attemptTimes = attempt.attemptTimes ?? []
  const drawerDayTimes: string[][] = [[], [], []]
  attemptTimes.forEach(t => { drawerDayTimes[followupDayIndex(t, attempt.entryIso)].push(t) })

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-xl bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div>
            <h2 className="font-semibold text-white text-lg capitalize">{attempt.name}</h2>
            <p className="text-xs text-gray-500">Entered {ctFmt(attempt.entryIso, { month: 'short', day: 'numeric' })} · {ctTimeStr(attempt.entryIso)} CT ({sinceLabel(attempt.entryIso)}) · 3-day follow-up window</p>
          </div>
          <div className="flex items-center gap-3">
            {attempt.contactId && (
              <a
                href={`https://app.gohighlevel.com/v2/location/${GHL_LOC}/contacts/detail/${attempt.contactId}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
              >
                Open in GHL ↗
              </a>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Status summary banner */}
        {attempt.status === 'ANSWERED' && (
          <div className="px-5 py-3 bg-blue-950/60 border-b border-blue-800 flex items-center gap-3">
            <span className="text-2xl">📞</span>
            <div>
              <p className="text-blue-300 font-semibold text-sm">Client Answered</p>
              <p className="text-blue-400 text-xs mt-0.5">
                {attempt.kpiReason || 'Lead picked up during follow-up sequence — no further attempts needed.'}
              </p>
            </div>
          </div>
        )}
        {attempt.status === 'COMPLETE' && (
          <div className="px-5 py-3 bg-green-950/60 border-b border-green-800 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-green-300 font-semibold text-sm">All Attempts Completed</p>
              <p className="text-green-400 text-xs mt-0.5">
                {attempt.kpiReason || 'All 18 required attempts (6 per day × 3 days) were made.'}
              </p>
            </div>
          </div>
        )}
        {attempt.status === 'NOT_ANSWERED' && (
          <div className="px-5 py-3 bg-orange-950/60 border-b border-orange-800 flex items-center gap-3">
            <span className="text-2xl">📵</span>
            <div>
              <p className="text-orange-300 font-semibold text-sm">Not Answered — All Attempts Exhausted</p>
              <p className="text-orange-400 text-xs mt-0.5">
                {attempt.kpiReason || 'All attempts were made but lead never picked up.'}
              </p>
            </div>
          </div>
        )}
        {attempt.status === 'FAIL' && (
          <div className="px-5 py-3 bg-red-950/60 border-b border-red-800 flex items-center gap-3">
            <span className="text-2xl">❌</span>
            <div>
              <p className="text-red-300 font-semibold text-sm">Incomplete — Tracking Window Expired</p>
              <p className="text-red-400 text-xs mt-0.5">
                {attempt.kpiReason || 'Tracking window expired without completing all required attempts.'}
              </p>
            </div>
          </div>
        )}
        {attempt.status === 'IN_PROGRESS' && (
          <div className="px-5 py-3 bg-yellow-950/60 border-b border-yellow-800 flex items-center gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <p className="text-yellow-300 font-semibold text-sm">In Progress</p>
              <p className="text-yellow-400 text-xs mt-0.5">
                {attempt.kpiReason || 'Follow-up sequence still active.'}
              </p>
            </div>
          </div>
        )}

        {/* 3-day timeline detail */}
        <div className="px-5 py-4 border-b border-gray-800 space-y-3">
          {[0, 1, 2].map(i => {
            const done = [attempt.day1Done, attempt.day2Done, attempt.day3Done][i]
            const future = dayIsFuture(attempt.entryIso, i)
            return (
              <div key={i} className="flex items-start gap-3">
                <div className="w-24 shrink-0">
                  <p className="text-gray-400 text-xs font-medium">Day {i + 1}</p>
                  <p className="text-gray-600 text-[10px]">{followupDayLabel(attempt.entryIso, i)}</p>
                </div>
                <div className="flex-1">
                  {attempt.status === 'ANSWERED' && done === 0 && !future
                    ? <p className="text-blue-400 text-xs">📞 Answered — no further attempts needed</p>
                    : <>
                        <DayCell done={done} future={future} times={drawerDayTimes[i]} />
                        {drawerDayTimes[i].length > 0 && (
                          <p className="text-[10px] text-gray-500 mt-1">
                            {drawerDayTimes[i].map(t => ctTimeStr(t)).join(' · ')} CT
                          </p>
                        )}
                      </>}
                </div>
              </div>
            )
          })}
          <div className="pt-1 flex gap-6 text-sm border-t border-gray-800/60">
            <div className="pt-2">
              <p className="text-gray-500 text-xs">Total attempts</p>
              <p className="text-white font-medium">{attempt.totalDone}/18</p>
            </div>
            <div className="pt-2">
              <p className="text-gray-500 text-xs">QA Calls scored</p>
              <p className="text-white font-medium">{contactScores.length}</p>
            </div>
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
              📞 Human Follow-Up — 3-Day Rule
              <span className="text-sm text-gray-500 font-normal ml-2">(6 call attempts/day × 3 days from lead entry · calls &lt;45 min apart count as 1 attempt)</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Click a row to see QA scorecards for that contact</p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="text-blue-400 font-medium">📞 Answered: {attemptsAnswered}</span>
            <span className="text-green-400 font-medium">✅ Complete: {attemptsComplete}</span>
            <span className="text-orange-400 font-medium">📵 Not Answered: {parsedAttempts.filter(r => r.status === 'NOT_ANSWERED').length}</span>
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
                  <th className="px-4 py-3">Entered</th>
                  <th className="px-4 py-3">Day 1</th>
                  <th className="px-4 py-3">Day 2</th>
                  <th className="px-4 py-3">Day 3</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsedAttempts.map(r => {
                  const times = r.attemptTimes ?? []
                  const dayTimes: string[][] = [[], [], []]
                  times.forEach(t => { dayTimes[followupDayIndex(t, r.entryIso)].push(t) })
                  return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedAttempt(r)}
                    className="border-b border-gray-800/50 hover:bg-gray-800/60 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-white capitalize">{r.name}</span>
                      {r.contactId && <span className="ml-1 text-xs text-gray-600">↗</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      <div>{ctDateStr(r.entryIso) !== '—' ? ctFmt(r.entryIso, { month: 'short', day: 'numeric' }) : r.date} · {ctTimeStr(r.entryIso)}</div>
                      <div className="text-xs text-gray-600">{sinceLabel(r.entryIso)}</div>
                    </td>
                    {[0, 1, 2].map(i => (
                      <td key={i} className="px-4 py-3">
                        {r.status === 'ANSWERED' ? <span className="text-blue-400 text-xs">📞</span> : (
                          <div>
                            <DayCell done={[r.day1Done, r.day2Done, r.day3Done][i]} future={dayIsFuture(r.entryIso, i)} times={dayTimes[i]} />
                            <div className="text-[10px] text-gray-600 mt-0.5">{followupDayLabel(r.entryIso, i)}</div>
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      {(() => {
                        const pct = r.completionPct ?? 0
                        const color = pct >= 100 ? 'text-green-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400'
                        return (
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${color} whitespace-nowrap`}>{r.status === 'ANSWERED' ? '📞' : `${r.totalDone}/18`}</span>
                            <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                   style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <KpiPill status={r.status} />
                    </td>
                  </tr>
                  )
                })}
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
