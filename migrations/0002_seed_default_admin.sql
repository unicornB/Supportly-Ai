INSERT OR IGNORE INTO admin_users (
  id,
  email,
  name,
  password_hash,
  role,
  status,
  created_at,
  updated_at
)
VALUES (
  'admin_1',
  'admin@example.com',
  'Default Admin',
  NULL,
  'owner',
  'active',
  datetime('now'),
  datetime('now')
);
