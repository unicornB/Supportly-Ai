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
  'pbkdf2_sha256$100000$c3VwcG9ydGx5LWRlZmF1bA$qnLv7IH2_NfwzB-JI6RznuftNxtKWXEO0debRM3J9mk',
  'owner',
  'active',
  datetime('now'),
  datetime('now')
);

UPDATE admin_users
SET password_hash = 'pbkdf2_sha256$100000$c3VwcG9ydGx5LWRlZmF1bA$qnLv7IH2_NfwzB-JI6RznuftNxtKWXEO0debRM3J9mk',
    updated_at = datetime('now')
WHERE id = 'admin_1'
  AND password_hash IS NULL;
