import axios from './axios';

export function setupMocks() {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;

  axios.interceptors.request.use(async (config) => {
    const { method, url } = config;
    if (method === 'get' && url === '/indexes') {
      config.adapter = async () => ({ data: [], status: 200, statusText: 'OK', headers: {}, config });
    }
    if (method === 'get' && url?.startsWith('/indexes/paginated')) {
      config.adapter = async () => ({
        data: { items: [], total: 0, page: 1, pageSize: 10 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    }
    return config;
  });
}
