<script setup lang="ts">
/**
 * 底部输入条
 * - 接收 v-model（modelValue）作为输入内容
 * - 触发 expand 事件，由 App/useThinkFlow 执行“生成/扩展”
 */

// 图标：输入提示与执行态
import { Github, RefreshCw, Terminal, Zap, Sparkles, Brain } from 'lucide-vue-next'

/**
 * props：
 * - t：i18n 翻译函数
 * - modelValue：输入框内容（由 v-model 驱动）
 * - isLoading：是否正在生成（用于禁用按钮并显示 loading 图标）
 * - aiStyle: AI 思考风格
 * - onToggleAiStyle: 切换 AI 思考风格的回调
 */
const props = defineProps<{
    t: any
    modelValue: string
    isLoading: boolean
    aiStyle: string
    onToggleAiStyle: () => void
}>()

/**
 * 事件：
 * - update:modelValue：更新输入框内容
 * - expand：触发一次生成/扩展
 */
const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
    (e: 'expand'): void
}>()
</script>

<template>
    <div class="fixed bottom-4 md:bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 w-full max-w-2xl px-4 md:px-6">
        <!-- 思考风格切换 -->
        <div class="flex items-center gap-1.5 self-start ml-2 md:ml-4 mb-1">
            <button
                @click="props.onToggleAiStyle"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold tracking-widest uppercase transition-all shadow-sm"
                :class="
                    props.aiStyle === 'creative' ? 'bg-amber-50 border-amber-200 text-amber-600 shadow-amber-100/50' : 'bg-cyan-50 border-cyan-200 text-cyan-700 shadow-cyan-100/50'
                "
            >
                <component :is="props.aiStyle === 'creative' ? Sparkles : Brain" class="w-3 h-3" />
                <span>{{ props.aiStyle === 'creative' ? props.t('nav.styleCreative') : props.t('nav.stylePrecise') }}</span>
            </button>
        </div>

        <div class="flex items-center gap-2 md:gap-3 w-full">
            <div
                class="flex-grow flex items-center gap-2 md:gap-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl px-3 md:px-5 py-2 md:py-3 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-slate-100 transition-all"
            >
                <Terminal class="w-4 h-4 md:w-5 h-5 text-slate-400 flex-shrink-0" />
                <input
                    :value="props.modelValue"
                    :placeholder="props.t('nav.placeholder')"
                    class="flex-grow bg-transparent border-none outline-none text-xs md:text-sm font-bold text-slate-700 placeholder:text-slate-400 min-w-0"
                    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
                    @keyup.enter="emit('expand')"
                />
                <button
                    @click="emit('expand')"
                    :disabled="props.isLoading || !props.modelValue.trim()"
                    class="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg md:rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group/btn flex-shrink-0"
                >
                    <span class="text-[9px] md:text-[10px] font-black tracking-widest uppercase">{{ props.t('nav.execute') }}</span>
                    <Zap v-if="!props.isLoading" class="w-3.5 h-3.5 md:w-4 h-4 text-orange-400 group-hover/btn:scale-110 transition-transform" />
                    <RefreshCw v-else class="w-3.5 h-3.5 md:w-4 h-4 animate-spin" />
                </button>
            </div>
        </div>

        <div
            class="flex items-center gap-2 px-3 py-1 bg-white/60 backdrop-blur-sm border border-slate-200/50 rounded-full text-[10px] font-black tracking-widest select-none shadow-sm"
        >
            <a
                href="https://github.com/liu-ziting/ThinkFlowAI"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-1.5 text-slate-500 hover:text-orange-500 transition-colors"
            >
                <Github class="w-3 h-3" />
                <span>ThinkFlowAI</span>
            </a>
            <!-- <span class="w-[1px] h-2 bg-slate-300 mx-1"></span> -->
            <!-- <span class="text-slate-400">By:Liuziting</span> -->
        </div>
    </div>
</template>
