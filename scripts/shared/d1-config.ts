import ts from "typescript";

export function readD1Config(contents: string, env: "staging" | "prod") {
  const parsed = ts.parseConfigFileTextToJson("wrangler.jsonc", contents);
  if (parsed.error) throw new Error("Invalid wrangler.jsonc");
  const bindings = env === "staging"
    ? parsed.config?.env?.staging?.d1_databases
    : parsed.config?.d1_databases;
  const binding = bindings?.find((entry: { binding?: string }) => entry.binding === "DB");
  if (!binding?.database_id || !binding.database_name)
    throw new Error(`No D1 binding DB configured for ${env}`);
  return { databaseId: String(binding.database_id), databaseName: String(binding.database_name) };
}
