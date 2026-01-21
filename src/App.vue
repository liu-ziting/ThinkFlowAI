<script setup lang="ts">
/**
 * 应用入口组件
 * - 负责组合：顶部导航、画布（VueFlow）、节点渲染、底部输入条、各类弹窗
 * - 业务状态与动作全部由 useThinkFlow 提供，App.vue 仅做组装与事件转发
 */

// i18n：提供 t/locale，并把 locale 传入业务层做持久化
import { useI18n } from 'vue-i18n'

// 画布：VueFlow 与可选插件
import { VueFlow } from '@vue-flow/core'
import { Background, BackgroundVariant } from '@vue-flow/background'
import { Controls, ControlButton } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { Maximize, Minimize } from 'lucide-vue-next'

// VueFlow 内置样式（必须引入，否则组件样式缺失）
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'
import '@vue-flow/controls/dist/style.css'

// 页面 UI 子组件
import BottomBar from './components/BottomBar.vue'
import ImagePreviewModal from './components/ImagePreviewModal.vue'
import ResetConfirmModal from './components/ResetConfirmModal.vue'
import SettingsModal from './components/SettingsModal.vue'
import SummaryModal from './components/SummaryModal.vue'
import TopNav from './components/TopNav.vue'
import WindowNode from './components/WindowNode.vue'

// 业务层：统一的状态与动作入口
import { useThinkFlow } from './composables/useThinkFlow'
import { computed, ref, onMounted, onUnmounted } from 'vue'

const { t, locale } = useI18n()

/**
 * 全屏控制逻辑
 */
const isFullscreen = ref(false)

const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
            console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`)
        })
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen()
        }
    }
}

const handleFullscreenChange = () => {
    isFullscreen.value = !!document.fullscreenElement
}

onMounted(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onUnmounted(() => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
})

/**
 * 从业务层拿到全局状态与动作。
 * 说明：
 * - 展开/深挖/图片/总结等网络请求与数据写回都在 useThinkFlow 内完成
 * - App.vue 只负责把这些能力传给对应 UI 组件
 */
const {
    apiConfig,
    showSettings,
    ideaInput,
    isLoading,
    previewImageUrl,
    showResetConfirm,
    showSummaryModal,
    isSummarizing,
    summaryContent,
    panOnDrag,
    isSpacePressed,
    config,
    flowNodes,
    activeNodeId,
    activePath,
    updateNode,
    fitView,
    resetLayout,
    centerRoot,
    handleNodeDrag,
    alignmentGuides,
    viewport,
    toggleSubtreeCollapse,
    isSubtreeCollapsed,
    startNewSession,
    executeReset,
    generateSummary,
    exportMarkdown,
    generateNodeImage,
    deepDive,
    expandIdea
} = useThinkFlow({ t, locale })

const verticalGuideStyle = computed(() => {
    const x = alignmentGuides.value.x
    if (x == null) return null
    const screenX = x * viewport.value.zoom + viewport.value.x
    return { left: `${screenX}px` }
})

const horizontalGuideStyle = computed(() => {
    const y = alignmentGuides.value.y
    if (y == null) return null
    const screenY = y * viewport.value.zoom + viewport.value.y
    return { top: `${screenY}px` }
})

/**
 * 切换语言（zh <-> en）
 */
const toggleLocale = () => {
    locale.value = locale.value === 'zh' ? 'en' : 'zh'
}

/**
 * 视图适配：缩放到当前内容的合适视野
 */
const fitToView = () => {
    fitView({ padding: 0.2, duration: 800 })
}
</script>

<template>
    <div class="h-screen w-screen bg-white font-mono text-slate-800 relative overflow-hidden flex flex-col selection:bg-orange-100">
        <TopNav
            :t="t"
            :locale="locale"
            :config="config"
            :onFit="fitToView"
            :onResetLayout="resetLayout"
            :onCenterRoot="centerRoot"
            :onStartNewSession="startNewSession"
            :onGenerateSummary="generateSummary"
            :onExportMarkdown="exportMarkdown"
            :onOpenSettings="() => (showSettings = true)"
            @toggle-locale="toggleLocale"
        />

        <div class="flex-grow relative">
            <VueFlow
                :default-edge-options="{ type: config.edgeType }"
                :fit-view-on-init="true"
                class="bg-white"
                :class="{ 'space-pressed': isSpacePressed }"
                :pan-on-drag="panOnDrag"
                :selection-key-code="'Shift'"
                :snap-to-grid="config.snapToGrid"
                :snap-grid="config.snapGrid"
                @node-drag="handleNodeDrag"
            >
                <Background
                    :variant="config.backgroundVariant"
                    :pattern-color="config.backgroundVariant === BackgroundVariant.Dots ? '#cbd5e1' : '#f1f5f9'"
                    :gap="24"
                    :size="config.backgroundVariant === BackgroundVariant.Dots ? 1 : 0.5"
                />
                <Controls v-if="config.showControls" :show-fullscreen="false" :show-fit-view="false">
                    <ControlButton @click="toggleFullscreen" :title="isFullscreen ? t('nav.exitFullscreen') : t('nav.fullscreen')">
                        <component :is="isFullscreen ? Minimize : Maximize" class="w-4 h-4 text-slate-500" />
                    </ControlButton>
                </Controls>
                <MiniMap v-if="config.showMiniMap" pannable zoomable />

                <template #node-window="{ id, data, selected }">
                    <WindowNode
                        :id="id"
                        :data="data"
                        :selected="selected"
                        :t="t"
                        :config="config"
                        :fitView="fitView"
                        :activeNodeId="activeNodeId"
                        :activePath="activePath"
                        :flowNodes="flowNodes"
                        :updateNode="updateNode"
                        :deepDive="deepDive"
                        :generateNodeImage="generateNodeImage"
                        :expandIdea="expandIdea"
                        :toggleSubtreeCollapse="toggleSubtreeCollapse"
                        :isSubtreeCollapsed="isSubtreeCollapsed"
                        @preview="previewImageUrl = $event"
                    />
                </template>
            </VueFlow>

            <div class="absolute inset-0 pointer-events-none z-20">
                <div v-if="config.showAlignmentGuides && verticalGuideStyle" class="absolute top-0 bottom-0 w-px bg-orange-300/70" :style="verticalGuideStyle"></div>
                <div v-if="config.showAlignmentGuides && horizontalGuideStyle" class="absolute left-0 right-0 h-px bg-orange-300/70" :style="horizontalGuideStyle"></div>
            </div>

            <SettingsModal :show="showSettings" :t="t" :apiConfig="apiConfig" @close="showSettings = false" />
            <ImagePreviewModal :url="previewImageUrl" @close="previewImageUrl = null" />
            <ResetConfirmModal :show="showResetConfirm" :t="t" @close="showResetConfirm = false" @confirm="executeReset" />
            <SummaryModal :show="showSummaryModal" :t="t" :isSummarizing="isSummarizing" :summaryContent="summaryContent" @close="showSummaryModal = false" />
        </div>

        <BottomBar :t="t" :isLoading="isLoading" v-model="ideaInput" @expand="expandIdea" />
    </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');

body {
    margin: 0;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
}

.font-mono {
    font-family: 'JetBrains Mono', monospace;
}

.toolbar-btn {
    @apply flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black tracking-widest transition-all active:scale-95 uppercase;
}

.toolbar-btn:hover {
    @apply border-current shadow-sm;
}

.toolbar-select {
    @apply px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black tracking-widest text-slate-500 outline-none cursor-pointer hover:border-slate-200 transition-all uppercase;
}

.nav-btn {
    @apply flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-600 hover:border-slate-300 hover:shadow-sm transition-all;
}

/* VueFlow Custom Node Styles */
.window-node {
    @apply w-[280px] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden transition-all duration-300;
}

.window-node:hover {
    @apply shadow-2xl shadow-orange-100 -translate-y-1 border-orange-200;
}

.window-header {
    @apply bg-slate-50/80 px-3 py-1.5 border-b border-slate-100 flex items-center justify-between;
}

.window-title {
    @apply text-[9px] font-bold text-slate-300 tracking-widest uppercase;
}

.window-content {
    @apply p-4;
}

.action-btn {
    @apply flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold transition-all active:scale-95 uppercase tracking-tighter whitespace-nowrap border border-transparent;
}

.action-btn:hover {
    @apply border-current bg-opacity-10;
}

.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    @apply bg-transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    @apply bg-slate-200 rounded-full hover:bg-slate-300 transition-colors;
}

/* VueFlow Overrides */
.vue-flow__node-window {
    @apply p-0 border-none bg-transparent !important;
}

.vue-flow__node.selected {
    z-index: 1000 !important;
}

.vue-flow__controls {
    @apply !bg-white !border-slate-200 !shadow-xl !rounded-lg !left-4 md:!left-6 !bottom-28 md:!bottom-6 !transition-all;
}

@media (max-width: 767px) {
    .vue-flow__controls {
        margin-left: 0 !important;
        left: 1rem !important;
    }
}

.vue-flow__controls-button {
    @apply !border-slate-100 !fill-slate-400 hover:!bg-slate-50 !transition-colors;
}

.vue-flow__minimap {
    @apply !bg-white/80 !backdrop-blur-md !border-slate-200 !shadow-2xl !rounded-xl !overflow-hidden !transition-all;
    bottom: 130px !important;
    right: 1rem !important;
    width: 140px !important;
    height: 100px !important;
    margin: 0 !important;
}

.vue-flow__minimap svg {
    display: block !important;
    width: 100% !important;
    height: 100% !important;
}

@media (min-width: 768px) {
    .vue-flow__minimap {
        bottom: 1.5rem !important;
        right: 1.5rem !important;
        width: 220px !important;
        height: 160px !important;
        margin: 0 !important;
    }
}

.vue-flow__minimap-mask {
    @apply !fill-slate-500/5;
}

.vue-flow__minimap-node {
    @apply !fill-slate-200 !stroke-none;
}

/* Custom Controls for Space Dragging */
.vue-flow__pane {
    cursor: default;
}

.vue-flow__pane.space-pressed {
    cursor: grab;
}

.vue-flow__pane.space-pressed:active {
    cursor: grabbing;
}

.vue-flow__background {
    @apply !bg-white;
}

/* Animation */
@keyframes spin-slow {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

input::placeholder {
    @apply opacity-30;
}

input:focus::placeholder {
    @apply opacity-10;
}

.line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.no-scrollbar::-webkit-scrollbar {
    display: none;
}

.no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
</style>
