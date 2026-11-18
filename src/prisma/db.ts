import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

export const contract = contractFromJson<Contract>(contractJson);

// Local dev, Docker and Render pass a real DATABASE_URL. On Prisma Compute,
// Composer pins DATABASE_URL to the placeholder "-" and hands the database to
// the service as a binding instead, read through service.load().
async function databaseUrl(): Promise<string> {
  const fromEnv = process.env['DATABASE_URL'];
  if (fromEnv && fromEnv !== '-') return fromEnv;
  const { default: service } = await import('../service.mts');
  return service.load().db.url;
}

export const db = postgres({
  contract,
  url: await databaseUrl(),
});
