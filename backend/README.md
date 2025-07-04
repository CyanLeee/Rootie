# Rootie Backend

基于 FastAPI 的后端服务，提供 AI 问答和对话树管理功能。

## 功能特性

- 🤖 集成火山引擎 AI 模型服务
- 🌳 对话树结构管理
- 📝 上下文感知的对话历史
- 🔒 环境变量安全配置
- 🚀 高性能异步 API

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 环境配置

复制环境变量模板并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置你的火山引擎 API 密钥：

```ini
ARK_API_KEY=your-actual-api-key-here
```

### 3. 启动服务

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务将在 `http://localhost:8000` 启动。

## API 文档

启动服务后，访问以下地址查看 API 文档：

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 主要 API 端点

### POST /api/chat

发起新的对话请求。

**请求体：**
```json
{
  "prompt": "用户的问题",
  "parent_node_id": "父节点ID（可选）"
}
```

**响应：**
```json
{
  "new_node_data": {
    "id": "新节点ID",
    "question": "用户问题",
    "answer": "AI回答",
    "parent_node_id": "父节点ID",
    "created_at": "创建时间"
  },
  "success": true,
  "message": "对话创建成功"
}
```

### GET /api/nodes

获取所有对话节点。

### GET /api/health

健康检查端点。

## 环境变量说明

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `ARK_API_KEY` | 火山引擎 API 密钥 | 必填 |
| `ENVIRONMENT` | 运行环境 | development |
| `HOST` | 服务器主机 | 0.0.0.0 |
| `PORT` | 服务器端口 | 8000 |
| `ALLOWED_ORIGINS` | CORS 允许的源 | http://localhost:5173 |

## 项目结构

```
backend/
├── main.py              # 主应用文件
├── requirements.txt     # Python 依赖
├── .env.example        # 环境变量模板
├── .gitignore          # Git 忽略文件
└── README.md           # 项目说明
```

## 开发说明

### 数据存储

当前版本使用内存存储对话数据，重启服务后数据会丢失。生产环境建议集成 PostgreSQL 数据库。

### 火山引擎 API

- 使用模型：`doubao-1-5-pro-32k-250115`
- API 端点：`https://ark.cn-beijing.volces.com/api/v3/chat/completions`
- 支持上下文感知对话

### 安全注意事项

- 🔒 API 密钥通过环境变量管理，不要硬编码
- 🚫 `.env` 文件已加入 `.gitignore`，不会被提交
- ✅ 生产环境请使用 HTTPS

## 故障排除

### 常见问题

1. **API 密钥未配置**
   - 确保 `.env` 文件中设置了正确的 `ARK_API_KEY`

2. **CORS 错误**
   - 检查前端地址是否在 `ALLOWED_ORIGINS` 中

3. **依赖安装失败**
   - 确保使用 Python 3.8+ 版本
   - 建议使用虚拟环境

## 许可证

MIT License