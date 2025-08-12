import axios from './axios';

export function setupMocks() {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;

  axios.interceptors.request.use(async (config) => {
    const { method, url } = config;
    if (method === 'get' && url === '/indexes') {
      config.adapter = async () => ({ data: [], status: 200, statusText: 'OK', headers: {}, config });
    }
    return config;
  });
}
