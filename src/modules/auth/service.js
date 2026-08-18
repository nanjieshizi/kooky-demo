import api from '@/shared/services/api'

/**
 * Exchange SSO ticket for a token
 * @param {string} service - The service URL for callback
 * @returns {Promise} Token response
 */
export function exchangeTicket(service) {
  return api.get('/collab/server/auth/token', {
    params: {
      ticket: '',
      service,
      grant_type: 'client_credentials'
    }
  })
}

/**
 * Get current user info (placeholder)
 * @returns {Promise} User info response
 */
export function getUserInfo() {
  return api.get('/api/user/info')
}
