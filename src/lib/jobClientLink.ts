/**
 * Saved customer → New Job prefill (Call-to-CRM Stage 3).
 *
 * When a job is started, the dispatcher can pick a saved customer from a
 * dropdown instead of retyping their details, or start a job straight
 * from a customer's profile. The job is then linked to that customer
 * record (Job.clientId). Everything here comes from the saved record
 * itself — nothing is guessed:
 *
 * - The prefill carries the customer's name, phone, and id verbatim.
 * - The job category defaults to the customer's serviceType only when
 *   it is exactly one of the business's own services (its catalog from
 *   getJobCategories). A serviceType from another trade, or one the
 *   business no longer offers, leaves the category for the user.
 * - The dropdown label shows name • phone (serviceType), skipping any
 *   part the record does not have — a customer with no phone and no
 *   service shows just their name, never a placeholder.
 */

import { Client } from '../types';

/** Pre-filled values for a new job started from a saved customer. */
export interface JobPrefill {
  name: string;
  phone: string;
  /** The saved customer this job is for — persisted as Job.clientId. */
  clientId: string;
  /** One of the business's own services, when the customer's serviceType
   *  is exactly one of them. */
  serviceType?: string;
}

/** Build the New Job prefill from a saved customer. Only the service
 *  is conditional: it defaults only on an exact match with the
 *  business's own catalog. */
export function buildJobPrefillFromClient(
  client: Client,
  serviceOptions: string[],
): JobPrefill {
  const prefill: JobPrefill = {
    name: client.name,
    phone: client.phone,
    clientId: client.id,
  };
  const serviceType = (client.serviceType || '').trim();
  if (serviceType && serviceOptions.includes(serviceType)) {
    prefill.serviceType = serviceType;
  }
  return prefill;
}

/** One dropdown row for a saved customer: name • phone (serviceType),
 *  with any part the record lacks left out. */
export function clientDropdownLabel(client: Client): string {
  const parts = [client.name.trim()];
  if (client.phone.trim()) parts.push(client.phone.trim());
  const label = parts.join(' • ');
  const serviceType = (client.serviceType || '').trim();
  return serviceType ? `${label} (${serviceType})` : label;
}

/** Dropdown options for the saved-customers list, in the order the
 *  list is given — no reordering, no filtering. */
export function buildClientDropdownOptions(
  clients: Client[],
): { id: string; label: string }[] {
  return clients.map((client) => ({ id: client.id, label: clientDropdownLabel(client) }));
}
