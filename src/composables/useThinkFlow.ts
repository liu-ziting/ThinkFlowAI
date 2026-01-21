/**
 * ThinkFlow 核心业务 composable
 * - 统一管理：画布状态（节点/边）、交互状态、API 调用、错误处理与导出能力
 * - 对外提供：页面与组件可直接调用的状态与动作（expand / deepDive / image / summary 等）
 */

import { computed, reactive, ref, watch, type Ref } from 'vue'
import { MarkerType, Position, useVueFlow } from '@vue-flow/core'
import { BackgroundVariant } from '@vue-flow/background'

/**
 * i18n 翻译函数类型（等价于 vue-i18n 的 t）
 */
type Translate = (key: string, params?: any) => string

/**
 * 创建 ThinkFlow 的业务上下文。
 * @param t 国际化翻译函数
 * @param locale 当前语言（用于持久化语言选择）
 */
export function useThinkFlow({ t, locale }: { t: Translate; locale: Ref<string> }) {
    /**
     * 默认模式下的 API Key（当前不使用环境变量注入）。
     * - 如需鉴权，请通过 Settings 的 Custom 模式填写 apiKey
     */
    const API_KEY = ''

    /**
     * API 配置（支持默认/自定义两种模式）
     * - 自定义模式写入 localStorage，刷新后仍保留
     */
    const apiConfig = reactive({
        mode: localStorage.getItem('api_mode') || 'default',
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

    /**
     * 默认接口配置（当用户选择默认模式时使用）
     * - apiKey 允许为空：会回退到 API_KEY（环境变量）
     */
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

    /**
     * 语言选择持久化（与 i18n/index.ts 中的初始化配合）
     */
    watch(
        () => locale.value,
        newVal => {
            localStorage.setItem('language', newVal)
        }
    )

    /**
     * API 配置持久化：任何字段变化都会更新 localStorage
     */
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

    /**
     * 设置弹窗开关（由顶部导航触发）
     */
    const showSettings = ref(false)

    /**
     * VueFlow 实例能力集合：节点/边增删改与视图控制
     */
    const {
        addNodes,
        addEdges,
        setNodes,
        setEdges,
        nodes: flowNodes,
        edges: flowEdges,
        updateNode,
        removeNodes,
        removeEdges,
        fitView,
        viewport,
        onNodeDragStart,
        onNodeDrag,
        onNodeDragStop
    } = useVueFlow()

    /**
     * 全局输入与对话状态
     */
    const ideaInput = ref('')
    const isLoading = ref(false)
    const previewImageUrl = ref<string | null>(null)
    const showResetConfirm = ref(false)
    const showSummaryModal = ref(false)
    const isSummarizing = ref(false)
    const summaryContent = ref('')

    const draggingNodeId = ref<string | null>(null)
    const dragLastPositionByNodeId = new Map<string, { x: number; y: number }>()
    const alignmentGuides = ref<{ x: number | null; y: number | null }>({ x: null, y: null })

    /**
     * 交互：按住 Space 启用“抓手拖拽画布”
     * - isSpacePressed 用于在 UI 层展示手型光标
     * - panOnDrag 控制 VueFlow 的拖拽行为（按 Space 时总是允许拖拽画布）
     */
    const panOnDrag = ref(true)
    const isSpacePressed = ref(false)

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

    /**
     * 用拖拽节点作为“当前激活节点”的一种来源，便于高亮路径/聚焦
     */
    onNodeDragStart(e => {
        draggingNodeId.value = e.node.id
        dragLastPositionByNodeId.set(e.node.id, {
            x: e.node.position.x,
            y: e.node.position.y
        })
    })

    /**
     * 处理节点拖拽事件 (联动移动子节点)
     */
    const handleNodeDrag = (payload: any) => {
        const node = payload?.node ?? payload
        if (!node?.id || !node?.position) return

        const draggedStoreNode = flowNodes.value.find(n => n.id === node.id)
        if (!draggedStoreNode) return

        if (config.snapToAlignment) {
            const snapThreshold = 8

            const getNodeSize = (n: any) => {
                const width = n.dimensions?.width ?? n.measured?.width ?? 280
                const height = n.dimensions?.height ?? n.measured?.height ?? 180
                return { width, height }
            }

            const draggedSize = getNodeSize(draggedStoreNode)
            const proposedX = node.position.x
            const proposedY = node.position.y

            const draggedAnchorsX = [proposedX, proposedX + draggedSize.width / 2, proposedX + draggedSize.width]
            const draggedAnchorsY = [proposedY, proposedY + draggedSize.height / 2, proposedY + draggedSize.height]

            let bestX: { delta: number; guide: number } | null = null
            let bestY: { delta: number; guide: number } | null = null

            for (const other of flowNodes.value) {
                if (other.id === node.id) continue
                if (other.hidden) continue

                const otherSize = getNodeSize(other)
                const otherX = other.position?.x ?? 0
                const otherY = other.position?.y ?? 0

                const otherAnchorsX = [otherX, otherX + otherSize.width / 2, otherX + otherSize.width]
                const otherAnchorsY = [otherY, otherY + otherSize.height / 2, otherY + otherSize.height]

                for (const ox of otherAnchorsX) {
                    for (const ax of draggedAnchorsX) {
                        const delta = ox - ax
                        const absDelta = Math.abs(delta)
                        if (absDelta <= snapThreshold && (!bestX || absDelta < Math.abs(bestX.delta))) {
                            bestX = { delta, guide: ox }
                        }
                    }
                }

                for (const oy of otherAnchorsY) {
                    for (const ay of draggedAnchorsY) {
                        const delta = oy - ay
                        const absDelta = Math.abs(delta)
                        if (absDelta <= snapThreshold && (!bestY || absDelta < Math.abs(bestY.delta))) {
                            bestY = { delta, guide: oy }
                        }
                    }
                }
            }

            const snappedX = bestX ? proposedX + bestX.delta : proposedX
            const snappedY = bestY ? proposedY + bestY.delta : proposedY

            alignmentGuides.value = config.showAlignmentGuides ? { x: bestX?.guide ?? null, y: bestY?.guide ?? null } : { x: null, y: null }

            if (snappedX !== proposedX || snappedY !== proposedY) {
                draggedStoreNode.position = { x: snappedX, y: snappedY }
                node.position = { x: snappedX, y: snappedY }
            }
        } else {
            alignmentGuides.value = { x: null, y: null }
        }

        if (!config.hierarchicalDragging) return

        const lastPosition = dragLastPositionByNodeId.get(node.id)
        if (!lastPosition) {
            const fallbackDelta = payload?.delta
            dragLastPositionByNodeId.set(node.id, { x: node.position.x, y: node.position.y })
            if (fallbackDelta && typeof fallbackDelta.x === 'number' && typeof fallbackDelta.y === 'number') {
                const descendantIds = getDescendantIds(node.id)
                if (descendantIds.size === 0) return

                const selectedNodeIds = new Set(flowNodes.value.filter(n => n.selected).map(n => n.id))
                descendantIds.forEach(id => {
                    if (!selectedNodeIds.has(id)) {
                        const targetNode = flowNodes.value.find(n => n.id === id)
                        if (targetNode) {
                            targetNode.position = {
                                x: targetNode.position.x + fallbackDelta.x,
                                y: targetNode.position.y + fallbackDelta.y
                            }
                        }
                    }
                })
            }
            return
        }

        const dx = node.position.x - lastPosition.x
        const dy = node.position.y - lastPosition.y
        if (dx === 0 && dy === 0) return

        dragLastPositionByNodeId.set(node.id, { x: node.position.x, y: node.position.y })

        const descendantIds = getDescendantIds(node.id)
        if (descendantIds.size === 0) return

        // 获取当前所有选中的节点，避免重复位移
        const selectedNodeIds = new Set(flowNodes.value.filter(n => n.selected).map(n => n.id))

        // 批量更新子节点位置
        descendantIds.forEach(id => {
            if (!selectedNodeIds.has(id)) {
                const targetNode = flowNodes.value.find(n => n.id === id)
                if (targetNode) {
                    // 直接更新位置对象，确保 Vue 能够检测到深层变化
                    targetNode.position = {
                        x: targetNode.position.x + dx,
                        y: targetNode.position.y + dy
                    }
                }
            }
        })
    }

    onNodeDrag(handleNodeDrag)

    onNodeDragStop(e => {
        draggingNodeId.value = null
        if (e?.node?.id) {
            dragLastPositionByNodeId.delete(e.node.id)
        }
        alignmentGuides.value = { x: null, y: null }
    })

    /**
     * 当前激活节点 id
     * 优先级：正在展开的节点 > 选中的节点 > 正在拖拽的节点
     */
    const activeNodeId = computed(() => {
        const expandingNode = flowNodes.value.find(n => n.data.isExpanding)
        const selectedNode = flowNodes.value.find(n => n.selected)
        return expandingNode?.id || selectedNode?.id || draggingNodeId.value
    })

    /**
     * 获取节点的所有后代节点 ID (迭代实现，更健壮)
     */
    const getDescendantIds = (nodeId: string): Set<string> => {
        const descendants = new Set<string>()
        const stack = [nodeId]
        const edges = flowEdges.value

        while (stack.length > 0) {
            const currentId = stack.pop()!
            for (const edge of edges) {
                if (edge.source === currentId) {
                    if (!descendants.has(edge.target)) {
                        descendants.add(edge.target)
                        stack.push(edge.target)
                    }
                }
            }
        }
        return descendants
    }

    /**
     * 删除指定节点的所有后代节点
     * 用于在重新扩展某个节点时，清空其原有的子树
     */
    const removeDescendants = (nodeId: string) => {
        const descendantIds = getDescendantIds(nodeId)
        if (descendantIds.size > 0) {
            removeNodes(Array.from(descendantIds))
        }
    }

    /**
     * 当前激活路径（节点集合 + 边集合）
     * - 向上：从激活节点回溯到根
     * - 向下：包含激活节点的所有后代
     * 用于：
     * - 节点高亮/弱化
     * - 边高亮/动画
     */
    const activePath = computed(() => {
        const nodeIds = new Set<string>()
        const edgeIds = new Set<string>()

        if (!activeNodeId.value) return { nodeIds, edgeIds }

        const targetId = activeNodeId.value
        nodeIds.add(targetId)

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

        const descendantIds = getDescendantIds(targetId)
        descendantIds.forEach(id => nodeIds.add(id))

        flowEdges.value.forEach(edge => {
            if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
                edgeIds.add(edge.id)
            }
        })

        return { nodeIds, edgeIds }
    })

    const config = reactive({
        edgeColor: '#fed7aa',
        edgeType: 'default',
        backgroundVariant: BackgroundVariant.Lines,
        showControls: true,
        showMiniMap: true,
        hierarchicalDragging: true,
        snapToGrid: true,
        snapGrid: [16, 16] as [number, number],
        snapToAlignment: true,
        showAlignmentGuides: true
    })

    const collapsedNodeIds = ref<string[]>([])

    const isSubtreeCollapsed = (nodeId: string) => collapsedNodeIds.value.includes(nodeId)

    const toggleSubtreeCollapse = (nodeId: string) => {
        if (isSubtreeCollapsed(nodeId)) {
            collapsedNodeIds.value = collapsedNodeIds.value.filter(id => id !== nodeId)
        } else {
            collapsedNodeIds.value = [...collapsedNodeIds.value, nodeId]
        }
    }

    const applyCollapsedVisibility = () => {
        const hiddenIds = new Set<string>()
        const childrenCountById = new Map<string, number>()

        for (const e of flowEdges.value) {
            childrenCountById.set(e.source, (childrenCountById.get(e.source) ?? 0) + 1)
        }

        for (const id of collapsedNodeIds.value) {
            const descendants = getDescendantIds(id)
            descendants.forEach(d => hiddenIds.add(d))
        }

        setNodes(
            flowNodes.value.map(n => {
                const isHidden = hiddenIds.has(n.id)
                const isCollapsed = isSubtreeCollapsed(n.id)
                const hiddenDescendantCount = isCollapsed ? getDescendantIds(n.id).size : 0
                const childrenCount = childrenCountById.get(n.id) ?? 0
                const nextData =
                    n.data?.hiddenDescendantCount !== hiddenDescendantCount || n.data?.childrenCount !== childrenCount
                        ? { ...n.data, hiddenDescendantCount, childrenCount }
                        : n.data

                return {
                    ...n,
                    hidden: isHidden,
                    data: nextData
                }
            })
        )

        setEdges(
            flowEdges.value.map(e => ({
                ...e,
                hidden: hiddenIds.has(e.source) || hiddenIds.has(e.target)
            }))
        )
    }

    watch([() => collapsedNodeIds.value.join(','), () => flowNodes.value.length, () => flowEdges.value.length], applyCollapsedVisibility, { immediate: true })

    const lastAppliedStatus = ref('')

    /**
     * 根据激活路径与配置，动态更新边的样式（高亮/透明度/动画）
     * - 通过 lastAppliedStatus 避免无效重复 setEdges
     */
    watch(
        [() => activeNodeId.value, () => config.edgeColor, () => config.edgeType, () => flowEdges.value.length, () => flowNodes.value.some(n => n.data.isExpanding)],
        ([, newColor, newType, , anyExpanding]) => {
            const { edgeIds } = activePath.value
            const edgeIdsStr = Array.from(edgeIds).sort().join(',')

            const currentStatus = `${edgeIdsStr}-${newColor}-${newType}-${anyExpanding}`
            if (lastAppliedStatus.value === currentStatus) return
            lastAppliedStatus.value = currentStatus

            setEdges(
                flowEdges.value.map(edge => {
                    const isHighlighted = edgeIds.has(edge.id)
                    const isExpanding = !!flowNodes.value.find(n => n.id === edge.source)?.data.isExpanding

                    return {
                        ...edge,
                        type: newType,
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
     * 将网络/接口异常转换为用户可读的错误文案
     */
    const getErrorMessage = (error: any) => {
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            return t('common.error.cors')
        }
        if (error.status === 429) return t('common.error.rateLimit')
        if (error.status === 400) return t('common.error.badRequest')
        if (error.status >= 500) return t('common.error.serverError')
        return error.message || t('common.error.unknown')
    }

    /**
     * 视图：将根节点居中显示
     */
    const centerRoot = () => {
        const rootNode = flowNodes.value.find(n => n.data.type === 'root')
        if (rootNode) {
            fitView({ nodes: [rootNode.id], padding: 2, duration: 800 })
        }
    }

    /**
     * 布局：从根节点开始按“横向树形”重新排布节点位置
     * - 主要用于整理节点过多导致的视觉拥挤
     */
    const resetLayout = () => {
        const rootNode = flowNodes.value.find(n => n.data.type === 'root')
        if (!rootNode) return

        const visited = new Set<string>()
        const layoutNode = (nodeId: string, x: number, y: number) => {
            if (visited.has(nodeId)) return
            visited.add(nodeId)

            const node = flowNodes.value.find(n => n.id === nodeId)
            if (node) {
                node.position = { x, y }

                const childEdges = flowEdges.value.filter(e => e.source === nodeId)
                childEdges.forEach((edge, index) => {
                    const offsetX = 450
                    const totalHeight = (childEdges.length - 1) * 280
                    const startY = y - totalHeight / 2
                    const offsetY = index * 280

                    layoutNode(edge.target, x + offsetX, startY + offsetY)
                })
            }
        }

        layoutNode(rootNode.id, 50, 300)

        setTimeout(() => {
            fitView({ padding: 0.2, duration: 800 })
        }, 100)
    }

    /**
     * 导出：将当前树形结构导出为 Markdown
     * - 以 root 为标题
     * - 子节点按缩进列表输出
     * - deepDive 生成的详细内容以引用块输出
     */
    const exportMarkdown = () => {
        if (flowNodes.value.length === 0) return

        const rootNode = flowNodes.value.find(n => n.data.type === 'root')
        if (!rootNode) return

        let markdown = `# ${rootNode.data.label}\n\n`

        const buildMarkdown = (parentId: string, level: number) => {
            const children = flowEdges.value
                .filter(e => e.source === parentId)
                .map(e => flowNodes.value.find(n => n.id === e.target))
                .filter(n => n !== undefined)

            children.forEach(child => {
                const indent = '  '.repeat(level - 1)
                markdown += `${indent}- ${child!.data.label}\n`
                if (child!.data.detailedContent) {
                    const detailIndent = '  '.repeat(level)
                    markdown += `${detailIndent}> ${child!.data.detailedContent.replace(/\n/g, `\n${detailIndent}> `)}\n`
                }
                buildMarkdown(child!.id, level + 1)
            })
        }

        buildMarkdown(rootNode.id, 1)

        const blob = new Blob([markdown], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.download = `thinkflow-${rootNode.data.label}-${Date.now()}.md`
        link.href = url
        link.click()
        URL.revokeObjectURL(url)
    }

    /**
     * 总结：基于当前所有节点信息生成一段总结文本
     * - 结果展示在 SummaryModal
     */
    const generateSummary = async () => {
        if (flowNodes.value.length === 0) return

        showSummaryModal.value = true
        isSummarizing.value = true
        summaryContent.value = ''

        const nodesInfo = flowNodes.value.map(n => ({
            label: n.data.label,
            description: n.data.description,
            type: n.data.type
        }))

        const useConfig = apiConfig.mode === 'default' ? DEFAULT_CONFIG.chat : apiConfig.chat
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
                        {
                            role: 'user',
                            content: t('prompts.summaryPrompt', {
                                nodes: JSON.stringify(nodesInfo, null, 2)
                            })
                        }
                    ]
                })
            })

            if (!response.ok) throw new Error('Summary request failed')

            const data = await response.json()
            summaryContent.value = data.choices[0].message.content
        } catch (error) {
            console.error('Summary Generation Error:', error)
            summaryContent.value = t('common.error.unknown')
        } finally {
            isSummarizing.value = false
        }
    }

    /**
     * 图片：为指定节点生成配图
     * - 节点会进入 isImageLoading 状态
     * - 成功后写入 imageUrl，用于节点卡片与预览弹窗展示
     */
    const generateNodeImage = async (nodeId: string, prompt: string) => {
        const node = flowNodes.value.find(n => n.id === nodeId)
        if (!node || node.data.isImageLoading) return

        updateNode(nodeId, ((n: any) => ({ ...n, selected: true, zIndex: 1000 })) as any)

        updateNode(nodeId, { data: { ...node.data, isImageLoading: true, error: null } })

        const useConfig = apiConfig.mode === 'default' ? DEFAULT_CONFIG.image : apiConfig.image
        const finalApiKey = apiConfig.mode === 'default' ? useConfig.apiKey || API_KEY : useConfig.apiKey

        try {
            const topic = node.data.label || prompt
            const detail = node.data.description || ''
            const response = await fetch(useConfig.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${finalApiKey}`
                },
                body: JSON.stringify({
                    model: useConfig.model,
                    prompt: t('prompts.image', { topic, detail })
                })
            })

            if (!response.ok) {
                const error: any = new Error('Image request failed')
                error.status = response.status
                throw error
            }
            const data = await response.json()
            const imageUrl = data.data[0].url

            updateNode(nodeId, { data: { ...node.data, imageUrl, isImageLoading: false, error: null } })
        } catch (error: any) {
            console.error('Image Generation Error:', error)
            updateNode(nodeId, { data: { ...node.data, isImageLoading: false, error: getErrorMessage(error) } })
        }
    }

    /**
     * 深挖：针对某个节点生成更详细的解释/拓展内容
     * - 若已有 detailedContent 且未展开，则直接展开（避免重复请求）
     */
    const deepDive = async (nodeId: string, topic: string) => {
        const node = flowNodes.value.find(n => n.id === nodeId)
        if (!node) return

        updateNode(nodeId, ((n: any) => ({ ...n, selected: true, zIndex: 1000 })) as any)

        if (node.data.detailedContent && !node.data.isDetailExpanded) {
            updateNode(nodeId, { data: { ...node.data, isDetailExpanded: true } })
            return
        }

        if (node.data.isDeepDiving) return

        updateNode(nodeId, { data: { ...node.data, isDeepDiving: true, isDetailExpanded: true, error: null } })

        const useConfig = apiConfig.mode === 'default' ? DEFAULT_CONFIG.chat : apiConfig.chat
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
                    messages: [{ role: 'user', content: t('prompts.deepDivePrompt', { topic }) }]
                })
            })

            if (!response.ok) {
                const error: any = new Error('Deep dive request failed')
                error.status = response.status
                throw error
            }
            const data = await response.json()
            const content = data.choices[0].message.content

            updateNode(nodeId, { data: { ...node.data, detailedContent: content, isDeepDiving: false, error: null } })
        } catch (error: any) {
            console.error('Deep Dive Error:', error)
            updateNode(nodeId, { data: { ...node.data, isDeepDiving: false, error: getErrorMessage(error) } })
        }
    }

    /**
     * 生成从根到指定节点的“上下文路径”文本，用于二次扩展时给模型更明确的上下文
     */
    const findPathToNode = (nodeId: string): string[] => {
        const path: string[] = []
        let currentId = nodeId

        while (currentId) {
            const node = flowNodes.value.find(n => n.id === currentId)
            if (node) {
                path.unshift(`${node.data.label} (${node.data.description})`)
                const edge = flowEdges.value.find(e => e.target === currentId)
                currentId = edge ? edge.source : ''
            } else {
                break
            }
        }
        return path
    }

    /**
     * 将模型返回的子节点数组写入画布，并连边到 parentId
     */
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
                    isImageLoading: false,
                    isTitleExpanded: false,
                    error: null
                },
                sourcePosition: Position.Right,
                targetPosition: Position.Left
            })

            addEdges({
                id: `e-${parentId}-${childId}`,
                source: parentId,
                target: childId,
                animated: true,
                type: config.edgeType,
                style: { stroke: config.edgeColor, strokeWidth: 2 },
                markerEnd: MarkerType.ArrowClosed
            })
        })
    }

    /**
     * 生成/扩展节点
     * - 无 parentNode：创建 root 节点并生成第一层子节点
     * - 有 parentNode：基于选中节点生成下一层子节点（支持 followUp 作为追加需求）
     *
     * 接口约定：
     * - chat completion 返回 message.content 为 JSON 字符串
     * - response_format: { type: 'json_object' } 用于提高 JSON 输出稳定性
     */
    const expandIdea = async (param?: any, customInput?: string) => {
        const parentNode = param && param.id ? param : undefined
        const text = customInput || (parentNode ? parentNode.data.label : ideaInput.value)

        if (!text || (parentNode ? parentNode.data.isExpanding : isLoading.value)) return

        let currentParentId = parentNode?.id

        if (!parentNode) {
            isLoading.value = true
            setNodes([])
            setEdges([])

            const rootId = 'root-' + Date.now()
            currentParentId = rootId

            addNodes({
                id: rootId,
                type: 'window',
                position: { x: 50, y: 300 },
                data: {
                    label: text,
                    description: t('node.coreIdea'),
                    type: 'root',
                    isExpanding: true,
                    isTitleExpanded: false,
                    followUp: '',
                    error: null
                },
                sourcePosition: Position.Right,
                targetPosition: Position.Left
            })

            ideaInput.value = ''
        } else {
            const node = flowNodes.value.find(n => n.id === parentNode.id)
            if (node) {
                updateNode(parentNode.id, {
                    data: {
                        ...node.data,
                        isExpanding: true,
                        isDetailExpanded: false,
                        error: null
                    }
                })
            }
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

            if (!response.ok) {
                const error: any = new Error('AI request failed')
                error.status = response.status
                throw error
            }
            const data = await response.json()
            const result = JSON.parse(data.choices[0].message.content)

            // 如果是重新扩展已有节点，先清空其现有的所有后代节点
            if (parentNode && currentParentId) {
                removeDescendants(currentParentId)
            }

            const parentNodeObj = flowNodes.value.find(n => n.id === currentParentId)
            const startX = parentNodeObj ? parentNodeObj.position.x : 50
            const startY = parentNodeObj ? parentNodeObj.position.y : 300

            processSubNodes(result.nodes, currentParentId, startX, startY)

            if (!parentNode) {
                setTimeout(() => {
                    const childEdges = flowEdges.value.filter(e => e.source === currentParentId)
                    const childIds = childEdges.map(e => e.target)

                    const nodesToFit = [currentParentId, ...childIds.slice(0, 3)]

                    fitView({
                        nodes: nodesToFit,
                        padding: 0.25,
                        duration: 1000
                    })
                }, 100)
            }
        } catch (error: any) {
            console.error('Expansion Error:', error)
            const node = flowNodes.value.find(n => n.id === currentParentId)
            if (node) {
                updateNode(currentParentId, { data: { ...node.data, error: getErrorMessage(error) } })
            }
        } finally {
            const node = flowNodes.value.find(n => n.id === currentParentId)
            if (node) {
                node.data.isExpanding = false
            }
            isLoading.value = false
        }
    }

    /**
     * 立即清空当前画布与输入，并关闭确认弹窗
     */
    const executeReset = () => {
        ideaInput.value = ''
        setNodes([])
        setEdges([])
        showResetConfirm.value = false
    }

    /**
     * 新会话入口
     * - 若当前已有节点：弹出二次确认
     * - 若为空：直接清空（等价 executeReset）
     */
    const startNewSession = () => {
        if (flowNodes.value.length > 0) {
            showResetConfirm.value = true
            return
        }
        executeReset()
    }

    return {
        apiConfig,
        DEFAULT_CONFIG,
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
        flowEdges,
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
    }
}

