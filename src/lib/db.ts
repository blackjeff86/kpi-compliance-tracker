import postgres from 'postgres';

// O "!" garante ao TypeScript que a URL existe no seu .env
const sql = postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
  idle_timeout: 20,
});

export default sql;