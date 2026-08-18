const DOWNLOAD_LINK_RE = /\/(artifacts|uploads)\//i
const FILE_LINK_RE = /\.(md|txt|pdf|docx?|xlsx?|csv|json|yaml|yml|xml|py|js|ts|html|css|sh|png|jpg|jpeg|gif|svg|zip|tar|gz)(\?.*)?$/i

export function stripMessageDownloadLinks(html) {
  return String(html || '').replace(
    /<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (match, href, content) => {
      if (!href.startsWith('http://') && !href.startsWith('https://')) return content
      if (DOWNLOAD_LINK_RE.test(href)) return content
      if (FILE_LINK_RE.test(href)) return content
      return match
    },
  )
}
