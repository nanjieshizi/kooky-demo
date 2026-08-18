import { isDevlocalMode } from '@/shared/utils/devlocalUser'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'

const K_PREFIX = '/kooky-api'
/** DeerFlow Gateway 直连无 nginx 时：与 `rewrite ^/api/langgraph-compat/(.*) /api/$1` 对齐 */
const LANGGRAPH_COMPAT_PREFIX = '/api/langgraph-compat/'

/**
 * devlocal 直连 Gateway：去掉 `/kooky-api`，并把 `/api/langgraph-compat/` 改为 `/api/`。
 * @param {string} path - 请求路径或 URL pathname
 */
function rewriteDevlocalKookyGatewayPath(path) {
  if (!path || typeof path !== 'string') return path
  let p = path
  if (p === K_PREFIX || p.startsWith(`${K_PREFIX}/`)) {
    p = p === K_PREFIX ? '/' : p.slice(K_PREFIX.length)
  }
  if (p.startsWith(LANGGRAPH_COMPAT_PREFIX)) {
    return `/api/${p.slice(LANGGRAPH_COMPAT_PREFIX.length)}`
  }
  if (p === '/api/langgraph-compat') return '/api'
  return p
}

/**
 * devlocal 下网关无 /kooky-api 前缀：将 `/kooky-api/...` 或绝对 URL 中的该段去掉；
 * 并将 `/api/langgraph-compat/...` 改写为 `/api/...`（直连 8001 与经 nginx 行为一致）。
 * @param {string} [url]
 * @returns {string|undefined}
 */
export function normalizeKookyApiAxiosUrl(url) {
  if (!isDevlocalMode() || url == null || typeof url !== 'string') return url
  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url)
      u.pathname = rewriteDevlocalKookyGatewayPath(u.pathname || '')
      return u.toString()
    } catch {
      return url
    }
  }
  return rewriteDevlocalKookyGatewayPath(url)
}

/**
 * 将 `/kooky-api/api/...` 拼成访问网关的绝对 URL。
 * devlocal：去掉 `/kooky-api`，并把 `/api/langgraph-compat/` 改为 `/api/`。
 * @param {string} path - 以 / 开头，通常为 `/kooky-api/api/...`
 */
export function absoluteKookyPublicUrl(path) {
  const base = getOneBaseUrl().replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  if (isDevlocalMode()) {
    const tail = p.startsWith(`${K_PREFIX}/`) ? p.slice(K_PREFIX.length) : p
    return `${base}${rewriteDevlocalKookyGatewayPath(tail)}`
  }
  if (p.startsWith(`${K_PREFIX}/`)) return `${base}${p}`
  return `${base}${K_PREFIX}${p}`
}
