<template>
  <div class="dashboard-container">
    <!-- 顶部导航栏 -->
    <header class="top-header">
      <div class="header-left">
        <div class="brand">
          <el-icon :size="28" color="#27ae60"><Connection /></el-icon>
          <span>InterConnect</span>
        </div>
      </div>
      <div class="header-right">
        <el-dropdown @command="handleCommand">
          <div class="user-info">
            <el-avatar :size="32" :icon="UserFilled" class="user-avatar" />
            <span class="username">管理员</span>
            <el-icon><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">
                <el-icon><SwitchButton /></el-icon>
                退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 统计卡片 -->
      <div class="stats-row">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon online">
            <el-icon :size="24"><CircleCheck /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value" style="color: #27ae60;">{{ stats.online }}</div>
            <div class="stat-label">在线节点</div>
          </div>
        </el-card>
        
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon offline">
            <el-icon :size="24"><CircleClose /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value" style="color: #95a5a6;">{{ stats.offline }}</div>
            <div class="stat-label">离线节点</div>
          </div>
        </el-card>
        
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon total">
            <el-icon :size="24"><DataLine /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value" style="color: #e67e22;">{{ stats.total }}</div>
            <div class="stat-label">节点总数</div>
          </div>
        </el-card>
      </div>

      <!-- 节点列表 -->
      <el-card class="table-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span class="card-title">
              <el-icon><List /></el-icon>
              节点管理
            </span>
          </div>
        </template>
        
        <NodeTable
          :data="nodeList"
          :loading="loading"
          @create="showCreateDialog"
          @refresh="fetchData"
          @kick="handleKick"
          @delete="handleDelete"
        />
      </el-card>
    </main>

    <!-- 新建节点对话框 -->
    <el-dialog
      v-model="createDialogVisible"
      title="新建节点"
      width="500px"
      destroy-on-close
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="100px"
      >
        <el-form-item label="节点名称" prop="servername">
          <el-input
            v-model="createForm.servername"
            placeholder="请输入节点名称（如：mc-server-01）"
          />
        </el-form-item>
      </el-form>
      
      <!-- 创建结果展示 -->
      <div v-if="createResult" class="create-result">
        <el-alert
          type="success"
          :closable="false"
          show-icon
        >
          <template #title>
            <div>节点创建成功！请妥善保存以下信息：</div>
          </template>
        </el-alert>
        <div class="result-content">
          <div class="result-item">
            <label>Token：</label>
            <div class="result-value">
              <code>{{ createResult.token }}</code>
              <el-button
                type="primary"
                link
                :icon="DocumentCopy"
                @click="copyText(createResult.token)"
              >
                复制
              </el-button>
            </div>
          </div>
          <div class="result-item">
            <label>UUID：</label>
            <div class="result-value">
              <code>{{ createResult.uuid }}</code>
              <el-button
                type="primary"
                link
                :icon="DocumentCopy"
                @click="copyText(createResult.uuid)"
              >
                复制
              </el-button>
            </div>
          </div>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="createDialogVisible = false">关闭</el-button>
        <el-button
          v-if="!createResult"
          type="primary"
          :loading="creating"
          @click="submitCreate"
        >
          创建
        </el-button>
        <el-button
          v-else
          type="primary"
          @click="resetCreate"
        >
          继续创建
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Connection,
  UserFilled,
  ArrowDown,
  SwitchButton,
  CircleCheck,
  CircleClose,
  DataLine,
  List,
  DocumentCopy
} from '@element-plus/icons-vue'
import NodeTable from '../components/NodeTable.vue'
import { getNodeList, createNode, deleteNode, kickNode } from '../api'

const router = useRouter()

// 数据
const nodeList = ref([])
const loading = ref(false)
const createDialogVisible = ref(false)
const creating = ref(false)
const createFormRef = ref()
const createResult = ref(null)

const createForm = reactive({
  servername: ''
})

const createRules = {
  servername: [
    { required: true, message: '请输入节点名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
  ]
}

// 统计
const stats = computed(() => {
  const online = nodeList.value.filter(n => n.stat === 1).length
  return {
    online,
    offline: nodeList.value.length - online,
    total: nodeList.value.length
  }
})

// 获取数据
const fetchData = async () => {
  loading.value = true
  try {
    const res = await getNodeList()
    if (res.success) {
      nodeList.value = res.data || []
    }
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}

// 显示创建对话框
const showCreateDialog = () => {
  createDialogVisible.value = true
  createResult.value = null
  createForm.servername = ''
}

// 提交创建
const submitCreate = async () => {
  if (!createFormRef.value) return
  
  try {
    await createFormRef.value.validate()
    creating.value = true
    
    const res = await createNode(createForm.servername)
    if (res.success) {
      createResult.value = res.data
      fetchData()
    }
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    creating.value = false
  }
}

// 重置创建
const resetCreate = () => {
  createResult.value = null
  createForm.servername = ''
}

// 复制文本
const copyText = (text) => {
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

// 踢下线
const handleKick = (row) => {
  ElMessageBox.confirm(
    `确定要将节点 "${row.servername}" 踢下线吗？`,
    '确认操作',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await kickNode(row.servername)
      ElMessage.success('已踢下线')
      fetchData()
    } catch (error) {
      ElMessage.error(error.message)
    }
  }).catch(() => {})
}

// 删除节点
const handleDelete = (row) => {
  ElMessageBox.confirm(
    `确定要删除节点 "${row.servername}" 吗？此操作不可恢复！`,
    '警告',
    {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'error'
    }
  ).then(async () => {
    try {
      await deleteNode(row.servername)
      ElMessage.success('删除成功')
      fetchData()
    } catch (error) {
      ElMessage.error(error.message)
    }
  }).catch(() => {})
}

// 下拉菜单命令
const handleCommand = (command) => {
  if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'info'
    }).then(() => {
      localStorage.removeItem('admin_token')
      router.push('/login')
      ElMessage.success('已退出登录')
    }).catch(() => {})
  }
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  background: #f5f7fa;
}

.top-header {
  height: 64px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left .brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 600;
  color: #2c3e50;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.3s;
}

.user-info:hover {
  background: #f5f7fa;
}

.user-avatar {
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%) !important;
}

.username {
  font-size: 14px;
  color: #606266;
}

.main-content {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  :deep(.el-card__body) {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
  }
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon.online {
  background: #e8f8f0;
  color: #27ae60;
}

.stat-icon.offline {
  background: #f4f6f7;
  color: #95a5a6;
}

.stat-icon.total {
  background: #fef3e2;
  color: #e67e22;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 6px;
}

.table-card {
  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid #e8e8e8;
  }
  
  :deep(.el-card__body) {
    padding: 0;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title .el-icon {
  color: #27ae60;
}

.create-result {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px dashed #dcdfe6;
}

.result-content {
  margin-top: 16px;
}

.result-item {
  margin-bottom: 16px;
}

.result-item label {
  display: block;
  font-size: 13px;
  color: #606266;
  margin-bottom: 6px;
}

.result-value {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f5f7fa;
  padding: 8px 12px;
  border-radius: 6px;
}

.result-value code {
  flex: 1;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: #2c3e50;
  word-break: break-all;
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
