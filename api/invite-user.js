import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function getBearerToken(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

function createTemporaryPassword() {
  return `Mf-${crypto.randomBytes(8).toString('base64url')}9!`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Método não permitido.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return json(res, 500, { error: 'Supabase não configurado no servidor.' });
  }

  const token = getBearerToken(req);
  if (!token) return json(res, 401, { error: 'Sessão ausente.' });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData.user) return json(res, 401, { error: 'Sessão inválida.' });

  const { data: requester, error: profileError } = await adminClient
    .from('profiles')
    .select('role, status')
    .eq('id', authData.user.id)
    .single();
  if (profileError || requester?.status !== 'ativo' || !['admin', 'gerente'].includes(requester?.role)) {
    return json(res, 403, { error: 'Apenas administradores e gerentes podem criar usuários.' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'JSON inválido.' }); }
  }

  const email = String(body.email || '').trim().toLowerCase();
  const role = ['admin', 'gerente', 'vendedor'].includes(body.role)
    ? body.role
    : 'vendedor';
  if (!email || !email.includes('@')) return json(res, 400, { error: 'Informe um email válido.' });

  const temporaryPassword = createTemporaryPassword();
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: email.split('@')[0] },
  });
  if (createError) {
    const message = createError.message?.toLowerCase().includes('already')
      ? 'Já existe um usuário com este email.'
      : createError.message;
    return json(res, 400, { error: message || 'Não foi possível criar o usuário.' });
  }

  const { data: profile, error: upsertError } = await adminClient
    .from('profiles')
    .upsert({
      id: created.user.id,
      email,
      full_name: created.user.user_metadata?.full_name || email.split('@')[0],
      role,
      status: 'ativo',
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (upsertError) {
    await adminClient.auth.admin.deleteUser(created.user.id).catch(() => {});
    return json(res, 500, { error: 'O usuário foi criado, mas o perfil não pôde ser configurado.' });
  }

  return json(res, 201, {
    ...profile,
    temporary_password: temporaryPassword,
  });
}
