const avatarModules = import.meta.glob('../assets/skill/*.png', { eager: true })
const avatarAgentModules = import.meta.glob('../assets/agent/*.png', { eager: true })


export function generateDefaultAvatars(type) {
  if(type==='agent') return Object.values(avatarAgentModules).map((mod) => mod.default)
  return Object.values(avatarModules).map((mod) => mod.default)
}