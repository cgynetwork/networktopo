import { useState, useCallback, type RefObject } from 'react'
import GIF from 'gif.js'
import gifWorkerUrl from 'gif.js/dist/gif.worker.js?url'
import type { ToastContextValue } from '../context/ToastContext'

interface UseGifExportOptions {
  /** Ref to the ReactFlow container div */
  containerRef: RefObject<HTMLDivElement | null>
  toast: ToastContextValue
}

interface UseGifExportReturn {
  isExportingGIF: boolean
  handleExportGIF: () => Promise<void>
}

export function useGifExport({
  containerRef,
  toast,
}: UseGifExportOptions): UseGifExportReturn {
  const [isExportingGIF, setIsExportingGIF] = useState(false)

  const handleExportGIF = useCallback(async () => {
    if (!containerRef.current || isExportingGIF) return
    const el = containerRef.current.querySelector('.react-flow') as HTMLElement
    if (!el) return

    setIsExportingGIF(true)
    try {
      const rect = el.getBoundingClientRect()
      if (rect.width < 50 || rect.height < 50) {
        toast.showToast('画布区域太小，无法导出 GIF', 'warning')
        setIsExportingGIF(false)
        return
      }

      const frameCount = 40
      const frameDelay = 55
      const gifQuality = 3

      const frames: HTMLCanvasElement[] = []
      let gifWidth = 0
      let gifHeight = 0
      const maxGifDim = 900

      for (let i = 0; i < frameCount; i++) {
        if (i > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, frameDelay))
        }

        const dataUrl = await window.electronAPI.captureFrame({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        })

        if (!dataUrl) {
          console.warn(`Frame ${i} capture failed, skipping`)
          continue
        }

        const frameImg = new Image()
        frameImg.src = dataUrl
        await new Promise<void>((resolve2, reject2) => {
          frameImg.onload = () => resolve2()
          frameImg.onerror = () => reject2(new Error('Frame load failed'))
        })

        if (i === 0) {
          const ratio = Math.min(maxGifDim / frameImg.width, maxGifDim / frameImg.height, 1)
          gifWidth = Math.round(frameImg.width * ratio)
          gifHeight = Math.round(frameImg.height * ratio)
        }

        const frameCanvas = document.createElement('canvas')
        frameCanvas.width = gifWidth
        frameCanvas.height = gifHeight
        const ctx = frameCanvas.getContext('2d')!
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(frameImg, 0, 0, gifWidth, gifHeight)
        frames.push(frameCanvas)
      }

      if (frames.length === 0) {
        toast.showToast('未能捕获任何帧，GIF 导出失败', 'error')
        setIsExportingGIF(false)
        return
      }

      console.log(`Captured ${frames.length} frames, ${gifWidth}x${gifHeight}`)

      const resultBlob = await new Promise<Blob>((resolve, reject) => {
        const gifEncoder = new GIF({
          workers: 2,
          workerScript: gifWorkerUrl,
          quality: gifQuality,
          width: gifWidth,
          height: gifHeight,
          repeat: 0,
          dither: true,
        })
        gifEncoder.on('finished', (blob: Blob) => resolve(blob))
        gifEncoder.on('error', (err: Error) => reject(err))
        frames.forEach((canvas) => {
          gifEncoder.addFrame(canvas, { delay: frameDelay, copy: true })
        })
        gifEncoder.render()
      })

      const gifDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(resultBlob)
      })

      const exportResult = await window.electronAPI.exportGIF(gifDataUrl)
      if (exportResult.success) toast.showToast('GIF 导出成功', 'success')
      else if (!exportResult.canceled) toast.showToast('GIF 导出失败', 'error')
    } catch (err) {
      console.error('Export GIF error:', err)
      toast.showToast('GIF 导出失败，请重试', 'error')
    } finally {
      setIsExportingGIF(false)
    }
  }, [isExportingGIF, containerRef, toast])

  return { isExportingGIF, handleExportGIF }
}
