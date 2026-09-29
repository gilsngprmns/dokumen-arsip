import axios from 'axios'

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const apiBaseUrl = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:5000/api' : '')

if (!apiBaseUrl) {
  throw new Error('VITE_API_URL wajib dikonfigurasi untuk build production.')
}

if (import.meta.env.PROD && !apiBaseUrl.startsWith('https://')) {
  throw new Error('VITE_API_URL harus menggunakan HTTPS di production.')
}

const api = axios.create({
  baseURL: apiBaseUrl,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/'
    }
    return Promise.reject(error)
  },
)

export default api