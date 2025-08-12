import { Grid } from '@mantine/core';
import CreatePoolForm from '../components/forms/CreatePoolForm';
import PoolsTable from '../components/tables/PoolsTable';

export default function Pools() {
  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 6 }}>
        <CreatePoolForm />
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 6 }}>
        <PoolsTable />
      </Grid.Col>
    </Grid>
  );
}
