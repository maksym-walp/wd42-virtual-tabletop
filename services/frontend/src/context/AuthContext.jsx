import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import api, { setAccessToken, clearAccessToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on app load via silent refresh
  useEffect(() => {
    axios
      .post('/api/auth/refresh', {}, { withCredentials: true })
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        return api.get('/api/auth/me');
      })
      .then(({ data }) => setUser(data.user))
      .catch(() => clearAccessToken())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
  };

  const register = async (email, username, password) => {
    const { data } = await api.post('/api/auth/register', { email, username, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      clearAccessToken();
      setUser(null);
    }
  };

  // Updates username/email. Issues a fresh access token since the old one
  // has the previous email/username baked into its claims.
  const updateAccount = async ({ email, username }) => {
    const { data } = await api.patch('/api/auth/me', { email, username });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  };

  // Changing the password revokes every refresh token server-side, so the
  // current session ends too — the caller should send the user to /login.
  const changePassword = async (currentPassword, newPassword) => {
    await api.put('/api/auth/me/password', { currentPassword, newPassword });
    clearAccessToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateAccount, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
