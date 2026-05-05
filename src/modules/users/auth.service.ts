import { AppError } from "../../shared/errors";
import {
  base64UrlDecodeToString,
  base64UrlEncode,
  hmacSha256Base64Url,
  timingSafeEqual,
  verifyPassword,
} from "../../gateways/crypto.gateway";
import { AdminUserRepository } from "./admin-user.repository";
import type { AdminUser } from "./admin-user.types";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

type AuthTokenPayload = {
  sub: string;
  email: string;
  name: string;
  role: AdminUser["role"];
  exp: number;
};

type PublicAdminUser = {
  id: string;
  email: string;
  name: string;
  role: AdminUser["role"];
};

export class AuthService {
  constructor(
    private readonly adminUsers: AdminUserRepository,
    private readonly jwtSecret: string
  ) {}

  async login(email: string, password: string) {
    const user = await this.adminUsers.findByEmail(email);
    const validPassword = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !validPassword) {
      throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }

    const expiresAtSeconds = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    return {
      token: await this.signToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        exp: expiresAtSeconds,
      }),
      tokenType: "Bearer",
      expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
      adminUser: toPublicAdminUser(user),
    };
  }

  async requireAdminUser(input: { adminUserId?: string; authorization?: string }) {
    const token = parseBearerToken(input.authorization);
    if (token) {
      const payload = await this.verifyToken(token);
      const user = await this.adminUsers.findById(payload.sub);
      if (!user) {
        throw new AppError("UNAUTHORIZED", "Admin user not found", 401);
      }
      return user;
    }

    if (!input.adminUserId) {
      throw new AppError("UNAUTHORIZED", "Missing admin user", 401);
    }

    const user = await this.adminUsers.findById(input.adminUserId);
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Admin user not found", 401);
    }

    return user;
  }

  private async signToken(payload: AuthTokenPayload) {
    const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = base64UrlEncode(JSON.stringify(payload));
    const signature = await hmacSha256Base64Url(this.jwtSecret, `${header}.${body}`);
    return `${header}.${body}.${signature}`;
  }

  private async verifyToken(token: string): Promise<AuthTokenPayload> {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) {
      throw new AppError("UNAUTHORIZED", "Invalid auth token", 401);
    }

    const expectedSignature = await hmacSha256Base64Url(this.jwtSecret, `${header}.${body}`);
    if (!timingSafeEqual(signature, expectedSignature)) {
      throw new AppError("UNAUTHORIZED", "Invalid auth token", 401);
    }

    const payload = JSON.parse(base64UrlDecodeToString(body)) as AuthTokenPayload;
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      throw new AppError("UNAUTHORIZED", "Auth token expired", 401);
    }

    return payload;
  }
}

function parseBearerToken(authorization: string | undefined) {
  if (!authorization) return null;
  const [type, token] = authorization.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export function toPublicAdminUser(user: AdminUser): PublicAdminUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}
