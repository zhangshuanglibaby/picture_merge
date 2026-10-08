// 导入 Vue 单文件组件编译插件。
import vue from '@vitejs/plugin-vue'
// 导入 Vite 配置辅助函数。
import { defineConfig, loadEnv } from 'vite'

// 开发服务器将 /images 请求转发到本地后端。
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  server: {
    proxy: {
      '/images': loadEnv(mode, process.cwd(), 'VITE_').VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:3000',
    },
  },
}))
