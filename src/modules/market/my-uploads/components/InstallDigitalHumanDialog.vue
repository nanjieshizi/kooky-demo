<!--
  my-uploads 入口下的 InstallDigitalHumanDialog 直接复用市场版组件，
  避免两份模板/样式漂移。新版（三类安装目标：我的分身 / 数字员工 / Kode 终端）
  在 @/modules/market/skill/components/InstallDigitalHumanDialog.vue 内统一实现。
-->
<template>
  <SkillInstallDialog
    :model-value="modelValue"
    :skill-slug="skillSlug"
    @update:model-value="(v) => emit('update:modelValue', v)"
    @confirm="(payload) => emit('confirm', payload)"
  />
</template>

<script setup>
import SkillInstallDialog from '@/modules/market/skill/components/InstallDigitalHumanDialog.vue'

defineProps({
  modelValue: { type: Boolean, default: false },
  skillSlug: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'confirm'])
</script>
