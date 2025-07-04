# API调用配置说明

## 修正的问题

### 1. 使用官方SDK
- **修正前**: 使用`httpx`直接调用HTTP API
- **修正后**: 使用官方`volcengine-python-sdk[ark]`
- **优势**: 更稳定、更安全、官方维护

### 2. 模型参数配置
- **修正前**: `model: "doubao-1-5-pro-32k-250115"` (错误的模型名称)
- **修正后**: `model: "ep-20250228174015-wrzrt"` (正确的接入点ID)
- **说明**: model参数应使用接入点ID，而非模型名称

### 3. 语法错误修正
- **修正前**: `"stream": Ture` (拼写错误)
- **修正后**: 使用官方SDK，无需手动设置stream参数
- **修正前**: `model: ep-20250228174015-wrzrt,` (缺少引号)
- **修正后**: `model: "ep-20250228174015-wrzrt"`

## 当前配置

### 接入点信息
```python
# 接入点ID（用于API调用）
VOLCANO_ENDPOINT_ID = "ep-20250228174015-wrzrt"
# 对应的具体模型名称（用于前端展示）
VOLCANO_MODEL_NAME = "Doubao-1.5-pro-32k-250115"
```

### API调用示例
```python
from volcenginesdkarkruntime import Ark

client = Ark(
    base_url="https://ark.cn-beijing.volces.com/api/v3",
    api_key=os.environ.get("ARK_API_KEY")
)

completion = client.chat.completions.create(
    model="ep-20250228174015-wrzrt",  # 接入点ID
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "你好"}
    ],
    extra_headers={'x-is-encrypted': 'true'}  # 启用加密
)
```

## 返回数据结构

现在API返回的数据包含了模型信息：

```json
{
  "new_node_data": {
    "id": "节点ID",
    "question": "用户问题",
    "answer": "AI回答",
    "parent_node_id": "父节点ID",
    "created_at": "创建时间",
    "model_name": "Doubao-1.5-pro-32k-250115",  // 用于前端展示
    "endpoint_id": "ep-20250228174015-wrzrt"     // 接入点ID记录
  },
  "success": true,
  "message": "对话创建成功"
}
```

## 环境变量配置

确保`.env`文件中包含正确的API密钥：

```env
ARK_API_KEY=your_volcano_api_key_here
```

## 安全注意事项

1. **API密钥安全**: 确保API密钥存储在环境变量中，不要硬编码
2. **加密传输**: 已启用`x-is-encrypted`头部进行加密
3. **CORS配置**: 仅允许前端域名访问

## 流式输出支持

如需启用流式输出，可参考以下代码：

```python
stream = client.chat.completions.create(
    model="ep-20250228174015-wrzrt",
    messages=messages,
    extra_headers={'x-is-encrypted': 'true'},
    stream=True  # 启用流式输出
)

for chunk in stream:
    if not chunk.choices:
        continue
    print(chunk.choices[0].delta.content, end="")
```

## 故障排除

1. **API密钥错误**: 检查环境变量`ARK_API_KEY`是否正确设置
2. **接入点ID错误**: 确认使用正确的接入点ID而非模型名称
3. **网络问题**: 检查网络连接和防火墙设置
4. **依赖问题**: 确保安装了`volcengine-python-sdk[ark]`