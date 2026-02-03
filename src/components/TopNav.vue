<script setup lang="ts">
/**
 * 顶部导航栏
 * - 桌面端：展示完整工具条（视图控制/布局/配色/导出/设置等）
 * - 移动端：收纳为下拉面板，通过 callAndClose 统一“执行 + 收起”
 */

// 基础依赖
import { computed, onMounted, onUnmounted, ref } from 'vue'

// 背景样式枚举（用于切换 Lines/Dots）
import { BackgroundVariant } from '@vue-flow/background'

// 图标：所有按钮与状态展示
import {
    ChevronDown,
    ChevronUp,
    Download,
    Focus,
    LayoutDashboard,
    Menu,
    Sparkles,
    Target,
    X,
    Trash2,
    Globe,
    Settings,
    GitGraph,
    Map,
    Palette,
    Play,
    Search,
    Zap,
    Brain,
    Waypoints,
    MessagesSquare
} from 'lucide-vue-next'

/**
 * props：
 * - t：i18n 翻译函数
 * - locale：当前语言标识（用于显示 EN/ZH）
 * - config：全局画布配置（边颜色/背景/小地图开关等）
 * - onXxx：由 App 传入的动作回调
 */
const props = defineProps<{
    t: any
    locale: string
    config: any
    onFit: () => void
    onResetLayout: () => void
    onCenterRoot: () => void
    onStartNewSession: () => void
    onGenerateSummary: () => void
    onExportMarkdown: () => void
    onOpenSettings: () => void
    isPresenting: boolean
    onTogglePresentation: () => void
    searchQuery: string
    onUpdateSearchQuery: (val: string) => void
    searchResults: any[]
    onFocusNode: (id: string) => void
    onToggleChat: () => void
}>()

const emit = defineEmits<{
    (e: 'toggle-locale'): void
}>()

/**
 * 移动端工具面板是否展开
 */
const isToolsExpanded = ref(false)

const isEdgeTypeMenuOpen = ref(false)
const isBackgroundMenuOpen = ref(false)

const edgeTypeOptions = [
    { value: 'default', labelKey: 'nav.edgeTypes.default' },
    { value: 'straight', labelKey: 'nav.edgeTypes.straight' },
    { value: 'step', labelKey: 'nav.edgeTypes.step' },
    { value: 'smoothstep', labelKey: 'nav.edgeTypes.smoothstep' }
]

const backgroundOptions = [
    { value: BackgroundVariant.Lines, labelKey: 'nav.lines' },
    { value: BackgroundVariant.Dots, labelKey: 'nav.dots' }
]

const currentEdgeTypeLabel = computed(() => {
    const option = edgeTypeOptions.find(o => o.value === props.config.edgeType)
    return option ? props.t(option.labelKey) : props.config.edgeType
})

const currentBackgroundLabel = computed(() => {
    const option = backgroundOptions.find(o => o.value === props.config.backgroundVariant)
    return option ? props.t(option.labelKey) : String(props.config.backgroundVariant)
})

const closeMenus = () => {
    isEdgeTypeMenuOpen.value = false
    isBackgroundMenuOpen.value = false
}

const toggleEdgeTypeMenu = () => {
    isEdgeTypeMenuOpen.value = !isEdgeTypeMenuOpen.value
    if (isEdgeTypeMenuOpen.value) isBackgroundMenuOpen.value = false
}

const toggleBackgroundMenu = () => {
    isBackgroundMenuOpen.value = !isBackgroundMenuOpen.value
    if (isBackgroundMenuOpen.value) isEdgeTypeMenuOpen.value = false
}

const setEdgeType = (value: string) => {
    props.config.edgeType = value
    closeMenus()
}

const setBackgroundVariant = (value: any) => {
    props.config.backgroundVariant = value
    closeMenus()
}

const handleDocumentPointerDown = (e: Event) => {
    const target = e.target as HTMLElement | null
    if (!target) return

    if (target.closest('[data-edge-type-menu="true"]')) return
    if (target.closest('[data-background-menu="true"]')) return
    closeMenus()
}

onMounted(() => {
    document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onUnmounted(() => {
    document.removeEventListener('pointerdown', handleDocumentPointerDown)
})

/**
 * 执行某个工具动作后自动收起移动端面板
 */
const callAndClose = (fn: () => void) => {
    fn()
    isToolsExpanded.value = false
}
</script>

<template>
    <nav class="flex-none bg-white/80 backdrop-blur-md border-b border-slate-200 px-3 md:px-6 py-2 md:py-3 flex items-center justify-between shadow-sm z-50">
        <div class="flex items-center gap-2 md:gap-6 flex-grow mr-2">
            <div class="flex items-center gap-2 flex-shrink-0">
                <div class="w-3 h-3 bg-orange-500 rounded-sm rotate-45"></div>
                <span class="logo font-black text-slate-900 tracking-tighter text-base md:text-lg">ThinkFlowAI</span>
            </div>

            <div class="h-6 w-[1px] bg-slate-200 mx-1 md:mx-2 flex-shrink-0"></div>

            <!-- 搜索框 -->
            <div class="hidden lg:flex items-center relative flex-grow max-w-xs group">
                <Search class="absolute left-3 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                    type="text"
                    :value="props.searchQuery"
                    @input="e => props.onUpdateSearchQuery((e.target as HTMLInputElement).value)"
                    :placeholder="props.t('nav.searchPlaceholder')"
                    class="w-full bg-slate-50 border border-slate-200 rounded-full py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                <!-- 搜索结果下拉 -->
                <div
                    v-if="props.searchQuery && props.searchResults.length > 0"
                    class="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 z-[60] max-h-60 overflow-y-auto"
                >
                    <button
                        v-for="node in props.searchResults"
                        :key="node.id"
                        @click="
                            () => {
                                props.onFocusNode(node.id)
                                props.onUpdateSearchQuery('')
                            }
                        "
                        class="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors group"
                    >
                        <div class="font-bold text-slate-700 text-xs truncate group-hover:text-blue-600">{{ node.data.label }}</div>
                        <div class="text-[10px] text-slate-400 truncate">{{ node.data.description }}</div>
                    </button>
                </div>
            </div>

            <div class="h-6 w-[1px] bg-slate-200 mx-1 md:mx-2 flex-shrink-0 hidden lg:block"></div>

            <div class="hidden md:flex items-center gap-2">
                <button
                    @click="props.onTogglePresentation"
                    class="toolbar-btn flex-shrink-0"
                    :class="props.isPresenting ? 'text-green-600 bg-green-50 border-green-100' : 'text-slate-500 hover:bg-slate-50 border-slate-100'"
                >
                    <Play class="w-3.5 h-3.5 md:w-4 h-4" />
                    <span>{{ props.t('nav.presentation') }}</span>
                </button>

                <div class="h-4 w-[1px] bg-slate-100 mx-1 flex-shrink-0"></div>

                <button @click="props.onGenerateSummary" class="toolbar-btn text-orange-600 hover:bg-orange-50 border-orange-100 flex-shrink-0">
                    <Sparkles class="w-3.5 h-3.5 md:w-4 h-4" />
                    <span>{{ props.t('nav.summary') }}</span>
                </button>

                <button @click="props.onExportMarkdown" class="toolbar-btn text-indigo-600 hover:bg-indigo-50 border-indigo-100 flex-shrink-0">
                    <Download class="w-3.5 h-3.5 md:w-4 h-4" />
                    <span>{{ props.t('nav.export') }}</span>
                </button>

                <div class="h-4 w-[1px] bg-slate-100 mx-1 flex-shrink-0"></div>

                <button @click="props.onStartNewSession" class="toolbar-btn text-red-500 hover:bg-red-50 border-red-100 flex-shrink-0">
                    <Trash2 class="w-3.5 h-3.5 md:w-4 h-4" />
                    <span>{{ props.t('nav.reset') }}</span>
                </button>
            </div>

            <div class="md:hidden flex items-center">
                <button
                    @click="isToolsExpanded = !isToolsExpanded"
                    class="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 active:bg-slate-100 transition-colors"
                >
                    <Menu v-if="!isToolsExpanded" class="w-4 h-4" />
                    <X v-else class="w-4 h-4" />
                    <span class="text-xs font-bold">{{ props.t('common.tools') || 'Tools' }}</span>
                    <ChevronDown v-if="!isToolsExpanded" class="w-3 h-3 opacity-50" />
                    <ChevronUp v-else class="w-3 h-3 opacity-50" />
                </button>
            </div>
        </div>

        <div class="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <button v-if="false" @click="props.onToggleChat" class="hidden md:flex p-1.5 md:p-2 hover:bg-orange-50 rounded-md transition-colors text-orange-500 items-center gap-1">
                <MessagesSquare class="w-3.5 h-3.5 md:w-4 h-4" />
                <span class="hidden md:inline text-[10px] md:text-xs font-bold">{{ props.t('chat.title') }}</span>
            </button>

            <button @click="props.onOpenSettings" class="p-1.5 md:p-2 hover:bg-slate-100 rounded-md transition-colors text-slate-400 flex items-center gap-1">
                <Settings class="w-3.5 h-3.5 md:w-4 h-4" />
                <span class="hidden md:inline text-[10px] md:text-xs font-bold">{{ props.t('common.settings') }}</span>
            </button>

            <div class="h-4 w-[1px] bg-slate-200 mx-1"></div>

            <button
                @click="emit('toggle-locale')"
                class="p-1.5 md:p-2 hover:bg-slate-100 rounded-md transition-colors text-slate-400 font-bold text-[10px] md:text-xs flex items-center gap-1"
            >
                <Globe class="w-3.5 h-3.5 md:w-4 h-4" /> {{ props.locale === 'zh' ? 'EN' : 'ZH' }}
            </button>
        </div>
    </nav>

    <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform -translate-y-4 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform -translate-y-4 opacity-0"
    >
        <div
            v-if="isToolsExpanded"
            class="md:hidden absolute top-[57px] left-0 right-0 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xl z-40 py-4 px-4 flex flex-wrap gap-3 justify-center"
        >
            <button @click="callAndClose(props.onFit)" class="toolbar-btn text-blue-500 hover:bg-blue-50 border-blue-100">
                <Focus class="w-4 h-4" />
                <span>{{ props.t('nav.fit') }}</span>
            </button>

            <button @click="callAndClose(props.onResetLayout)" class="toolbar-btn text-purple-500 hover:bg-purple-50 border-purple-100">
                <LayoutDashboard class="w-4 h-4" />
                <span>{{ props.t('nav.layout') }}</span>
            </button>

            <button @click="callAndClose(props.onCenterRoot)" class="toolbar-btn text-orange-500 hover:bg-orange-50 border-orange-100">
                <Target class="w-4 h-4" />
                <span>{{ props.t('nav.center') }}</span>
            </button>

            <button @click="callAndClose(props.onStartNewSession)" class="toolbar-btn text-red-500 hover:bg-red-50 border-red-100">
                <Trash2 class="w-4 h-4" />
                <span>{{ props.t('nav.reset') }}</span>
            </button>

            <div class="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                <Palette class="w-4 h-4 text-slate-400" />
                <input type="color" v-model="props.config.edgeColor" class="w-4 h-4 rounded cursor-pointer bg-transparent border-none" />
                <span class="text-[10px] font-bold text-slate-500 uppercase">{{ props.t('nav.edge') }}</span>
            </div>

            <div data-edge-type-menu="true" class="relative">
                <button type="button" class="toolbar-select flex items-center gap-2" @click="toggleEdgeTypeMenu">
                    <span>{{ currentEdgeTypeLabel }}</span>
                    <ChevronDown class="w-3 h-3 opacity-60" />
                </button>
                <div v-if="isEdgeTypeMenuOpen" class="absolute top-full left-0 mt-2 min-w-[180px] bg-white border border-slate-200 rounded-lg shadow-xl p-1 z-50">
                    <button
                        v-for="opt in edgeTypeOptions"
                        :key="opt.value"
                        type="button"
                        class="w-full text-left px-3 py-2 rounded-md text-[10px] font-black tracking-widest uppercase transition-colors"
                        :class="opt.value === props.config.edgeType ? 'bg-orange-50 text-orange-600' : 'text-slate-600 hover:bg-slate-50'"
                        @click="callAndClose(() => setEdgeType(opt.value))"
                    >
                        {{ props.t(opt.labelKey) }}
                    </button>
                </div>
            </div>

            <div data-background-menu="true" class="relative">
                <button type="button" class="toolbar-select flex items-center gap-2" @click="toggleBackgroundMenu">
                    <span>{{ currentBackgroundLabel }}</span>
                    <ChevronDown class="w-3 h-3 opacity-60" />
                </button>
                <div v-if="isBackgroundMenuOpen" class="absolute top-full left-0 mt-2 min-w-[140px] bg-white border border-slate-200 rounded-lg shadow-xl p-1 z-50">
                    <button
                        v-for="opt in backgroundOptions"
                        :key="String(opt.value)"
                        type="button"
                        class="w-full text-left px-3 py-2 rounded-md text-[10px] font-black tracking-widest uppercase transition-colors"
                        :class="opt.value === props.config.backgroundVariant ? 'bg-orange-50 text-orange-600' : 'text-slate-600 hover:bg-slate-50'"
                        @click="callAndClose(() => setBackgroundVariant(opt.value))"
                    >
                        {{ props.t(opt.labelKey) }}
                    </button>
                </div>
            </div>

            <button
                @click="props.config.hierarchicalDragging = !props.config.hierarchicalDragging"
                class="toolbar-btn"
                :class="props.config.hierarchicalDragging ? 'text-orange-500 bg-orange-50 border-orange-100' : 'text-slate-400 hover:text-slate-600'"
            >
                <GitGraph class="w-4 h-4" />
                <span>{{ props.t('nav.hierarchicalDragging') }}</span>
            </button>

            <button @click="callAndClose(props.onGenerateSummary)" class="toolbar-btn text-orange-600 hover:bg-orange-50 border-orange-100">
                <Sparkles class="w-4 h-4" />
                <span>{{ props.t('nav.summary') }}</span>
            </button>

            <button @click="callAndClose(props.onExportMarkdown)" class="toolbar-btn text-indigo-600 hover:bg-indigo-50 border-indigo-100">
                <Download class="w-4 h-4" />
                <span>{{ props.t('nav.export') }}</span>
            </button>
        </div>
    </Transition>
</template>
