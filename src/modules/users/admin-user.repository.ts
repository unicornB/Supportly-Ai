import type { AdminUser, AdminUserRow } from "./admin-user.types";
import { mapAdminUser } from "./admin-user.types";

export class AdminUserRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<AdminUser | null> {
    const row = await this.db
      .prepare("SELECT * FROM admin_users WHERE id = ? AND status = 'active' LIMIT 1")
      .bind(id)
      .first<AdminUserRow>();

    return row ? mapAdminUser(row) : null;
  }

  async findByEmail(email: string): Promise<AdminUser | null> {
    const row = await this.db
      .prepare("SELECT * FROM admin_users WHERE lower(email) = lower(?) AND status = 'active' LIMIT 1")
      .bind(email)
      .first<AdminUserRow>();

    return row ? mapAdminUser(row) : null;
  }
}
