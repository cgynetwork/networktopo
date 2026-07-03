import { useCallback, type RefObject } from 'react'
import type { Node, Edge, ReactFlowInstance } from '@xyflow/react'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import type { EdgeData } from '../types'
import type { HistoryState } from './useHistory'
import type { ToastContextValue } from '../context/ToastContext'
import { migrateViewMode } from '../utils/rackUtils'

interface UseFileOperationsOptions {
  rfInstance: ReactFlowInstance | null
  currentFilePath: string | null
  isDirty: boolean
  nodes: Node[]
  edges: Edge[]
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void
  setCurrentFilePath: (path: string | null) => void
  setIsDirty: (dirty: boolean) => void
  setShowOpenConfirm: (show: boolean) => void
  setShowNewConfirm: (show: boolean) => void
  setSelectedNode: (node: Node | null) => void
  setSelectedEdge: (edge: Edge | null) => void
  setPanelCollapsed: (collapsed: boolean) => void
  containerRef: RefObject<HTMLDivElement | null>
  history: HistoryState
  toast: ToastContextValue
  defaultEdgeData: EdgeData
}

interface UseFileOperationsReturn {
  handleNew: () => void
  clearCanvas: () => void
  handleNewSave: () => Promise<void>
  handleNewDiscard: () => void
  handleNewCancel: () => void
  handleSave: () => Promise<void>
  handleSaveAs: () => Promise<void>
  handleOpen: () => Promise<void>
  doOpen: () => Promise<void>
  handleOpenByPath: (filePath: string) => Promise<void>
  handleExportPNG: () => Promise<void>
  handleExportPDF: () => Promise<void>
}

export function useFileOperations({
  rfInstance,
  currentFilePath,
  isDirty,
  nodes,
  edges,
  setNodes,
  setEdges,
  setCurrentFilePath,
  setIsDirty,
  setShowOpenConfirm,
  setShowNewConfirm,
  setSelectedNode,
  setSelectedEdge,
  setPanelCollapsed,
  containerRef,
  history,
  toast,
  defaultEdgeData,
}: UseFileOperationsOptions): UseFileOperationsReturn {

  // ── Canvas clear ──────────────────────────────────────────
  const clearCanvas = useCallback(() => {
    setNodes([])
    setEdges([])
    setSelectedNode(null)
    setSelectedEdge(null)
    setPanelCollapsed(true)
    setShowNewConfirm(false)
    setIsDirty(false)
    setCurrentFilePath(null)
    history.clearHistory()
  }, [setNodes, setEdges, setSelectedNode, setSelectedEdge, setPanelCollapsed,
      setShowNewConfirm, setIsDirty, setCurrentFilePath, history])

  // ── New file ──────────────────────────────────────────────
  const handleNew = useCallback(() => {
    if (nodes.length > 0 || edges.length > 0) {
      setShowNewConfirm(true)
    } else {
      clearCanvas()
    }
  }, [nodes.length, edges.length, clearCanvas, setShowNewConfirm])

  const handleNewSave = useCallback(async () => {
    if (!rfInstance) return
    const flow = rfInstance.toObject()
    const topoFile = {
      version: '1.1.0',
      nodes: flow.nodes,
      edges: flow.edges,
      viewport: flow.viewport,
    }
    try {
      const result = await window.electronAPI.saveFile(JSON.stringify(topoFile, null, 2))
      if (result.success) {
        setCurrentFilePath(result.filePath!)
        setIsDirty(false)
        clearCanvas()
      }
    } catch (err) {
      console.error('Save error:', err)
    }
  }, [rfInstance, clearCanvas, setCurrentFilePath, setIsDirty])

  const handleNewDiscard = useCallback(() => {
    clearCanvas()
  }, [clearCanvas])

  const handleNewCancel = useCallback(() => {
    setShowNewConfirm(false)
  }, [setShowNewConfirm])

  // ── Save ─────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!rfInstance) return
    const flow = rfInstance.toObject()
    const topoFile = { version: '1.1.0', nodes: flow.nodes, edges: flow.edges, viewport: flow.viewport }
    try {
      const result = await window.electronAPI.saveFile(
        JSON.stringify(topoFile, null, 2),
        currentFilePath ?? undefined
      )
      if (result.success && result.filePath) {
        setCurrentFilePath(result.filePath)
        setIsDirty(false)
        toast.showToast('文件已保存', 'success')
        window.electronAPI.clearAutoSave().catch(() => {})
      } else if (!result.canceled && result.error) {
        toast.showToast('保存失败: ' + result.error, 'error')
      }
    } catch (err) {
      console.error('Save error:', err)
    }
  }, [rfInstance, currentFilePath, setCurrentFilePath, setIsDirty, toast])

  // ── Save As ──────────────────────────────────────────────
  const handleSaveAs = useCallback(async () => {
    if (!rfInstance) return
    const flow = rfInstance.toObject()
    const topoFile = { version: '1.1.0', nodes: flow.nodes, edges: flow.edges, viewport: flow.viewport }
    try {
      const result = await window.electronAPI.saveFile(JSON.stringify(topoFile, null, 2))
      if (result.success && result.filePath) {
        setCurrentFilePath(result.filePath)
        setIsDirty(false)
        toast.showToast('文件已保存', 'success')
        window.electronAPI.clearAutoSave().catch(() => {})
      } else if (!result.canceled && result.error) {
        toast.showToast('保存失败: ' + result.error, 'error')
      }
    } catch (err) {
      console.error('Save error:', err)
    }
  }, [rfInstance, setCurrentFilePath, setIsDirty, toast])

  // ── Load a topo file into the canvas ──────────────────────
  const loadTopoFile = useCallback(
    (content: string, filePath: string) => {
      history.pushSnapshot(nodes, edges)
      const topoFile = JSON.parse(content)
      const loadedNodes = (topoFile.nodes || []).map((n: Node) => {
        const data = n.data as Record<string, unknown> | undefined
        // V1.1.2: Migrate old viewMode values ('compact'/'detail' → 'front'/'back')
        if (data && 'viewMode' in data) {
          data.viewMode = migrateViewMode(data.viewMode as string | undefined)
        }
        if (data && 'parentViewMode' in data) {
          data.parentViewMode = migrateViewMode(data.parentViewMode as string | undefined)
        }
        // V1.4.0: Migrate old SDWAN model names → unified 互联网应用
        if (data && 'device' in data) {
          const dev = data.device as Record<string, unknown>
          if (dev && (dev.model === '国内互联网应用' || dev.model === '国际互联网应用')) {
            dev.model = '互联网应用'
          }
        }
        // V1.5.0: Migrate old single appImage → appImages array
        if (data && (data as Record<string, unknown>).appImage && !(data as Record<string, unknown>).appImages) {
          const d = data as Record<string, unknown>
          ;(d as Record<string, unknown[]>).appImages = [{
            id: 'img-legacy-1',
            dataUrl: d.appImage,
            offsetX: (d.appImageOffset as { x: number; y: number } | undefined)?.x ?? 0,
            offsetY: (d.appImageOffset as { x: number; y: number } | undefined)?.y ?? 0,
            scale: 1,
          }]
          delete d.appImage
          delete d.appImageOffset
        }
        return {
          ...n,
          type: n.type || 'deviceNode',
          data,
        }
      })
      const loadedEdges = (topoFile.edges || []).map((e: Edge) => ({
        ...e,
        type: e.type || 'animated',
        data: { ...defaultEdgeData, ...e.data },
      }))
      setNodes(loadedNodes)
      setEdges(loadedEdges)
      setPanelCollapsed(true)
      setCurrentFilePath(filePath)
      setIsDirty(false)
      history.clearHistory()
      window.electronAPI.clearAutoSave().catch(() => {})
      toast.showToast('文件已打开', 'success')
      window.electronAPI.addRecentFile(filePath).catch(() => {})
    },
    [nodes, edges, setNodes, setEdges, setPanelCollapsed, setCurrentFilePath,
     setIsDirty, history, toast, defaultEdgeData],
  )

  // ── Open ─────────────────────────────────────────────────
  const doOpen = useCallback(async () => {
    setShowOpenConfirm(false)
    try {
      const result = await window.electronAPI.openFile()
      if (result.success && result.content) {
        loadTopoFile(result.content, result.filePath!)
      }
    } catch (err) {
      console.error('Open error:', err)
      toast.showToast('打开文件失败', 'error')
    }
  }, [loadTopoFile, setShowOpenConfirm, toast])

  const handleOpen = useCallback(async () => {
    if (isDirty) {
      setShowOpenConfirm(true)
      return
    }
    doOpen()
  }, [isDirty, doOpen, setShowOpenConfirm])

  const handleOpenByPath = useCallback(
    async (filePath: string) => {
      try {
        const result = await window.electronAPI.openFileByPath(filePath)
        if (result.success && result.content) {
          loadTopoFile(result.content, filePath)
        }
      } catch (err) {
        console.error('Open error:', err)
        toast.showToast('打开文件失败', 'error')
      }
    },
    [loadTopoFile, toast],
  )

  // ── Canvas capture helper ────────────────────────────────
  const captureCanvas = useCallback(async (): Promise<string | null> => {
    if (!containerRef.current) return null
    try {
      const dataUrl = await toPng(
        containerRef.current.querySelector('.react-flow') as HTMLElement,
        { backgroundColor: 'var(--color-canvas)', pixelRatio: 2 }
      )
      return dataUrl
    } catch (err) {
      console.error('Capture error:', err)
      return null
    }
  }, [containerRef])

  // ── Export PNG ───────────────────────────────────────────
  const handleExportPNG = useCallback(async () => {
    const dataUrl = await captureCanvas()
    if (!dataUrl) return
    try {
      const result = await window.electronAPI.exportPNG(dataUrl)
      if (result.success) toast.showToast('PNG 导出成功', 'success')
      else if (!result.canceled) toast.showToast('PNG 导出失败', 'error')
    } catch (err) {
      console.error('Export PNG error:', err)
      toast.showToast('PNG 导出失败', 'error')
    }
  }, [captureCanvas, toast])

  // ── Export PDF ───────────────────────────────────────────
  const handleExportPDF = useCallback(async () => {
    const dataUrl = await captureCanvas()
    if (!dataUrl) return
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      const img = new Image()
      img.src = dataUrl
      await new Promise<void>((resolve) => { img.onload = () => resolve() })

      const imgRatio = img.width / img.height
      let w = pageWidth - 40
      let h = w / imgRatio
      if (h > pageHeight - 40) {
        h = pageHeight - 40
        w = h * imgRatio
      }
      pdf.addImage(dataUrl, 'PNG', (pageWidth - w) / 2, (pageHeight - h) / 2, w, h)
      const pdfDataUrl = pdf.output('datauristring')

      const result = await window.electronAPI.exportPDF(pdfDataUrl)
      if (result.success) toast.showToast('PDF 导出成功', 'success')
      else if (!result.canceled) toast.showToast('PDF 导出失败', 'error')
    } catch (err) {
      console.error('Export PDF error:', err)
      toast.showToast('PDF 导出失败', 'error')
    }
  }, [captureCanvas, toast])

  return {
    handleNew,
    clearCanvas,
    handleNewSave,
    handleNewDiscard,
    handleNewCancel,
    handleSave,
    handleSaveAs,
    handleOpen,
    doOpen,
    handleOpenByPath,
    handleExportPNG,
    handleExportPDF,
  }
}
