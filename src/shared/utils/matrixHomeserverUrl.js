/**
 * Matrix Client-Server API 根路径（与 one 环境联动）
 * 各环境均通过 nginx 域名代理访问，路径为 {one域名}/kooky-api/api/client
 */
import { resolveOneEnvMapping } from '@/shared/utils/oneEnv.js'

export const MATRIX_HOMESERVER_DEV = 'https://one-dev.iflytek.com/kooky-api/api/client'

export const MATRIX_HOMESERVER_TEST = 'https://one-test.iflytek.com/kooky-api/api/client'

export const MATRIX_HOMESERVER_PROD = 'https://one.iflytek.com/kooky-api/api/client'

const ENV_URL_MAP = {
  dev: MATRIX_HOMESERVER_DEV,
  test: MATRIX_HOMESERVER_TEST,
  prod: MATRIX_HOMESERVER_PROD,
}

/**
 * 根据当前 one 环境返回对应的 Matrix homeserver 根路径（含 /api/client，无尾斜杠）。
 * 未识别的环境兜底使用生产地址。
 * @returns {string}
 */
export function getMatrixHomeserverBaseUrl() {
  const { effectiveEnv } = resolveOneEnvMapping()
  return ENV_URL_MAP[effectiveEnv] ?? MATRIX_HOMESERVER_PROD
}
