<template>
  <div class="hired-detail-container">
    <AvatarCloneDetailView v-if="isClone" />
    <AvatarDetailView v-else-if="detail" :detail="detail" />
    <div v-else-if="initialized && !store.loading" class="not-found">未找到聘用记录</div>

    <!-- Loading -->
    <Loading :visible="loading" text="加载中..." :fullscreen="false" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMyHiredStore, MOCK_CLONE_DETAIL } from '../store'
import AvatarCloneDetailView from './AvatarCloneDetailView.vue'
import AvatarDetailView from './AvatarDetailView.vue'
import Loading from '@/shared/components/Loading/index.vue'

const route = useRoute()
const store = useMyHiredStore()

const id = computed(() => route.params.id)
const isClone = computed(() => String(id.value) === String(MOCK_CLONE_DETAIL.id))
const initialized = ref(false)
const loading = ref(false)

const detail = computed(() => {
  if (isClone.value) return null
  return store.getById(id.value)
})

async function initDetail() {
  initialized.value = false
  // 判断 URL 中是否含有 origin: 'agent-market'
  const origin = route.params.origin || route.query.origin
  const forceRefresh = origin === 'agent-market'
  
  if (!store.list.length || forceRefresh) {
    loading.value = true
    try {
      await store.loadList(forceRefresh)
    } finally {
      loading.value = false
    }
  }

  initialized.value = true
}

onMounted(() => {
  initDetail()
})

watch(id, () => {
  initDetail()
})
</script>

<style lang="scss" scoped>
.hired-detail-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.not-found {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #91949e;
}
</style>
