// @ts-check
import { module } from "@prisma/composer";
import { postgres, dataContract } from "@prisma/composer-prisma-cloud/orm";
import toDoAppContractJson from "./src/prisma/contract.json" with { type: "json" };
import toDoAppService from "./src/service.mts";

export default module("to-do-app", ({ provision }) => {
  const database = provision(postgres({ name: "database", contract: dataContract(toDoAppContractJson), config: "./prisma.config.ts" }));
  provision(toDoAppService, { id: "todoapp", deps: { db: database } });
});
