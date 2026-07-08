CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'seller')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  barcode TEXT UNIQUE,
  internal_code TEXT UNIQUE NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(12,2),
  stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unidade',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number SERIAL UNIQUE,
  seller_id UUID REFERENCES app_users(id),
  seller_name TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'paid',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  canceled_at TIMESTAMPTZ,
  canceled_by TEXT,
  cancel_reason TEXT
);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  weight NUMERIC(12,3),
  subtotal NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  seller_id UUID REFERENCES app_users(id),
  seller_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  settled_by TEXT
);

CREATE TABLE IF NOT EXISTS suspended_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot INTEGER NOT NULL,
  seller_id UUID REFERENCES app_users(id),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  sale_id UUID REFERENCES sales(id),
  user_id UUID REFERENCES app_users(id),
  user_name TEXT NOT NULL,
  type TEXT NOT NULL,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  origin TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
