from sqlalchemy import Column, String, Text, DateTime, Float, ForeignKey, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import uuid

Base = declarative_base()

class DialogueGraph(Base):
    """对话图谱表"""
    __tablename__ = "dialogue_graphs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    nodes = relationship("DialogueNode", back_populates="graph", cascade="all, delete-orphan")

class DialogueNode(Base):
    """对话节点表"""
    __tablename__ = "dialogue_nodes"
    
    id = Column(String, primary_key=True)
    graph_id = Column(String, ForeignKey("dialogue_graphs.id"), nullable=False)
    parent_node_id = Column(String, ForeignKey("dialogue_nodes.id"), nullable=True)
    user_prompt = Column(Text, nullable=False)
    ai_response = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    model_name = Column(String(100), nullable=True)
    endpoint_id = Column(String(100), nullable=True)
    
    # 关系
    graph = relationship("DialogueGraph", back_populates="nodes")
    parent = relationship("DialogueNode", remote_side=[id], backref="children")

# 数据库配置
DATABASE_URL = "sqlite:///./rootie.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建表
Base.metadata.create_all(bind=engine)

# 数据库依赖
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()