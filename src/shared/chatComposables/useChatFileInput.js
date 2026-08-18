/**
 * useChatFileInput
 * 封装 ChatFileUploadArea 的拖拽消费者注册。
 * 接收父组件持有的 uploadAreaRef（指向 ChatFileUploadArea 实例），
 * 在内部调用 useChatFileDropConsumer，使两个 ChatInput 组件不再各自重复调用。
 *
 * @param {import('vue').Ref} uploadAreaRef - ref(null)，指向 ChatFileUploadArea
 */
import { useChatFileDropConsumer } from '@/shared/chatComposables/useChatFileDrop'

export function useChatFileInput(uploadAreaRef) {
  useChatFileDropConsumer(uploadAreaRef)
}
