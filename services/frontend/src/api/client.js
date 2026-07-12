import axios from 'axios';

// Access token lives only in memory — never in localStorage
let accessToken = null;
export const getAccessToken = () => accessToken;
export const setAccessToken = (t) => { accessToken = t; };
export const clearAccessToken = () => { accessToken = null; };

const api = axios.create({
  baseURL: '',
  withCredentials: true, // sends httpOnly refresh token cookie automatically
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Silent refresh on 401
let isRefreshing = false;
let queue = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
      setAccessToken(data.accessToken);
      queue.forEach(({ resolve }) => resolve(data.accessToken));
      queue = [];
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (refreshError) {
      queue.forEach(({ reject }) => reject(refreshError));
      queue = [];
      clearAccessToken();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
