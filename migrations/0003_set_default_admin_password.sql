UPDATE admin_users
SET password_hash = 'pbkdf2_sha256$100000$c3VwcG9ydGx5LWRlZmF1bA$qnLv7IH2_NfwzB-JI6RznuftNxtKWXEO0debRM3J9mk',
    updated_at = datetime('now')
WHERE id = 'admin_1'
  AND password_hash IS NULL;
