#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/63e9423a77d7b6db5bb3864c775f4fe47779fcf57654e1f6f29ec29c3d303fa5/contract';
import startContract from '../../snapshots/63e9423a77d7b6db5bb3864c775f4fe47779fcf57654e1f6f29ec29c3d303fa5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d3088eb2232fe22613f750a5738c02c042be255229cad742ed1865b676464d93/contract';
import endContract from '../../snapshots/d3088eb2232fe22613f750a5738c02c042be255229cad742ed1865b676464d93/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Todo',
        column: col('dueDate', 'date', { codecRef: { codecId: 'pg/date-string@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
