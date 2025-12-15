/// <reference types="vite/client" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { loadEnvTyped } from './src/utils/env.utils'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig(({ mode }) => {
  const env = loadEnvTyped(mode)
  console.log(`Building for ${mode}`)
  console.log('VITE_API_URL:', env.VITE_API_URL)
  return {
    base: '/',
    define: {
      __API_URL__: JSON.stringify(env.VITE_API_URL || 'https://esce-api-hwhhh5behvh3gnfr.southeastasia-01.azurewebsites.net'),
      __API_APP_PORT__: Number(env.VITE_APP_PORT || 3000),
      __KEY_STORAGE_ACCOUNT__: JSON.stringify(env.VITE_KEY_STORAGE_ACCOUNT || 'account'),
      __BASE_PX_SIZE__: 10
    },
    plugins: [react(), tailwindcss()],
    server: {
      port: Number(env.VITE_APP_PORT),
      strictPort: true // Bắt buộc dùng port 5173, báo lỗi nếu port đã bị chiếm
    },
    resolve: {
      alias: [{ find: '~', replacement: '/src' }]
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        output: {
          // Use a conservative single `vendor` chunk for node_modules to avoid
          // circular import / TDZ issues introduced by aggressive manualChunks splitting.
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              return 'vendor'
            }
          }
        }
      },
      // Tối ưu chunk size warnings
      chunkSizeWarningLimit: 1000,
      // Tối ưu minification
      minify: 'esbuild',
      // Source maps cho production (có thể tắt để giảm size)
      sourcemap: false
    }
  }
})
