import { useCallback, type RefObject } from 'react'
import type { Node, Edge, ReactFlowInstance } from '@xyflow/react'
import { jsPDF } from 'jspdf'
import type { EdgeData } from '../types'
import type { HistoryState } from './useHistory'
import type { ToastContextValue } from '../context/ToastContext'
import { migrateViewMode } from '../utils/rackUtils'
import { t } from '../i18n'

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
        toast.showToast(t('toast.fileSaved'), 'success')
        window.electronAPI.clearAutoSave().catch(() => {})
      } else if (!result.canceled && result.error) {
        toast.showToast(t('toast.fileSaveFailed', { error: result.error }), 'error')
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
        toast.showToast(t('toast.fileSaved'), 'success')
        window.electronAPI.clearAutoSave().catch(() => {})
      } else if (!result.canceled && result.error) {
        toast.showToast(t('toast.fileSaveFailed', { error: result.error }), 'error')
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
      toast.showToast(t('toast.fileOpened'), 'success')
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
      toast.showToast(t('toast.fileOpenFailed'), 'error')
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
        toast.showToast(t('toast.fileOpenFailed'), 'error')
      }
    },
    [loadTopoFile, toast],
  )

  // ── Image cropping helper ──────────────────────────────────
  // Maps content screen coordinates (relative to .react-flow) to
  // captured image pixels, then crops with padding.
  const cropImage = (
    dataUrl: string,
    reactFlowRect: { width: number; height: number },
    contentScreen: { x: number; y: number; width: number; height: number },
    paddingPx: number,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const scaleX = img.width / reactFlowRect.width
        const scaleY = img.height / reactFlowRect.height

        // Offset content coords to be relative to .react-flow origin
        const cx = contentScreen.x
        const cy = contentScreen.y
        const cw = contentScreen.width
        const ch = contentScreen.height

        const sx = Math.max(0, Math.round((cx - paddingPx) * scaleX))
        const sy = Math.max(0, Math.round((cy - paddingPx) * scaleY))
        const sw = Math.min(img.width - sx, Math.round((cw + paddingPx * 2) * scaleX))
        const sh = Math.min(img.height - sy, Math.round((ch + paddingPx * 2) * scaleY))

        const canvas = document.createElement('canvas')
        canvas.width = sw
        canvas.height = sh
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => reject(new Error('Crop image load failed'))
      img.src = dataUrl
    })
  }

  // ── Canvas capture helper ────────────────────────────────
  // Uses Electron native capturePage (not html-to-image) to correctly
  // render SVG elements with CSS variables, gradients, and animations.
  // Rect is computed in the renderer at the current zoom level and passed
  // to the main process — no zoomFactor manipulation, no coordinate mismatch.
  // After capture, the image is cropped to the content bounding box (auto-crop).
  const captureCanvas = useCallback(async (): Promise<string | null> => {
    if (!containerRef.current || !rfInstance) return null

    // Save current viewport to restore after capture
    const savedViewport = rfInstance.getViewport()
    let contentScreenBounds: { x: number; y: number; width: number; height: number } | null = null
    let reactFlowRect: { left: number; top: number; width: number; height: number } | null = null

    try {
      // Fit all nodes into view for full-canvas capture
      const allNodes = rfInstance.getNodes()
      if (allNodes.length > 0) {
        const bounds = rfInstance.getNodesBounds(allNodes)
        rfInstance.fitBounds(bounds, { padding: 0.1, duration: 0, maxZoom: 2, minZoom: 0.05 })
        // Wait for React to re-render with the new viewport
        await new Promise<void>(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })

        // Compute content bounds relative to .react-flow element
        // (same zoom level throughout — coordinates are consistent)
        const elForBounds = containerRef.current.querySelector('.react-flow') as HTMLElement
        if (elForBounds) {
          const rfRect = elForBounds.getBoundingClientRect()
          const topLeft = rfInstance.flowToScreenPosition({ x: bounds.x, y: bounds.y })
          const bottomRight = rfInstance.flowToScreenPosition({
            x: bounds.x + bounds.width,
            y: bounds.y + bounds.height,
          })
          contentScreenBounds = {
            x: topLeft.x - rfRect.left,
            y: topLeft.y - rfRect.top,
            width: bottomRight.x - topLeft.x,
            height: bottomRight.y - topLeft.y,
          }
        }
      }

      // Get the .react-flow element (same zoom level as contentScreenBounds)
      const el = containerRef.current.querySelector('.react-flow') as HTMLElement
      if (!el) return null
      reactFlowRect = el.getBoundingClientRect()
      if (reactFlowRect.width < 10 || reactFlowRect.height < 10) return null

      // Hide ReactFlow overlay widgets (MiniMap, Controls, Background) via CSS class
      el.classList.add('react-flow--capturing')
      // Wait a frame for the browser to apply the CSS rule before capture
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })

      try {
        // Capture with rect — main process does NOT change zoomFactor,
        // so the captured image matches reactFlowRect/ contentScreenBounds exactly
        const captureRect = {
          x: Math.round(reactFlowRect.left),
          y: Math.round(reactFlowRect.top),
          width: Math.round(reactFlowRect.width),
          height: Math.round(reactFlowRect.height),
        }
        const dataUrl = await window.electronAPI.captureCanvas(captureRect)
        if (!dataUrl) return null

        // Auto-crop to content bounds (with padding) if we have bounds
        if (contentScreenBounds) {
          return await cropImage(dataUrl, reactFlowRect, contentScreenBounds, 24)
        }
        return dataUrl
      } finally {
        // Always restore overlay visibility even if capture fails
        el.classList.remove('react-flow--capturing')
      }
    } catch (err) {
      console.error('Capture error:', err)
      return null
    } finally {
      // Restore original viewport
      rfInstance.setViewport(savedViewport, { duration: 0 })
    }
  }, [containerRef, rfInstance])

  // ── Export PNG ───────────────────────────────────────────
  const handleExportPNG = useCallback(async () => {
    const dataUrl = await captureCanvas()
    if (!dataUrl) return
    try {
      const result = await window.electronAPI.exportPNG(dataUrl)
      if (result.success) toast.showToast(t('toast.pngExportSuccess'), 'success')
      else if (!result.canceled) toast.showToast(t('toast.pngExportFailed'), 'error')
    } catch (err) {
      console.error('Export PNG error:', err)
      toast.showToast(t('toast.pngExportFailed'), 'error')
    }
  }, [captureCanvas, toast])

  // ── Export PDF ───────────────────────────────────────────
  const handleExportPDF = useCallback(async () => {
    const dataUrl = await captureCanvas()
    if (!dataUrl) return
    try {
      // Load captured PNG to get its natural dimensions
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('Failed to load captured image'))
        image.src = dataUrl
        // Timeout after 30 seconds to prevent hanging
        setTimeout(() => reject(new Error('Image load timed out')), 30000)
      })

      // Auto-select orientation based on image aspect ratio
      const imgRatio = img.width / img.height
      const orientation = imgRatio >= 1 ? 'landscape' : 'portrait'

      const pdf = new jsPDF({ orientation, unit: 'px' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      // Scale image to fit page with 40px margins, maintaining aspect ratio
      let w = pageWidth - 40
      let h = w / imgRatio
      if (h > pageHeight - 40) {
        h = pageHeight - 40
        w = h * imgRatio
      }
      pdf.addImage(dataUrl, 'PNG', (pageWidth - w) / 2, (pageHeight - h) / 2, w, h)

      // Use arraybuffer output + manual base64 encoding to avoid
      // jsPDF 4.x datauristring format incompatibility (extra ;filename= param)
      const buf = pdf.output('arraybuffer')
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const pdfDataUrl = 'data:application/pdf;base64,' + btoa(binary)

      const result = await window.electronAPI.exportPDF(pdfDataUrl)
      if (result.success) toast.showToast(t('toast.pdfExportSuccess'), 'success')
      else if (!result.canceled) toast.showToast(t('toast.pdfExportFailed'), 'error')
    } catch (err) {
      console.error('Export PDF error:', err)
      toast.showToast(t('toast.pdfExportFailed'), 'error')
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
