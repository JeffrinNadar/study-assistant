import { create } from 'zustand';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// Clear expired token from localStorage on load
const storedToken = localStorage.getItem('access_token');
if (storedToken && isTokenExpired(storedToken)) {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user_email');
}

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
