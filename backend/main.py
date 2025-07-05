from fastapi import FastAPI, HTTPException, Depends
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
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from models import DialogueGraph, DialogueNode, get_db
import uuid

# 加载 .env 文件中的环境变量
load_dotenv()

# 配置日志记录
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Rootie Backend", version="1.0.0")

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite默认端口
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 数据模型
class DialogueNodeModel(BaseModel):
    id: str
    user_prompt: str
    ai_response: str
    parent_node_id: Optional[str] = None
    created_at: str
    position_x: Optional[float] = None
    position_y: Optional[float] = None

class ChatRequest(BaseModel):
    prompt: str
    parent_node_id: Optional[str] = None
    node_id: Optional[str] = None  # 前端传递的当前节点ID
    nodes: List[DialogueNodeModel]  # 前端传递的完整节点列表
    graph_id: Optional[str] = None  # 对话图谱ID

class ChatResponse(BaseModel):
    new_node_data: dict
    success: bool
    message: str = ""

class CreateGraphRequest(BaseModel):
    title: str
    description: Optional[str] = None

class GraphResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    created_at: str
    updated_at: str

class SaveGraphRequest(BaseModel):
    graph_id: str
    nodes: List[DialogueNodeModel]
    edges: List[dict]  # 边的信息

class LoadGraphResponse(BaseModel):
    graph: GraphResponse
    nodes: List[DialogueNodeModel]
    edges: List[dict]

# 火山引擎API配置
# 从环境变量加载火山引擎配置，并提供默认值
# 接入点ID（用于API调用）
VOLCANO_ENDPOINT_ID = os.getenv("VOLCANO_ENDPOINT_ID", "ep-20250228174015-wrzrt")
# 对应的具体模型名称（用于前端展示）
VOLCANO_MODEL_NAME = os.getenv("VOLCANO_MODEL_NAME", "Doubao-1.5-pro-32k-250115")

# 初始化火山引擎客户端
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

def build_context(parent_node_id: Optional[str], nodes: List[DialogueNodeModel]) -> List[dict]:
    """根据前端传递的节点列表构建对话上下文"""
    logger.info(f"构建上下文，父节点ID: {parent_node_id}")
    logger.info(f"接收到的节点数量: {len(nodes)}")

    if not parent_node_id:
        logger.info("没有父节点，返回基础上下文")
        return [{"role": "system", "content": "You are a helpful assistant."}]

    # 创建节点ID到节点的映射以便快速查找
    node_map = {node.id: node for node in nodes}

    # 回溯构建完整对话历史
    context = [{"role": "system", "content": "You are a helpful assistant."}]
    path = []
    current_id = parent_node_id

    while current_id:
        node = node_map.get(current_id)
        if not node:
            logger.warning(f"在提供的节点列表中未找到节点ID: {current_id}")
            break
        path.append(node)
        current_id = node.parent_node_id

    # 从根到当前节点的顺序反转路径
    path.reverse()

    logger.info(f"构建的对话路径长度: {len(path)}")

    for node in path:
        context.append({"role": "user", "content": node.user_prompt})
        context.append({"role": "assistant", "content": node.ai_response})

    logger.info(f"最终上下文长度: {len(context)}")
    return context



async def call_volcano_api(messages: List[dict]) -> Tuple[str, str]:
    """调用火山引擎API（非流式）
    
    Returns:
        tuple: (ai_response, model_name) - AI响应内容和模型名称
    """
    try:
        client = get_volcano_client()
        
        # 使用非流式调用
        completion = client.chat.completions.create(
            model=VOLCANO_ENDPOINT_ID,  # 使用接入点ID
            messages=messages,
            # 免费开启推理会话应用层加密
            extra_headers={'x-is-encrypted': 'true'}
        )
        
        ai_response = completion.choices[0].message.content
        return ai_response, VOLCANO_MODEL_NAME
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"API调用失败: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Rootie Backend API is running!"}

@app.post("/api/chat/stream")
def chat_stream(request: ChatRequest):
    """处理流式聊天请求"""
    logger.info(f"收到流式请求: {request.model_dump_json(indent=2)}")
    
    # 使用前端传递的节点列表构建上下文
    context = build_context(request.parent_node_id, request.nodes)
    context.append({"role": "user", "content": request.prompt})
    logger.info(f"构建的上下文: {json.dumps(context, indent=2, ensure_ascii=False)}")
    
    import uuid
    new_node_id = request.node_id or str(uuid.uuid4())
    
    def generate_response():
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
            client = get_volcano_client()
            stream = client.chat.completions.create(
                model=VOLCANO_ENDPOINT_ID,
                messages=context,
                stream=True,
                extra_headers={'x-is-encrypted': 'true'}
            )

            logger.info("开始从火山引擎API流式接收数据...")
            for chunk in stream:
                # logger.info(f"收到原始数据块: {chunk!r}") # 移除此日志，避免刷屏
                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    
                    data = {
                        "type": "chunk",
                        "content": content
                    }
                    yield f"data: {json.dumps(data)}\n\n"
            
            # 如果有graph_id，保存节点到数据库
            if hasattr(request, 'graph_id') and request.graph_id:
                try:
                    from models import SessionLocal
                    db = SessionLocal()
                    try:
                        # 检查图谱是否存在
                        graph = db.query(DialogueGraph).filter(DialogueGraph.id == request.graph_id).first()
                        if graph:
                            # 保存新节点到数据库
                            new_db_node = DialogueNode(
                                id=new_node_id,
                                graph_id=request.graph_id,
                                parent_node_id=request.parent_node_id,
                                user_prompt=request.prompt,
                                ai_response=full_response,
                                model_name=VOLCANO_MODEL_NAME,
                                endpoint_id=VOLCANO_ENDPOINT_ID
                            )
                            db.add(new_db_node)
                            
                            # 更新图谱的更新时间
                            graph.updated_at = datetime.utcnow().isoformat()
                            
                            db.commit()
                            logger.info(f"节点已保存到数据库: {new_node_id}")
                    finally:
                        db.close()
                except Exception as e:
                    logger.error(f"保存节点到数据库失败: {e}", exc_info=True)
            
            logger.info(f"流式响应完成，节点ID: {new_node_id}")

            end_data = {"type": "done"}
            yield f"data: {json.dumps(end_data)}\n\n"

        except Exception as e:
            logger.error(f"流式处理失败: {e}", exc_info=True)
            error_data = {
                "type": "error",
                "message": f"API调用失败: {str(e)}"
            }
            yield f"data: {json.dumps(error_data)}\n\n"

    return StreamingResponse(generate_response(), media_type="text/event-stream")

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """处理非流式聊天请求"""
    try:
        # 构建上下文
        context = build_context(request.parent_node_id)
        
        # 添加当前用户输入
        context.append({"role": "user", "content": request.prompt})
        
        # 调用AI API
        ai_response, model_name = await call_volcano_api(context)
        
        # 生成新节点ID
        import uuid
        
        new_node_id = str(uuid.uuid4())
        
        # 创建新节点
        new_node = DialogueNode(
            id=new_node_id,
            user_prompt=request.prompt,
            ai_response=ai_response,
            parent_node_id=request.parent_node_id,
            created_at=datetime.now().isoformat()
        )
        
        # 保存到临时存储
        dialogue_nodes.append(new_node)
        
        # 返回新节点数据
        new_node_data = {
            "id": new_node_id,
            "question": request.prompt,
            "answer": ai_response,
            "parent_node_id": request.parent_node_id,
            "created_at": new_node.created_at,
            "model_name": model_name,  # 添加模型名称用于前端展示
            "endpoint_id": VOLCANO_ENDPOINT_ID  # 添加接入点ID用于记录
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

# 对话图谱管理API
@app.post("/api/graphs", response_model=GraphResponse)
async def create_graph(request: CreateGraphRequest, db: Session = Depends(get_db)):
    """创建新的对话图谱"""
    try:
        new_graph = DialogueGraph(
            title=request.title,
            description=request.description or "自动创建的对话图谱"
        )
        db.add(new_graph)
        db.commit()
        db.refresh(new_graph)
        
        return GraphResponse(
            id=new_graph.id,
            title=new_graph.title,
            description=new_graph.description,
            created_at=new_graph.created_at.isoformat(),
            updated_at=new_graph.updated_at.isoformat()
        )
    except Exception as e:
        logger.error(f"创建图谱失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/graphs", response_model=List[GraphResponse])
async def get_graphs(db: Session = Depends(get_db)):
    """获取所有对话图谱"""
    try:
        graphs = db.query(DialogueGraph).order_by(DialogueGraph.updated_at.desc()).all()
        return [
            GraphResponse(
                id=graph.id,
                title=graph.title,
                description=graph.description,
                created_at=graph.created_at.isoformat(),
                updated_at=graph.updated_at.isoformat()
            )
            for graph in graphs
        ]
    except Exception as e:
        logger.error(f"获取图谱列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/graphs/{graph_id}/save")
async def save_graph(graph_id: str, request: SaveGraphRequest, db: Session = Depends(get_db)):
    """保存对话图谱的节点和边"""
    try:
        # 检查图谱是否存在
        graph = db.query(DialogueGraph).filter(DialogueGraph.id == graph_id).first()
        if not graph:
            raise HTTPException(status_code=404, detail="图谱不存在")
        
        # 删除现有节点（级联删除）
        db.query(DialogueNode).filter(DialogueNode.graph_id == graph_id).delete()
        
        # 保存新节点
        for node_data in request.nodes:
            node = DialogueNode(
                id=node_data.id,
                graph_id=graph_id,
                parent_node_id=node_data.parent_node_id,
                user_prompt=node_data.user_prompt,
                ai_response=node_data.ai_response,
                position_x=node_data.position_x,
                position_y=node_data.position_y,
                created_at=datetime.fromisoformat(node_data.created_at.replace('Z', '+00:00')) if node_data.created_at else datetime.utcnow()
            )
            db.add(node)
        
        # 更新图谱的更新时间
        graph.updated_at = datetime.utcnow()
        
        db.commit()
        return {"success": True, "message": "图谱保存成功"}
        
    except Exception as e:
        db.rollback()
        logger.error(f"保存图谱失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/graphs/{graph_id}/load", response_model=LoadGraphResponse)
async def load_graph(graph_id: str, db: Session = Depends(get_db)):
    """加载对话图谱的完整数据"""
    try:
        # 获取图谱信息
        graph = db.query(DialogueGraph).filter(DialogueGraph.id == graph_id).first()
        if not graph:
            raise HTTPException(status_code=404, detail="图谱不存在")
        
        # 获取所有节点
        nodes = db.query(DialogueNode).filter(DialogueNode.graph_id == graph_id).all()
        
        # 构建节点数据
        node_list = [
            DialogueNodeModel(
                id=node.id,
                user_prompt=node.user_prompt,
                ai_response=node.ai_response,
                parent_node_id=node.parent_node_id,
                created_at=node.created_at.isoformat(),
                position_x=node.position_x,
                position_y=node.position_y
            )
            for node in nodes
        ]
        
        # 构建边数据（基于parent_node_id关系）
        edges = []
        for node in nodes:
            if node.parent_node_id:
                edges.append({
                    "id": f"{node.parent_node_id}-{node.id}",
                    "source": node.parent_node_id,
                    "target": node.id,
                    "animated": True,
                    "style": {"stroke": "#ff4444", "strokeWidth": 2},
                    "markerEnd": {"type": "ArrowClosed", "color": "#ff4444"}
                })
        
        return LoadGraphResponse(
            graph=GraphResponse(
                id=graph.id,
                title=graph.title,
                description=graph.description,
                created_at=graph.created_at.isoformat(),
                updated_at=graph.updated_at.isoformat()
            ),
            nodes=node_list,
            edges=edges
        )
        
    except Exception as e:
        logger.error(f"加载图谱失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/graphs/{graph_id}")
async def update_graph(graph_id: str, request: dict, db: Session = Depends(get_db)):
    """更新指定对话图谱"""
    try:
        graph = db.query(DialogueGraph).filter(DialogueGraph.id == graph_id).first()
        if not graph:
            raise HTTPException(status_code=404, detail="图谱不存在")
        
        # 更新标题
        if "title" in request:
            graph.title = request["title"]
        
        # 更新描述
        if "description" in request:
            graph.description = request["description"]
        
        graph.updated_at = datetime.utcnow()
        db.commit()
        
        return GraphResponse(
            id=graph.id,
            title=graph.title,
            description=graph.description,
            created_at=graph.created_at.isoformat(),
            updated_at=graph.updated_at.isoformat()
        )
    except Exception as e:
        db.rollback()
        logger.error(f"更新图谱失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/graphs/{graph_id}")
async def delete_graph(graph_id: str, db: Session = Depends(get_db)):
    """删除对话图谱"""
    try:
        graph = db.query(DialogueGraph).filter(DialogueGraph.id == graph_id).first()
        if not graph:
            raise HTTPException(status_code=404, detail="图谱不存在")
        
        db.delete(graph)
        db.commit()
        return {"success": True, "message": "图谱删除成功"}
        
    except Exception as e:
        db.rollback()
        logger.error(f"删除图谱失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)