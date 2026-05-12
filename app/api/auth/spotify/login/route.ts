import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { EnvValidationError, getServerEnv } from '../../../../../lib/config/env';
import {
  generateOpaqueToken,
  setOAuthStateCookie,
} from '../../../../../lib/auth/session';
import { buildSpotifyAuthorizeUrl } from '../../../../../lib/spotify';

export const runtime = 'nodejs';

const loginQuerySchema = z.object({}).strict();

function envValidationResponse() {
  return NextResponse.json(
    {
      error: {
        code: 'ENV_VALIDATION_FAILED',
        message: 'Missing or invalid server environment variables.',
      },
    },
    { status: 500 },
  );
}

export function GET(request: NextRequest) {
  const query = loginQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!query.success) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_QUERY',
          message: 'This endpoint does not accept query parameters.',
        },
      },
      { status: 400 },
    );
  }

  try {
    const env = getServerEnv();
    const state = generateOpaqueToken();
    const response = NextResponse.redirect(buildSpotifyAuthorizeUrl(env, state));

    setOAuthStateCookie(response, state);

    return response;
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return envValidationResponse();
    }

    throw error;
  }
}
