import { NextRequest } from 'next/server';
import { APP_SESSION_COOKIE, PB_TOKEN_COOKIE, verifySessionToken } from '@/lib/session';

export type RequestAuth = {
  pbToken: string;
  userId: string;
  email: string;
};

export async function getRequestAuth(request: NextRequest): Promise<RequestAuth | null> {
  const sessionCookie = request.cookies.get(APP_SESSION_COOKIE)?.value;
  const sessionData = sessionCookie ? await verifySessionToken(sessionCookie) : null;
  const cookiePbToken = request.cookies.get(PB_TOKEN_COOKIE)?.value;
  const authHeader = request.headers.get('authorization') || '';
  const bearerPbToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const pbToken = cookiePbToken || bearerPbToken;

  if (!pbToken) {
    return null;
  }

  return {
    pbToken,
    userId: sessionData?.userId ?? '',
    email: sessionData?.email ?? '',
  };
}

