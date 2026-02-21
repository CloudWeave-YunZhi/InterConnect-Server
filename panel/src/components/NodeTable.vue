<template>
  <div class="node-table-container">
    <!-- 搜索和操作栏 -->
    <div class="table-toolbar">
      <div class="search-box">
        <el-input
          v-model="searchQuery"
          placeholder="搜索节点名称或UUID"
          clearable
          :prefix-icon="Search"
          style="width: 280px"
        />
      </div>
      <div class="action-buttons">
        <el-button
          type="primary"
          :icon="Plus"
          @click="$emit('create')"
        >
          新建节点
        </el-button>
        <el-button
          :icon="Refresh"
          @click="$emit('refresh')"
        >
          刷新
        </el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <el-table
      :data="paginatedData"
      style="width: 100%"
      v-loading="loading"
      stripe
      border
      highlight-current-row
    >
      <el-table-column type="index" label="#" width="60" align="center" />
      
      <el-table-column label="节点名称" min-width="150">
        <template #default="{ row }">
          <div class="node-name">
            <el-icon><Monitor /></el-icon>
            <span>{{ row.servername }}</span>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column label="UUID" min-width="280">
        <template #default="{ row }">
          <code class="uuid-code">{{ row.uuid }}</code>
        </template>
      </el-table-column>
      
      <el-table-column label="状态" width="120" align="center">
        <template #default="{ row }">
          <el-tag
            :type="row.stat === 1 ? 'success' : 'info'"
            effect="light"
            size="small"
          >
            <el-icon v-if="row.stat === 1" class="is-loading"><Loading /></el-icon>
            {{ row.stat === 1 ? '在线' : '离线' }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column label="创建时间" width="180" align="center">
        <template #default="{ row }">
          <span class="time-text">{{ formatDate(row.create_at) }}</span>
        </template>
      </el-table-column>
      
      <el-table-column label="操作" width="200" align="center" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.stat === 1"
            type="warning"
            size="small"
            :icon="CircleClose"
            @click="$emit('kick', row)"
          >
            踢下线
          </el-button>
          <el-button
            type="danger"
            size="small"
            :icon="Delete"
            @click="$emit('delete', row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="filteredData.length"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Search, Plus, Refresh, Monitor, Loading, CircleClose, Delete } from '@element-plus/icons-vue'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['create', 'refresh', 'kick', 'delete'])

const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(10)

// 过滤数据
const filteredData = computed(() => {
  if (!searchQuery.value) return props.data
  const query = searchQuery.value.toLowerCase()
  return props.data.filter(item => 
    item.servername?.toLowerCase().includes(query) ||
    item.uuid?.toLowerCase().includes(query)
  )
})

// 分页数据
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredData.value.slice(start, end)
})

// 搜索时重置页码
watch(searchQuery, () => {
  currentPage.value = 1
})

const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
}

const handleCurrentChange = (val) => {
  currentPage.value = val
}

const formatDate = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp * 1000)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.node-table-container {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.search-box {
  display: flex;
  gap: 12px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.node-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #2c3e50;
}

.node-name .el-icon {
  color: #27ae60;
}

.uuid-code {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: #606266;
  background: #f5f7fa;
  padding: 4px 8px;
  border-radius: 4px;
  word-break: break-all;
}

.time-text {
  font-size: 13px;
  color: #606266;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

:deep(.el-table) {
  border-radius: 8px;
  overflow: hidden;
}

:deep(.el-table__header th) {
  background-color: #f8f9fa !important;
  color: #2c3e50;
  font-weight: 600;
}

:deep(.el-tag) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.is-loading {
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
