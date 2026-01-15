import { defineStore } from 'pinia'
import { ref, watch, nextTick } from 'vue'
import type { Activity, WhisperMode } from '@shared/types'

// Re-export for consumers that import from this module
export type { WhisperMode }

export type ChatMessage = {
  id: number
  type: 'user' | 'assistant' | 'error'
  content: string
  language?: string
  mode?: WhisperMode
  activity?: Activity
  filePath?: string
  timestamp: Date
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const nextId = ref(1)
  const chatContainer = ref<HTMLElement | null>(null)

  // Auto-scroll chat to bottom when new messages arrive
  function scrollToBottom(): void {
    nextTick(() => {
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight
      }
    })
  }

  // Watch for messages changes to auto-scroll
  watch(messages, scrollToBottom, { deep: true })

  function addMessage(
    type: ChatMessage['type'],
    content: string,
    extras?: Partial<Omit<ChatMessage, 'id' | 'type' | 'content' | 'timestamp'>>
  ): ChatMessage {
    const message: ChatMessage = {
      id: nextId.value++,
      type,
      content,
      timestamp: new Date(),
      ...extras
    }
    messages.value.push(message)
    return message
  }

  function addUserMessage(content: string, language?: string, mode?: WhisperMode): ChatMessage {
    return addMessage('user', content, { language, mode })
  }

  function addAssistantMessage(content: string, activity?: Activity, filePath?: string): ChatMessage {
    return addMessage('assistant', content, { activity, filePath })
  }

  function addErrorMessage(content: string): ChatMessage {
    return addMessage('error', content)
  }

  function clearMessages(): void {
    messages.value = []
  }

  function setChatContainer(el: HTMLElement | null): void {
    chatContainer.value = el
  }

  return {
    messages,
    chatContainer,
    addMessage,
    addUserMessage,
    addAssistantMessage,
    addErrorMessage,
    clearMessages,
    setChatContainer,
    scrollToBottom
  }
})

// Language label helper
export function getLanguageLabel(lang?: string): string {
  const labels: Record<string, string> = {
    german: 'Deutsch',
    polish: 'Polnisch',
    english: 'Englisch',
    de: 'Deutsch',
    pl: 'Polnisch',
    en: 'Englisch'
  }
  return lang ? labels[lang.toLowerCase()] || lang : 'Unbekannt'
}
