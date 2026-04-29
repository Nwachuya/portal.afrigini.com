/**
 * PocketBase schema bootstrap for Global Payments v1.
 *
 * Usage:
 *   PB_URL="https://pb.afrigini.com" POCKETBASE_ADMIN_EMAIL="..." POCKETBASE_ADMIN_PASSWORD="..." node scripts/pb_global_payments_v1.mjs
 *   PB_URL="https://pb.afrigini.com" POCKETBASE_ADMIN_TOKEN="..." node scripts/pb_global_payments_v1.mjs
 *
 * Notes:
 * - This uses the PocketBase Admin API endpoints available on the target instance.
 * - This script is idempotent: it creates missing collections and updates rules/fields when present.
 */

const PB_URL = process.env.PB_URL || process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';
const ADMIN_TOKEN = process.env.POCKETBASE_ADMIN_TOKEN;
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!ADMIN_TOKEN && (!ADMIN_EMAIL || !ADMIN_PASSWORD)) {
  console.error(
    'Missing admin auth. Provide either POCKETBASE_ADMIN_TOKEN or (POCKETBASE_ADMIN_EMAIL + POCKETBASE_ADMIN_PASSWORD).'
  );
  process.exit(1);
}

async function pbFetch(path, { token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = token;
  const res = await fetch(`${PB_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function adminLogin() {
  // PocketBase v0.22+ uses _superusers auth collection under /api/collections/_superusers/auth-with-password.
  // Some installs also support /api/admins/auth-with-password. Try superusers first.
  try {
    const data = await pbFetch('/api/collections/_superusers/auth-with-password', {
      method: 'POST',
      body: { identity: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    return data?.token ? data.token : '';
  } catch (err) {
    const data = await pbFetch('/api/admins/auth-with-password', {
      method: 'POST',
      body: { identity: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    return data?.token ? data.token : '';
  }
}

function selectField(name, values, { required = false } = {}) {
  return {
    type: 'select',
    name,
    required,
    presentable: false,
    system: false,
    hidden: false,
    maxSelect: 1,
    values,
  };
}

function textField(name, { required = false } = {}) {
  return {
    type: 'text',
    name,
    required,
    presentable: false,
    system: false,
    hidden: false,
    min: 0,
    max: 0,
    pattern: '',
    autogeneratePattern: '',
  };
}

function numberField(name, { required = false, min = null, max = null } = {}) {
  return {
    type: 'number',
    name,
    required,
    presentable: false,
    system: false,
    hidden: false,
    min,
    max,
    onlyInt: false,
  };
}

function dateField(name, { required = false } = {}) {
  return {
    type: 'date',
    name,
    required,
    presentable: false,
    system: false,
    hidden: false,
    min: '',
    max: '',
  };
}

function jsonField(name, { required = false } = {}) {
  return {
    type: 'json',
    name,
    required,
    presentable: false,
    system: false,
    hidden: false,
    maxSize: 0,
  };
}

async function upsertCollection(token, collection) {
  const existing = await pbFetch('/api/collections', { token }).then((d) => d.items || []);
  const match = existing.find((c) => c.name === collection.name);
  if (!match) {
    console.log('Creating collection:', collection.name);
    await pbFetch('/api/collections', { token, method: 'POST', body: collection });
    return;
  }

  console.log('Updating collection:', collection.name);
  await pbFetch(`/api/collections/${match.id}`, { token, method: 'PATCH', body: collection });
}

const RULES = {
  orgMemberAny: "@request.auth.id != '' && @collection.org_members.organization ?= org_id && @collection.org_members.user ?= @request.auth.id",
  orgBilling: "@request.auth.id != '' && @collection.org_members.organization ?= org_id && @collection.org_members.user ?= @request.auth.id && (@collection.org_members.role ?= 'owner' || @collection.org_members.role ?= 'billing')",
};

function collectionDef({
  name,
  fields,
  listRule,
  viewRule,
  createRule,
  updateRule,
  deleteRule,
}) {
  return {
    name,
    type: 'base',
    system: false,
    fields,
    indexes: [],
    listRule: listRule ?? null,
    viewRule: viewRule ?? null,
    createRule: createRule ?? null,
    updateRule: updateRule ?? null,
    deleteRule: deleteRule ?? null,
    options: {},
  };
}

const collections = [
  collectionDef({
    name: 'placements',
    fields: [
      textField('org_id', { required: true }),
      textField('job_id', { required: true }),
      textField('application_id', { required: true }),
      textField('candidate_id', { required: true }),
      dateField('start_date', { required: true }),
      dateField('end_date'),
      selectField('status', ['active', 'paused', 'ended'], { required: true }),
      textField('created_by_user', { required: true }),
    ],
    listRule: RULES.orgMemberAny,
    viewRule: RULES.orgMemberAny,
    createRule: RULES.orgBilling,
    updateRule: RULES.orgBilling,
    deleteRule: null,
  }),
  collectionDef({
    name: 'salary_schedules',
    fields: [
      textField('org_id', { required: true }),
      textField('placement_id', { required: true }),
      textField('candidate_id', { required: true }),
      numberField('amount_usd', { required: true, min: 0 }),
      selectField('cadence', ['monthly'], { required: true }),
      numberField('day_of_month', { required: true, min: 1, max: 28 }),
      dateField('effective_from', { required: true }),
      dateField('effective_to'),
      selectField('status', ['active', 'paused', 'ended'], { required: true }),
    ],
    listRule: RULES.orgMemberAny,
    viewRule: RULES.orgMemberAny,
    createRule: RULES.orgBilling,
    updateRule: RULES.orgBilling,
    deleteRule: null,
  }),
  collectionDef({
    name: 'salary_payment_requests',
    fields: [
      textField('org_id', { required: true }),
      textField('placement_id', { required: true }),
      textField('salary_schedule_id', { required: true }),
      dateField('period_start', { required: true }),
      dateField('period_end', { required: true }),
      dateField('due_date', { required: true }),
      numberField('salary_amount_usd', { required: true, min: 0 }),
      numberField('platform_fee_usd', { required: true, min: 0 }),
      numberField('provider_fee_usd', { required: true, min: 0 }),
      numberField('total_due_usd', { required: true, min: 0 }),
      selectField('status', ['draft', 'pending_payment', 'paid', 'overdue', 'canceled'], { required: true }),
      selectField('payment_method', ['stablecoin', 'stripe'], { required: false }),
      textField('stripe_session_id'),
      textField('stablecoin_deposit_id'),
      dateField('paid_at'),
    ],
    listRule: RULES.orgBilling,
    viewRule: RULES.orgBilling,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  }),
  collectionDef({
    name: 'stablecoin_deposits',
    fields: [
      textField('org_id', { required: true }),
      textField('salary_payment_request_id', { required: true }),
      selectField('asset', ['USDC', 'USDT'], { required: true }),
      selectField('chain', ['base'], { required: true }),
      selectField('provider', ['bridge'], { required: true }),
      textField('deposit_address', { required: true }),
      numberField('amount_expected_usd', { required: true, min: 0 }),
      numberField('amount_received_usd', { required: false, min: 0 }),
      textField('tx_hash'),
      selectField('status', ['awaiting_payment', 'confirming', 'confirmed', 'failed', 'expired'], { required: true }),
      jsonField('raw_provider_event'),
    ],
    listRule: RULES.orgBilling,
    viewRule: RULES.orgBilling,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  }),
  collectionDef({
    name: 'candidate_payout_profiles',
    fields: [
      textField('candidate_id', { required: true }),
      textField('user_id', { required: true }),
      selectField('method', ['bank', 'momo'], { required: true }),
      textField('country', { required: true }),
      textField('currency', { required: true }),
      jsonField('details', { required: true }),
      selectField('status', ['draft', 'verified', 'disabled'], { required: true }),
    ],
    listRule: "@request.auth.id != '' && user_id = @request.auth.id",
    viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
    createRule: "@request.auth.id != '' && user_id = @request.auth.id",
    updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
    deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
  }),
  collectionDef({
    name: 'candidate_payouts',
    fields: [
      textField('org_id', { required: true }),
      textField('placement_id', { required: true }),
      textField('salary_payment_request_id', { required: true }),
      textField('candidate_id', { required: true }),
      textField('payout_profile_id', { required: true }),
      numberField('amount_usd', { required: true, min: 0 }),
      textField('currency_local', { required: true }),
      numberField('amount_local', { required: true, min: 0 }),
      numberField('fx_rate'),
      selectField('status', ['queued', 'processing', 'paid', 'failed', 'canceled'], { required: true }),
      selectField('provider', ['bridge'], { required: true }),
      textField('provider_ref'),
      textField('error_message'),
      dateField('executed_at'),
    ],
    listRule: RULES.orgBilling,
    viewRule: RULES.orgBilling,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  }),
];

const token = ADMIN_TOKEN || (await adminLogin());
if (!token) {
  console.error('Failed to authenticate PocketBase admin.');
  process.exit(1);
}

for (const c of collections) {
  await upsertCollection(token, c);
}

console.log('Done.');
