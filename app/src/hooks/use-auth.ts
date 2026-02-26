import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "tandim_auth_token";

type AuthUser = {
  userId: string;
  displayName: string;
};

type UseAuthOptions = {
  apiUrl: string;
};

type UseAuthReturn = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (displayName: string, password: string) => Promise<void>;
  register: (displayName: string, password: string) => Promise<void>;
  logout: () => void;
  getToken: () => string | null;
};

export function useAuth({ apiUrl }: UseAuthOptions): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const storeToken = useCallback((newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // Validate existing token on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }

    setToken(stored);

    fetch(`${apiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          clearAuth();
        }
      })
      .catch(() => {
        // Server unreachable — keep token, will retry later
      })
      .finally(() => setIsLoading(false));
  }, [apiUrl, clearAuth]);

  const login = useCallback(
    async (displayName: string, password: string) => {
      setError(null);
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Login failed");
        throw new Error(data.message ?? "Login failed");
      }

      storeToken(data.token);
      setUser(data.user);
    },
    [apiUrl, storeToken],
  );

  const register = useCallback(
    async (displayName: string, password: string) => {
      setError(null);
      const res = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Registration failed");
        throw new Error(data.message ?? "Registration failed");
      }

      storeToken(data.token);
      setUser(data.user);
    },
    [apiUrl, storeToken],
  );

  const logout = useCallback(() => {
    clearAuth();
    setError(null);
  }, [clearAuth]);

  const getToken = useCallback(() => {
    return localStorage.getItem(TOKEN_KEY);
  }, []);

  return {
    user,
    token,
    isAuthenticated: user !== null && token !== null,
    isLoading,
    error,
    login,
    register,
    logout,
    getToken,
  };
}
