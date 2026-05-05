export type AdminUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  role: "owner" | "admin" | "agent";
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
};

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  role: "owner" | "admin" | "agent";
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
};

export function mapAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
