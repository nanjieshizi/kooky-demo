<template>
  <section class="ent-detail" v-if="agent">
    <header class="ent-detail__bar">
      <button class="ent-detail__back" @click="goBack">‹ 返回</button>
      <span class="ent-detail__bar-title">{{ agent.name }} 详情</span>
    </header>

    <div class="ent-detail__body">
      <!-- Hero -->
      <div class="ent-hero">
        <div class="ent-hero__avatar">{{ agent.icon }}</div>
        <div class="ent-hero__info">
          <div class="ent-hero__title-row">
            <h1 class="ent-hero__title">{{ agent.name }}</h1>
            <span class="ent-hero__db">🗄️ 带数据库</span>
          </div>
          <div class="ent-hero__tags">
            <span v-for="t in agent.tags" :key="t" class="ent-tag">{{ t }}</span>
          </div>
          <div class="ent-hero__meta">
            由 <b>{{ agent.author.displayName }}</b> 维护 · 更新于 {{ agent.updatedAt }} · 👥 {{ agent.subscribers }} 订阅
          </div>
        </div>
        <div class="ent-hero__actions">
          <button class="ent-sub-btn" :class="{ 'is-subscribed': agent.isSubscribed }" @click="toggleSubscribe">
            {{ agent.isSubscribed ? '已订阅' : '订阅' }}
          </button>
        </div>
      </div>

      <!-- 基本信息 -->
      <section class="ent-sec">
        <h2 class="ent-sec__title">基本信息</h2>
        <p class="ent-sec__text">{{ agent.description }}</p>
      </section>

      <!-- 技能 -->
      <section class="ent-sec">
        <h2 class="ent-sec__title">技能</h2>
        <div class="ent-skill-list">
          <div v-for="s in agent.skills" :key="s.id" class="ent-skill">
            <span class="ent-skill__icon">🧩</span>
            <div>
              <div class="ent-skill__name">{{ s.name }}</div>
              <div class="ent-skill__desc">{{ s.desc }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- 知识库 -->
      <section class="ent-sec">
        <h2 class="ent-sec__title">知识库</h2>
        <div class="ent-know-list">
          <div v-for="k in agent.knowledge" :key="k.id" class="ent-know">
            <span>{{ k.type === 'url' ? '🔗' : '📄' }}</span>
            <span class="ent-know__name">{{ k.name }}</span>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup>
defineOptions({ name: 'EnterpriseDetailView' })
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getEnterpriseAgent } from '@/dev-mocks/data/enterprise-agents'

const route = useRoute()
const router = useRouter()
const agent = computed(() => getEnterpriseAgent(route.params.id))

function toggleSubscribe() {
  const a = agent.value
  if (!a) return
  a.isSubscribed = !a.isSubscribed
  if (a.isSubscribed) {
    a.subscribers += 1
    ElMessage.success(`已订阅「${a.name}」，可在会话中 @召唤`)
  } else {
    a.subscribers = Math.max(0, a.subscribers - 1)
    ElMessage.info('已取消订阅')
  }
}
function goBack() { router.back() }
</script>

<style lang="scss" scoped>
.ent-detail { flex: 1; display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow-y: auto; }
.ent-detail__bar { height: 52px; display: flex; align-items: center; gap: 12px; padding: 0 20px; border-bottom: 1px solid #eceef3; position: sticky; top: 0; background: #fff; z-index: 5; }
.ent-detail__back { border: none; background: transparent; color: #6b7280; font-size: 14px; cursor: pointer; }
.ent-detail__bar-title { font-size: 15px; font-weight: 600; color: #1a1a1a; }
.ent-detail__body { padding: 24px 32px; max-width: 920px; }

.ent-hero { display: flex; gap: 16px; align-items: flex-start; padding-bottom: 24px; border-bottom: 1px solid #eceef3; }
.ent-hero__avatar { width: 72px; height: 72px; flex-shrink: 0; border-radius: 16px; background: linear-gradient(135deg, #eef2ff, #f5f3ff); display: flex; align-items: center; justify-content: center; font-size: 38px; }
.ent-hero__info { flex: 1; min-width: 0; }
.ent-hero__title-row { display: flex; align-items: center; gap: 10px; }
.ent-hero__title { margin: 0; font-size: 24px; font-weight: 700; color: #1a1a1a; }
.ent-hero__db { font-size: 12px; color: #6366f1; background: rgba(99,102,241,0.1); padding: 2px 8px; border-radius: 6px; }
.ent-hero__tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
.ent-hero__meta { font-size: 13px; color: #9ca3af; }
.ent-hero__actions { flex-shrink: 0; }
.ent-tag { font-size: 11px; color: #6b7280; background: #f3f4f6; padding: 2px 8px; border-radius: 5px; }

.ent-sub-btn { height: 38px; padding: 0 28px; border: none; border-radius: 10px; background: #6366f1; color: #fff; font-size: 14px; cursor: pointer; &:hover { background: #4f46e5; } &.is-subscribed { background: #f2f3f5; color: #6b7280; } }

.ent-sec { padding: 22px 0; border-bottom: 1px solid #f3f4f6; }
.ent-sec__title { margin: 0 0 14px; font-size: 16px; font-weight: 600; color: #1a1a1a; border-left: 3px solid #ff684e; padding-left: 8px; }
.ent-sec__text { margin: 0; font-size: 14px; color: #4b5563; line-height: 1.8; }

.ent-skill-list { display: flex; flex-direction: column; gap: 10px; }
.ent-skill { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; background: #f9fafb; border-radius: 10px; }
.ent-skill__icon { font-size: 18px; }
.ent-skill__name { font-size: 14px; font-weight: 500; color: #1a1a1a; }
.ent-skill__desc { font-size: 12px; color: #9ca3af; margin-top: 2px; }

.ent-know-list { display: flex; flex-direction: column; gap: 8px; }
.ent-know { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #f9fafb; border-radius: 10px; font-size: 13px; color: #374151; }
</style>
