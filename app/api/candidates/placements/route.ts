import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/request-auth';
import { createAdminPb, createUserPb } from '@/lib/server/pb';
function esc(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await getRequestAuth(request);
    if (!auth?.pbToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userPb = createUserPb(auth.pbToken);
    let authenticatedUserId = auth.userId;

    if (!authenticatedUserId) {
      const refresh = await userPb.collection('users').authRefresh({ requestKey: null });
      authenticatedUserId = refresh.record?.id || '';
    }

    const me = await userPb.collection('users').getOne(authenticatedUserId, { requestKey: null });
    if (me?.role !== 'Applicant') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find the candidate record for this user
    let candidate;
    try {
      candidate = await userPb.collection('candidates').getFirstListItem(
        `user = "${esc(authenticatedUserId)}"`,
        { requestKey: null }
      );
    } catch {
      return NextResponse.json({ data: [] });
    }

    // Fetch placements for this candidate
    const placements = await userPb.collection('placements').getFullList({
      filter: `candidate_id = "${esc(candidate.id)}"`,
      sort: '-created',
      expand: 'org_id,job_id',
      requestKey: null,
    });

    return NextResponse.json({ data: placements });
  } catch (error: any) {
    console.error('Placements API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load placements' },
      { status: 500 }
    );
  }
}
