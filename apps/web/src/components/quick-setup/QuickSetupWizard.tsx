'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Sparkles, X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import type { DiscordChannel } from '@/lib/discord-channels'
import type { Translations } from '@/i18n/translations'

export type QuickSetupData = {
  panelName: string
  accentColor: string
  presenceChannelId: string | null
  warningChannelId: string | null
  notificationChannelId: string | null
  logChannelId: string | null
  presenceEnabled: boolean
  absenceEnabled: boolean
  warningEnabled: boolean
  contributionEnabled: boolean
  accountingEnabled: boolean
  vdaEnabled: boolean
  presenceMessageTime: string
  reminderTime: string
  timezone: string
}

type CompleteAction = (data: Partial<QuickSetupData> & { markComplete: boolean }) => Promise<void>

const TIMEZONES = [
  'Europe/Paris', 'Europe/London', 'Europe/Berlin', 'Europe/Madrid',
  'America/New_York', 'America/Los_Angeles', 'America/Chicago',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney',
]

export default function QuickSetupWizard({
  initialData,
  channels,
  autoOpen,
  completeAction,
  q,
}: {
  initialData: QuickSetupData
  channels: DiscordChannel[]
  autoOpen: boolean
  completeAction: CompleteAction
  q: Translations['quickSetup']
}) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen)
  const [step, setStep] = useState(0)
  const [data, setData] = useState<QuickSetupData>(initialData)
  const [isPending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const steps = [q.stepAppearance, q.stepDiscord, q.stepModules, q.stepSchedule]
  const lastStep = steps.length - 1

  function update<K extends keyof QuickSetupData>(key: K, value: QuickSetupData[K]) {
    setData((d) => ({ ...d, [key]: value }))
  }

  function launch() {
    setStep(0)
    setData(initialData)
    setOpen(true)
  }

  function finish(markComplete: boolean) {
    startTransition(async () => {
      await completeAction({ ...data, markComplete })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        onClick={launch}
        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--hover)] transition-colors text-[var(--text-3)]"
        title={q.triggerLabel}
      >
        <Sparkles size={15} />
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--bg)]/90 backdrop-blur-sm p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[var(--accent)]" />
                <h2 className="text-base font-bold text-[var(--text)]">{q.title}</h2>
              </div>
              <button
                onClick={() => finish(true)}
                disabled={isPending}
                className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex gap-1 px-6 pt-4">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)]'}`}
                />
              ))}
            </div>
            <p className="px-6 pt-2 text-xs text-[var(--text-3)]">
              {q.stepLabel} {step + 1}/{steps.length} — {steps[step]}
            </p>

            <div className="px-6 py-5 space-y-4 max-h-[55vh] overflow-y-auto">
              {step === 0 && <AppearanceStep data={data} update={update} q={q} />}
              {step === 1 && <DiscordStep data={data} update={update} channels={channels} q={q} />}
              {step === 2 && <ModulesStep data={data} update={update} q={q} />}
              {step === 3 && <ScheduleStep data={data} update={update} q={q} />}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)]">
              <button
                onClick={() => finish(true)}
                disabled={isPending}
                className="text-xs text-[var(--text-3)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
              >
                {q.skip}
              </button>
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button
                    onClick={() => setStep((s) => s - 1)}
                    disabled={isPending}
                    className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text)] hover:bg-[var(--hover)] transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <ChevronLeft size={14} /> {q.back}
                  </button>
                )}
                {step < lastStep ? (
                  <button
                    onClick={() => setStep((s) => s + 1)}
                    disabled={isPending}
                    className="px-4 py-2 btn-primary text-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    {q.next} <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={() => finish(true)}
                    disabled={isPending}
                    className="px-4 py-2 btn-primary text-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    <Check size={14} /> {isPending ? q.saving : q.finish}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

type StepProps = {
  data: QuickSetupData
  update: <K extends keyof QuickSetupData>(key: K, value: QuickSetupData[K]) => void
  q: Translations['quickSetup']
}

function AppearanceStep({ data, update, q }: StepProps) {
  return (
    <>
      <p className="text-sm text-[var(--text-2)]">{q.appearanceHint}</p>
      <div>
        <label className="block text-sm font-medium text-[var(--text)] mb-1">{q.panelNameLabel}</label>
        <input
          value={data.panelName}
          onChange={(e) => update('panelName', e.target.value)}
          maxLength={50}
          className="w-full input px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text)] mb-1">{q.accentColorLabel}</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={data.accentColor}
            onChange={(e) => update('accentColor', e.target.value)}
            className="h-10 w-14 bg-[var(--bg)] border border-[var(--border)] rounded-lg cursor-pointer p-1"
          />
          <span className="text-sm text-[var(--text-2)] font-mono">{data.accentColor}</span>
        </div>
      </div>
    </>
  )
}

function ChannelSelect({
  value,
  onChange,
  channels,
  q,
}: {
  value: string | null
  onChange: (v: string | null) => void
  channels: DiscordChannel[]
  q: Translations['quickSetup']
}) {
  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5)
  if (textChannels.length === 0) {
    return (
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={q.channelIdPlaceholder}
        className="w-full input px-3 py-2 text-sm font-mono"
      />
    )
  }
  const categories = new Map(channels.filter((c) => c.type === 4).map((c) => [c.id, c]))
  const uncategorized = textChannels
    .filter((c) => !c.parent_id || !categories.has(c.parent_id))
    .sort((a, b) => a.position - b.position)
  const grouped = [...categories.values()]
    .sort((a, b) => a.position - b.position)
    .map((category) => ({
      category,
      channels: textChannels.filter((c) => c.parent_id === category.id).sort((a, b) => a.position - b.position),
    }))
    .filter((g) => g.channels.length > 0)

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full input px-3 py-2 text-sm"
    >
      <option value="">{q.noneOption}</option>
      {uncategorized.map((ch) => (
        <option key={ch.id} value={ch.id}># {ch.name}</option>
      ))}
      {grouped.map(({ category, channels: chs }) => (
        <optgroup key={category.id} label={category.name}>
          {chs.map((ch) => (
            <option key={ch.id} value={ch.id}># {ch.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

function DiscordStep({ data, update, channels, q }: StepProps & { channels: DiscordChannel[] }) {
  const fields = [
    { key: 'presenceChannelId', label: q.presenceChannelLabel },
    { key: 'warningChannelId', label: q.warningChannelLabel },
    { key: 'notificationChannelId', label: q.notificationChannelLabel },
    { key: 'logChannelId', label: q.logChannelLabel },
  ] as const

  return (
    <>
      <p className="text-sm text-[var(--text-2)]">{q.discordHint}</p>
      {fields.map(({ key, label }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-[var(--text)] mb-1.5">{label}</label>
          <ChannelSelect
            value={data[key]}
            onChange={(v) => update(key, v)}
            channels={channels}
            q={q}
          />
        </div>
      ))}
    </>
  )
}

function ModuleToggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
      <div>
        <p className="text-sm text-[var(--text)]">{label}</p>
        <p className="text-xs text-[var(--text-3)] mt-0.5">{desc}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)]'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

function ModulesStep({ data, update, q }: StepProps) {
  const modules = [
    { key: 'presenceEnabled', label: q.presenceModule, desc: q.presenceModuleDesc },
    { key: 'absenceEnabled', label: q.absenceModule, desc: q.absenceModuleDesc },
    { key: 'warningEnabled', label: q.warningModule, desc: q.warningModuleDesc },
    { key: 'contributionEnabled', label: q.contributionModule, desc: q.contributionModuleDesc },
    { key: 'accountingEnabled', label: q.accountingModule, desc: q.accountingModuleDesc },
    { key: 'vdaEnabled', label: 'VDA', desc: q.vdaModuleDesc },
  ] as const

  return (
    <>
      <p className="text-sm text-[var(--text-2)]">{q.modulesHint}</p>
      <div className="space-y-2">
        {modules.map(({ key, label, desc }) => (
          <ModuleToggle key={key} label={label} desc={desc} checked={data[key]} onChange={(v) => update(key, v)} />
        ))}
      </div>
    </>
  )
}

function ScheduleStep({ data, update, q }: StepProps) {
  return (
    <>
      <p className="text-sm text-[var(--text-2)]">{q.scheduleHint}</p>
      <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
        <span className="text-sm text-[var(--text)]">{q.presenceMessageTimeLabel}</span>
        <input
          type="time"
          value={data.presenceMessageTime}
          onChange={(e) => update('presenceMessageTime', e.target.value)}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>
      <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
        <span className="text-sm text-[var(--text)]">{q.reminderTimeLabel}</span>
        <input
          type="time"
          value={data.reminderTime}
          onChange={(e) => update('reminderTime', e.target.value)}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text)] mb-1.5">{q.timezoneLabel}</label>
        <select
          value={data.timezone}
          onChange={(e) => update('timezone', e.target.value)}
          className="w-full input px-3 py-2 text-sm"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>
    </>
  )
}
