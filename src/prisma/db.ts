import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

export const contract = contractFromJson<Contract>(contractJson);

// On Prisma Compute the database is the Composer-managed one, handed to the
// service as a binding (service.load()). It wins over DATABASE_URL there:
// Composer pins DATABASE_URL to "-", or leaves an older value in place that
// points at a different database. Everywhere else (local dev, Docker, Render)
// there is no binding, so DATABASE_URL is used.
async function databaseUrl(): Promise<string> {
  const { default: service } = await import('../service.mts');
  try {
    return service.load().db.url;
  } catch (noBinding) {
    const fromEnv = process.env['DATABASE_URL'];
    if (fromEnv && fromEnv !== '-') return fromEnv;
    throw noBinding;
  }
}

export const db = postgres({
  contract,
  url: await databaseUrl(),
});
