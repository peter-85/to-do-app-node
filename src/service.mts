import node from "@prisma/composer/node";
import { compute } from "@prisma/composer-prisma-cloud";
import { postgres, dataContract } from "@prisma/composer-prisma-cloud/orm";
import type { Contract } from "./prisma/contract.js";
import toDoAppContractJson from "./prisma/contract.json" with { type: "json" };

export default compute({
  name: "to-do-app",
  deps: { db: postgres(dataContract<Contract>(toDoAppContractJson)) },
  build: node({ module: import.meta.url, dir: "../dist", entry: "server.mjs", dependencies: "external" }),
});
