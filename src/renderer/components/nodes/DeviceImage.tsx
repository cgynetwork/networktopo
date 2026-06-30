import { useState, useEffect } from 'react'

interface DeviceImageProps {
  imageBasename: string | undefined
}

/**
 * Loads and displays a device photo from the stored basename.
 * Falls back to a placeholder on error or while loading.
 */
export default function DeviceImage({ imageBasename }: DeviceImageProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!imageBasename) {
      setDataUrl(null)
      setLoading(false)
      setError(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(false)

    window.electronAPI
      .readDeviceImage(imageBasename)
      .then((result) => {
        if (cancelled) return
        if (result.success && result.dataUrl) {
          setDataUrl(result.dataUrl)
        } else {
          setError(true)
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [imageBasename])

  // No image to show
  if (!imageBasename) return null

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 144 }}>
        <div className="flex flex-col items-center gap-2 text-text-secondary">
          <div className="w-8 h-8 border-2 border-select-border border-t-transparent rounded-full animate-spin" />
          <span className="text-2xs">加载图片中...</span>
        </div>
      </div>
    )
  }

  // Error fallback
  if (error || !dataUrl) {
    return (
      <div className="flex items-center justify-center" style={{ height: 144 }}>
        <div className="flex flex-col items-center gap-1.5 text-text-secondary">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <span className="text-2xs">图片加载失败</span>
        </div>
      </div>
    )
  }

  // Success — show the uploaded image
  return (
    <div className="flex items-center justify-center px-2 py-2 bg-surface">
      <img
        src={dataUrl}
        alt="设备实拍图"
        className="rounded object-contain"
        style={{
          maxHeight: 144,
          maxWidth: '100%',
          border: '1px solid var(--color-border)',
        }}
      />
    </div>
  )
}
