export function parseCityDistrict(address: string | null | undefined): string | null {
  if (!address) return null
  const match = address.match(/^(.{2,3}[市縣])(.{2,3}[區市鎮鄉])/)
  if (!match) return null
  return `${match[1]}, ${match[2]}`
}

export function parseCity(address: string | null | undefined): string | null {
  if (!address) return null
  const match = address.match(/^(.{2,3}[市縣])/)
  return match ? match[1] : null
}
