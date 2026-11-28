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
    return respond(500, {
      error: 'Permanent user deletion service is not configured.',
    });
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
      return respond(401, {
        error: 'Your sign-in session is invalid or expired.',
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: actorProfile, error: actorProfileError } = await adminClient
      .from('user_profiles')
      .select('id, full_name, role, account_status, approval_status, is_deleted, is_archived')
      .eq('id', actor.id)
      .maybeSingle();

    if (actorProfileError) {
      return respond(500, {
        error: 'Could not verify the administrator account.',
      });
    }

    if (
      !actorProfile ||
      actorProfile.role !== 'Super Admin' ||
      actorProfile.account_status !== 'Active' ||
      (actorProfile.approval_status &&
        actorProfile.approval_status !== 'Approved') ||
      actorProfile.is_deleted ||
      actorProfile.is_archived
    ) {
      return respond(403, {
        error:
          'Only an active approved Super Admin can permanently delete user accounts.',
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
    const notes =
      'notes' in body && typeof body.notes === 'string'
        ? body.notes.trim().slice(0, 500)
        : '';

    if (targetUserId === actor.id) {
      return respond(400, {
        error: 'Self deletion is strictly prohibited.',
      });
    }

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from('user_profiles')
      .select('id, email, full_name, role, deleted_at')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetProfileError) {
      return respond(500, { error: 'Could not verify the target account.' });
    }
    if (!targetProfile) {
      return respond(404, { error: 'The target account was not found.' });
    }
    if (targetProfile.role === 'Super Admin') {
      return respond(403, {
        error: 'Active Super Admin accounts cannot be permanently deleted.',
      });
    }

    const nowIso = new Date().toISOString();

    const { error: auditError } = await adminClient
      .from('user_deletion_audit_logs')
      .insert({
        target_user_id: targetProfile.id,
        target_user_email: targetProfile.email,
        target_user_name: targetProfile.full_name,
        target_user_role: targetProfile.role,
        action: 'permanently_deleted',
        actor_id: actorProfile.id,
        actor_name: actorProfile.full_name,
        notes:
          notes ||
          'Permanently deleted from Recycle Bin (account, profile, role assignments, approval history, and authentication record removed)',
        deleted_at: targetProfile.deleted_at ?? nowIso,
        permanently_deleted_at: nowIso,
      });

    if (auditError) {
      return respond(500, {
        error: `Could not record deletion audit entry: ${auditError.message}`,
      });
    }

    // Explicitly purge role/approval/verification/notification action records in addition to auth cascade
    await Promise.allSettled([
      adminClient.from('role_change_logs').delete().eq('user_id', targetUserId),
      adminClient.from('approval_logs').delete().eq('user_id', targetUserId),
      adminClient.from('verification_logs').delete().eq('user_id', targetUserId),
      adminClient
        .from('personal_notification_actions')
        .delete()
        .eq('user_id', targetUserId),
      adminClient.from('notifications').delete().eq('user_id', targetUserId),
    ]);

    const { error: deleteAuthError } =
      await adminClient.auth.admin.deleteUser(targetUserId);

    if (deleteAuthError) {
      return respond(400, {
        error: `Supabase could not permanently remove this account: ${deleteAuthError.message}`,
      });
    }

    return respond(200, {
      deletedUserId: targetUserId,
      permanentlyDeletedAt: nowIso,
    });
  } catch {
    return respond(500, {
      error: 'The permanent user deletion could not be completed.',
    });
  }
});
