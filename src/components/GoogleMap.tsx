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
