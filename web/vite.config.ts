// 导入 Vue 单文件组件编译插件。
import vue from '@vitejs/plugin-vue'
// 导入 Vite 配置辅助函数。
import { defineConfig } from 'vite'

// 配置本地前端开发服务器。
export default defineConfig({
  // 保留当前项目使用的 Vue 插件。
  plugins: [vue()],
  // 将图片拼接请求转发到只监听本机的 Nest 服务，避免开发时跨域。
  server: {
    // 仅代理业务接口，不改动其余前端资源请求。
    proxy: {
      // 浏览器请求同源 /images 时由 Vite 转交给后端。
      '/images': 'http://127.0.0.1:3000',
    },
  },
})
