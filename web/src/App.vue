<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import createIcon from './assets/images/create.svg'

type PageState = 'selecting' | 'processing' | 'result'
type SelectedImage = { id: number; file: File; previewUrl: string }

const MAX_IMAGES = 5
const MAX_FILE_BYTES = 15 * 1024 * 1024
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_OUTPUT_WIDTH = 1080
const MAX_OUTPUT_HEIGHT = 16000
const MAX_OUTPUT_PIXELS = 16_000_000
const MIN_OUTPUT_WIDTH = 160

const pageState = ref<PageState>('selecting')
const selectedImages = ref<SelectedImage[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const returnButton = ref<HTMLButtonElement | null>(null)
const uploadButton = ref<HTMLButtonElement | null>(null)
const previewDialog = ref<HTMLDialogElement | null>(null)
const previewId = ref<number | null>(null)
let previewTrigger: HTMLButtonElement | null = null
const previewImage = computed(() => selectedImages.value.find((image) => image.id === previewId.value))
const error = ref('')
const isAdding = ref(false)
const resultUrl = ref('')
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
    else if (rejected) error.value = `${rejected} 张图片未添加，请选择不超过 15 MB 的 JPG、PNG 或 WebP 图片。`
    else if (overflow) error.value = `最多添加 ${MAX_IMAGES} 张，另有 ${overflow} 张未添加。`
  } finally {
    isAdding.value = false
  }
}

function openPreview(id: number, event: MouseEvent) {
  previewId.value = id
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

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('无法生成图片'))
    }, 'image/png')
  })
}

async function stitchDemo() {
  if (!canStitch.value || pageState.value !== 'selecting') return
  error.value = ''
  pageState.value = 'processing'

  try {
    const images = await Promise.all(selectedImages.value.map((item) => loadImage(item.previewUrl)))
    const heightRatio = images.reduce((sum, image) => sum + image.naturalHeight / image.naturalWidth, 0)
    const width = Math.floor(Math.min(
      MAX_OUTPUT_WIDTH,
      MAX_OUTPUT_HEIGHT / heightRatio,
      Math.sqrt(MAX_OUTPUT_PIXELS / heightRatio),
    ))
    if (width < MIN_OUTPUT_WIDTH) throw new Error('图片过长')
    const heights = images.map((image) => Math.max(1, Math.round(image.naturalHeight / image.naturalWidth * width)))
    const height = heights.reduce((sum, value) => sum + value, 0)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建画布')

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    let y = 0
    images.forEach((image, index) => {
      const segmentHeight = heights[index]!
      context.drawImage(image, 0, y, width, segmentHeight)
      y += segmentHeight
    })

    const blob = await canvasToBlob(canvas)
    clearResult()
    resultUrl.value = URL.createObjectURL(blob)
    pageState.value = 'result'
    await nextTick()
    returnButton.value?.focus()
  } catch {
    error.value = '生成失败，请换一组较小的图片后重试。'
    pageState.value = 'selecting'
    await nextTick()
    uploadButton.value?.focus()
  }
}

async function returnToSelection() {
  clearResult()
  pageState.value = 'selecting'
  error.value = ''
  await nextTick()
  uploadButton.value?.focus()
}

onBeforeUnmount(() => {
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
            <h1 id="page-title">图片拼接工具</h1>
            <p class="intro-subtitle">选好截图，一键拼成长图</p>
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
            <span class="upload-symbol" aria-hidden="true">+</span>
            <span class="upload-copy">
              <strong>{{ selectedImages.length ? '继续添加图片' : '选择图片' }}</strong>
              <small>{{ selectedImages.length >= MAX_IMAGES ? '已选满 5 张' : '选择 2-5 张图片' }}</small>
            </span>
            <span class="upload-arrow" aria-hidden="true">↗</span>
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
            <button class="primary-action" type="button" :disabled="!canStitch" @click="stitchDemo">
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
          <div class="result-heading">
            <div>
              <h2>已生成</h2>
              <p>按所选顺序排列，未自动去重。</p>
            </div>
            <button ref="returnButton" type="button" class="back-button" @click="returnToSelection">返回调整</button>
          </div>
          <div class="result-actions">
            <a class="download-button" :href="resultUrl" download="拼接长图.png">下载图片 <span aria-hidden="true">↗</span></a>
            <span>若无法直接下载，可尝试长按下方图片保存。</span>
          </div>
          <img class="result-image" :src="resultUrl" alt="按所选顺序纵向排列的演示长图" />
        </div>
      </section>
    </div>
    <dialog ref="previewDialog" class="preview-dialog" aria-label="图片预览" @close="onPreviewClose" @click="handlePreviewBackdropClick">
      <button type="button" class="preview-close" aria-label="关闭图片预览" @click="closePreview">×</button>
      <img v-if="previewImage" :src="previewImage.previewUrl" alt="放大的已选图片" />
    </dialog>
  </main>
</template>
