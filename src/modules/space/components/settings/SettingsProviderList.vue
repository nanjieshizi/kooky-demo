<script setup>
import kookyLogo from '@/assets/settings/kooky.png'
import defaultProviderIcon from '@/assets/settings/default_icon.svg'
import { resolveBundledImageFromApiPath, isLikelyInvalidSrcAssetPath } from '@/shared/utils/localApiAssetMap'

const props = defineProps({
  kookyProvider: { type: Object, default: () => ({}) },
  providers: { type: Array, default: () => [] },
  activeProviderId: { type: [String, Number], default: 'kooky' },
})

const emit = defineEmits(['select', 'create', 'delete'])

function getProviderLogoSrc(logo) {
  if (typeof logo !== 'string') return ''
  const val = logo.trim()
  if (!val) return ''
  const bundled = resolveBundledImageFromApiPath(val)
  if (bundled) return bundled
  if (isLikelyInvalidSrcAssetPath(val)) return defaultProviderIcon
  const isHttp = /^https?:\/\//i.test(val)
  const isDataImage = /^data:image\//i.test(val)
  const isLocalPath = val.startsWith('/') || val.startsWith('./')
  return (isHttp || isDataImage || isLocalPath) ? val : ''
}

function handleSelect(id) {
  emit('select', id)
}

function handleDelete(event, provider) {
  event.stopPropagation()
  emit('delete', provider.id)
}

function formatModelCount(provider) {
  const chat = provider.chatModelCount ?? 0
  const kode = provider.kodeModelCount ?? 0
  const total = provider.modelCount ?? (chat + kode)
  return `${total}个模型`
}

function isProviderDeleteDisabled(provider) {
  if (!provider || provider.id === 'kooky' || provider.isTemp) return false
  return Boolean(provider.dialogEnabled ?? provider.dialog_enabled)
    || Boolean(provider.kodeEnabled ?? provider.kode_enabled)
}

function isProviderEnabled(provider) {
  return Boolean(provider.dialogEnabled ?? provider.dialog_enabled)
    || Boolean(provider.kodeEnabled ?? provider.kode_enabled)
}
</script>

<template>
  <div class="spl-provider-list-wrap">
    <div class="spl-provider-list-header">
      <span class="spl-provider-list-title">服务商</span>
      <button
          type="button"
          class="spl-provider-add-btn" 
          @click="emit('create')"
        >
        <svgIcon name="icon-tianjia" />
      </button>
      <!-- <el-button class="spl-provider-add-btn" :icon="Plus" circle text @click="emit('create')" /> -->
    </div>

    <div
      class="spl-provider-item spl-provider-item--kooky-fixed"
      :class="{ active: activeProviderId === 'kooky' }"
      @click="handleSelect('kooky')"
    >
      <span class="spl-provider-logo">
        <span class="spl-provider-logo__inner">
          <img :src="kookyLogo" class="spl-provider-logo__img" alt="Kooky" />
        </span>
      </span>
      <div class="spl-provider-text">
        <div class="spl-provider-name-row">
          <span class="spl-provider-name">{{ kookyProvider.name || 'Kooky' }}</span>
          <span class="spl-provider-official-tag">官方</span>
        </div>
        <span class="spl-provider-meta">{{ formatModelCount(kookyProvider) }}</span>
      </div>
    </div>

    <div class="spl-provider-list-divider" />

    <div class="spl-provider-list-body">
      <div
        v-for="provider in providers"
        :key="provider.id"
        class="spl-provider-item"
        :class="{ active: activeProviderId === provider.id }"
        @click="handleSelect(provider.id)"
      >
        <span class="spl-provider-logo">
          <span class="spl-provider-logo__inner">
            <img
              v-if="getProviderLogoSrc(provider.logo)"
              :src="getProviderLogoSrc(provider.logo)"
              class="spl-provider-logo__img"
              alt="logo"
            />
            <span v-else>{{ provider.logo }}</span>
          </span>
        </span>
        <div class="spl-provider-text">
          <div class="spl-provider-name-row">
            <span class="spl-provider-name">{{ provider.name }}</span>
            <span
              v-if="isProviderEnabled(provider)"
              class="spl-provider-enabled-dot"
            />
          </div>
          <span class="spl-provider-meta">{{ formatModelCount(provider) }}</span>
        </div>
        <button
          v-if="activeProviderId === provider.id"
          class="spl-provider-delete-btn"
          type="button"
          @click="handleDelete($event, provider)"
        >
          <svgIcon name="icon-shanchu2" />
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.spl-provider-list-wrap {
  flex: 0 0 260px;
  align-self: stretch;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-right: 1px solid #ebeef5;
  overflow: hidden;
}

.spl-provider-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 16px 12px;
  flex-shrink: 0;

  .spl-provider-list-title {
    font-family: PingFang SC;
    font-size: 14px;
    font-weight: 500;
    line-height: 22px;
    text-align: center;
    letter-spacing: normal;
    /* 文本色&图标色/三级文本色 */
    color: #91949E;
  }

  .spl-provider-add-btn {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #606266;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s;
    &:hover {
      // color: #ff6b35;
      background: #f3f3f4;
    }
  }
}

.spl-provider-list-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0 12px 16px;
}

.spl-provider-list-divider {
  flex-shrink: 0;
  height: 1px;
  margin: 4px 24px 12px;
  background: #ebeef5;
}

.spl-provider-item--kooky-fixed {
  flex-shrink: 0;
  margin: 0 12px 0;
  padding: 12px;
  border-radius: 8px;

  .spl-provider-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .spl-provider-official-tag {
    display: inline-flex;
    align-items: center;
    padding: 0 6px;
    height: 20px;
    font-size: 11px;
    font-weight: 500;
    color: #FF621F;
    background: #FFFFFF;
    border-radius: 4px;
    line-height: 1;
  }

  .spl-provider-enabled-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #07C160;
    flex-shrink: 0;
  }

  .spl-provider-text {
    gap: 4px;
  }
}

.spl-provider-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  margin-bottom: 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  border: 1px solid transparent;
  position: relative;

  &:hover {
    background: #FFF1EA;
  }

  &.active {
    background: #FFF1EA;
    // border-color: #ffd4c8;
  }

  .spl-provider-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .spl-provider-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .spl-provider-name {
    font-size: 14px;
    font-weight: 500;
    color: #2F3547;
  }

  .spl-provider-enabled-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #07C160;
    flex-shrink: 0;
  }

  .spl-provider-meta {
    font-size: 12px;
    color: #91949E;
  }
}

.spl-provider-delete-btn {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #91949e;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 16px;

  &:hover:not(:disabled):not(.is-disabled) {
    border-radius: 8px;
    /* 文本色&图标色/一级文本色 */
    background: rgba(47, 53, 71, 0.1);
    color: rgba(145, 148, 158, 1);
  }

  &:disabled,
  &.is-disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.spl-provider-logo {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: #fff;
  box-sizing: border-box;
  border: 1px solid #eceef3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.spl-provider-logo__inner {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;
  font-size: 20px;
  line-height: 1;
}

.spl-provider-logo__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
