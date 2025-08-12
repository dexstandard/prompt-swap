import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import queryClient from './lib/queryClient';
import { setupMocks } from './lib/mocks';
process.env.VITE_USE_MOCKS='true';
setupMocks();

test('renders Pools link', () => {
  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
  expect(screen.getByText(/Pools/i)).toBeInTheDocument();
});
