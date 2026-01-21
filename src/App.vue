<script setup lang="ts">
import { ref, reactive, h, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
const { t, locale } = useI18n()
import {
    Sparkles,
    Search,
    Folder,
    Monitor,
    BookOpen,
    Code,
    Sun,
    Globe,
    LogIn,
    Plus,
    MousePointer2,
    Zap,
    ArrowRight,
    RefreshCw,
    Image as ImageIcon,
    Download,
    Settings,
    Palette,
    Grid3X3,
    Trash2,
    X,
    Maximize2,
    Terminal,
    ChevronRight,
    LayoutDashboard,
    Focus,
    Target,
    Map,
    Link as LinkIcon,
    Shield,
    Key,
    Activity
} from 'lucide-vue-next'
import { VueFlow, useVueFlow, Position, MarkerType, Handle } from '@vue-flow/core'
import { Background, BackgroundVariant } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { toPng } from 'html-to-image'

// 导入 VueFlow 样式
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'
import '@vue-flow/controls/dist/style.css'

// API 配置
const API_KEY = ''

// API 详情配置
const apiConfig = reactive({
    mode: localStorage.getItem('api_mode') || 'default', // 'default' | 'custom'
    chat: {
        baseUrl: localStorage.getItem('chat_baseUrl') || '',
        model: localStorage.getItem('chat_model') || '',
        apiKey: localStorage.getItem('chat_apiKey') || ''
    },
    image: {
        baseUrl: localStorage.getItem('image_baseUrl') || '',
        model: localStorage.getItem('image_model') || '',
        apiKey: localStorage.getItem('image_apiKey') || ''
    }
})

// 默认配置常量
const DEFAULT_CONFIG = {
    chat: {
        baseUrl: 'https://thinkflow.lz-t.top/chat/completions',
        model: 'glm-4-flash',
        apiKey: ''
    },
    image: {
        baseUrl: 'https://thinkflow.lz-t.top/images/generations',
        model: 'cogview-3-flash',
        apiKey: ''
    }
}

// 监听配置变化并保存
watch(
    () => locale.value,
    newVal => {
        localStorage.setItem('language', newVal)
    }
)

watch(
    () => apiConfig,
    newVal => {
        localStorage.setItem('api_mode', newVal.mode)
        localStorage.setItem('chat_baseUrl', newVal.chat.baseUrl)
        localStorage.setItem('chat_model', newVal.chat.model)
        localStorage.setItem('chat_apiKey', newVal.chat.apiKey)
        localStorage.setItem('image_baseUrl', newVal.image.baseUrl)
        localStorage.setItem('image_model', newVal.image.model)
        localStorage.setItem('image_apiKey', newVal.image.apiKey)
    },
    { deep: true }
)

const showSettings = ref(false)

// VueFlow 实例
const { addNodes, addEdges, onConnect, setNodes, setEdges, nodes: flowNodes, edges: flowEdges, updateNode, fitView, onNodeDragStart, onNodeDragStop } = useVueFlow()

// 状态管理
const ideaInput = ref('')
const isLoading = ref(false)
const hoveredNodeId = ref<string | null>(null)
const focusedNodeId = ref<string | null>(null)
const draggingNodeId = ref<string | null>(null)
const previewImageUrl = ref<string | null>(null)

// 画布控制状态
const panOnDrag = ref(true)
const isSpacePressed = ref(false)

// 键盘监听：按住空格键开启抓手拖拽
window.addEventListener('keydown', e => {
    if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        isSpacePressed.value = true
        panOnDrag.value = true
    }
})

window.addEventListener('keyup', e => {
    if (e.code === 'Space') {
        isSpacePressed.value = false
    }
})

// 拖拽监听
onNodeDragStart(e => {
    draggingNodeId.value = e.node.id
})

onNodeDragStop(() => {
    draggingNodeId.value = null
})

// 计算当前是否有节点处于“活跃”状态（被选中、聚焦、拖拽或正在生成）
const activeNodeId = computed(() => {
    const expandingNode = flowNodes.value.find(n => n.data.isExpanding)
    const selectedNode = flowNodes.value.find(n => n.selected)
    return expandingNode?.id || selectedNode?.id || draggingNodeId.value || focusedNodeId.value
})

/**
 * 递归获取所有子节点 ID
 */
const getDescendantIds = (nodeId: string, ids: Set<string> = new Set()): Set<string> => {
    flowEdges.value.forEach(edge => {
        if (edge.source === nodeId) {
            ids.add(edge.target)
            getDescendantIds(edge.target, ids)
        }
    })
    return ids
}

// 计算当前活跃节点的相关路径（向上追溯到根，向下包含所有子孙）
const activePath = computed(() => {
    const nodeIds = new Set<string>()
    const edgeIds = new Set<string>()

    if (!activeNodeId.value) return { nodeIds, edgeIds }

    const targetId = activeNodeId.value
    nodeIds.add(targetId)

    // 1. 向上追溯到根节点
    let currentId = targetId
    while (currentId) {
        const edge = flowEdges.value.find(e => e.target === currentId)
        if (edge) {
            edgeIds.add(edge.id)
            nodeIds.add(edge.source)
            currentId = edge.source
        } else {
            break
        }
    }

    // 2. 向下包含所有子孙节点和相关连线
    const descendantIds = getDescendantIds(targetId)
    descendantIds.forEach(id => nodeIds.add(id))

    // 3. 收集子孙节点之间的连线
    flowEdges.value.forEach(edge => {
        if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
            edgeIds.add(edge.id)
        }
    })

    return { nodeIds, edgeIds }
})

// 画布配置
const config = reactive({
    edgeColor: '#fed7aa',
    edgeStyle: 'smoothstep',
    backgroundVariant: BackgroundVariant.Lines,
    showControls: true,
    showMiniMap: true
})

const lastAppliedStatus = ref('')

// 监听 activePath 和配置变化，动态更新连线状态
watch(
    [() => activeNodeId.value, () => config.edgeColor, () => flowEdges.value.length, () => flowNodes.value.some(n => n.data.isExpanding)],
    ([newNodeId, newColor, newLength, anyExpanding]) => {
        const { edgeIds } = activePath.value
        const edgeIdsStr = Array.from(edgeIds).sort().join(',')

        // 状态标识：包含高亮边、颜色、以及是否有节点在发散（影响动画）
        const currentStatus = `${edgeIdsStr}-${newColor}-${anyExpanding}`
        if (lastAppliedStatus.value === currentStatus) return
        lastAppliedStatus.value = currentStatus

        setEdges(
            flowEdges.value.map(edge => {
                const isHighlighted = edgeIds.has(edge.id)
                const isExpanding = !!flowNodes.value.find(n => n.id === edge.source)?.data.isExpanding

                return {
                    ...edge,
                    animated: isHighlighted || isExpanding,
                    style: {
                        ...edge.style,
                        stroke: isHighlighted ? newColor : `${newColor}33`,
                        strokeWidth: isHighlighted ? 3 : 2,
                        transition: 'all 0.3s ease'
                    }
                }
            })
        )
    },
    { immediate: true }
)

/**
 * 聚焦到根节点
 */
const centerRoot = () => {
    const rootNode = flowNodes.value.find(n => n.data.type === 'root')
    if (rootNode) {
        fitView({ nodes: [rootNode.id], padding: 2, duration: 800 })
    }
}

/**
 * 重置布局
 */
const resetLayout = () => {
    // 找到根节点
    const rootNode = flowNodes.value.find(n => n.data.type === 'root')
    if (!rootNode) return

    // 重新计算所有节点位置
    const visited = new Set<string>()
    const layoutNode = (nodeId: string, x: number, y: number) => {
        if (visited.has(nodeId)) return
        visited.add(nodeId)

        const node = flowNodes.value.find(n => n.id === nodeId)
        if (node) {
            node.position = { x, y }

            // 找到所有子节点
            const childEdges = flowEdges.value.filter(e => e.source === nodeId)
            childEdges.forEach((edge, index) => {
                const offsetX = 450
                // 计算子节点垂直分布
                const totalHeight = (childEdges.length - 1) * 280
                const startY = y - totalHeight / 2
                const offsetY = index * 280

                layoutNode(edge.target, x + offsetX, startY + offsetY)
            })
        }
    }

    layoutNode(rootNode.id, 50, 300)

    // 动画过渡到合适视图
    setTimeout(() => {
        fitView({ padding: 0.2, duration: 800 })
    }, 100)
}

/**
 * 导出为图片
 */
const exportImage = async () => {
    const el = document.querySelector('.vue-flow') as HTMLElement
    if (!el) return

    try {
        const dataUrl = await toPng(el, {
            backgroundColor: '#ffffff',
            quality: 1,
            pixelRatio: 2
        })
        const link = document.createElement('a')
        link.download = `thinkflow-${Date.now()}.png`
        link.href = dataUrl
        link.click()
    } catch (err) {
        console.error('Export failed:', err)
    }
}

/**
 * 调用智谱AI生成图片
 */
const generateNodeImage = async (nodeId: string, prompt: string) => {
    const node = flowNodes.value.find(n => n.id === nodeId)
    if (!node || node.data.isImageLoading) return

    updateNode(nodeId, { data: { ...node.data, isImageLoading: true } })

    const useConfig = apiConfig.mode === 'default' ? DEFAULT_CONFIG.image : apiConfig.image
    // 自定义模式下完全使用用户输入，不进行项目 Key 兜底
    const finalApiKey = apiConfig.mode === 'default' ? useConfig.apiKey || API_KEY : useConfig.apiKey

    try {
        const response = await fetch(useConfig.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${finalApiKey}`
            },
            body: JSON.stringify({
                model: useConfig.model,
                prompt: t('prompts.image', { prompt })
            })
        })

        if (!response.ok) throw new Error('Image request failed')
        const data = await response.json()
        const imageUrl = data.data[0].url

        updateNode(nodeId, { data: { ...node.data, imageUrl, isImageLoading: false } })
    } catch (error) {
        console.error('Image Generation Error:', error)
        updateNode(nodeId, { data: { ...node.data, isImageLoading: false } })
    }
}

/**
 * 递归获取从根节点到当前节点的路径
 */
const findPathToNode = (nodeId: string): string[] => {
    const path: string[] = []
    let currentId = nodeId

    while (currentId) {
        const node = flowNodes.value.find(n => n.id === currentId)
        if (node) {
            path.unshift(`${node.data.label} (${node.data.description})`)
            // 查找连入该节点的边
            const edge = flowEdges.value.find(e => e.target === currentId)
            currentId = edge ? edge.source : ''
        } else {
            break
        }
    }
    return path
}

/**
 * 调用智谱AI生成思维发散节点
 */
const expandIdea = async (param?: any, customInput?: string) => {
    // 判断是点击了节点上的按钮还是主输入框
    const parentNode = param && param.id ? param : undefined
    const text = customInput || (parentNode ? parentNode.data.label : ideaInput.value)

    if (!text || (parentNode ? parentNode.data.isExpanding : isLoading.value)) return

    // 记录父节点加载状态
    if (parentNode) {
        const node = flowNodes.value.find(n => n.id === parentNode.id)
        if (node) node.data.isExpanding = true
    } else {
        isLoading.value = true
    }

    // 如果是第一次生成，清空画布
    if (!parentNode) {
        setNodes([])
        setEdges([])
    }

    const systemPrompt = t('prompts.system')

    let userMessage = ''
    if (parentNode) {
        const path = findPathToNode(parentNode.id)
        userMessage = `[${t('prompts.contextPath')}]: ${path.join(' -> ')}\n[${t('prompts.selectedNode')}]: ${parentNode.data.label}\n[${t('prompts.newRequirement')}]: ${customInput || t('prompts.continue')}`
    } else {
        userMessage = `${t('prompts.coreIdeaPrefix')}: ${text}`
    }

    const useConfig = apiConfig.mode === 'default' ? DEFAULT_CONFIG.chat : apiConfig.chat
    // 自定义模式下完全使用用户输入，不进行项目 Key 兜底
    const finalApiKey = apiConfig.mode === 'default' ? useConfig.apiKey || API_KEY : useConfig.apiKey

    try {
        const response = await fetch(useConfig.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${finalApiKey}`
            },
            body: JSON.stringify({
                model: useConfig.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.8
            })
        })

        if (!response.ok) throw new Error('AI request failed')
        const data = await response.json()
        const result = JSON.parse(data.choices[0].message.content)

        // 起始坐标
        const startX = parentNode ? parentNode.position.x + 450 : 50
        const startY = parentNode ? parentNode.position.y : 300

        // 创建根节点 (如果是第一次)
        if (!parentNode) {
            const rootId = 'root-' + Date.now()
            addNodes({
                id: rootId,
                type: 'window',
                position: { x: startX, y: startY },
                data: {
                    label: text,
                    description: t('node.coreIdea'),
                    type: 'root',
                    isExpanding: false,
                    followUp: ''
                },
                sourcePosition: Position.Right,
                targetPosition: Position.Left
            })

            // 为后续子节点计算位置
            processSubNodes(result.nodes, rootId, startX, startY)
        } else {
            processSubNodes(result.nodes, parentNode.id, startX, startY)
        }
    } catch (error) {
        console.error('Expansion Error:', error)
    } finally {
        if (parentNode) {
            const node = flowNodes.value.find(n => n.id === parentNode.id)
            if (node) {
                node.data.isExpanding = false
                // 不再自动清空 followUp，以便用户查看追问的问题
            }
        } else {
            isLoading.value = false
        }
    }
}

const processSubNodes = (subNodes: any[], parentId: string, baseX: number, baseY: number) => {
    subNodes.forEach((item: any, index: number) => {
        const childId = `node-${Date.now()}-${index}`
        const offsetX = 450
        const offsetY = (index - (subNodes.length - 1) / 2) * 280

        addNodes({
            id: childId,
            type: 'window',
            position: { x: baseX + offsetX, y: baseY + offsetY },
            data: {
                label: item.text,
                description: item.description,
                type: 'child',
                followUp: '',
                isExpanding: false,
                isImageLoading: false
            },
            sourcePosition: Position.Right,
            targetPosition: Position.Left
        })

        addEdges({
            id: `e-${parentId}-${childId}`,
            source: parentId,
            target: childId,
            animated: true,
            style: { stroke: config.edgeColor, strokeWidth: 2 },
            markerEnd: MarkerType.ArrowClosed
        })
    })
}

const startNewSession = () => {
    ideaInput.value = ''
    setNodes([])
    setEdges([])
}
</script>

<template>
    <div class="h-screen w-screen bg-white font-mono text-slate-800 relative overflow-hidden flex flex-col selection:bg-orange-100">
        <!-- 顶部导航栏 (工具栏) -->
        <nav class="flex-none bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm z-50">
            <div class="flex items-center gap-6">
                <div class="flex items-center gap-2 mr-4">
                    <div class="w-3 h-3 bg-orange-500 rounded-sm rotate-45"></div>
                    <span class="font-black text-slate-900 tracking-tighter text-lg">ThinkFlow</span>
                </div>

                <div class="h-6 w-[1px] bg-slate-200 mx-2"></div>

                <!-- 工具按钮组 -->
                <div class="flex items-center gap-2">
                    <!-- 重置画布 -->
                    <button @click="startNewSession" class="toolbar-btn text-red-500 hover:bg-red-50 border-red-100" :title="t('nav.reset')">
                        <Trash2 class="w-4 h-4" />
                        <span>{{ t('nav.reset') }}</span>
                    </button>

                    <div class="h-4 w-[1px] bg-slate-100 mx-1"></div>

                    <!-- 布局控制 -->
                    <button @click="fitView({ padding: 0.2, duration: 800 })" class="toolbar-btn text-blue-500 hover:bg-blue-50 border-blue-100" :title="t('nav.fit')">
                        <Focus class="w-4 h-4" />
                        <span>{{ t('nav.fit') }}</span>
                    </button>

                    <button @click="resetLayout" class="toolbar-btn text-purple-500 hover:bg-purple-50 border-purple-100" :title="t('nav.layout')">
                        <LayoutDashboard class="w-4 h-4" />
                        <span>{{ t('nav.layout') }}</span>
                    </button>

                    <button @click="centerRoot" class="toolbar-btn text-orange-500 hover:bg-orange-50 border-orange-100" :title="t('nav.center')">
                        <Target class="w-4 h-4" />
                        <span>{{ t('nav.center') }}</span>
                    </button>

                    <div class="h-4 w-[1px] bg-slate-100 mx-1"></div>

                    <!-- 连线颜色 -->
                    <div class="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                        <Palette class="w-3.5 h-3.5 text-slate-400" />
                        <input type="color" v-model="config.edgeColor" class="w-4 h-4 rounded cursor-pointer bg-transparent border-none" />
                        <span class="text-[10px] font-bold text-slate-500 uppercase">{{ t('nav.edge') }}</span>
                    </div>

                    <!-- 背景样式 -->
                    <select v-model="config.backgroundVariant" class="toolbar-select">
                        <option :value="BackgroundVariant.Lines">{{ t('nav.lines') }}</option>
                        <option :value="BackgroundVariant.Dots">{{ t('nav.dots') }}</option>
                    </select>

                    <div class="h-4 w-[1px] bg-slate-100 mx-1"></div>

                    <!-- 小地图开关 -->
                    <button
                        @click="config.showMiniMap = !config.showMiniMap"
                        class="toolbar-btn border-slate-100"
                        :class="config.showMiniMap ? 'text-blue-500 bg-blue-50 border-blue-100' : 'text-slate-400 hover:text-slate-600'"
                        :title="t('nav.map')"
                    >
                        <Map class="w-4 h-4" />
                        <span>{{ t('nav.map') }}</span>
                    </button>

                    <div class="h-4 w-[1px] bg-slate-100 mx-1"></div>

                    <!-- 导出图片 -->
                    <button @click="exportImage" class="toolbar-btn text-emerald-600 hover:bg-emerald-50 border-emerald-100">
                        <Download class="w-4 h-4" />
                        <span>{{ t('nav.export') }}</span>
                    </button>

                    <div class="h-4 w-[1px] bg-slate-100 mx-1"></div>

                    <!-- 设置按钮 -->
                    <button @click="showSettings = true" class="toolbar-btn text-slate-600 hover:bg-slate-50 border-slate-100">
                        <Settings class="w-4 h-4" />
                        <span>{{ t('common.settings') }}</span>
                    </button>
                </div>
            </div>

            <div class="flex items-center gap-3">
                <button
                    @click="locale = locale === 'zh' ? 'en' : 'zh'"
                    class="p-2 hover:bg-slate-100 rounded-md transition-colors text-slate-400 font-bold text-xs flex items-center gap-1"
                >
                    <Globe class="w-3.5 h-3.5" /> {{ locale === 'zh' ? 'EN' : 'ZH' }}
                </button>
                <button
                    class="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                >
                    {{ t('common.signin') }} <LogIn class="w-3.5 h-3.5 ml-1" />
                </button>
            </div>
        </nav>

        <!-- 主内容区：VueFlow 画布 -->
        <div class="flex-grow relative">
            <VueFlow
                :default-edge-options="{ type: 'smoothstep' }"
                :fit-view-on-init="true"
                class="bg-white"
                :class="{ 'space-pressed': isSpacePressed }"
                :pan-on-drag="panOnDrag"
                :selection-key-code="'Shift'"
            >
                <Background :variant="config.backgroundVariant" pattern-color="#f2f2f2" :gap="24" :size="0.5" />
                <Controls v-if="config.showControls" />
                <MiniMap v-if="config.showMiniMap" pannable zoomable />

                <!-- 自定义节点插槽 -->
                <template #node-window="{ id, data, selected }">
                    <div
                        class="window-node group transition-all duration-500"
                        :class="{
                            'opacity-40 grayscale-[0.4] blur-[0.5px] scale-[0.98] pointer-events-none': activeNodeId && !activePath.nodeIds.has(id),
                            'opacity-100 grayscale-0 blur-0 scale-105 z-50 ring-2 ring-offset-4': activePath.nodeIds.has(id)
                        }"
                        :style="{
                            borderColor: activePath.nodeIds.has(id) ? config.edgeColor : config.edgeColor + '40',
                            boxShadow: activeNodeId === id ? `0 20px 50px -12px ${config.edgeColor}40` : '',
                            '--tw-ring-color': selected ? config.edgeColor + '40' : 'transparent'
                        }"
                        @mouseenter="hoveredNodeId = id"
                        @mouseleave="hoveredNodeId = null"
                    >
                        <!-- 增加连接锚点 -->
                        <Handle type="target" :position="Position.Left" class="!bg-transparent !border-none" />
                        <Handle type="source" :position="Position.Right" class="!bg-transparent !border-none" />

                        <!-- Window Header -->
                        <div class="window-header" :style="{ backgroundColor: activePath.nodeIds.has(id) ? config.edgeColor + '15' : config.edgeColor + '05' }">
                            <div class="flex gap-1.5">
                                <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: activePath.nodeIds.has(id) ? config.edgeColor : config.edgeColor + '40' }"></div>
                                <div class="w-2 h-2 rounded-full bg-slate-200"></div>
                                <div class="w-2 h-2 rounded-full bg-slate-200"></div>
                            </div>
                            <span class="window-title" :style="{ color: activePath.nodeIds.has(id) ? config.edgeColor : '' }">
                                {{ data.type === 'root' ? t('node.mainTitle') : t('node.moduleTitle') }}
                            </span>
                        </div>

                        <!-- Loading Overlay for Node -->
                        <div
                            v-if="data.isExpanding"
                            class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-2xl transition-all duration-300"
                        >
                            <div class="relative">
                                <RefreshCw class="w-8 h-8 text-slate-900 animate-spin mb-3" :style="{ color: config.edgeColor }" />
                                <div class="absolute inset-0 blur-xl opacity-20 animate-pulse" :style="{ backgroundColor: config.edgeColor }"></div>
                            </div>
                            <span class="text-[10px] font-black tracking-widest uppercase text-slate-500">{{ t('common.expanding') }}</span>
                        </div>

                        <!-- Window Content -->
                        <div class="window-content">
                            <!-- Image Display -->
                            <div
                                v-if="data.imageUrl || data.isImageLoading"
                                class="mb-4 rounded-lg overflow-hidden bg-slate-50 border border-slate-100 aspect-video flex items-center justify-center relative group/img cursor-pointer"
                                @click.stop="data.imageUrl ? (previewImageUrl = data.imageUrl) : null"
                            >
                                <img v-if="data.imageUrl" :src="data.imageUrl" class="w-full h-full object-cover" />
                                <div v-if="data.isImageLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm cursor-default">
                                    <RefreshCw class="w-6 h-6 text-orange-500 animate-spin mb-2" />
                                    <span class="text-[8px] font-bold text-slate-400 uppercase">{{ t('common.generating') }}</span>
                                </div>
                                <div
                                    v-if="data.imageUrl"
                                    class="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2"
                                >
                                    <button class="p-2 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-md transition-all" :title="t('node.view')">
                                        <Maximize2 class="w-4 h-4 text-white" />
                                    </button>
                                    <button
                                        @click.stop="generateNodeImage(id, data.label)"
                                        class="p-2 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-md transition-all"
                                        :title="t('node.regenerate')"
                                    >
                                        <RefreshCw class="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 mb-2">
                                <span class="font-bold" :style="{ color: config.edgeColor }">></span>
                                <h3 class="font-black text-slate-900 tracking-tight truncate">{{ data.label }}</h3>
                            </div>
                            <p class="text-[10px] text-slate-500 leading-relaxed font-medium line-clamp-3">
                                {{ data.description }}
                            </p>

                            <!-- Node Actions -->
                            <div class="pt-3 mt-3 border-t border-slate-50">
                                <div class="flex items-center justify-between mb-3">
                                    <div class="flex items-center gap-1.5 shrink-0">
                                        <div class="w-1.5 h-1.5 rounded-full animate-pulse" :style="{ backgroundColor: data.isExpanding ? config.edgeColor : '#34d399' }"></div>
                                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{{
                                            data.isExpanding ? t('common.expanding') : t('common.active')
                                        }}</span>
                                    </div>

                                    <div class="flex items-center gap-2">
                                        <button
                                            v-if="!data.imageUrl && !data.isImageLoading"
                                            @click.stop="generateNodeImage(id, data.label)"
                                            class="action-btn text-blue-500 hover:bg-blue-50"
                                        >
                                            <ImageIcon class="w-2.5 h-2.5" />
                                            <span>{{ t('node.imgAction') }}</span>
                                        </button>
                                    </div>
                                </div>

                                <!-- Follow-up Input -->
                                <div class="relative group/input">
                                    <div
                                        class="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-2 border border-slate-100 focus-within:bg-white transition-all"
                                        :style="{ borderColor: data.followUp || focusedNodeId === id ? config.edgeColor : '' }"
                                    >
                                        <ChevronRight v-if="!data.followUp" class="w-3 h-3 text-slate-400" />
                                        <Terminal v-else class="w-3 h-3" :style="{ color: config.edgeColor }" />
                                        <input
                                            v-model="data.followUp"
                                            @focus="focusedNodeId = id"
                                            @blur="focusedNodeId = null"
                                            @keyup.enter="expandIdea({ id, data, position: flowNodes.find(n => n.id === id)?.position }, data.followUp)"
                                            :placeholder="t('node.followUp')"
                                            class="bg-transparent border-none outline-none text-[10px] font-bold text-slate-700 flex-grow placeholder:text-slate-300"
                                            :disabled="data.isExpanding"
                                        />
                                        <button
                                            @click.stop="expandIdea({ id, data, position: flowNodes.find(n => n.id === id)?.position }, data.followUp)"
                                            :disabled="!data.followUp?.trim() || data.isExpanding"
                                            class="transition-all transform active:scale-90"
                                            :style="{ color: data.followUp?.trim() ? config.edgeColor : '#cbd5e1' }"
                                        >
                                            <RefreshCw v-if="data.isExpanding" class="w-3.5 h-3.5 animate-spin" />
                                            <ArrowRight v-else class="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </VueFlow>

            <!-- 浮动 UI 层 -->
            <div class="absolute inset-0 pointer-events-none z-10 p-12"></div>

            <!-- 设置弹窗 -->
            <div v-if="showSettings" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" @click.self="showSettings = false">
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-300">
                    <div class="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div class="flex items-center gap-3">
                            <div class="p-2 bg-slate-900 rounded-xl text-white">
                                <Settings class="w-5 h-5" />
                            </div>
                            <div>
                                <h3 class="text-lg font-black text-slate-900 tracking-tight">{{ t('settings.title') }}</h3>
                                <p class="text-xs text-slate-500 font-bold uppercase tracking-wider">{{ t('settings.subtitle') }}</p>
                            </div>
                        </div>
                        <button @click="showSettings = false" class="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                            <X class="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    <div class="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        <!-- 模式切换 -->
                        <div class="flex p-1.5 bg-slate-100 rounded-2xl w-fit">
                            <button
                                @click="apiConfig.mode = 'default'"
                                class="px-6 py-2 rounded-xl text-xs font-black tracking-widest transition-all"
                                :class="apiConfig.mode === 'default' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
                            >
                                {{ t('common.default') }}
                            </button>
                            <button
                                @click="apiConfig.mode = 'custom'"
                                class="px-6 py-2 rounded-xl text-xs font-black tracking-widest transition-all"
                                :class="apiConfig.mode === 'custom' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
                            >
                                {{ t('common.custom') }}
                            </button>
                        </div>

                        <div v-if="apiConfig.mode === 'custom'" class="space-y-4 animate-in slide-in-from-top-2 duration-300">
                            <div class="flex items-center gap-2 text-slate-900">
                                <Sparkles class="w-4 h-4 text-orange-500" />
                                <span class="text-sm font-black uppercase tracking-widest">{{ t('settings.textGen') }}</span>
                            </div>
                            <div class="grid grid-cols-1 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                <div class="space-y-1.5">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                        <LinkIcon class="w-3 h-3" /> {{ t('settings.baseUrl') }}
                                    </label>
                                    <input
                                        v-model="apiConfig.chat.baseUrl"
                                        type="text"
                                        :placeholder="t('settings.placeholderUrl')"
                                        class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all font-mono"
                                    />
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="space-y-1.5">
                                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <Shield class="w-3 h-3" /> {{ t('settings.modelName') }}
                                        </label>
                                        <input
                                            v-model="apiConfig.chat.model"
                                            type="text"
                                            :placeholder="t('settings.placeholderModel')"
                                            class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all font-mono"
                                        />
                                    </div>
                                    <div class="space-y-1.5">
                                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <Key class="w-3 h-3" /> {{ t('settings.apiKey') }}
                                        </label>
                                        <input
                                            v-model="apiConfig.chat.apiKey"
                                            type="password"
                                            :placeholder="t('settings.placeholderKey')"
                                            class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="apiConfig.mode === 'custom'" class="space-y-4 animate-in slide-in-from-top-2 duration-300">
                            <div class="flex items-center gap-2 text-slate-900">
                                <ImageIcon class="w-4 h-4 text-blue-500" />
                                <span class="text-sm font-black uppercase tracking-widest">{{ t('settings.imageGen') }}</span>
                            </div>
                            <div class="grid grid-cols-1 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                <div class="space-y-1.5">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                        <LinkIcon class="w-3 h-3" /> {{ t('settings.baseUrl') }}
                                    </label>
                                    <input
                                        v-model="apiConfig.image.baseUrl"
                                        type="text"
                                        :placeholder="t('settings.placeholderUrl')"
                                        class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
                                    />
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="space-y-1.5">
                                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <Shield class="w-3 h-3" /> {{ t('settings.modelName') }}
                                        </label>
                                        <input
                                            v-model="apiConfig.image.model"
                                            type="text"
                                            :placeholder="t('settings.placeholderModel')"
                                            class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
                                        />
                                    </div>
                                    <div class="space-y-1.5">
                                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <Key class="w-3 h-3" /> {{ t('settings.apiKey') }}
                                        </label>
                                        <input
                                            v-model="apiConfig.image.apiKey"
                                            type="password"
                                            :placeholder="t('settings.placeholderKey')"
                                            class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 默认模式提示 -->
                        <div v-if="apiConfig.mode === 'default'" class="flex flex-col items-center justify-center py-12 text-center space-y-4 animate-in fade-in duration-500">
                            <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                                <Activity class="w-8 h-8 text-slate-400" />
                            </div>
                            <div class="space-y-1">
                                <h4 class="text-sm font-black text-slate-900 uppercase">{{ t('settings.defaultModeTitle') }}</h4>
                                <p class="text-xs text-slate-500 max-w-[280px]">{{ t('settings.defaultModeDesc') }}</p>
                            </div>
                        </div>
                    </div>

                    <div class="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                        <button
                            @click="showSettings = false"
                            class="px-8 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
                        >
                            {{ t('common.save') }}
                        </button>
                    </div>
                </div>
            </div>

            <!-- 全局图片预览弹窗 -->
            <div v-if="previewImageUrl" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-10" @click="previewImageUrl = null">
                <div class="relative max-w-full max-h-full rounded-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300" @click.stop>
                    <button @click="previewImageUrl = null" class="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors z-10">
                        <X class="w-5 h-5" />
                    </button>
                    <img :src="previewImageUrl" class="max-w-screen max-h-screen object-contain" />
                </div>
            </div>

            <!-- 加载状态遮罩 -->
            <div v-if="isLoading" class="absolute inset-0 z-[100] flex items-center justify-center bg-white/5 backdrop-blur-[1px] pointer-events-none">
                <div class="bg-white/90 p-4 rounded-full shadow-2xl border border-orange-100 animate-bounce">
                    <Zap class="w-8 h-8 text-orange-500" />
                </div>
            </div>
        </div>

        <!-- 底部全局操作栏 -->
        <div class="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4 w-full max-w-2xl px-6">
            <div class="flex items-center gap-3 w-full">
                <!-- 核心输入框容器 -->
                <div
                    class="flex-grow flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-slate-100 transition-all"
                >
                    <Terminal class="w-5 h-5 text-slate-400" />
                    <input
                        v-model="ideaInput"
                        :placeholder="t('nav.placeholder')"
                        class="flex-grow bg-transparent border-none outline-none text-sm font-bold text-slate-700 placeholder:text-slate-300"
                        @keyup.enter="expandIdea"
                    />
                    <button
                        @click="expandIdea"
                        :disabled="isLoading || !ideaInput.trim()"
                        class="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all active:scale-95 disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed group/btn"
                    >
                        <span class="text-[10px] font-black tracking-widest uppercase mr-1">{{ t('nav.execute') }}</span>
                        <Zap v-if="!isLoading" class="w-4 h-4 text-orange-400 group-hover/btn:scale-110 transition-transform" />
                        <RefreshCw v-else class="w-4 h-4 animate-spin" />
                    </button>
                </div>

                <!-- 底部按钮组 (仅保留核心功能) -->
                <div class="flex items-center gap-2">
                    <!-- 这里可以根据需要放一些其他快捷按钮 -->
                </div>
            </div>
        </div>
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

/* VueFlow Overrides */
.vue-flow__node-window {
    @apply p-0 border-none bg-transparent !important;
}

.vue-flow__controls {
    @apply !bg-white !border-slate-200 !shadow-xl !rounded-lg !left-6 !bottom-6;
}

.vue-flow__controls-button {
    @apply !border-slate-100 !fill-slate-400 hover:!bg-slate-50 !transition-colors;
}

.vue-flow__minimap {
    @apply !bg-white/80 !backdrop-blur-md !border-slate-200 !shadow-2xl !rounded-xl !overflow-hidden !m-6;
    width: 200px !important;
    height: 150px !important;
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
</style>
