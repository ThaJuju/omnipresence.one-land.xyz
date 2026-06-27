export type BotLocale = 'fr' | 'en'
type DateLocale = 'fr-FR' | 'en-GB'

const fr = {
  presence: {
    embedTitle: '✅ Confirmation de présence',
    embedDesc: (date: string, count: number) =>
      `Bonjour ! Veuillez confirmer votre présence pour aujourd'hui.\n\n**${date}**\n\n${count} membre(s) à confirmer.`,
    btnPresent: 'Présent',
    btnAbsent: 'Absent',
    btnLate: 'En retard',
    lateModalTitle: 'Déclaration de retard',
    lateDelayLabel: 'Durée du retard (en minutes)',
    lateDelayPlaceholder: 'Ex: 30',
    lateSuccess: (minutes: number) => `⏰ Retard de **${minutes} min** enregistré !`,
    lateErrInvalid: '❌ Durée invalide. Entrez un nombre de minutes positif.',
    lateErrGeneral: "❌ Erreur lors de l'enregistrement.",
    dateLocale: 'fr-FR' as DateLocale,
  },
  reminder: {
    message: (count: number, mentions: string) =>
      `⏰ **Rappel de présence** — ${count} membre(s) n'ont pas encore confirmé leur présence :\n${mentions}`,
  },
  warning: {
    autoReason: 'Absence non déclarée',
  },
  absence: {
    embedTitle: "📋 Déclaration d'absence",
    embedBody:
      "Vous souhaitez déclarer une absence ?\n\nCliquez sur le bouton ci-dessous pour ouvrir le formulaire. Votre demande sera soumise **en attente de validation** par un responsable.",
    buttonLabel: "Déclarer une absence",
    modalTitle: "Déclaration d'absence",
    reasonLabel: "Motif",
    startLabel: "Début (JJ/MM/AAAA)",
    endLabel: "Fin (JJ/MM/AAAA)",
    reasonPlaceholder: "Raison de votre absence...",
    success: (s: string, e: string) =>
      `✅ Absence enregistrée du **${s}** au **${e}**. En attente de validation.`,
    errFormat: 'Format de date invalide. Utilisez JJ/MM/AAAA.',
    errDates: 'La date de fin doit être après la date de début.',
    errGeneral: "❌ Erreur lors de l'enregistrement.",
  },
  reports: {
    dailyTitle: '📊 Rapport journalier',
    weeklyTitle: '📊 Rapport hebdomadaire',
    monthlyTitle: '📊 Rapport mensuel',
    presenceField: '✅ Présences',
    presenceValue: (bar: string, rate: number, present: number, total: number, members: number) =>
      `\`${bar}\` **${rate}%**\n${present}/${total} présences · ${members} membres actifs`,
    absencesField: '📅 Absences',
    absencesValue: (n: number) => `${n} en attente`,
    warningsField: '⚠️ Avertissements',
    warningsValue: (n: number) => `${n} actifs`,
    topField: '🏆 Top présences',
    noData: 'Aucune donnée',
    financesField: '💰 Finances',
    contribLine: (total: number, currency: string, count: number) =>
      `💳 Cotisations : **${total.toFixed(2)} ${currency}** (${count} membres)`,
    incomeLine: (n: number) => `📈 Recettes : **${n.toFixed(2)} €**`,
    expenseLine: (n: number) => `📉 Dépenses : **${n.toFixed(2)} €**`,
    balanceLine: (n: number) => `${n >= 0 ? '✅' : '⚠️'} Balance : **${n.toFixed(2)} €**`,
    noFinances: 'Aucune donnée financière',
    absencesMonth: (n: number) => `${n} déclarée(s) ce mois`,
    warningsMonth: (n: number) => `${n} émis ce mois`,
  },
}

const en: typeof fr = {
  absence: {
    embedTitle: '📋 Absence Declaration',
    embedBody:
      'Would you like to declare an absence?\n\nClick the button below to open the form. Your request will be submitted **pending validation** by a manager.',
    buttonLabel: 'Declare an absence',
    modalTitle: 'Absence Declaration',
    reasonLabel: 'Reason',
    startLabel: 'Start (DD/MM/YYYY)',
    endLabel: 'End (DD/MM/YYYY)',
    reasonPlaceholder: 'Reason for your absence...',
    success: (s: string, e: string) =>
      `✅ Absence registered from **${s}** to **${e}**. Pending validation.`,
    errFormat: 'Invalid date format. Use DD/MM/YYYY.',
    errDates: 'End date must be after start date.',
    errGeneral: '❌ Error during registration.',
  },
  presence: {
    embedTitle: '✅ Presence confirmation',
    embedDesc: (date: string, count: number) =>
      `Hello! Please confirm your presence for today.\n\n**${date}**\n\n${count} member(s) to confirm.`,
    btnPresent: 'Present',
    btnAbsent: 'Absent',
    btnLate: 'Late',
    lateModalTitle: 'Late declaration',
    lateDelayLabel: 'Delay duration (in minutes)',
    lateDelayPlaceholder: 'E.g. 30',
    lateSuccess: (minutes: number) => `⏰ **${minutes} min** delay registered!`,
    lateErrInvalid: '❌ Invalid duration. Enter a positive number of minutes.',
    lateErrGeneral: '❌ Error during registration.',
    dateLocale: 'en-GB' as DateLocale,
  },
  reminder: {
    message: (count: number, mentions: string) =>
      `⏰ **Presence reminder** — ${count} member(s) have not yet confirmed their presence:\n${mentions}`,
  },
  warning: {
    autoReason: 'Undeclared absence',
  },
  reports: {
    dailyTitle: '📊 Daily report',
    weeklyTitle: '📊 Weekly report',
    monthlyTitle: '📊 Monthly report',
    presenceField: '✅ Presences',
    presenceValue: (bar: string, rate: number, present: number, total: number, members: number) =>
      `\`${bar}\` **${rate}%**\n${present}/${total} presences · ${members} active members`,
    absencesField: '📅 Absences',
    absencesValue: (n: number) => `${n} pending`,
    warningsField: '⚠️ Warnings',
    warningsValue: (n: number) => `${n} active`,
    topField: '🏆 Top presences',
    noData: 'No data',
    financesField: '💰 Finances',
    contribLine: (total: number, currency: string, count: number) =>
      `💳 Contributions: **${total.toFixed(2)} ${currency}** (${count} members)`,
    incomeLine: (n: number) => `📈 Income: **${n.toFixed(2)} €**`,
    expenseLine: (n: number) => `📉 Expenses: **${n.toFixed(2)} €**`,
    balanceLine: (n: number) => `${n >= 0 ? '✅' : '⚠️'} Balance: **${n.toFixed(2)} €**`,
    noFinances: 'No financial data',
    absencesMonth: (n: number) => `${n} declared this month`,
    warningsMonth: (n: number) => `${n} issued this month`,
  },
}

export const botDict = { fr, en }
export type BotTranslations = typeof fr

export function getBotT(locale: string): BotTranslations {
  return locale === 'en' ? botDict.en : botDict.fr
}
