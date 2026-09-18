import { fileURLToPath } from 'node:url';
process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('./battle-tests.tsconfig.json', import.meta.url));
import { registerHooks } from 'node:module';
// Component markup tests do not need browser stylesheets.
registerHooks({ load(url, context, nextLoad) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : nextLoad(url, context); } });
