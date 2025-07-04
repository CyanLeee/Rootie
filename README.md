# Rootie - AI对话树应用

一个基于React和FastAPI的AI对话树应用，支持分支对话和流式响应。

## 功能特性

- 🌳 **对话树结构**: 支持创建分支对话，形成树状对话结构
- 🔄 **流式响应**: 实时显示AI回复内容
- 🎨 **可视化界面**: 基于React Flow的直观对话流程图
- 🚀 **现代技术栈**: React + TypeScript + FastAPI + 火山引擎API

## 技术栈

### 前端
- React 18
- TypeScript
- Vite
- React Flow
- Tailwind CSS

### 后端
- FastAPI
- Python 3.8+
- 火山引擎API
- Uvicorn

## 部署到Vercel

### 自动部署

1. Fork此仓库到你的GitHub账户
2. 在Vercel中导入项目
3. 配置环境变量（见下方）
4. 点击部署

### 环境变量配置

在Vercel项目设置中添加以下环境变量：

```
VOLCANO_API_KEY=your_volcano_api_key_here
VOLCANO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VOLCANO_MODEL=ep-20241218152634-xxxxx
```

### 本地开发

1. 克隆仓库：
```bash
git clone https://github.com/CyanLeee/Rootie.git
cd Rootie
```

2. 安装前端依赖：
```bash
cd frontend
npm install
```

3. 安装后端依赖：
```bash
cd ../backend
pip install -r requirements.txt
```

4. 配置环境变量：
```bash
# 在backend目录下创建.env文件
VOLCANO_API_KEY=your_api_key
VOLCANO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VOLCANO_MODEL=your_model_endpoint
```

5. 启动后端服务：
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

6. 启动前端服务：
```bash
cd frontend
npm run dev
```

## 项目结构

```
Rootie/
├── frontend/          # React前端应用
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/           # FastAPI后端应用
│   ├── main.py
│   └── requirements.txt
├── api/              # Vercel Serverless函数
│   └── index.py
├── vercel.json       # Vercel配置文件
└── README.md
```

## API文档

部署后，可以访问 `/api/docs` 查看自动生成的API文档。

## 许可证

MIT License