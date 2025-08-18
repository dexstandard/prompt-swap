import axios from 'axios';

// Use the Vite dev server proxy by default so requests hit the same origin
// and avoid CORS. An explicit base URL can still be provided via VITE_API_BASE
// for deployments where the API lives elsewhere.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('user');
    if (raw) {
      try {
        const { id } = JSON.parse(raw);
        if (id) {
          config.headers = config.headers || {};
          config.headers['x-user-id'] = id;
        }
      } catch {
        // ignore JSON parse errors
      }
    }
  }
  return config;
});

export default api;
