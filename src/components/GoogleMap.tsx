'use client'

import { useEffect, useRef, useState } from 'react'
import { LocateFixed } from 'lucide-react'

type Practitioner = {
  id: string
  name: string
  lat: number
  lng: number
}

type Props = {
  practitioners: Practitioner[]
  onSelect?: (id: string) => void
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any
    initGoogleMap?: () => void
  }
}

export default function GoogleMap({ practitioners, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  type PulsingOverlay = { setMap: (m: unknown) => void; setPosition: (p: { lat: number; lng: number }) => void }
  const overlayClassRef = useRef<(new (pos: { lat: number; lng: number }) => PulsingOverlay) | null>(null)
  const userOverlayRef = useRef<PulsingOverlay | null>(null)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey || !ref.current) return

    function initMap() {
      if (!ref.current) return
      const center = practitioners.length > 0
        ? { lat: practitioners[0].lat, lng: practitioners[0].lng }
        : { lat: 25.0330, lng: 121.5654 } // 台北市中心

      const map = new window.google.maps.Map(ref.current, {
        center,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })
      mapRef.current = map

      practitioners.forEach(p => {
        const marker = new window.google.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          map,
          title: p.name,
          icon: {
            path: 'M12 0C7.802 0 4 3.403 4 7.602C4 11.8 7.469 16.812 12 24C16.531 16.812 20 11.8 20 7.602C20 3.403 16.198 0 12 0ZM12 11C10.343 11 9 9.657 9 8C9 6.343 10.343 5 12 5C13.657 5 15 6.343 15 8C15 9.657 13.657 11 12 11Z',
            fillColor: '#1A1A1A',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
            scale: 2,
            anchor: new window.google.maps.Point(12, 24),
          },
        })

        const infoWindow = new window.google.maps.InfoWindow({
          content: `<div style="font-size:13px;font-weight:600;color:#2D2D2D">${p.name}</div>`,
        })

        marker.addListener('click', () => {
          infoWindow.open(map, marker)
          onSelect?.(p.id)
        })
      })

      class PulsingDotOverlay extends window.google.maps.OverlayView {
        private div: HTMLDivElement | null = null
        private position: { lat: number; lng: number }

        constructor(position: { lat: number; lng: number }) {
          super()
          this.position = position
        }

        onAdd() {
          const div = document.createElement('div')
          div.style.position = 'absolute'
          div.innerHTML = `
            <div style="position:relative;width:16px;height:16px;transform:translate(-50%,-50%)">
              <div style="position:absolute;inset:0;border-radius:50%;background:#378ADD;opacity:0.6;animation:prolink-pulse 1.6s ease-out infinite"></div>
              <div style="position:absolute;inset:3px;border-radius:50%;background:#378ADD;border:2px solid white;box-shadow:0 0 2px rgba(0,0,0,0.4)"></div>
            </div>
          `
          this.div = div
          this.getPanes()?.overlayMouseTarget.appendChild(div)
        }

        draw() {
          if (!this.div) return
          const point = this.getProjection()?.fromLatLngToDivPixel(
            new window.google.maps.LatLng(this.position.lat, this.position.lng)
          )
          if (point) {
            this.div.style.left = `${point.x}px`
            this.div.style.top = `${point.y}px`
          }
        }

        onRemove() {
          this.div?.parentNode?.removeChild(this.div)
          this.div = null
        }

        setPosition(pos: { lat: number; lng: number }) {
          this.position = pos
          this.draw()
        }
      }

      if (!document.getElementById('prolink-pulse-style')) {
        const style = document.createElement('style')
        style.id = 'prolink-pulse-style'
        style.textContent = `@keyframes prolink-pulse { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2.6); opacity: 0; } }`
        document.head.appendChild(style)
      }

      userOverlayRef.current = null
      overlayClassRef.current = PulsingDotOverlay as unknown as new (pos: { lat: number; lng: number }) => PulsingOverlay
    }

    if (window.google?.maps) {
      initMap()
    } else {
      window.initGoogleMap = initMap
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMap`
      script.async = true
      document.head.appendChild(script)
    }
  }, [practitioners, onSelect])

  function locateMe() {
    if (!navigator.geolocation) {
      setLocateError('此瀏覽器不支援定位')
      return
    }
    setLocating(true)
    setLocateError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const map = mapRef.current
        if (map) {
          map.panTo(coords)
          map.setZoom(15)
          const PulsingDotOverlay = overlayClassRef.current
          if (PulsingDotOverlay) {
            if (userOverlayRef.current) {
              userOverlayRef.current.setPosition(coords)
            } else {
              const overlay = new PulsingDotOverlay(coords)
              overlay.setMap(map)
              userOverlayRef.current = overlay
            }
          }
        }
        setLocating(false)
      },
      () => {
        setLocateError('無法取得目前位置，請確認已允許定位權限')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  return (
    <div className="relative w-full h-full">
      <div ref={ref} className="w-full h-full rounded-xl" />
      <button
        type="button"
        onClick={locateMe}
        disabled={locating}
        aria-label="定位目前位置"
        className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-accent active:scale-90 transition-all disabled:opacity-60"
      >
        <LocateFixed className={`w-4.5 h-4.5 text-foreground ${locating ? 'animate-pulse' : ''}`} />
      </button>
      {locateError && (
        <div className="absolute bottom-14 right-3 bg-white border border-border rounded-lg px-3 py-1.5 text-xs text-destructive shadow-sm max-w-[200px]">
          {locateError}
        </div>
      )}
    </div>
  )
}
