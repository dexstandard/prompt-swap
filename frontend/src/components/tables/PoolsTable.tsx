import { useState } from 'react';
import { Button, Group, Table, TextInput, Pagination, Paper, Stack, Title } from '@mantine/core';
import { usePools } from '../../hooks/usePools';

const PAGE_SIZE = 10;

type SortKey = 'name' | 'exchange';

export default function PoolsTable() {
  const { poolsQuery, statusMutation } = usePools();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [page, setPage] = useState(1);

  const pools = Array.isArray(poolsQuery.data) ? poolsQuery.data : [];
  const data = pools.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const sorted = [...data].sort((a, b) => a[sort].localeCompare(b[sort]));
  const pages = Math.ceil(sorted.length / PAGE_SIZE) || 1;
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Paper withBorder shadow="sm" p="md" radius="md">
      <Stack>
        <Title order={4}>Pools</Title>
        <TextInput
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th onClick={() => setSort('name')}>Name</Table.Th>
              <Table.Th onClick={() => setSort('exchange')}>Exchange</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {paged.map((pool) => (
              <Table.Tr key={pool.id}>
                <Table.Td>{pool.name}</Table.Td>
                <Table.Td>{pool.exchange}</Table.Td>
                <Table.Td>{pool.status}</Table.Td>
                <Table.Td>
                  <Group justify="flex-end">
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() =>
                        statusMutation.mutate({
                          id: pool.id,
                          status: pool.status === 'active' ? 'paused' : 'active',
                        })
                      }
                    >
                      {pool.status === 'active' ? 'Pause' : 'Activate'}
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Group justify="center" mt="sm">
          <Pagination total={pages} value={page} onChange={setPage} />
        </Group>
      </Stack>
    </Paper>
  );
}
