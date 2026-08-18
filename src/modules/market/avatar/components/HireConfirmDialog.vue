<template>
  <el-dialog
    class="hire-confirm-el-dialog"
    :style="dialogShellStyle"
    :model-value="modelValue"
    width="480px"
    align-center
    :show-close="true"
    :close-on-click-modal="false"
    append-to-body
    @update:model-value="handleClose"
  >
    <template #header>
      <div class="hire-confirm-header">
        <img :src="hiPng" alt="" class="hire-confirm-hi" />
        <h3 class="hire-confirm-title">给你聘用的数字人起个专属名字吧~</h3>
      </div>
    </template>

    <el-form ref="formRef" class="hire-confirm-form" :model="formData" :rules="formRules" label-position="left" label-width="auto">
      <el-form-item label="原数字人名称">
        <el-input :value="displayName" disabled />
      </el-form-item>
      <el-form-item label="新名称" prop="newName" required>
        <el-input
          v-model="formData.newName"
          placeholder="请输入新名称"
          clearable
          maxlength="15"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="hire-confirm-footer">
        <MarketCustomButton
          variant="default"
          @click="handleClose"
        >
          取消
        </MarketCustomButton>
        <MarketCustomButton
          variant="dark"
          @click="handleConfirm"
        >
          确定
        </MarketCustomButton>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'
import hiPng from './images/hi.png'
import dialogBg from './images/dialogBg.png'

const dialogShellStyle = {
  '--hire-dialog-bg': `url("${dialogBg}")`,
}

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  displayName: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const formRef = ref(null)
const formData = ref({
  newName: ''
})

const formRules = {
  newName: [
    { required: true, message: '请输入新名称', trigger: 'blur' },
    { min: 1, max: 15, message: '长度在 1 到 15 个字符', trigger: 'blur' }
  ]
}

const MAX_NAME_LEN = 15

/**
 * 新名称规则（与 maxlength 一致）：
 * - 若不以「-」+ 数字结尾，则追加「-1」
 * - 若以「-」+ 数字结尾，则对该数字 +1
 * - 若超长，从基础名称尾部删字，仍不满足则压缩尾数位数，最后再硬截断
 */
function applyHireNameSuffixRule(rawName) {
  let s = String(rawName ?? '').trim()
  if (!s) return ''

  const re = /^(.*)-(\d+)$/
  const m = s.match(re)
  let base
  let nextNum

  if (m) {
    base = m[1]
    const parsed = parseInt(m[2], 10)
    nextNum = Number.isFinite(parsed) ? parsed + 1 : 1
  } else {
    base = s
    nextNum = 1
  }

  const build = (b, n) => `${b}-${n}`

  let b = base
  while (build(b, nextNum).length > MAX_NAME_LEN && b.length > 0) {
    b = b.slice(0, -1)
  }

  let out = build(b, nextNum)
  while (out.length > MAX_NAME_LEN && String(nextNum).length > 1) {
    nextNum = Math.floor(nextNum / 10)
    out = build(b, nextNum)
  }

  if (out.length > MAX_NAME_LEN) {
    out = out.slice(0, MAX_NAME_LEN)
  }

  return out
}

// 每次打开：按聘用后缀规则生成默认名，直接填入「新名称」
watch(() => props.modelValue, (val) => {
  if (!val) return
  const d = String(props.displayName ?? '').trim()
  formData.value.newName = d ? applyHireNameSuffixRule(d) : ''
})

function handleClose() {
  emit('update:modelValue', false)
  // 重置表单
  if (formRef.value) {
    formRef.value.resetFields()
  }
}

async function handleConfirm() {
  // 验证表单
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    const t = formData.value.newName.trim()
    if (!t) {
      return
    }
    emit('update:modelValue', false)
    emit('confirm', t)
    // 重置表单
    formRef.value.resetFields()
  } catch (error) {
    console.log('表单验证失败:', error)
  }
}
</script>

<style lang="scss" scoped>
.hire-confirm-header {
  display: flex;
  // align-items: center;
  // justify-content: center;
  gap: 8px;
  padding-right: 36px;
}

.hire-confirm-hi {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  object-fit: contain;
  display: block;
}

.hire-confirm-title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: #2F3547;
}

.hire-confirm-form {
  :deep(.el-form-item) {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(.el-form-item__label) {
    width: 84px !important;
    padding-right: 0;
    font-size: 14px;
    color: #2F3547;
    font-weight: normal;
    line-height: 32px;
    height: 32px;
  }

  :deep(.el-form-item__content) {
    margin-left: 24px !important;
    width: 324px;
  }

  :deep(.el-input__wrapper) {
    border-radius: 8px;
  }

  :deep(.el-input.is-disabled .el-input__wrapper) {
    background: #f5f6f8;
  }

  :deep(.el-input.is-disabled .el-input__inner) {
    color: #606572;
    -webkit-text-fill-color: #606572;
  }
}

.hire-confirm-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  width: 100%;
}
</style>

<style lang="scss">
.hire-confirm-el-dialog.el-dialog {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 480px !important;
  // height: 220px !important;
  max-width: 480px;
  padding: 24px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 28px rgba(47, 53, 71, 0.12);
  background-color: #f5f6f8;
  background-image: var(--hire-dialog-bg);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;

  .el-input {
  --accent: #FF9566;
}
}

.hire-confirm-el-dialog .el-dialog__header {
  position: relative;
  margin: 0;
  padding: 0;
  flex: 0 0 auto;
  border-bottom: none;
  background: transparent;
}

.hire-confirm-el-dialog .el-dialog__headerbtn {
  top: 0;
  right: 0;
  width: 32px;
  height: 32px;
}

.hire-confirm-el-dialog .el-dialog__headerbtn .el-dialog__close {
  color: #91949e;
  font-size: 18px;

  &:hover { color: #606572; }
}

.hire-confirm-el-dialog .el-dialog__body {
  margin: 0;
  padding: 24px 0 24px;
  flex: 1 1 auto;
  overflow: hidden;
  background: transparent;
}

.hire-confirm-el-dialog .el-dialog__footer {
  margin: 0;
  padding: 0px 0 0;
  flex: 0 0 auto;
  background: transparent;
}
</style>
