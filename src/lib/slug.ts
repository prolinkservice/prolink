// 只能轉換英文/數字，中文名稱轉不出有意義的拼音，會變成空字串，由老師自己輸入
export function slugifySuggestion(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30)
}
