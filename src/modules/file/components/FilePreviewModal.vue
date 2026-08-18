<template>
  <Teleport to="body">
    <Transition name="fpm-fade">
      <div v-if="file" class="fpm-mask" @click.self="store.close()">
        <div class="fpm-window">
          <!-- 窗口标题栏 -->
          <div class="fpm-titlebar">
            <span class="fpm-dots"><i></i><i></i><i></i></span>
            <span class="fpm-app">Kooky</span>
          </div>

          <!-- 文件头 -->
          <header class="fpm-head">
            <span class="fpm-fileinfo">
              <span class="fpm-badge" :style="{ color: meta.color, background: meta.bg }">{{ meta.label }}</span>
              <span class="fpm-name">{{ file.name }}</span>
            </span>
            <span class="fpm-actions">
              <button class="fpm-iconbtn" title="下载">⬇</button>
              <button class="fpm-iconbtn" title="保存">💾</button>
            </span>
          </header>

          <!-- 预览内容 -->
          <div class="fpm-body">
            <div class="fpm-card">
              <div class="fpm-accent"></div>
              <h2 class="fpm-title">{{ file.name }}</h2>
              <div class="fpm-metaline">{{ file.size }} · 今天 14:32</div>
              <h3 class="fpm-sub">文件预览</h3>
              <p class="fpm-desc">这是个人文件的独立预览窗口。</p>
              <div class="fpm-skel">
                <span class="sk" style="width: 78%"></span>
                <span class="sk" style="width: 92%"></span>
                <span class="sk" style="width: 64%"></span>
              </div>
              <div class="fpm-skelblock">
                <span class="sk" style="width: 40%"></span>
                <span class="sk" style="width: 88%"></span>
                <span class="sk" style="width: 70%"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { FILE_TYPE_META } from '@/modules/file/demo/fileLibraryDemo'
import { useFilePreviewStore } from '@/modules/file/store/filePreviewStore'

const store = useFilePreviewStore()
const file = computed(() => store.file)
const meta = computed(() => FILE_TYPE_META[file.value?.type] || FILE_TYPE_META.other)
</script>

<style scoped>
.fpm-mask {
  position: fixed;
  inset: 0;
  z-index: 4000;
  background: rgba(31, 35, 41, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}
.fpm-window {
  width: min(880px, 92vw);
  height: min(680px, 84vh);
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 24px 80px rgba(31, 35, 41, 0.32);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.fpm-titlebar {
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  position: relative;
  padding: 0 14px;
  background: #f2f3f5;
  border-bottom: 1px solid var(--kk-border-soft, #e5e6eb);
}
.fpm-dots {
  display: flex;
  gap: 8px;
}
.fpm-dots i {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.fpm-dots i:nth-child(1) { background: #ff5f57; }
.fpm-dots i:nth-child(2) { background: #febc2e; }
.fpm-dots i:nth-child(3) { background: #28c840; }
.fpm-app {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  font-weight: 500;
  color: var(--kk-ink-600, #4b5563);
}
.fpm-head {
  height: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  border-bottom: 1px solid var(--kk-border-soft, #e5e6eb);
}
.fpm-fileinfo {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.fpm-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 7px;
  border-radius: 6px;
}
.fpm-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--kk-ink-800, #1f2329);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fpm-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.fpm-iconbtn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 15px;
}
.fpm-iconbtn:hover {
  background: var(--kk-fill-hover, rgba(0, 0, 0, 0.05));
}
.fpm-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: #fafbfc;
  padding: 28px;
  display: flex;
  justify-content: center;
}
.fpm-card {
  width: 100%;
  max-width: 640px;
  background: #fff;
  border: 1px solid var(--kk-border-soft, #e5e6eb);
  border-radius: 12px;
  padding: 0 32px 32px;
  overflow: hidden;
}
.fpm-accent {
  height: 6px;
  margin: 0 -32px 24px;
  background: var(--grad-warm, linear-gradient(90deg, #ff8a4c, #ff621f));
}
.fpm-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--kk-ink-800, #1f2329);
  margin: 0;
}
.fpm-metaline {
  font-size: 12px;
  color: var(--kk-ink-400, #9aa0aa);
  margin-top: 8px;
}
.fpm-sub {
  font-size: 16px;
  font-weight: 600;
  color: var(--kk-ink-800, #1f2329);
  margin: 28px 0 8px;
}
.fpm-desc {
  font-size: 14px;
  color: var(--kk-ink-600, #4b5563);
  margin: 0 0 20px;
}
.fpm-skel,
.fpm-skelblock {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fpm-skelblock {
  margin-top: 24px;
  padding: 18px;
  background: #f6f7f9;
  border-radius: 10px;
}
.sk {
  height: 10px;
  border-radius: 5px;
  background: #eceef1;
}

.fpm-fade-enter-active,
.fpm-fade-leave-active {
  transition: opacity 0.18s ease;
}
.fpm-fade-enter-from,
.fpm-fade-leave-to {
  opacity: 0;
}
</style>
