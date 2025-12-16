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
          // Split vendor chunks để load song song và cache tốt hơn
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              // React core
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'react-vendor'
              }
              // MUI - thư viện lớn nhất
              if (id.includes('@mui') || id.includes('@emotion')) {
                return 'mui-vendor'
              }
              // Firebase
              if (id.includes('firebase')) {
                return 'firebase-vendor'
              }
              // Charts
              if (id.includes('chart.js') || id.includes('recharts')) {
                return 'charts-vendor'
              }
              // Còn lại
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
      sourcemap: false,
      // Target modern browsers để giảm polyfills
      target: 'es2020'
    }
  }
})
