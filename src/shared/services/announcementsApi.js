import api from './api'

export function getActiveAnnouncements() {
  return api.get('/kooky-api/api/announcements/active')
}

export function dismissAnnouncement(key) {
  return api.post(`/kooky-api/api/announcements/${key}/dismiss`)
}

export function getUserLeader() {
  return api.get('/kooky-api/api/users/me/leader')
}
