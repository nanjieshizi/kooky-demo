/**
 * 登录/接口的 one 环境切换（one-dev、one-test、one）
 * 选择结果存 localStorage，供登录流程与 api baseURL 使用
 */

const ONE_ENV_KEY = "one_env";

export const ENV_OPTIONS = [
  { label: "开发", value: "dev", baseUrl: "https://one-dev.iflytek.com" },
  { label: "测试", value: "test", baseUrl: "https://one-test.iflytek.com" },
  { label: "生产", value: "prod", baseUrl: "https://one.iflytek.com" },
];

const BASE_MAP = Object.fromEntries(
  ENV_OPTIONS.map((e) => [e.value, e.baseUrl])
);

/**
 * 从当前 BASEDB.VITE_BASE_URL 推断环境
 */
function inferEnvFromConfig() {
  if (typeof window === "undefined" || !window.BASEDB?.VITE_BASE_URL)
    return null;
  const url = (window.BASEDB.VITE_BASE_URL || "").replace(/\/$/, "");
  const entry = ENV_OPTIONS.find((e) => e.baseUrl === url);
  return entry ? entry.value : null;
}

export function getOneEnv() {
  // 不展示环境选择（生产部署）时固定为 prod，忽略 localStorage 里可能残留的 dev/test
  if (isProductionDeployment()) return "prod";
  if (typeof localStorage === "undefined") return inferEnvFromConfig() || "dev";
  const v = localStorage.getItem(ONE_ENV_KEY);
  if (BASE_MAP[v]) return v;
  return inferEnvFromConfig() || "dev";
}

export function setOneEnv(env) {
  if (typeof localStorage === "undefined") return;
  if (BASE_MAP[env]) {
    const prev = localStorage.getItem(ONE_ENV_KEY);
    localStorage.setItem(ONE_ENV_KEY, env);
    // 环境切换时清空云端文件树缓存，防止新环境看到旧环境数据
    if (prev !== env) {
      import("@/modules/file/store")
        .then(({ useFileStore }) => {
          const fileStore = useFileStore();
          fileStore.cloudTree.nodeCache = {};
          fileStore.cloudTree.expandedNodeIds = [];
          fileStore.cloudTree.loadingNodeIds = [];
          fileStore.quotaInfo = {};
        })
        .catch(() => {});
    }
  }
}

/**
 * 是否为生产部署
 * 判断逻辑：
 * 1. 如果设置了 VITE_SHOW_ENV_SWITCH 环境变量，以其为准
 *    - VITE_SHOW_ENV_SWITCH=false 时视为生产部署（不显示环境切换）
 *    - VITE_SHOW_ENV_SWITCH=true 时视为非生产部署（显示环境切换）
 * 2. 否则根据域名判断：one.iflytek.com 视为生产部署
 */
export function isProductionDeployment() {
  // 优先使用环境变量控制
  const envSwitch = import.meta.env?.VITE_SHOW_ENV_SWITCH;
  if (envSwitch !== undefined && envSwitch !== "") {
    return envSwitch === "false" || envSwitch === false;
  }
  // 兜底：根据域名判断
  if (typeof window === "undefined" || !window.location?.hostname) return false;
  return window.location.hostname === "one.iflytek.com";
}

/**
 * 当前 one 域名 base（无尾斜杠）
 * 未选择时使用 window.BASEDB.VITE_BASE_URL，再兜底 one-dev
 */
export function getOneBaseUrl() {
  // 仅 vite --mode devlocal：本地网关（deer-flow / kooky-api），不影响其他 mode
  const localGateway =
    typeof import.meta !== "undefined" &&
    import.meta.env?.MODE === "devlocal" &&
    import.meta.env?.VITE_LOCAL_GATEWAY_URL;
  if (localGateway && String(localGateway).trim()) {
    return String(localGateway).replace(/\/$/, "");
  }
  const env = getOneEnv();
  if (env) return BASE_MAP[env].replace(/\/$/, "");
  const fromConfig =
    typeof window !== "undefined" &&
    window.BASEDB &&
    window.BASEDB.VITE_BASE_URL;
  return (fromConfig || "https://one-dev.iflytek.com").replace(/\/$/, "");
}

/**
 * env ↔ baseUrl 映射及运行时 BASEDB 解析（数据源与 getOneEnv / getOneBaseUrl 一致，不替代二者逻辑）
 * @returns {{
 *   envToBase: Record<string, string>,
 *   baseToEnv: Record<string, string>,
 *   runtimeBaseUrl: string | null,
 *   inferredEnvFromRuntime: string | null,
 *   effectiveEnv: string
 * }}
 */
export function resolveOneEnvMapping() {
  const envToBase = { ...BASE_MAP };
  const baseToEnv = Object.fromEntries(
    ENV_OPTIONS.map((e) => [String(e.baseUrl).replace(/\/$/, ""), e.value])
  );
  let runtimeBaseUrl = null;
  if (typeof window !== "undefined" && window.BASEDB?.VITE_BASE_URL) {
    runtimeBaseUrl = String(window.BASEDB.VITE_BASE_URL).replace(/\/$/, "");
  }
  const inferredEnvFromRuntime = runtimeBaseUrl
    ? baseToEnv[runtimeBaseUrl] ?? null
    : null;
  const effectiveEnv = getOneEnv();
  return {
    envToBase,
    baseToEnv,
    runtimeBaseUrl,
    inferredEnvFromRuntime,
    effectiveEnv,
  };
}
