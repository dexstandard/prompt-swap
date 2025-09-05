import axios from 'axios';

// Use the Vite dev server proxy by default so requests hit the same origin
// and avoid CORS. An explicit base URL can still be provided via VITE_API_BASE
// for deployments where the API lives elsewhere.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  withCredentials: true,
});

export default api;
