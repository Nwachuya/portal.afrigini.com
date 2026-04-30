/// <reference path="../pb_data/types.d.ts" />
// PocketBase JS hooks for Global Payments v1 invariants.
// PB version: v0.36.1

function normalizeStatus(value) {
  return String(value || '').trim();
}

async function assertPlacementConsistency(e, record, isUpdate) {
  const placementId = String(record.get('placement_id') || record.get('placement_id') || '');
  const orgId = String(record.get('org_id') || '');
  const candidateId = String(record.get('candidate_id') || '');

  if (!placementId || !orgId || !candidateId) {
    throw new BadRequestError('Missing placement_id, org_id, or candidate_id.');
  }

  const placement = await e.dao.findRecordById('placements', placementId);
  if (!placement) {
    throw new BadRequestError('Invalid placement_id.');
  }

  if (String(placement.get('org_id') || '') !== orgId) {
    throw new BadRequestError('org_id must match placement org_id.');
  }

  if (String(placement.get('candidate_id') || '') !== candidateId) {
    throw new BadRequestError('candidate_id must match placement candidate_id.');
  }

  const placementStatus = normalizeStatus(placement.get('status'));
  if (placementStatus === 'ended') {
    throw new BadRequestError('Cannot modify salary schedule for ended placement.');
  }

  if (isUpdate && record.original) {
    const original = record.original();
    if (original && normalizeStatus(original.get('status')) === 'ended') {
      throw new BadRequestError('Cannot update an ended salary schedule.');
    }
  }
}

function assertMonthlyCadence(record) {
  const cadence = String(record.get('cadence') || '');
  if (cadence !== 'monthly') {
    throw new BadRequestError('Only monthly cadence is supported.');
  }

  const day = Number(record.get('day_of_month') || 0);
  if (!Number.isFinite(day) || day < 1 || day > 28) {
    throw new BadRequestError('day_of_month must be between 1 and 28.');
  }

  const amount = Number(record.get('amount_usd') || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BadRequestError('amount_usd must be greater than 0.');
  }
}

onRecordBeforeCreateRequest(async (e) => {
  assertMonthlyCadence(e.record);
  await assertPlacementConsistency(e, e.record, false);
}, 'salary_schedules');

onRecordBeforeUpdateRequest(async (e) => {
  assertMonthlyCadence(e.record);
  await assertPlacementConsistency(e, e.record, true);
}, 'salary_schedules');

