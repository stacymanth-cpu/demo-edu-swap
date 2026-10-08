import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
})
