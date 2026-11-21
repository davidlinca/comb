// Dupa semnare: termenul de retragere (art. 26), reminderul (art. 10) si suma la retragere.

import { addDays, daysBetween } from './dates.ts';
import { round2 } from './money.ts';

export const WITHDRAWAL_DAYS = 14;
export const RETURN_DAYS = 30;

/** Retragere: 14 zile calendaristice de la semnare (atunci primeste si contractul). */
export const withdrawalDeadline = (signedDate: string): string => addDays(signedDate, WITHDRAWAL_DAYS);

/**
 * Reminder (art. 10): daca a semnat la mai putin de o zi dupa ce a primit informatiile,
 * primeste un reminder despre retragere intre zilele 1 si 7 de la semnare.
 */
export function reminderWindow(infoReceivedAt: Date, signedAt: Date, signedDate: string):
  { required: boolean; from: string | null; to: string | null } {
  const lessThanOneDay = signedAt.getTime() - infoReceivedAt.getTime() < 24 * 3600 * 1000;
  return lessThanOneDay
    ? { required: true, from: addDays(signedDate, 1), to: addDays(signedDate, 7) }
    : { required: false, from: null, to: null };
}

/**
 * Suma de returnat la retragere (art. 26): creditul + dobanda pe zilele de la
 * primirea banilor pana la retragere (dobanda zilnica = rata nominala / 365).
 * Se returneaza in maximum 30 de zile de la retragere.
 */
export function withdrawalAmount(principalLei: number, nominalRatePct: number, signedDate: string, withdrawDate: string) {
  const days = Math.max(0, daysBetween(signedDate, withdrawDate));
  const interest = round2(principalLei * (nominalRatePct / 100 / 365) * days);
  return {
    days_used: days,
    principal_lei: round2(principalLei),
    interest_lei: interest,
    amount_to_return_lei: round2(principalLei + interest),
    return_by: addDays(withdrawDate, RETURN_DAYS),
    text: days === 0
      ? `Returnezi suma primita (${principalLei.toFixed(2).replace('.', ',')} lei), in maximum ${RETURN_DAYS} de zile. Nu platesti dobanda, pentru ca te retragi in aceeasi zi.`
      : `Returnezi suma primita si dobanda pentru ${days} ${days === 1 ? 'zi' : 'zile'} folosite, in maximum ${RETURN_DAYS} de zile.`,
  };
}

export const canWithdraw = (today: string, deadline: string): boolean => today <= deadline;
