/**
 * 消息气泡内链接点击：Electron 下载或外开，Web 新开页
 * @param {MouseEvent} e
 */
export function handleMessageContentLinkClick(e) {
  const anchor = e.target.closest('a[href]')
  if (!anchor) return
  const href = anchor.getAttribute('href')
  if (!href || href.startsWith('#')) return
  e.preventDefault()

  const isDownload =
    anchor.hasAttribute('download') ||
    /\.(zip|tar\.gz|tar|gz|exe|dmg|pkg|deb|rpm|pdf|docx?|xlsx?|pptx?|csv|apk|ipa|md|txt|json|yaml|yml|xml|html|htm|sh|py|js|ts|java|go|rs|c|cpp|h)(\?|$)/i.test(
      href,
    )

  if (window.electronAPI) {
    if (isDownload) window.electronAPI.downloadURL(href)
    else window.electronAPI.openExternal(href)
  } else {
    window.open(href, '_blank', 'noopener,noreferrer')
  }
}
