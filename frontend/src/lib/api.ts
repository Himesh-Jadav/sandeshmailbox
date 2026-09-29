export interface User {
  id: string;
  _id?: string;
  phone: string;
  email: string;
  displayName: string;
  name?: string;
  dob?: string | null;
  gender?: string | null;
  profilePictureUrl: string | null;
  hasSetPassword: boolean;
  createdVia: string;
  aliasIds: string[];
  publicKey: string | null;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface SetupTokenResponse {
  setupToken: string;
  phone: string;
  email: string;
  isExistingUser: boolean;
}

export interface CheckUserResponse {
  exists: boolean;
  hasSetPassword: boolean;
}

const API_BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data?.error || data?.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }
  return data as T;
}

export const api = {
  async checkUser(phone: string): Promise<CheckUserResponse> {
    const res = await fetch(`${API_BASE}/auth/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    return handleResponse<CheckUserResponse>(res);
  },

  async requestSetupToken(phone: string): Promise<SetupTokenResponse> {
    const res = await fetch(`${API_BASE}/auth/setup-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    return handleResponse<SetupTokenResponse>(res);
  },

  async startOtp(
    phone: string,
    purpose: 'signup' | 'forgot_password' | 'login' | 'generic' = 'signup',
    channel: 'sms' | 'call' = 'sms'
  ): Promise<{ success: boolean; channel: string; message: string }> {
    const res = await fetch(`${API_BASE}/auth/otp/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, purpose, channel }),
    });
    return handleResponse<{ success: boolean; channel: string; message: string }>(res);
  },

  async verifyOtp(
    phone: string,
    code: string,
    purpose: 'signup' | 'forgot_password' | 'login' | 'generic' = 'signup'
  ): Promise<{ setupToken?: string; resetToken?: string; phone: string }> {
    const res = await fetch(`${API_BASE}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, purpose }),
    });
    return handleResponse<{ setupToken?: string; resetToken?: string; phone: string }>(res);
  },

  async resetPassword(resetToken: string, newPassword: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/forgot-password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken, newPassword }),
    });
    return handleResponse<AuthResponse>(res);
  },

  async setPassword(setupToken: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setupToken, password }),
    });
    return handleResponse<AuthResponse>(res);
  },

  async login(phone: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    return handleResponse<AuthResponse>(res);
  },

  async getMe(token: string): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{ user: User }>(res);
  },

  async updateMe(
    data: {
      name?: string;
      displayName?: string;
      dob?: string | null;
      gender?: string | null;
      profilePictureUrl?: string | null;
      publicKey?: string | null;
    },
    token: string
  ): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return handleResponse<{ user: User }>(res);
  },

  async uploadAvatar(file: File, token: string): Promise<{ user: User; profilePictureUrl: string }> {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await fetch(`${API_BASE}/me/avatar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    return handleResponse<{ user: User; profilePictureUrl: string }>(res);
  },
};
