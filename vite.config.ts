import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Adds the servers this build talks to beyond Firebase and LiveKit to the Content Security
 * Policy in index.html: the configured PIN / call-token server, and the local Firebase
 * emulators when VITE_USE_FIREBASE_EMULATORS is on (browser tests).
 */
function cspConnectSources(env: Record<string, string>): Plugin {
  const sources = new Set<string>();
  for (const endpoint of [env.VITE_LIVEKIT_TOKEN_ENDPOINT, env.VITE_OTP_ENDPOINT]) {
    if (endpoint && /^https?:\/\//.test(endpoint)) sources.add(new URL(endpoint).origin);
  }
  if (env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    ['http://127.0.0.1:9099', 'http://127.0.0.1:8080', 'ws://127.0.0.1:8080'].forEach(source => sources.add(source));
  }
  return {
    name: 'eduswap-csp-connect-src',
    transformIndexHtml(html) {
      const missing = [...sources].filter(source => !html.includes(` ${source}`));
      return missing.length ? html.replace("connect-src 'self'", `connect-src 'self' ${missing.join(' ')}`) : html;
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), cspConnectSources(loadEnv(mode, process.cwd(), 'VITE_'))],
  build: {
    rolldownOptions: {
      output: {
        // Libraries change far less often than app code, so give them their own
        // files that browsers keep cached across deploys.
        codeSplitting: {
          groups: [
            // Storage is left out because it is loaded on demand (see lib/firestore/registration.ts).
            { name: 'firebase', test: /node_modules[\\/]@?firebase[\\/](?!storage[\\/])/ },
            { name: 'livekit', test: /node_modules[\\/]livekit-client[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
}))
