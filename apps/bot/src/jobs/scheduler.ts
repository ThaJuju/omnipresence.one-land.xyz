import cron from 'node-cron'
import { prisma } from '@repo/db'
import type { GuildConfig, GuildInstance } from '@repo/db'
import { logger } from '../logger'
import { runDailyPresence } from './dailyPresence'
import { runReminder } from './reminder'
import { runWarningCheck } from './warningCheck'
import { runDailyReport } from './dailyReport'
import { runWeeklyReport } from './weeklyReport'
import { runMonthlyReport } from './monthlyReport'

const scheduledTasks = new Map<string, cron.ScheduledTask[]>()

function destroyGuildTasks(discordGuildId: string) {
  const tasks = scheduledTasks.get(discordGuildId) ?? []
  tasks.forEach((t) => t.stop())
  scheduledTasks.delete(discordGuildId)
}

function scheduleForGuild(config: GuildConfig & { guild: GuildInstance }) {
  const { guildId } = config
  const discordGuildId = config.guild.discordGuildId
  const tz = config.timezone

  destroyGuildTasks(discordGuildId)
  const tasks: cron.ScheduledTask[] = []

  if (config.presenceEnabled) {
    const [ph, pm] = config.presenceMessageTime.split(':') as [string, string]
    tasks.push(cron.schedule(`${pm} ${ph} * * *`, () => runDailyPresence(guildId), { timezone: tz }))
  }

  if (config.reminderEnabled) {
    const [rh, rm] = config.reminderTime.split(':') as [string, string]
    tasks.push(cron.schedule(`${rm} ${rh} * * *`, () => runReminder(guildId), { timezone: tz }))
  }

  if (config.warningEnabled && config.warningCheckEnabled) {
    const [wh, wm] = config.warningCheckTime.split(':') as [string, string]
    tasks.push(cron.schedule(`${wm} ${wh} * * *`, () => runWarningCheck(guildId), { timezone: tz }))
  }

  if (config.dailyReportEnabled) {
    tasks.push(cron.schedule('0 8 * * *', () => runDailyReport(guildId), { timezone: tz }))
  }

  if (config.weeklyReportEnabled) {
    tasks.push(cron.schedule('0 8 * * 1', () => runWeeklyReport(guildId), { timezone: tz }))
  }

  if (config.monthlyReportEnabled) {
    tasks.push(cron.schedule('0 8 1 * *', () => runMonthlyReport(guildId), { timezone: tz }))
  }

  scheduledTasks.set(discordGuildId, tasks)
  logger.info({ discordGuildId }, 'Scheduled crons for guild')
}

export async function initScheduler() {
  const configs = await prisma.guildConfig.findMany({
    where: { guild: { isActive: true, isBanned: false } },
    include: { guild: true },
  })

  for (const config of configs) {
    scheduleForGuild(config)
  }

  logger.info(`Scheduler initialized for ${configs.length} guild(s)`)
}

export async function reloadGuildSchedule(discordGuildId: string) {
  const guild = await prisma.guildInstance.findUnique({ where: { discordGuildId } })
  if (!guild) return

  const config = await prisma.guildConfig.findUnique({
    where: { guildId: guild.id },
    include: { guild: true },
  })

  if (!config) {
    destroyGuildTasks(discordGuildId)
    return
  }

  scheduleForGuild(config)
}
