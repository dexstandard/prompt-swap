import { Container, Grid } from '@mantine/core';
import CreatePoolForm from '../components/forms/CreatePoolForm';
import PoolsTable from '../components/tables/PoolsTable';

export default function Pools() {
  return (
    <Container size="lg" py="md">
      <Grid gutter="xl">
        <Grid.Col span={{ base: 12, md: 5 }}>
          <CreatePoolForm />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <PoolsTable />
        </Grid.Col>
      </Grid>
    </Container>
  );
}
