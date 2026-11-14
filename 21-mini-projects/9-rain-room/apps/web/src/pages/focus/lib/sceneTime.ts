export function formatSceneTime(date: Date): string {
  const hours = date.getHours()
  return `${String(hours % 12 || 12).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`
}
