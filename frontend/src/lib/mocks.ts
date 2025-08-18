import axios from './axios';

export function setupMocks() {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;

  axios.interceptors.request.use(async (config) => {
    return config;
  });
}
