import { create } from 'zustand';

interface AuthState {
  token: string | null;
  email: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string, email: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('access_token'),
  email: localStorage.getItem('user_email'),
  isAuthenticated: !!localStorage.getItem('access_token'),

  setAuth: (token, email) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user_email', email);
    set({ token, email, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_email');
    set({ token: null, email: null, isAuthenticated: false });
  },
}));
