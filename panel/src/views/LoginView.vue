<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <div class="logo">
          <el-icon :size="48" color="#27ae60"><Connection /></el-icon>
        </div>
        <h1>InterConnect</h1>
        <p>服务器管理面板</p>
      </div>
      
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        class="login-form"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="password">
          <el-input
            v-model="formData.password"
            type="password"
            placeholder="请输入管理员密码"
            :prefix-icon="Lock"
            size="large"
            show-password
          />
        </el-form-item>
        
        <el-button
          type="primary"
          size="large"
          class="login-btn"
          :loading="loading"
          @click="handleLogin"
        >
          登 录
        </el-button>
      </el-form>
      
      <div class="login-footer">
        <p>安全访问 · 受保护区域</p>
      </div>
    </div>
    
    <!-- 装饰背景 -->
    <div class="bg-decoration bg-1"></div>
    <div class="bg-decoration bg-2"></div>
    <div class="bg-decoration bg-3"></div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Lock, Connection } from '@element-plus/icons-vue'
import { login } from '../api'

const router = useRouter()
const formRef = ref()
const loading = ref(false)

const formData = reactive({
  password: ''
})

const rules = {
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 1, message: '密码不能为空', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    loading.value = true
    
    const result = await login(formData.password)
    
    if (result.success && result.token) {
      localStorage.setItem('admin_token', result.token)
      ElMessage.success('登录成功')
      router.push('/dashboard')
    } else {
      ElMessage.error(result.error || '登录失败')
    }
  } catch (error) {
    ElMessage.error(error.message || '网络错误')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8f8f0 50%, #fef3e2 100%);
  position: relative;
  overflow: hidden;
}

.login-box {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 48px 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(39, 174, 96, 0.15);
  backdrop-filter: blur(10px);
  position: relative;
  z-index: 10;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  box-shadow: 0 8px 24px rgba(39, 174, 96, 0.3);
}

.login-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 8px;
}

.login-header p {
  font-size: 14px;
  color: #7f8c8d;
}

.login-form {
  margin-top: 24px;
}

.login-btn {
  width: 100%;
  margin-top: 8px;
  height: 48px;
  font-size: 16px;
  font-weight: 500;
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
  border: none;
  box-shadow: 0 4px 16px rgba(39, 174, 96, 0.3);
  transition: all 0.3s ease;
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(39, 174, 96, 0.4);
}

.login-footer {
  margin-top: 24px;
  text-align: center;
}

.login-footer p {
  font-size: 12px;
  color: #95a5a6;
}

/* 背景装饰 */
.bg-decoration {
  position: absolute;
  border-radius: 50%;
  opacity: 0.4;
}

.bg-1 {
  width: 400px;
  height: 400px;
  background: linear-gradient(135deg, #27ae60 0%, #52d681 100%);
  top: -100px;
  right: -100px;
  filter: blur(60px);
}

.bg-2 {
  width: 300px;
  height: 300px;
  background: linear-gradient(135deg, #e67e22 0%, #f39c12 100%);
  bottom: -50px;
  left: -50px;
  filter: blur(50px);
}

.bg-3 {
  width: 200px;
  height: 200px;
  background: linear-gradient(135deg, #52d681 0%, #27ae60 100%);
  top: 50%;
  left: 10%;
  filter: blur(80px);
  opacity: 0.2;
}

:deep(.el-input__wrapper) {
  border-radius: 8px;
  padding: 4px 12px;
}

:deep(.el-input__inner) {
  height: 44px;
}
</style>
