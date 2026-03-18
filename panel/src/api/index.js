import axios from 'axios'

const API_BASE_STORAGE_KEY = 'admin_api_base_url'

function getApiBaseUrl() {
  return localStorage.getItem(API_BASE_STORAGE_KEY) || '/'
}

const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器：自动附带 Token 和动态 baseURL
apiClient.interceptors.request.use(
  (config) => {
    config.baseURL = getApiBaseUrl()
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器：401 统一跳登录
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token')
      window.location.href = '/admin/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient

// 登录
export async function login(password) {
  try {
    const response = await apiClient.post('/login', { password })
    return response.data
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('密码错误')
    } else if (error.response?.status === 429) {
      throw new Error('请求过于频繁，请稍后再试')
    } else {
      throw new Error(error.response?.data?.error || '登录失败')
    }
  }
}

// 获取节点列表
export async function getNodeList() {
  try {
    const response = await apiClient.get('/manager/keys')
    return response.data
  } catch (error) {
    throw new Error(error.response?.data?.error || '获取节点列表失败')
  }
}

// 创建/重置节点
export async function createNode(servername) {
  try {
    const response = await apiClient.post(`/manager/keys/${encodeURIComponent(servername)}`)
    return response.data
  } catch (error) {
    throw new Error(error.response?.data?.error || '创建节点失败')
  }
}

// 删除节点
export async function deleteNode(servername) {
  try {
    const response = await apiClient.delete(`/manager/keys/${encodeURIComponent(servername)}`)
    return response.data
  } catch (error) {
    throw new Error(error.response?.data?.error || '删除节点失败')
  }
}

// 踢下线节点
export async function kickNode(servername) {
  try {
    const response = await apiClient.post(`/manager/kick/${encodeURIComponent(servername)}`)
    return response.data
  } catch (error) {
    throw new Error(error.response?.data?.error || '踢下线失败')
  }
}
