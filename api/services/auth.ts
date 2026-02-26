import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "tandim-dev-secret";
const TOKEN_EXPIRY = "7d";
const SALT_ROUNDS = 10;

export type AuthUser = {
  userId: string;
  displayName: string;
  passwordHash: string;
  avatarUrl?: string;
};

export type TokenPayload = {
  userId: string;
  displayName: string;
};

const users = new Map<string, AuthUser>();

// Keyed by displayName (lowercased) for login lookups
const displayNameIndex = new Map<string, string>();

export function registerUser(
  displayName: string,
  password: string
): { userId: string; displayName: string } {
  const key = displayName.toLowerCase();
  if (displayNameIndex.has(key)) {
    throw new Error("User already exists");
  }

  const userId = `u-${crypto.randomUUID().slice(0, 8)}`;
  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
  const user: AuthUser = { userId, displayName, passwordHash };

  users.set(userId, user);
  displayNameIndex.set(key, userId);

  return { userId, displayName };
}

export function authenticateUser(
  displayName: string,
  password: string
): { userId: string; displayName: string } | null {
  const key = displayName.toLowerCase();
  const userId = displayNameIndex.get(key);
  if (!userId) return null;

  const user = users.get(userId);
  if (!user) return null;

  if (!bcrypt.compareSync(password, user.passwordHash)) return null;

  return { userId: user.userId, displayName: user.displayName };
}

export function generateToken(user: { userId: string; displayName: string }): string {
  const payload: TokenPayload = {
    userId: user.userId,
    displayName: user.displayName,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return { userId: decoded.userId, displayName: decoded.displayName };
  } catch {
    return null;
  }
}

/** For testing — reset the in-memory store */
export function _resetUsers(): void {
  users.clear();
  displayNameIndex.clear();
}
