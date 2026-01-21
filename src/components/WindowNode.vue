<script setup lang="ts">
/**
 * 自定义节点：WindowNode
 * - 展示节点标题、描述、错误态、图片、深挖内容、followUp 输入
 * - 将用户交互（深挖/配图/继续扩展）转发给 useThinkFlow 的动作函数
 * - 使用 activePath 对非路径节点做弱化处理，突出当前上下文
 */

// 组件状态
import { ref } from 'vue'

// VueFlow：连接点
import { Handle, Position } from '@vue-flow/core'

// 图标：节点 UI
import {
    ArrowRight,
    BookOpen,
    ChevronDown,
    ChevronRight,
    Image as ImageIcon,
    Maximize2,
    RefreshCw,
    Shield,
    Terminal,
    X
} from 'lucide-vue-next'

// Markdown 渲染
import MarkdownIt from 'markdown-it'

/**
 * props：
 * - id/data/selected：VueFlow 提供的节点数据
 * - t/config：全局翻译与样式配置
 * - activeNodeId/activePath：用于路径高亮与节点弱化
 * - flowNodes/updateNode/deepDive/generateNodeImage/expandIdea：由 App/useThinkFlow 传入的能力
 */
const props = defineProps<{
    id: string
    data: any
    selected: boolean
    t: any
    config: any
    fitView: (options?: any) => void
    activeNodeId: string | null
    activePath: { nodeIds: Set<string>; edgeIds: Set<string> }
    flowNodes: any[]
    updateNode: (id: string, payload: any) => void
    deepDive: (id: string, topic: string) => void
    generateNodeImage: (id: string, prompt: string) => void
    expandIdea: (param?: any, customInput?: string) => void
    toggleSubtreeCollapse: (id: string) => void
    isSubtreeCollapsed: (id: string) => boolean
}>()

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
})

/**
 * preview：请求 App 打开图片预览弹窗
 */
const emit = defineEmits<{
    (e: 'preview', url: string): void
}>()

/**
 * followUp 输入框是否聚焦（用于边框高亮）
 */
const isFocused = ref(false)

/**
 * 从 flowNodes 中找到节点当前位置，用于扩展时定位新节点生成的参考坐标
 */
const getNodePosition = (id: string) => props.flowNodes.find(n => n.id === id)?.position

/**
 * 输入框聚焦处理：放大节点并居中视图
 */
const handleFocus = () => {
    isFocused.value = true
    // 聚焦时将视图中心对准该节点，并给予适当的 padding 确保放大后完整可见
    props.fitView({ nodes: [props.id], padding: 1.5, duration: 600 })
}

/**
 * 输入框失去焦点处理
 */
const handleBlur = () => {
    isFocused.value = false
}
</script>

<template>
    <div
        class="window-node group transition-all duration-500"
        :class="{
            'opacity-40 grayscale-[0.4] blur-[0.5px] scale-[0.98] pointer-events-none': props.activeNodeId && !props.activePath.nodeIds.has(props.id),
            'opacity-100 grayscale-0 blur-0 scale-105 z-50 ring-2 ring-offset-4': props.activePath.nodeIds.has(props.id) && !isFocused,
            'opacity-100 grayscale-0 blur-0 scale-110 z-[100] shadow-2xl ring-4 ring-offset-8': isFocused,
            '!w-[450px]': props.data.isDetailExpanded
        }"
        :style="{
            borderColor: isFocused || props.activePath.nodeIds.has(props.id) ? props.config.edgeColor : props.config.edgeColor + '40',
            boxShadow: isFocused ? `0 25px 50px -12px ${props.config.edgeColor}60` : (props.activeNodeId === props.id ? `0 20px 50px -12px ${props.config.edgeColor}40` : ''),
            '--tw-ring-color': isFocused || props.selected ? props.config.edgeColor + '40' : 'transparent'
        }"
    >
        <Handle type="target" :position="Position.Left" class="!bg-transparent !border-none" />
        <Handle type="source" :position="Position.Right" class="!bg-transparent !border-none" />

        <div class="window-header" :style="{ backgroundColor: props.activePath.nodeIds.has(props.id) ? props.config.edgeColor + '15' : props.config.edgeColor + '05' }">
            <div class="flex gap-1.5">
                <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: props.activePath.nodeIds.has(props.id) ? props.config.edgeColor : props.config.edgeColor + '40' }"></div>
                <div class="w-2 h-2 rounded-full bg-slate-200"></div>
                <div class="w-2 h-2 rounded-full bg-slate-200"></div>
            </div>
            <span class="window-title" :style="{ color: props.activePath.nodeIds.has(props.id) ? props.config.edgeColor : '' }">
                {{ props.data.type === 'root' ? props.t('node.mainTitle') : props.t('node.moduleTitle') }}
            </span>
            <button
                v-if="props.data.childrenCount > 0"
                type="button"
                class="flex items-center gap-1 px-1.5 py-1 rounded-md text-[9px] font-black tracking-widest uppercase transition-colors"
                :class="props.isSubtreeCollapsed(props.id) ? 'text-orange-600 bg-orange-50' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'"
                @click.stop="props.toggleSubtreeCollapse(props.id)"
            >
                <component :is="props.isSubtreeCollapsed(props.id) ? ChevronRight : ChevronDown" class="w-3 h-3" />
                <span v-if="props.isSubtreeCollapsed(props.id) && props.data.hiddenDescendantCount" class="text-[9px] font-black">{{ props.data.hiddenDescendantCount }}</span>
            </button>
        </div>

        <div v-if="props.data.isExpanding" class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-2xl transition-all duration-300">
            <div class="relative">
                <RefreshCw class="w-8 h-8 text-slate-900 animate-spin mb-3" :style="{ color: props.config.edgeColor }" />
                <div class="absolute inset-0 blur-xl opacity-20 animate-pulse" :style="{ backgroundColor: props.config.edgeColor }"></div>
            </div>
            <span class="text-[10px] font-black tracking-widest uppercase text-slate-500">{{ props.t('common.expanding') }}</span>
        </div>

        <div class="window-content">
            <div
                v-if="props.data.imageUrl || props.data.isImageLoading"
                class="mb-4 rounded-lg overflow-hidden bg-slate-50 border border-slate-100 aspect-video flex items-center justify-center relative group/img cursor-pointer"
                @click.stop="props.data.imageUrl ? emit('preview', props.data.imageUrl) : null"
            >
                <img v-if="props.data.imageUrl" :src="props.data.imageUrl" class="w-full h-full object-cover" />
                <div v-if="props.data.isImageLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm cursor-default">
                    <RefreshCw class="w-6 h-6 text-orange-500 animate-spin mb-2" />
                    <span class="text-[8px] font-bold text-slate-400 uppercase">{{ props.t('common.generating') }}</span>
                </div>
                <div v-if="props.data.imageUrl" class="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button class="p-2 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-md transition-all" :title="props.t('node.view')">
                        <Maximize2 class="w-4 h-4 text-white" />
                    </button>
                    <button
                        @click.stop="props.generateNodeImage(props.id, props.data.label)"
                        class="p-2 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-md transition-all"
                        :title="props.t('node.regenerate')"
                    >
                        <RefreshCw class="w-4 h-4 text-white" />
                    </button>
                </div>
            </div>

            <div class="flex items-start gap-2 mb-2">
                <span class="font-bold shrink-0 mt-0.5" :style="{ color: props.config.edgeColor }">></span>
                <h3
                    class="font-black text-slate-900 tracking-tight cursor-pointer hover:text-orange-600 transition-colors"
                    :class="props.data.isTitleExpanded ? 'whitespace-normal' : 'truncate'"
                    @click.stop="props.updateNode(props.id, { data: { ...props.data, isTitleExpanded: !props.data.isTitleExpanded } })"
                >
                    {{ props.data.label }}
                </h3>
            </div>

            <p class="text-[10px] text-slate-500 leading-relaxed font-medium line-clamp-3">
                {{ props.data.description }}
            </p>

            <div v-if="props.data.error" class="mt-3 p-2.5 bg-red-50 border border-red-100 rounded-lg animate-in fade-in slide-in-from-top-1 duration-300">
                <div class="flex items-start gap-2">
                    <Shield class="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <div class="flex-grow space-y-1">
                        <p class="text-[10px] font-black text-red-600 leading-tight">{{ props.t('common.error.title') }}</p>
                        <p class="text-[9px] text-red-500 leading-relaxed">{{ props.data.error }}</p>
                    </div>
                    <button
                        @click.stop="props.data.imageUrl === null && props.data.isImageLoading === false ? props.generateNodeImage(props.id, props.data.label) : props.expandIdea({ id: props.id, data: props.data, position: getNodePosition(props.id) })"
                        class="p-1 hover:bg-red-100 rounded transition-colors"
                        :title="props.t('common.error.retry')"
                    >
                        <RefreshCw class="w-3 h-3 text-red-600" />
                    </button>
                </div>
            </div>

            <div class="pt-3 mt-3 border-t border-slate-50">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-1.5 shrink-0">
                        <div class="w-1.5 h-1.5 rounded-full animate-pulse" :style="{ backgroundColor: props.data.isExpanding ? props.config.edgeColor : '#34d399' }"></div>
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{{
                            props.data.isExpanding ? props.t('common.expanding') : props.t('common.active')
                        }}</span>
                    </div>

                    <div class="flex items-center gap-2">
                        <button
                            @click.stop="props.deepDive(props.id, props.data.label)"
                            class="action-btn text-orange-500 hover:bg-orange-50"
                            :title="props.t('node.deepDive')"
                        >
                            <BookOpen class="w-2.5 h-2.5" />
                            <span>{{ props.t('node.deepDive') }}</span>
                        </button>
                        <button
                            v-if="!props.data.imageUrl && !props.data.isImageLoading"
                            @click.stop="props.generateNodeImage(props.id, props.data.label)"
                            class="action-btn text-blue-500 hover:bg-blue-50"
                        >
                            <ImageIcon class="w-2.5 h-2.5" />
                            <span>{{ props.t('node.imgAction') }}</span>
                        </button>
                    </div>
                </div>

                <div v-if="props.data.isDetailExpanded" class="mb-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">{{ props.t('node.deepDive') }}</span>
                        <button @click.stop="props.updateNode(props.id, { data: { ...props.data, isDetailExpanded: false } })" class="text-slate-300 hover:text-slate-500">
                            <X class="w-3 h-3" />
                        </button>
                    </div>
                    <div v-if="props.data.isDeepDiving" class="flex flex-col items-center py-6">
                        <div class="relative mb-3">
                            <RefreshCw class="w-6 h-6 text-orange-400 animate-spin" />
                            <div class="absolute inset-0 blur-lg bg-orange-200 opacity-50 animate-pulse"></div>
                        </div>
                        <span class="text-[9px] font-black text-slate-300 uppercase tracking-widest animate-pulse">{{ props.t('common.loading') }}</span>
                    </div>
                    <div
                        v-else
                        class="markdown-body text-[11px] text-slate-600 leading-relaxed font-medium max-h-[350px] overflow-y-auto custom-scrollbar pr-2 selection:bg-orange-100 nowheel"
                        v-html="md.render(props.data.detailedContent)"
                    ></div>
                </div>

                <div class="relative group/input">
                    <div
                        class="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-2 border border-slate-100 focus-within:bg-white transition-all"
                        :style="{ borderColor: props.data.followUp || isFocused ? props.config.edgeColor : '' }"
                    >
                        <ChevronRight v-if="!props.data.followUp" class="w-3 h-3 text-slate-400" />
                        <Terminal v-else class="w-3 h-3" :style="{ color: props.config.edgeColor }" />
                        <input
                            v-model="props.data.followUp"
                            @focus="handleFocus"
                            @blur="handleBlur"
                            @keyup.enter="props.expandIdea({ id: props.id, data: props.data, position: getNodePosition(props.id) }, props.data.followUp)"
                            :placeholder="props.t('node.followUp')"
                            class="bg-transparent border-none outline-none text-[10px] font-bold text-slate-700 flex-grow placeholder:text-slate-400"
                            :disabled="props.data.isExpanding"
                        />
                        <button
                            @click.stop="props.expandIdea({ id: props.id, data: props.data, position: getNodePosition(props.id) }, props.data.followUp)"
                            :disabled="!props.data.followUp?.trim() || props.data.isExpanding"
                            class="transition-all transform active:scale-90"
                            :style="{ color: props.data.followUp?.trim() ? props.config.edgeColor : '#94a3b8' }"
                        >
                            <RefreshCw v-if="props.data.isExpanding" class="w-3.5 h-3.5 animate-spin" />
                            <ArrowRight v-else class="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
