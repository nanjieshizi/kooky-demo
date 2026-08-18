<template>
  <div class="related-skills">
    <div class="section-title">
      <div class="belt"></div>关联 Skill
    </div>
    <div v-if="skills.length" class="related-skills__list">
      <RelatedSkillCard
        v-for="skill in skills"
        :key="skill.id"
        :item="skill"
        @click="handleView(skill.id)"
      />
    </div>
    <div v-else class="related-skills__empty">暂无关联 Skill</div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import RelatedSkillCard from './RelatedSkillCard.vue'

const props = defineProps({
  skills: { type: Array, default: () => [] },
  agentId: { type: [String, Number], default: '' },
})

const router = useRouter()

function handleView(id) {
  const currentHistory = router.options.history.state.breadcrumbHistory || []

  // 构建新的历史：保留当前历史 + 添加当前详情页（带 to）
  const newHistory = currentHistory.length > 0
    ? [
        ...currentHistory,
        { label: '数字人详情', to: `/market/my-uploads/agent/${props.agentId}` },
      ]
    : [
        { label: '我的上传', to: '/market/my-uploads' },
        { label: '数字人详情', to: `/market/my-uploads/agent/${props.agentId}` },
      ]

  router.push({
    name: 'UploadSkillDetail',
    params: { id },
    state: {
      breadcrumbHistory: newHistory,
    },
  })
}
</script>

<style lang="scss" scoped>
.section-title {
  font-family: PingFang SC;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  display: flex;
  align-items: center;
  letter-spacing: 0px;
  font-variation-settings: "opsz" auto;
  color: #2F3547;
  margin-bottom: 24px;

  .belt {
    background: #FF684E;
    margin-top: 2px;
    width: 3px;
    height: 14px;
    border-radius: 0px 4px 4px 0px;
    margin-right: 8px;
  }
}

.related-skills__list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.related-skills__empty {
  font-size: 14px;
  color: #8f959e;
}
</style>
