import { supabase } from '@/lib/supabase';

const COLLECTIONS = [
  'Category',
  'FiadoRecord',
  'GeneralAudit',
  'Product',
  'ProductAudit',
  'Sale',
  'SystemConfig',
  'User',
];

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

function createId(prefix = 'item') {
  const id = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${id}`;
}

function throwIfError(error, fallback = 'Não foi possível concluir a operação.') {
  if (!error) return;
  const err = new Error(error.message || fallback);
  err.code = error.code;
  err.status = error.status;
  throw err;
}

function parseSort(sort) {
  if (!sort) return null;
  const descending = String(sort).startsWith('-');
  return { field: descending ? String(sort).slice(1) : String(sort), descending };
}

function sortItems(items, sort) {
  const parsed = parseSort(sort);
  if (!parsed) return [...items];
  const { field, descending } = parsed;
  return [...items].sort((a, b) => {
    const av = a?.[field];
    const bv = b?.[field];
    if (av === bv) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const comparison = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv), 'pt-BR', { numeric: true });
    return descending ? -comparison : comparison;
  });
}

function matchesFilter(item, criteria = {}) {
  return Object.entries(criteria).every(([key, value]) => item?.[key] === value);
}

function applyListOptions(items, sort, limit) {
  const ordered = sortItems(items, sort);
  return Number.isFinite(Number(limit)) ? ordered.slice(0, Number(limit)) : ordered;
}

function rowToEntity(row) {
  return {
    ...(row?.data || {}),
    id: row.id,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

function profileToUser(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    email: profile.email || '',
    full_name: profile.full_name || '',
    role: profile.role || 'vendedor',
    photo_url: profile.photo_url || '',
    status: profile.status || 'ativo',
    created_date: profile.created_at,
    updated_date: profile.updated_at,
  };
}

async function listProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });
  throwIfError(error, 'Erro ao carregar usuários.');
  return (data || []).map(profileToUser);
}

function createUserEntityApi() {
  return {
    async list(sort, limit) {
      return applyListOptions(await listProfiles(), sort, limit);
    },

    async filter(criteria = {}, sort, limit) {
      const users = (await listProfiles()).filter(user => matchesFilter(user, criteria));
      return applyListOptions(users, sort, limit);
    },

    async get(id) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      throwIfError(error, 'Usuário não encontrado.');
      return profileToUser(data);
    },

    async create() {
      throw new Error('Use a tela de criação de usuários para cadastrar um acesso.');
    },

    async update(id, changes = {}) {
      const allowed = ['full_name', 'role', 'photo_url', 'status'];
      const payload = Object.fromEntries(
        Object.entries(changes).filter(([key]) => allowed.includes(key))
      );
      payload.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
      throwIfError(error, 'Erro ao atualizar usuário.');
      window.dispatchEvent(new CustomEvent('mercadoflow:data-change'));
      return profileToUser(data);
    },

    async delete() {
      throw new Error('A exclusão completa de usuários deve ser feita pelo administrador do Supabase.');
    },
  };
}

function createRecordEntityApi(collection) {
  const baseQuery = () => supabase
    .from('app_records')
    .select('id, collection, data, created_at, updated_at')
    .eq('collection', collection);

  return {
    async list(sort, limit) {
      const { data, error } = await baseQuery();
      throwIfError(error, `Erro ao carregar ${collection}.`);
      return applyListOptions((data || []).map(rowToEntity), sort, limit);
    },

    async filter(criteria = {}, sort, limit) {
      const items = await this.list();
      return applyListOptions(items.filter(item => matchesFilter(item, criteria)), sort, limit);
    },

    async get(id) {
      const { data, error } = await baseQuery().eq('id', id).single();
      throwIfError(error, 'Registro não encontrado.');
      return rowToEntity(data);
    },

    async create(input = {}) {
      const id = input.id || createId(collection.toLowerCase());
      const timestamp = new Date().toISOString();
      const recordData = { ...structuredClone(input) };
      delete recordData.id;
      delete recordData.created_date;
      delete recordData.updated_date;

      const { data, error } = await supabase
        .from('app_records')
        .insert({
          id,
          collection,
          data: recordData,
          created_at: input.created_date || timestamp,
          updated_at: timestamp,
        })
        .select('id, collection, data, created_at, updated_at')
        .single();
      throwIfError(error, 'Erro ao criar registro.');
      window.dispatchEvent(new CustomEvent('mercadoflow:data-change'));
      return rowToEntity(data);
    },

    async update(id, changes = {}) {
      const current = await this.get(id);
      const merged = { ...current, ...structuredClone(changes) };
      delete merged.id;
      delete merged.created_date;
      delete merged.updated_date;

      const { data, error } = await supabase
        .from('app_records')
        .update({ data: merged, updated_at: new Date().toISOString() })
        .eq('collection', collection)
        .eq('id', id)
        .select('id, collection, data, created_at, updated_at')
        .single();
      throwIfError(error, 'Erro ao atualizar registro.');
      window.dispatchEvent(new CustomEvent('mercadoflow:data-change'));
      return rowToEntity(data);
    },

    async delete(id) {
      const current = await this.get(id);
      const { error } = await supabase
        .from('app_records')
        .delete()
        .eq('collection', collection)
        .eq('id', id);
      throwIfError(error, 'Erro ao excluir registro.');
      window.dispatchEvent(new CustomEvent('mercadoflow:data-change'));
      return current;
    },
  };
}

const entities = Object.fromEntries(
  COLLECTIONS.map(name => [
    name,
    name === 'User' ? createUserEntityApi() : createRecordEntityApi(name),
  ])
);

async function getCurrentProfile(authUser) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();
  throwIfError(error, 'Perfil de usuário não encontrado.');
  if (data.status !== 'ativo') {
    const err = new Error('Seu acesso está pendente ou inativo. Fale com um administrador.');
    err.status = 403;
    err.code = 'USER_INACTIVE';
    throw err;
  }
  return profileToUser(data);
}

async function authenticatedFetch(url, options = {}) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  throwIfError(sessionError, 'Sessão inválida.');
  const token = sessionData.session?.access_token;
  if (!token) {
    const error = new Error('Sessão não encontrada.');
    error.status = 401;
    throw error;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'Erro ao comunicar com o servidor.');
    error.status = response.status;
    throw error;
  }
  return body;
}

export const appClient = {
  entities,
  supabase,

  auth: {
    async me() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        const authError = new Error('Sessão não encontrada.');
        authError.status = 401;
        throw authError;
      }
      return getCurrentProfile(data.user);
    },

    async loginViaEmailPassword(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password: String(password || ''),
      });
      throwIfError(error, 'Email ou senha inválidos.');
      try {
        const user = await getCurrentProfile(data.user);
        return { user, access_token: data.session?.access_token };
      } catch (profileError) {
        await supabase.auth.signOut();
        throw profileError;
      }
    },

    async register({ email, password, full_name = '' }) {
      const normalized = normalizeEmail(email);
      if (!normalized) throw new Error('Informe um email válido.');
      if (String(password || '').length < 6) {
        throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      }

      const { data: available, error: rpcError } = await supabase.rpc('bootstrap_available');
      throwIfError(rpcError, 'Não foi possível verificar o cadastro inicial.');
      if (!available) {
        throw new Error('O administrador inicial já foi criado. Novos acessos devem ser criados pela tela Usuários.');
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalized,
        password,
        options: {
          data: { full_name: full_name.trim() },
          emailRedirectTo: window.location.origin,
        },
      });
      throwIfError(error, 'Não foi possível criar a conta.');

      return {
        user: data.user,
        access_token: data.session?.access_token || null,
        requiresEmailConfirmation: !data.session,
      };
    },

    async resetPasswordRequest(email) {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo });
      throwIfError(error, 'Não foi possível enviar o email de redefinição.');
      return { sent: true };
    },

    async resetPassword({ newPassword }) {
      if (String(newPassword || '').length < 6) {
        throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      }
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      throwIfError(error, 'Link de redefinição inválido ou expirado.');
      return data.user;
    },

    async logout(redirectTo = '/login') {
      await supabase.auth.signOut();
      if (redirectTo) window.location.assign(redirectTo);
    },

    redirectToLogin() {
      window.location.assign('/login');
    },

    async setToken() {
      throw new Error('A sessão agora é controlada pelo Supabase Auth.');
    },
  },

  users: {
    async inviteUser(email, role = 'vendedor') {
      return authenticatedFetch('/api/invite-user', {
        method: 'POST',
        body: JSON.stringify({ email: normalizeEmail(email), role }),
      });
    },
  },

  integrations: {
    Core: {
      async UploadFile({ file }) {
        if (!file) throw new Error('Selecione um arquivo.');
        if (file.size > 1024 * 1024) throw new Error('Use uma imagem de até 1 MB.');

        const { data: authData, error: authError } = await supabase.auth.getUser();
        throwIfError(authError, 'Sessão inválida.');
        if (!authData.user) throw new Error('Faça login para enviar arquivos.');

        const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
        const path = `${authData.user.id}/${createId('asset')}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('mercadoflow-assets')
          .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
        throwIfError(uploadError, 'Erro ao enviar arquivo.');

        const { data } = supabase.storage.from('mercadoflow-assets').getPublicUrl(path);
        return { file_url: data.publicUrl, path };
      },
    },
  },
};
