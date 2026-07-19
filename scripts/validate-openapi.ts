import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { relative, resolve, sep } from "node:path";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);
const PUBLIC_RESPONSE_COMPONENTS = new Set(["HealthSuccess", "MetaSuccess"]);
const RATE_LIMITED_OPERATIONS = new Set([
  "POST /auth/register",
  "POST /auth/verify-signup-otp",
  "POST /auth/resend-signup-otp",
  "POST /auth/login",
  "POST /auth/forgot-password",
  "POST /auth/reset-password",
  "POST /me/change-password",
  "POST /me/device-tokens",
  "DELETE /me/device-tokens/{id}",
  "POST /feedback",
]);

export type OpenApiOperationContract = {
  operationId: string;
  responses: Record<string, string>;
};

function routeFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    return statSync(path).isDirectory() ? routeFiles(path) : entry === "route.ts" ? [path] : [];
  });
}

function implementedOperations(root: string) {
  const apiRoot = resolve(root, "app/api");
  const operations = new Set<string>();
  for (const file of routeFiles(apiRoot)) {
    const source = readFileSync(file, "utf8");
    const methods = new Set<string>();
    const exportPattern = /export\s+(?:(?:async\s+)?function|const)\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g;
    for (const match of source.matchAll(exportPattern)) methods.add(match[1].toLowerCase());
    const destructuredExportPattern = /export\s+const\s*{([^}]+)}/g;
    for (const match of source.matchAll(destructuredExportPattern)) {
      for (const name of match[1].split(",").map((value) => value.trim())) {
        if (/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/.test(name)) methods.add(name.toLowerCase());
      }
    }

    const relativePath = relative(apiRoot, file).split(sep).slice(0, -1);
    if (relativePath[0] === "v1" || relativePath[0] === "internal") relativePath.shift();
    const path = `/${relativePath.map((segment) => segment.replace(/^\[([^\]]+)\]$/, "{$1}")).join("/")}`;
    for (const method of methods) operations.add(`${method.toUpperCase()} ${path}`);
  }
  return operations;
}

function documentedOperations(source: string) {
  const operations = new Set<string>();
  const operationIds: string[] = [];
  const contracts = new Map<string, OpenApiOperationContract>();
  const responseAnchors = new Map<string, Record<string, string>>();
  let path: string | undefined;
  let method: string | undefined;
  let operation: string | undefined;
  let responseAnchor: string | undefined;
  let inPaths = false;

  for (const line of source.split(/\r?\n/)) {
    if (line === "paths:") { inPaths = true; continue; }
    if (line === "components:") { inPaths = false; path = undefined; method = undefined; operation = undefined; }
    if (!inPaths) continue;
    const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
    if (pathMatch) { path = pathMatch[1]; method = undefined; operation = undefined; responseAnchor = undefined; continue; }
    const methodMatch = line.match(/^    ([a-z]+):\s*$/);
    if (methodMatch && HTTP_METHODS.has(methodMatch[1])) {
      method = methodMatch[1];
      if (path) {
        operation = `${method.toUpperCase()} ${path}`;
        operations.add(operation);
        contracts.set(operation, { operationId: "", responses: {} });
      }
      responseAnchor = undefined;
      continue;
    }
    const operationMatch = line.match(/^      operationId:\s*([^\s#]+)\s*$/);
    if (operationMatch && operation) {
      operationIds.push(operationMatch[1]);
      const contract = contracts.get(operation);
      if (contract) contract.operationId = operationMatch[1];
      continue;
    }
    const anchorMatch = line.match(/^      responses:\s*&([A-Za-z0-9_-]+)\s*$/);
    if (anchorMatch && operation) {
      responseAnchor = anchorMatch[1];
      responseAnchors.set(responseAnchor, contracts.get(operation)?.responses ?? {});
      continue;
    }
    const aliasMatch = line.match(/^      responses:\s*\*([A-Za-z0-9_-]+)\s*$/);
    if (aliasMatch && operation) {
      const contract = contracts.get(operation);
      const responses = responseAnchors.get(aliasMatch[1]);
      if (contract && responses) contract.responses = { ...responses };
      continue;
    }
    const responseMatch = line.match(/^        '([0-9]{3}|default)':\s*\{\s*\$ref:\s*['"]?#\/components\/responses\/([^\s,}'"]+)/);
    if (responseMatch && operation) {
      const contract = contracts.get(operation);
      if (contract) contract.responses[responseMatch[1]] = responseMatch[2];
      if (responseAnchor) responseAnchors.get(responseAnchor)![responseMatch[1]] = responseMatch[2];
      continue;
    }
    const inlineResponseMatch = line.match(/^        '([0-9]{3}|default)':/);
    if (inlineResponseMatch && operation) {
      const contract = contracts.get(operation);
      if (contract) contract.responses[inlineResponseMatch[1]] = "<inline-response>";
    }
  }
  return { operations, operationIds, contracts };
}

function componentBlocks(source: string, section: string) {
  const componentsStart = source.indexOf("components:");
  const sectionStart = source.indexOf(`  ${section}:`, componentsStart);
  if (sectionStart < 0) return new Map<string, string>();
  const sectionTail = source.slice(sectionStart + `  ${section}:`.length);
  const nextSection = sectionTail.search(/^  [A-Za-z][^:]*:/m);
  const sectionText = nextSection < 0 ? sectionTail : sectionTail.slice(0, nextSection);
  const starts = [...sectionText.matchAll(/^    ([A-Za-z0-9_-]+):\s*$/gm)];
  return new Map(starts.map((match, index) => [
    match[1],
    sectionText.slice(match.index, starts[index + 1]?.index ?? sectionText.length),
  ]));
}

function validateJsonResponseHeaders(source: string, contracts: Map<string, OpenApiOperationContract>) {
  const responses = componentBlocks(source, "responses");
  const failures: string[] = [];

  for (const [name, block] of responses) {
    if (!block.includes("application/json") && !block.includes("content: *errorContent")) continue;
    const isPublic = PUBLIC_RESPONSE_COMPONENTS.has(name);
    const hasRequestId = /^\s+X-Request-ID:/m.test(block) || block.includes("*privateResponseHeaders");
    const hasCacheControl = /^\s+Cache-Control:/m.test(block) || block.includes("*privateResponseHeaders");
    const hasVary = /^\s+Vary:/m.test(block) || block.includes("*privateResponseHeaders");
    if (!hasRequestId || !hasCacheControl || (!isPublic && !hasVary) || (isPublic && hasVary)) {
      failures.push(`${name}: expected ${isPublic ? "public X-Request-ID/Cache-Control without Vary" : "private X-Request-ID/Cache-Control/Vary"}`);
    }
  }

  for (const [operation, contract] of contracts) {
    if (!contract.operationId) failures.push(`${operation}: missing operationId`);
    if (!Object.keys(contract.responses).length) failures.push(`${operation}: missing component response references`);
    for (const [status, responseName] of Object.entries(contract.responses)) {
      if (!responses.has(responseName)) failures.push(`${operation} ${status}: unknown response component ${responseName}`);
    }
  }

  const rateLimited = responses.get("RateLimited") ?? "";
  if (!rateLimited.includes("Retry-After") || !rateLimited.includes("#/components/headers/RetryAfter")) {
    failures.push("RateLimited: missing reusable Retry-After header");
  }
  const documentedRateLimits = new Set(
    [...contracts].filter(([, contract]) => contract.responses["429"] === "RateLimited").map(([operation]) => operation),
  );
  const missingRateLimits = difference(RATE_LIMITED_OPERATIONS, documentedRateLimits);
  const extraRateLimits = difference(documentedRateLimits, RATE_LIMITED_OPERATIONS);
  if (missingRateLimits.length) failures.push(`Runtime rate limits missing 429/Retry-After contract: ${missingRateLimits.join(", ")}`);
  if (extraRateLimits.length) failures.push(`Documented 429 without a runtime rate limit: ${extraRateLimits.join(", ")}`);
  if (failures.length) throw new Error(`Invalid JSON response header contract:\n${failures.join("\n")}`);
}

function validateLocalRefs(source: string) {
  const refs = [...source.matchAll(/\$ref:\s*['"]?#\/components\/([^/'"]+)\/([^\s,}\]'"#]+)/g)];
  const missing = refs.filter((match) => {
    const [, section, name] = match;
    const sectionStart = source.indexOf(`  ${section}:`, source.indexOf("components:"));
    if (sectionStart < 0) return true;
    const nextSection = source.slice(sectionStart + 1).search(/^  \w[^:]*:/m);
    const sectionText = nextSection < 0 ? source.slice(sectionStart) : source.slice(sectionStart, sectionStart + 1 + nextSection);
    return !new RegExp(`^    ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:`, "m").test(sectionText);
  });
  if (missing.length) throw new Error(`Unresolved local OpenAPI refs:\n${[...new Set(missing.map((match) => match[0]))].join("\n")}`);
}

function difference(left: Set<string>, right: Set<string>) {
  return [...left].filter((value) => !right.has(value)).sort();
}

export function validateOpenApiContract(root = process.cwd()) {
  const source = readFileSync(resolve(root, "docs/openapi.yaml"), "utf8");
  validateLocalRefs(source);
  const implemented = implementedOperations(root);
  const { operations: documented, operationIds, contracts } = documentedOperations(source);
  validateJsonResponseHeaders(source, contracts);
  const duplicateIds = operationIds.filter((id, index) => operationIds.indexOf(id) !== index);
  if (duplicateIds.length) throw new Error(`Duplicate operationIds: ${[...new Set(duplicateIds)].join(", ")}`);

  const undocumented = difference(implemented, documented);
  const unimplemented = difference(documented, implemented);
  if (undocumented.length || unimplemented.length) {
    throw new Error([
      undocumented.length ? `Implemented but undocumented:\n${undocumented.join("\n")}` : "",
      unimplemented.length ? `Documented but unimplemented:\n${unimplemented.join("\n")}` : "",
    ].filter(Boolean).join("\n\n"));
  }
  return { operations: implemented.size, operationIds: operationIds.length };
}

export function getOpenApiOperationContract(operation: string, root = process.cwd()) {
  const source = readFileSync(resolve(root, "docs/openapi.yaml"), "utf8");
  return documentedOperations(source).contracts.get(operation);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const result = validateOpenApiContract();
  console.log(`OpenAPI contract valid: ${result.operations} operations, ${result.operationIds} unique operationIds.`);
}
