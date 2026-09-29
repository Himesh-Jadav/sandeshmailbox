import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, User } from '../lib/api';
import {
  ensureUserKeyPair,
  getLocalSecretKey,
  getPublicKeyFingerprint,
} from '../lib/crypto';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  userSecretKey: string | null;
  userPublicKey: string | null;
  keyFingerprint: string;
  login: (phone: string, password: string) => Promise<User>;
  registerWithPassword: (setupToken: string, password: string) => Promise<User>;
  logout: () => void;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  syncKeys: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'phonemail_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [userSecretKey, setUserSecretKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Syncs and ensures local Curve25519 keypair and uploads public key to backend if missing
  const initE2eeKeys = useCallback(async (targetUser: User, activeToken: string) => {
    try {
      const { publicKey, secretKey, needsUpload } = ensureUserKeyPair(targetUser.id, targetUser.publicKey);
      setUserSecretKey(secretKey);

      if (needsUpload) {
        const { user: updatedUser } = await api.updateMe({ publicKey }, activeToken);
        setUser(updatedUser);
      }
    } catch (err) {
      console.warn('Failed to ensure E2EE keypair:', err);
      setUserSecretKey(getLocalSecretKey(targetUser.id));
    }
  }, []);

  useEffect(() => {
    async function loadUser() {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const { user: loadedUser } = await api.getMe(storedToken);
        setUser(loadedUser);
        setToken(storedToken);
        await initE2eeKeys(loadedUser, storedToken);
      } catch (err) {
        console.warn('Session expired or invalid, logging out', err);
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        setUserSecretKey(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, [initE2eeKeys]);

  const login = async (phone: string, password: string): Promise<User> => {
    const data = await api.login(phone, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    await initE2eeKeys(data.user, data.token);
    return data.user;
  };

  const registerWithPassword = async (setupToken: string, password: string): Promise<User> => {
    const data = await api.setPassword(setupToken, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    await initE2eeKeys(data.user, data.token);
    return data.user;
  };

  const logout = () => {
    if (user?.id) {
      // Retain secret key in device storage so re-login on same device retains decryption capability
      // clearLocalSecretKey(user.id) can be done on explicit device wipe
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setUserSecretKey(null);
  };

  const syncKeys = async () => {
    if (user && token) {
      await initE2eeKeys(user, token);
    }
  };

  const userPublicKey = user?.publicKey || null;
  const keyFingerprint = getPublicKeyFingerprint(userPublicKey);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        userSecretKey,
        userPublicKey,
        keyFingerprint,
        login,
        registerWithPassword,
        logout,
        setUser,
        syncKeys,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

