import { readFileSync } from 'node:fs';

import { resolveVersionHash } from '@ih3t/build-utils';
import { defineConfig } from 'vite';
import { VitePluginNode } from 'vite-plugin-node';

export default defineConfig({
    define: {
        __APP_VERSION_HASH__: JSON.stringify(resolveVersionHash()),
    },
    server: {
        // vite server configs, for details see [vite doc](https://vitejs.dev/config/#server-host)
        port: 3000,
    },
    plugins: [
        ...VitePluginNode({
            adapter: `express`,
            appPath: `./src/server.ts`,
            exportName: `app`,
        }),
        {
            /* The engine worker is its own entry: `worker_threads` loads a file, not a
             * chunk. The plugin above pins a single-file ssr build, so the entries are
             * re-declared here, flat, with SealBot's wasm emitted beside them — the
             * engine looks it up next to whichever file it was bundled into. */
            name: `engine-worker-entry`,
            config: () => ({
                build: {
                    ssr: true,
                    rollupOptions: {
                        input: {
                            server: `./src/server.ts`,
                            engineWorker: `./src/bots/drivers/engineWorker.ts`,
                        },
                        output: {
                            chunkFileNames: `[name]-[hash].cjs`,
                        },
                    },
                },
            }),
            generateBundle() {
                this.emitFile({
                    type: `asset`,
                    fileName: `sealEngine.wasm`,
                    source: readFileSync(new URL(`../bot-engine-seal/src/sealEngine.wasm`, import.meta.url)),
                });
            },
        },
    ],
});
