'use client'

import { useEffect, useRef } from 'react'

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

      practitioners.forEach(p => {
        const marker = new window.google.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          map,
          title: p.name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#FF6B6B',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
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

  return <div ref={ref} className="w-full h-full rounded-xl" />
}
