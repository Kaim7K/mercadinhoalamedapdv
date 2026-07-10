const DB_KEY = 'mercadoflow_database_v1';
const SESSION_KEY = 'mercadoflow_session_v1';
const RESET_KEY = 'mercadoflow_reset_tokens_v1';

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

const DEFAULT_ADMIN = {
  id: 'user_admin_default',
  email: 'admin@mercadoflow.local',
  full_name: 'Administrador',
  role: 'admin',
  photo_url: '',
  status: 'ativo',
};

const DEFAULT_CONFIG = [
  { id: 'config_logo', key: 'logo_url', value: '/mercadoflow-logo.svg', label: 'Logo do sistema' },
  { id: 'config_minimized', key: 'limite_vendas_minimizadas', value: '5', label: 'Limite de vendas minimizadas' },
];

const nowIso = () => new Date().toISOString();
const normalizeEmail = (email = '') => email.trim().toLowerCase();

function createId(prefix = 'item') {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function hashPassword(password) {
  const value = String(password || '');
  if (!value) throw new Error('Informe uma senha.');
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(value);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return btoa(unescape(encodeURIComponent(value)));
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    if (error?.name === 'QuotaExceededError') {
      throw new Error('O armazenamento do navegador está cheio. Remova imagens muito grandes ou exporte e limpe dados antigos.');
    }
    throw error;
  }
}

async function ensureDatabase() {
  let db = readJson(DB_KEY, null);
  if (!db || typeof db !== 'object') {
    db = Object.fromEntries(COLLECTIONS.map(name => [name, []]));
  }
  for (const name of COLLECTIONS) {
    if (!Array.isArray(db[name])) db[name] = [];
  }

  if (!db.User.some(user => user.id === DEFAULT_ADMIN.id)) {
    db.User.push({
      ...DEFAULT_ADMIN,
      password_hash: await hashPassword('admin123'),
      created_date: nowIso(),
      updated_date: nowIso(),
    });
  }

  for (const config of DEFAULT_CONFIG) {
    if (!db.SystemConfig.some(item => item.key === config.key)) {
      db.SystemConfig.push({ ...config, created_date: nowIso(), updated_date: nowIso() });
    }
  }

  writeJson(DB_KEY, db);
  return db;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

async function mutateDatabase(callback) {
  const db = await ensureDatabase();
  const result = await callback(db);
  writeJson(DB_KEY, db);
  window.dispatchEvent(new CustomEvent('mercadoflow:data-change'));
  return result;
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

function createEntityApi(collection) {
  return {
    async list(sort, limit) {
      const db = await ensureDatabase();
      const items = sortItems(db[collection], sort);
      const limited = Number.isFinite(Number(limit)) ? items.slice(0, Number(limit)) : items;
      return collection === 'User' ? limited.map(sanitizeUser) : structuredClone(limited);
    },

    async filter(criteria = {}, sort, limit) {
      const db = await ensureDatabase();
      const filtered = db[collection].filter(item => matchesFilter(item, criteria));
      const items = sortItems(filtered, sort);
      const limited = Number.isFinite(Number(limit)) ? items.slice(0, Number(limit)) : items;
      return collection === 'User' ? limited.map(sanitizeUser) : structuredClone(limited);
    },

    async get(id) {
      const db = await ensureDatabase();
      const item = db[collection].find(record => record.id === id);
      if (!item) throw new Error('Registro não encontrado.');
      return collection === 'User' ? sanitizeUser(item) : structuredClone(item);
    },

    async create(data = {}) {
      return mutateDatabase(async db => {
        const timestamp = nowIso();
        const item = {
          ...structuredClone(data),
          id: data.id || createId(collection.toLowerCase()),
          created_date: data.created_date || timestamp,
          updated_date: timestamp,
        };
        db[collection].push(item);
        return collection === 'User' ? sanitizeUser(item) : structuredClone(item);
      });
    },

    async update(id, data = {}) {
      return mutateDatabase(async db => {
        const index = db[collection].findIndex(record => record.id === id);
        if (index < 0) throw new Error('Registro não encontrado.');
        const protectedData = collection === 'User' ? { ...data } : data;
        if (collection === 'User') delete protectedData.password_hash;
        db[collection][index] = {
          ...db[collection][index],
          ...structuredClone(protectedData),
          id,
          updated_date: nowIso(),
        };
        return collection === 'User'
          ? sanitizeUser(db[collection][index])
          : structuredClone(db[collection][index]);
      });
    },

    async delete(id) {
      return mutateDatabase(async db => {
        const index = db[collection].findIndex(record => record.id === id);
        if (index < 0) throw new Error('Registro não encontrado.');
        const [removed] = db[collection].splice(index, 1);
        return collection === 'User' ? sanitizeUser(removed) : structuredClone(removed);
      });
    },
  };
}

function getSessionUserId() {
  return localStorage.getItem(SESSION_KEY);
}

function setSessionUserId(userId) {
  if (userId) localStorage.setItem(SESSION_KEY, userId);
  else localStorage.removeItem(SESSION_KEY);
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

const entities = Object.fromEntries(COLLECTIONS.map(name => [name, createEntityApi(name)]));

export const appClient = {
  entities,

  auth: {
    async me() {
      const userId = getSessionUserId();
      if (!userId) {
        const error = new Error('Sessão não encontrada.');
        error.status = 401;
        throw error;
      }
      const db = await ensureDatabase();
      const user = db.User.find(item => item.id === userId && item.status !== 'inativo');
      if (!user) {
        setSessionUserId(null);
        const error = new Error('Usuário não encontrado ou inativo.');
        error.status = 401;
        throw error;
      }
      return sanitizeUser(user);
    },

    async loginViaEmailPassword(email, password) {
      const db = await ensureDatabase();
      const normalized = normalizeEmail(email);
      const passwordHash = await hashPassword(password);
      const user = db.User.find(item => normalizeEmail(item.email) === normalized);
      if (!user || user.password_hash !== passwordHash) throw new Error('Email ou senha inválidos.');
      if (user.status === 'inativo') throw new Error('Este usuário está inativo.');
      setSessionUserId(user.id);
      return { user: sanitizeUser(user), access_token: user.id };
    },

    async register({ email, password, full_name = '' }) {
      const normalized = normalizeEmail(email);
      if (!normalized) throw new Error('Informe um email válido.');
      if (String(password || '').length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      return mutateDatabase(async db => {
        if (db.User.some(item => normalizeEmail(item.email) === normalized)) {
          throw new Error('Já existe uma conta com este email.');
        }
        const timestamp = nowIso();
        const user = {
          id: createId('user'),
          email: normalized,
          full_name: full_name.trim() || normalized.split('@')[0],
          role: db.User.length === 0 ? 'admin' : 'vendedor',
          photo_url: '',
          status: 'ativo',
          password_hash: await hashPassword(password),
          created_date: timestamp,
          updated_date: timestamp,
        };
        db.User.push(user);
        setSessionUserId(user.id);
        return { user: sanitizeUser(user), access_token: user.id };
      });
    },

    async resetPasswordRequest(email) {
      const db = await ensureDatabase();
      const user = db.User.find(item => normalizeEmail(item.email) === normalizeEmail(email));
      if (!user) throw new Error('Usuário não encontrado.');
      const token = createId('reset');
      const tokens = readJson(RESET_KEY, {});
      tokens[token] = { userId: user.id, expiresAt: Date.now() + 15 * 60 * 1000 };
      writeJson(RESET_KEY, tokens);
      return { resetToken: token };
    },

    async resetPassword({ resetToken, newPassword }) {
      if (String(newPassword || '').length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      const tokens = readJson(RESET_KEY, {});
      const entry = tokens[resetToken];
      if (!entry || entry.expiresAt < Date.now()) throw new Error('Link de redefinição inválido ou expirado.');
      await mutateDatabase(async db => {
        const user = db.User.find(item => item.id === entry.userId);
        if (!user) throw new Error('Usuário não encontrado.');
        user.password_hash = await hashPassword(newPassword);
        user.updated_date = nowIso();
      });
      delete tokens[resetToken];
      writeJson(RESET_KEY, tokens);
      return true;
    },

    logout(redirectTo = '/login') {
      setSessionUserId(null);
      if (redirectTo) window.location.assign(redirectTo);
    },

    redirectToLogin() {
      window.location.assign('/login');
    },

    setToken(token) {
      setSessionUserId(token);
    },
  },

  users: {
    async inviteUser(email, role = 'vendedor') {
      const normalized = normalizeEmail(email);
      if (!normalized) throw new Error('Informe um email válido.');
      return mutateDatabase(async db => {
        if (db.User.some(item => normalizeEmail(item.email) === normalized)) {
          throw new Error('Já existe um usuário com este email.');
        }
        const timestamp = nowIso();
        const user = {
          id: createId('user'),
          email: normalized,
          full_name: normalized.split('@')[0],
          role,
          photo_url: '',
          status: 'ativo',
          password_hash: await hashPassword('123456'),
          created_date: timestamp,
          updated_date: timestamp,
        };
        db.User.push(user);
        return { ...sanitizeUser(user), temporary_password: '123456' };
      });
    },
  },

  integrations: {
    Core: {
      async UploadFile({ file }) {
        if (!file) throw new Error('Selecione um arquivo.');
        if (file.size > 1024 * 1024) throw new Error('Use uma imagem de até 1 MB.');
        return { file_url: await fileToDataUrl(file) };
      },
    },
  },
};

ensureDatabase().catch(error => console.error('Falha ao iniciar armazenamento:', error));
