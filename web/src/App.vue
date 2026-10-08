<script setup lang="ts">
// 使用 Axios 发送 multipart 请求并接收 PNG 二进制响应。
import axios from 'axios'
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import createIcon from './assets/images/create.svg'
import backIcon from './assets/images/back.svg'

type PageState = 'selecting' | 'processing' | 'result'
type SelectedImage = { id: number; file: File; previewUrl: string }

const MAX_IMAGES = 5
const MAX_FILE_BYTES = 15 * 1024 * 1024
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const API_BASE_URL = import.meta.env.PROD ? import.meta.env.VITE_PROD_API_BASE_URL : ''
const pageState = ref<PageState>('selecting')
const selectedImages = ref<SelectedImage[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const downloadLink = ref<HTMLAnchorElement | null>(null)
const uploadButton = ref<HTMLButtonElement | null>(null)
const previewDialog = ref<HTMLDialogElement | null>(null)
const previewId = ref<number | null>(null)
const isResultPreview = ref(false)
let previewTrigger: HTMLButtonElement | null = null
const previewImage = computed(() => selectedImages.value.find((image) => image.id === previewId.value))
const previewUrl = computed(() => isResultPreview.value ? resultUrl.value : previewImage.value?.previewUrl)
const error = ref('')
const isAdding = ref(false)
const resultUrl = ref('')
// 保存正在处理的请求，以便页面销毁时中止上传或等待。
let activeRequest: AbortController | null = null
let nextId = 0

const canStitch = computed(() => selectedImages.value.length >= 2 && !isAdding.value)
const canAdd = computed(() => selectedImages.value.length < MAX_IMAGES && !isAdding.value)

function openPicker() {
  if (canAdd.value) fileInput.value?.click()
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片无法读取'))
    image.src = url
  })
}

async function addImages(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length || isAdding.value) return

  isAdding.value = true
  error.value = ''
  let rejected = 0
  let overflow = 0

  try {
    for (const file of files) {
      if (selectedImages.value.length >= MAX_IMAGES) {
        overflow++
        continue
      }
      if (!SUPPORTED_TYPES.has(file.type) || !file.size || file.size > MAX_FILE_BYTES) {
        rejected++
        continue
      }

      const previewUrl = URL.createObjectURL(file)
      try {
        const image = await loadImage(previewUrl)
        if (!image.naturalWidth || !image.naturalHeight) throw new Error('图片无法读取')
        selectedImages.value.push({ id: nextId++, file, previewUrl })
      } catch {
        URL.revokeObjectURL(previewUrl)
        rejected++
      }
    }
    if (rejected && overflow) error.value = `${rejected} 张图片不可用，另有 ${overflow} 张超出上限。`
    else if (rejected) error.value = `${rejected} 张图片未添加，请选择不超过 15 MiB 的 JPG、PNG 或 WebP 图片。`
    else if (overflow) error.value = `最多添加 ${MAX_IMAGES} 张，另有 ${overflow} 张未添加。`
  } finally {
    isAdding.value = false
  }
}

function openPreview(id: number, event: MouseEvent) {
  isResultPreview.value = false
  previewId.value = id
  previewTrigger = event.currentTarget as HTMLButtonElement
  previewDialog.value?.showModal()
}

function openResultPreview(event: MouseEvent) {
  isResultPreview.value = true
  previewTrigger = event.currentTarget as HTMLButtonElement
  previewDialog.value?.showModal()
}

function closePreview() {
  previewDialog.value?.close()
}

function handlePreviewBackdropClick(event: MouseEvent) {
  if (event.target === previewDialog.value) closePreview()
}

function onPreviewClose() {
  previewId.value = null
  isResultPreview.value = false
  previewTrigger?.focus()
  previewTrigger = null
}

function removeImage(id: number) {
  const index = selectedImages.value.findIndex((image) => image.id === id)
  if (index < 0) return
  URL.revokeObjectURL(selectedImages.value[index]!.previewUrl)
  selectedImages.value.splice(index, 1)
  error.value = ''
}

function clearResult() {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  resultUrl.value = ''
}

// 按页面上的图片顺序上传文件，并将后端返回的 PNG 用于结果预览。
async function stitchImages() {
  // 不足两张、正在添加或已经提交时，不再发起请求。
  if (!canStitch.value || pageState.value !== 'selecting') return
  // 清除之前的错误提示。
  error.value = ''
  // 立即切换状态，阻止连点造成重复提交。
  pageState.value = 'processing'
  // 为当前请求创建中止信号。
  const controller = new AbortController()
  // 记录当前请求，供页面销毁时使用。
  activeRequest = controller

  try {
    // 创建浏览器负责设置边界的 multipart 请求体。
    const formData = new FormData()
    // 按可见列表顺序依次添加相同字段名，保持后端拼接顺序一致。
    selectedImages.value.forEach((image) => {
      // 每张图片都使用后端约定的 images 字段。
      formData.append('images', image.file)
    })
    // 开发环境走 Vite 同源代理；生产构建使用环境变量指定的线上服务。
    const response = await axios.post<Blob>(`${API_BASE_URL}/images/stitch`, formData, {
      // 成功图片和失败 JSON 都先作为 Blob 接收。
      responseType: 'blob',
      // 保留 4xx/5xx 响应，以便读取业务错误或代理错误。
      validateStatus: () => true,
      // 页面卸载时取消尚未完成的请求。
      signal: controller.signal,
    })
    // 从响应头判断返回的是 PNG 还是 JSON/代理错误页。
    const contentType = String(response.headers['content-type'] ?? '')
    // 非 200 或非 PNG 均不能展示为图片。
    if (response.status !== 200 || !contentType.includes('image/png')) {
      // 代理返回 413 时未必有 JSON，先准备可理解的提示。
      let message = response.status === 413
        ? '上传图片总大小超出限制，请减少或更换图片。'
        : `拼接失败（HTTP ${response.status}），请重试。`
      // 只有 JSON 类型的错误响应才尝试读取业务消息。
      if (contentType.includes('application/json')) {
        try {
          // Axios 的 blob 模式下，错误 JSON 也以 Blob 形式返回。
          const text = await response.data.text()
          // 将错误体解析为待检查的未知数据。
          const detail: unknown = JSON.parse(text)
          // 确保业务错误体确实包含可显示的消息。
          if (detail && typeof detail === 'object' && 'message' in detail &&
            typeof detail.message === 'string') {
            // 使用后端给出的业务错误提示。
            message = detail.message
          }
        } catch {
          // 非法 JSON 保留原有提示，不把错误页当图片。
        }
      }
      // 交给统一失败分支恢复页面状态。
      throw new Error(message)
    }
    // 只在结果确认为 PNG 后清理上一张结果的 Object URL。
    clearResult()
    // 从后端原始 Blob 创建供预览和下载共用的地址。
    resultUrl.value = URL.createObjectURL(response.data)
    // 显示拼接结果页面。
    pageState.value = 'result'
    // 等待结果页面的下载入口渲染。
    await nextTick()
    // 将键盘焦点移到下载按钮。
    downloadLink.value?.focus()
  } catch (cause) {
    // 页面销毁后的主动取消无需再更新已经离开的页面。
    if (controller.signal.aborted) return
    // HTTP 业务错误保留后端提示；网络中断显示通用提示。
    error.value = cause instanceof Error && !axios.isAxiosError(cause)
      ? cause.message
      : '连接失败，请检查网络或稍后重试。'
    // 失败后保留已选图片，方便调整和再次提交。
    pageState.value = 'selecting'
    // 等待错误提示与上传按钮重新显示。
    await nextTick()
    // 让键盘用户可以继续操作上传入口。
    uploadButton.value?.focus()
  } finally {
    // 清除已结束的请求引用，避免之后误取消。
    if (activeRequest === controller) activeRequest = null
  }
}

function resetWorkspace() {
  if (previewDialog.value?.open) closePreview()
  selectedImages.value.forEach((image) => URL.revokeObjectURL(image.previewUrl))
  selectedImages.value = []
  clearResult()
  previewId.value = null
  isResultPreview.value = false
  previewTrigger = null
  if (fileInput.value) fileInput.value.value = ''
  error.value = ''
  isAdding.value = false
  nextId = 0
  pageState.value = 'selecting'
  void nextTick(() => uploadButton.value?.focus())
}

onBeforeUnmount(() => {
  // 页面销毁时取消尚未完成的上传或等待。
  activeRequest?.abort()
  selectedImages.value.forEach((image) => URL.revokeObjectURL(image.previewUrl))
  clearResult()
})
</script>

<template>
  <main class="app-shell">
    <div class="page-container">
      <section class="workspace" aria-labelledby="page-title">
        <div class="page-intro">
          <div class="intro-copy">
            <h1 id="page-title">拼图小能手</h1>
            <p class="intro-subtitle">多张截图，轻松拼成一张长图</p>
          </div>
        </div>

        <div v-if="pageState === 'selecting'" class="workspace-content">
          <input
            ref="fileInput"
            class="visually-hidden"
            type="file"
            tabindex="-1"
            accept="image/jpeg,image/png,image/webp"
            multiple
            aria-label="选择要拼接的图片"
            @change="addImages"
          />

          <button
            ref="uploadButton"
            type="button"
            class="upload-area"
            :class="{ 'upload-area--compact': selectedImages.length > 0 }"
            :disabled="!canAdd"
            @click="openPicker"
          >
            <span class="upload-symbol" aria-hidden="true"></span>
            <span class="upload-copy">
              <strong>{{ selectedImages.length ? '继续添加图片' : '选择图片' }}</strong>
              <small>{{ selectedImages.length >= MAX_IMAGES ? '已选满 5 张' : '选择 2-5 张图片' }}</small>
            </span>
          </button>

          <div v-if="selectedImages.length" class="selection">
            <ul class="thumbnail-grid" aria-label="已选图片，按显示顺序拼接">
              <li v-for="(image, index) in selectedImages" :key="image.id" class="thumbnail-item">
                <button type="button" class="thumbnail-preview" :aria-label="`放大查看第 ${index + 1} 张图片`" @click="openPreview(image.id, $event)">
                  <img :src="image.previewUrl" alt="" />
                </button>
                <button type="button" class="thumbnail-remove" :aria-label="`移除第 ${index + 1} 张图片`" @click="removeImage(image.id)">×</button>
              </li>
            </ul>
          </div>

          <p v-if="error" class="inline-error" role="alert">{{ error }}</p>

          <div class="action-area">
            <button class="primary-action" type="button" :disabled="!canStitch" @click="stitchImages">
              <span>生成长图</span>
              <span class="primary-action-icon" aria-hidden="true"><img :src="createIcon" alt="" /></span>
            </button>
          </div>
        </div>

        <div v-else-if="pageState === 'processing'" class="processing-view" role="status" aria-live="polite">
          <div class="processing-line" aria-hidden="true"></div>
          <h2>正在生成</h2>
        </div>

        <div v-else class="result-view">
          <button type="button" class="result-preview" aria-label="放大查看拼接长图" @click="openResultPreview($event)">
            <img :src="resultUrl" alt="" />
          </button>
          <div class="result-actions">
            <a ref="downloadLink" class="download-button" :href="resultUrl" download="拼接长图.png">
              <span>下载图片</span>
              <span class="primary-action-icon" aria-hidden="true"><img :src="createIcon" alt="" /></span>
            </a>
            <button class="reset-button" type="button" @click="resetWorkspace">
              <span>重新生成</span>
              <img :src="backIcon" alt="" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
    <dialog ref="previewDialog" class="preview-dialog" aria-label="图片预览" @close="onPreviewClose" @click="handlePreviewBackdropClick">
      <button type="button" class="preview-close" aria-label="关闭图片预览" @click="closePreview">×</button>
      <img v-if="previewUrl" :class="{ 'preview-result-image': isResultPreview }" :src="previewUrl" :alt="isResultPreview ? '放大的拼接长图' : '放大的已选图片'" />
    </dialog>
  </main>
</template>
