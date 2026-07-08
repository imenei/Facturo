import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.helpdz.com/api';

const api = axios.create({ baseURL: API_URL, timeout: 30000 });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('helpdz_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('helpdz_token');
      localStorage.removeItem('helpdz_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;
