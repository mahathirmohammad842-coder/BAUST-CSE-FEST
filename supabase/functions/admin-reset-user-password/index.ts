import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return respond(405, { error: 'Method not allowed.' });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.match(/^Bearer\s+\S+$/i)) {
    return respond(401, { error: 'A valid sign-in session is required.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond(500, { error: 'Password reset service is not configured.' });
  }

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const {
      data: { user: actor },
      error: actorAuthError,
    } = await userClient.auth.getUser();
    if (actorAuthError || !actor) {
      return respond(401, { error: 'Your sign-in session is invalid or expired.' });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: actorProfile, error: actorProfileError } = await adminClient
      .from('user_profiles')
      .select('role, account_status, approval_status')
      .eq('id', actor.id)
      .maybeSingle();
    if (actorProfileError) {
      return respond(500, { error: 'Could not verify the administrator account.' });
    }
    if (
      !actorProfile ||
      actorProfile.account_status !== 'Active' ||
      (actorProfile.approval_status && actorProfile.approval_status !== 'Approved') ||
      !['Organizer', 'Super Admin'].includes(actorProfile.role)
    ) {
      return respond(403, {
        error: 'Only an approved active Organizer or Super Admin can reset passwords.',
      });
    }

    const body: unknown = await request.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('userId' in body) ||
      typeof body.userId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        body.userId
      )
    ) {
      return respond(400, { error: 'A valid target user ID is required.' });
    }

    const targetUserId = body.userId;
    if (targetUserId === actor.id) {
      return respond(400, {
        error: 'Use My Profile to change your own password.',
      });
    }

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from('user_profiles')
      .select('role')
      .eq('id', targetUserId)
      .maybeSingle();
    if (targetProfileError) {
      return respond(500, { error: 'Could not verify the target account.' });
    }
    if (!targetProfile) {
      return respond(404, { error: 'The target account was not found.' });
    }
    if (
      actorProfile.role === 'Organizer' &&
      targetProfile.role === 'Super Admin'
    ) {
      return respond(403, {
        error: 'Organizers cannot reset a Super Admin password.',
      });
    }

    const randomBytes = crypto.getRandomValues(new Uint8Array(24));
    const temporaryPassword = `Bf!${Array.from(randomBytes, (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('')}`;
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      targetUserId,
      { password: temporaryPassword }
    );
    if (updateError) {
      return respond(400, {
        error: `Supabase could not update this account's password: ${updateError.message}`,
      });
    }

    return respond(200, { temporaryPassword });
  } catch {
    return respond(500, { error: 'The password reset could not be completed.' });
  }
});
