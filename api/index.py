from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import os
from typing import Optional, List, Tuple, AsyncGenerator
import asyncio
import json
import logging
from datetime import datetime
from volcenginesdkarkruntime import Ark

# 配置日志记录
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Rootie Backend", version="1.0.0")

# CORS配置 - 允许Vercel域名
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # 本地开发
        "https://*.vercel.app",   # Vercel部署域名
        "https://rootie.vercel.app",  # 你的项目域名
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 数据模型
class ChatRequest(BaseModel):
    prompt: str
    parent_node_id: Optional[str] = None
    node_id: Optional[str] = None

class ChatResponse(BaseModel):
    new_node_data: dict
    success: bool
    message: str = ""

class DialogueNode(BaseModel):
    id: str
    user_prompt: str
    ai_response: str
    parent_node_id: Optional[str] = None
    created_at: str

# 临时存储（生产环境应使用数据库）
dialogue_nodes: List[DialogueNode] = []

# 火山引擎API配置
VOLCANO_ENDPOINT_ID = "ep-20250228174015-wrzrt"
VOLCANO_MODEL_NAME = "Doubao-1.5-pro-32k-250115"

def get_volcano_client():
    """获取火山引擎客户端"""
    api_key = get_api_key()
    return Ark(
        base_url="https://ark.cn-beijing.volces.com/api/v3",
        api_key=api_key
    )

def get_api_key():
    """获取API密钥"""
    api_key = os.getenv("ARK_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="API密钥未配置")
    return api_key

def build_context(parent_node_id: Optional[str]) -> List[dict]:
    """构建对话上下文"""
    logger.info(f"构建上下文，父节点ID: {parent_node_id}")
    logger.info(f"当前存储的节点数量: {len(dialogue_nodes)}")
    
    if not parent_node_id:
        logger.info("没有父节点，返回基础上下文")
        return [{"role": "system", "content": "You are a helpful assistant."}]
    
    context = [{"role": "system", "content": "You are a helpful assistant."}]
    
    def find_path_to_root(node_id: str) -> List[DialogueNode]:
        path = []
        current_id = node_id
        
        while current_id:
            node = next((n for n in dialogue_nodes if n.id == current_id), None)
            if not node:
                logger.warning(f"未找到节点ID: {current_id}")
                break
            path.append(node)
            current_id = node.parent_node_id
            logger.info(f"找到节点: {node.id}, 父节点: {node.parent_node_id}")
        
        return list(reversed(path))
    
    path = find_path_to_root(parent_node_id)
    logger.info(f"构建的对话路径长度: {len(path)}")
    
    for node in path:
        context.append({"role": "user", "content": node.user_prompt})
        context.append({"role": "assistant", "content": node.ai_response})
    
    logger.info(f"最终上下文长度: {len(context)}")
    return context

async def call_volcano_api_stream(messages: List[dict]) -> AsyncGenerator[str, None]:
    """调用火山引擎API（流式）"""
    try:
        client = get_volcano_client()
        
        stream = client.chat.completions.create(
            model=VOLCANO_ENDPOINT_ID,
            messages=messages,
            stream=True,
            extra_headers={'x-is-encrypted': 'true'}
        )
        
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"API调用失败: {str(e)}")

async def call_volcano_api(messages: List[dict]) -> Tuple[str, str]:
    """调用火山引擎API（非流式）"""
    try:
        client = get_volcano_client()
        
        completion = client.chat.completions.create(
            model=VOLCANO_ENDPOINT_ID,
            messages=messages,
            extra_headers={'x-is-encrypted': 'true'}
        )
        
        ai_response = completion.choices[0].message.content
        return ai_response, VOLCANO_MODEL_NAME
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"API调用失败: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Rootie Backend API is running on Vercel!"}

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """处理流式聊天请求"""
    try:
        context = build_context(request.parent_node_id)
        context.append({"role": "user", "content": request.prompt})
        
        import uuid
        new_node_id = request.node_id or str(uuid.uuid4())
        
        async def generate_response():
            full_response = ""
            
            init_data = {
                "type": "init",
                "node_id": new_node_id,
                "question": request.prompt,
                "parent_node_id": request.parent_node_id,
                "model_name": VOLCANO_MODEL_NAME,
                "endpoint_id": VOLCANO_ENDPOINT_ID
            }
            yield f"data: {json.dumps(init_data)}\n\n"
            
            try:
                async for chunk in call_volcano_api_stream(context):
                    full_response += chunk
                    chunk_data = {
                        "type": "chunk",
                        "content": chunk
                    }
                    yield f"data: {json.dumps(chunk_data)}\n\n"
                
                existing_node = next((n for n in dialogue_nodes if n.id == new_node_id), None)
                if existing_node:
                    logger.info(f"更新节点: {new_node_id}")
                    existing_node.user_prompt = request.prompt
                    existing_node.ai_response = full_response
                    existing_node.parent_node_id = request.parent_node_id
                    existing_node.created_at = datetime.now().isoformat()
                else:
                    logger.info(f"创建新节点: {new_node_id}")
                    new_node = DialogueNode(
                        id=new_node_id,
                        user_prompt=request.prompt,
                        ai_response=full_response,
                        parent_node_id=request.parent_node_id,
                        created_at=datetime.now().isoformat()
                    )
                    dialogue_nodes.append(new_node)
                
                complete_data = {
                    "type": "complete",
                    "full_response": full_response,
                    "created_at": datetime.now().isoformat()
                }
                yield f"data: {json.dumps(complete_data)}\n\n"
                
            except Exception as e:
                error_data = {
                    "type": "error",
                    "error": str(e)
                }
                yield f"data: {json.dumps(error_data)}\n\n"
        
        return StreamingResponse(
            generate_response(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            }
        )
        
    except Exception as e:
        logger.error(f"处理流式聊天请求时发生错误: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """处理非流式聊天请求"""
    try:
        context = build_context(request.parent_node_id)
        context.append({"role": "user", "content": request.prompt})
        
        ai_response, model_name = await call_volcano_api(context)
        
        import uuid
        new_node_id = str(uuid.uuid4())
        
        new_node = DialogueNode(
            id=new_node_id,
            user_prompt=request.prompt,
            ai_response=ai_response,
            parent_node_id=request.parent_node_id,
            created_at=datetime.now().isoformat()
        )
        
        dialogue_nodes.append(new_node)
        
        new_node_data = {
            "id": new_node_id,
            "question": request.prompt,
            "answer": ai_response,
            "parent_node_id": request.parent_node_id,
            "created_at": new_node.created_at,
            "model_name": model_name,
            "endpoint_id": VOLCANO_ENDPOINT_ID
        }
        
        return ChatResponse(
            new_node_data=new_node_data,
            success=True,
            message="对话创建成功"
        )
        
    except Exception as e:
        logger.error(f"处理聊天请求时发生错误: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/nodes")
async def get_all_nodes():
    """获取所有对话节点"""
    return {"nodes": [node.model_dump() for node in dialogue_nodes]}

@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Vercel需要的handler
handler = app