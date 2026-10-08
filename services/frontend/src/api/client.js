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

// Silent refresh on 401. Один спільний запит на оновлення, навіть якщо
// кілька викликів (axios-інтерсептор, SSE-стрім кампанії) отримали 401 разом.
let refreshPromise = null;

export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios.post('/api/auth/refresh', {}, { withCredentials: true })
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        return data.accessToken;
      })
      .catch((err) => {
        clearAccessToken();
        window.location.href = '/login';
        throw err;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;
    const token = await refreshAccessToken();
    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  }
);

export default api;
