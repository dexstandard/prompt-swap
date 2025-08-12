import { AppShell as MantineAppShell, Group, NavLink, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from '../../lib/axios';

function ApiStatus() {
  const { isSuccess } = useQuery({
    queryKey: ['api-status'],
    queryFn: () => axios.get('/pools'),
  });

  return <Text size="sm">API: {isSuccess ? 'Online' : 'Offline'}</Text>;
}

export default function AppShell() {
  return (
    <MantineAppShell
      header={{ height: 60 }}
      navbar={{ width: 200, breakpoint: 'sm' }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group justify="space-between" px="md" h="100%">
          <Text>PromptSwap</Text>
          <ApiStatus />
        </Group>
      </MantineAppShell.Header>
      <MantineAppShell.Navbar p="md">
        <NavLink component={Link} to="/">Pools</NavLink>
        <NavLink component={Link} to="/settings">Settings</NavLink>
      </MantineAppShell.Navbar>
      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
