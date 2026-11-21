// Scrierea in jurnal. seq, prev_hash, hash si articolul CCD2 le pune BAZA DE DATE (trigger), nu API-ul.
// Payload-ul NU contine date personale in clar: doar coduri, id-uri, sume ale ofertei si hash-uri.

import { admin } from './supabase.ts';

export type LedgerEvent = {
  event: string;
  actor: 'customer' | 'system' | 'operator';
  payload?: Record<string, unknown>;
};

/** Scrie evenimentele in ordine, intr-o singura cerere (aceeasi tranzactie). */
export async function appendLedger(applicationId: string, events: LedgerEvent[]) {
  if (!events.length) return;
  const { error } = await admin.from('ledger_entries').insert(
    events.map((e) => ({ application_id: applicationId, event: e.event, actor: e.actor, payload: e.payload ?? {} })),
  );
  if (error) throw new Error(`ledger: ${error.message}`);
}
