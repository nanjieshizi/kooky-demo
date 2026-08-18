<template>
  <div v-if="secondaryNavItems.length" class="market-submenu-list">
    <template v-for="item in secondaryNavItems" :key="item.key">
      <div v-if="item.type === 'group-header'" class="market-submenu-group-header">
        <img v-if="iconMap[item.icon]" :src="iconMap[item.icon]" :alt="item.label" class="market-submenu-group-icon-img" />
        <span v-else-if="item.icon" class="market-submenu-group-icon">{{ item.icon }}</span>
        <span class="market-submenu-group-label">{{ item.label }}</span>
      </div>
      <div
        v-else
        class="market-submenu-item"
        :class="{ active: uiStore.activeSecondaryNav === item.key }"
        @click="onSecondaryNavClick(item)"
      >
        <span class="market-submenu-item-label">{{ item.label }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/modules/space/uiStore'
import { getSecondaryNavItems } from '@/modules/navigation/config'
import marketIcon from '@/assets/home/market.png'
import myIcon from '@/assets/home/my.png'

const router = useRouter()
const uiStore = useUIStore()

const iconMap = {
  market: marketIcon,
  my: myIcon,
}

const secondaryNavItems = computed(() =>
  getSecondaryNavItems('market'),
)

async function onSecondaryNavClick(item) {
  if (item.route) {
    uiStore.setActiveNavigation('market', item.key)
    await router.push(item.route)
  }
}
</script>

<style lang="scss" scoped>
.market-submenu-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.market-submenu-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 0px 14px;
  margin-top: 8px;
}

.market-submenu-group-header:first-child {
  margin-top: 0;
}

.market-submenu-group-icon {
  font-size: 18px;
  line-height: 1;
}

.market-submenu-group-icon-img {
  width: 14px;
  height: 14px;
  display: block;
}

.market-submenu-group-label {
  font-family: PingFang SC;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  color: #91949E;
}

.market-submenu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: #2f3547;
  cursor: pointer;
  transition: all 0.2s ease;
}

.market-submenu-item:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.7) 99%);
}

.market-submenu-item.active {
  font-weight: 600;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.7) 99%);
}

.market-submenu-item-label {
  min-width: 0;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}
</style>
