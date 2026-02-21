import axios from 'axios'

const API_BASE_URL = /* import.meta.env.VITE_API_BASE_URL || */ '/'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器 - 添加 Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 处理错误
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

// 登录 API
export async function login(password) {
  try {
    const response = await apiClient.post('/login', { password })
    return response.data
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('密码错误')
    } else if (error.response?.status === 429) {
      throw new Error('请求太频繁，请稍后再试')
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
