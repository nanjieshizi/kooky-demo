<template>
  <div class="kept-main-stack w-full h-full min-h-0" style="position: relative">
    <div
      v-show="active === 'collaboration'"
      class="kept-main-layer"
    >
      <Collaboration v-if="collabMounted" class="main-content" />
    </div>
    <div
      v-show="active === 'solo-team'"
      class="kept-main-layer"
    >
      <SoloTeamView
        v-if="soloMounted"
        class="main-content"
        @team-data-ready="emit('team-data-ready', $event)"
      />
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'KeptMainStack' })
import { ref, watch } from 'vue'
import Collaboration from './Collaboration.vue'
import { SoloTeamView } from '@/modules/solo-team'

const props = defineProps({
  /** 空字符串表示不展示任一层，但不卸载已挂载的实例 */
  active: {
    type: String,
    default: '',
    validator: (v) => v === '' || ['collaboration', 'solo-team'].includes(v),
  },
})

const emit = defineEmits(['team-data-ready'])

const collabMounted = ref(false)
const soloMounted = ref(false)

watch(
  () => props.active,
  (a) => {
    if (a === 'collaboration') collabMounted.value = true
    else if (a === 'solo-team') soloMounted.value = true
  },
  { immediate: true },
)
</script>

<style scoped>
.kept-main-stack {
  position: relative;
}
.kept-main-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>
