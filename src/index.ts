/**
 * Manifest handler barrel. Every Forge `function` module `handler` points at
 * one of these named exports (for example `handler: index.resolverHandler`).
 * The Forge bundler resolves this file at deploy time.
 */
export { handler as resolverHandler } from "./resolvers/index";
export { osPresign } from "./functions/osPresign";
export { scanConsumer } from "./functions/scanConsumer";
