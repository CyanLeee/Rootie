import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, { addEdge, applyNodeChanges, applyEdgeChanges, MiniMap, Controls, Background, MarkerType, Handle, Position, ConnectionMode } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';
import Sidebar from './Sidebar'; // 导入 Sidebar 组件
import { BackgroundVariant } from 'reactflow';

// 创建输入框节点组件
const InputNode = ({ id, data }: any) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  return (
    <div className="input-node">
      <div className="input-node-container">
        <Handle type="target" position={Position.Top} id="a" />
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="有什么可以帮到您？"
          className="canvas-input nodrag"
          onInput={handleInput}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && e.currentTarget.value.trim()) {
              e.preventDefault();
              data.onSend(id, e.currentTarget.value.trim(), e.currentTarget);
              e.currentTarget.blur();
            }
          }}
        />
        <button 
          className="canvas-send-button"
          onClick={(e) => {
            const textarea = (e.currentTarget.previousElementSibling as HTMLTextAreaElement);
            if (textarea.value.trim()) {
              data.onSend(id, textarea.value.trim(), textarea);
            }
          }}
        >
          <span>{`R`}</span>
        </button>
        <Handle type="source" position={Position.Bottom} id="b" />
      </div>
    </div>
  );
};

// 创建合并的问答节点组件
const ConversationNode = ({ data }: any) => {
  return (
    <div className="conversation-node">
      <Handle type="target" position={Position.Top} />
      <div className="question-section">
        <div className="question-label">Question</div>
        <div className="question-content nodrag">{data.question}</div>
      </div>
      <div className="answer-section">
        <div className="answer-label">Answer</div>
        <div className="answer-content nodrag">{data.answer}</div>
        <div className="node-actions">
          <span>💬</span>
          <span>重试</span>
          <button 
            className="branch-button"
            onClick={() => data.onCreateBranch && data.onCreateBranch()}
          >
            话题分支
          </button>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const nodeTypes = {
  input: InputNode,
  conversation: ConversationNode,
};

 

function App() {
  const nodeId = useRef(2); // Start at 2, since 'input-1' is hardcoded
  const getNextId = () => `input-${nodeId.current++}`;
  const isProcessing = useRef(false);

  const [chatHistory, setChatHistory] = useState<string[]>(['构建一个树状对话产品', '第二个话题', '还有其他话题', '还有其他话题的记录']);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const handleSendRef = useRef<any>(null);
  const handleCreateBranchRef = useRef<any>(null);

  // 创建分支的处理函数
  const handleCreateBranch = useCallback((sourceNodeId: string) => {
    const sourceNode = nodes.find(node => node.id === sourceNodeId);
    if (!sourceNode) return;

    const nodeElement = document.querySelector(`.react-flow__node[data-id="${sourceNodeId}"]`);
    const sourceNodeWidth = (nodeElement as HTMLElement)?.offsetWidth || 450;
    const sourceNodeHeight = (nodeElement as HTMLElement)?.offsetHeight || 250;
    const newInputNodeWidth = 400; // Based on .input-node min-width
    const horizontalGap = 50;
    const verticalGap = 150;

    const newInputId = getNextId();

    // Get all direct children of the source node that are 'input' nodes
    const childInputNodes = edges
      .filter(edge => edge.source === sourceNodeId)
      .map(edge => nodes.find(node => node.id === edge.target))
      .filter((node): node is Node => !!node && node.type === 'input');

    // The Y position is the same for all children, placed below the parent.
    const newY = sourceNode.position.y + (sourceNode.height || sourceNodeHeight) + verticalGap;

    let newX;

    if (childInputNodes.length === 0) {
      // First child: center it under the parent.
      newX = sourceNode.position.x + ((sourceNode.width || sourceNodeWidth) / 2) - (newInputNodeWidth / 2);
    } else {
      // Subsequent children: find the rightmost child and place the new one next to it.
      const rightmostChild = childInputNodes.reduce((prev, current) => 
        (prev.position.x > current.position.x) ? prev : current
      );
      newX = rightmostChild.position.x + (rightmostChild.width || newInputNodeWidth) + horizontalGap;
    }

    const newPosition = { x: newX, y: newY };

    const newInputNode: Node = {
      id: newInputId,
      type: 'input',
      data: {
        onSend: (inputId: string, text: string, inputElement: HTMLInputElement) => {
          handleSendRef.current?.(inputId, text, inputElement);
        }
      },
      position: newPosition,
    };

    const newEdge: Edge = {
      id: `${sourceNodeId}-${newInputId}`,
      source: sourceNodeId,
      target: newInputId,
      animated: true,
      style: { stroke: '#ff4444', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#ff4444',
      },
    };

    setNodes(nds => [...nds, newInputNode]);
    setEdges(eds => [...eds, newEdge]);
  }, [nodes, edges, setNodes, setEdges]);

  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Delete') {
        setNodes(currentNodes => {
          const selectedNodes = currentNodes.filter(node => node.selected);
          if (selectedNodes.length === 0) {
            return currentNodes;
          }
          
          const nodeIdsToRemove = selectedNodes.map(n => n.id);

          if (currentNodes.length - nodeIdsToRemove.length < 1) {
            return currentNodes;
          }

          setEdges(currentEdges => currentEdges.filter(e => !nodeIdsToRemove.includes(e.source) && !nodeIdsToRemove.includes(e.target)));
          return currentNodes.filter(n => !nodeIdsToRemove.includes(n.id));
        });
      }
    },
    [setNodes, setEdges]
  );
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  const onConnect = useCallback(
    (connection: any) => {
      // 如果有target，说明是连接到现有节点
      if (connection.target) {
        setEdges((eds) => addEdge(connection, eds));
        return;
      }
      
      // 如果没有target，说明是拖拽到空白区域，创建新的分支
      const sourceNode = nodes.find(node => node.id === connection.source);
      if (sourceNode && sourceNode.type === 'conversation') {
        const newInputId = getNextId();
        const branchOffset = 300;
        const verticalOffset = 150;
        
        const newInputNode: Node = {
          id: newInputId,
          type: 'input',
          data: { 
            onSend: (inputId: string, text: string, inputElement: HTMLInputElement) => {
              handleSend(inputId, text, inputElement);
            }
          },
          position: { 
            x: sourceNode.position.x + branchOffset, 
            y: sourceNode.position.y + verticalOffset 
          },
        };
        
        const newEdge: Edge = {
          id: `${connection.source}-${newInputId}`,
          source: connection.source,
          target: newInputId,
          animated: true,
          style: { stroke: '#ff4444', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#ff4444',
          },
        };
        
        setNodes(currentNodes => [...currentNodes, newInputNode]);
        setEdges(currentEdges => [...currentEdges, newEdge]);
      }
    },
    [setEdges, nodes]
  );

    const handleSend = useCallback(async (inputId: string, text: string, inputElement: HTMLInputElement) => {
    if (isProcessing.current) return;
    isProcessing.current = true;

    if (inputElement) {
      inputElement.value = '';
    }

    // 获取父节点ID（用于构建上下文）
    const parentNodeId = edges.find(edge => edge.target === inputId)?.source || null;
    console.log('发送消息，父节点ID:', parentNodeId);

    // 第一步：将输入节点转换为对话节点
    setNodes((currentNodes) => {
      const currentInputNode = currentNodes.find(node => node.id === inputId);
      if (!currentInputNode) {
        isProcessing.current = false;
        return currentNodes;
      }

      const newConversationNode: Node = {
        id: currentInputNode.id,
        type: 'conversation',
        data: {
          question: text,
          answer: '正在思考中...',
          onCreateBranch: () => handleCreateBranchRef.current?.(currentInputNode.id)
        },
        position: { x: currentInputNode.position.x, y: currentInputNode.position.y },
      };

      return currentNodes.map(node => (node.id === currentInputNode.id ? newConversationNode : node));
    });

    try {
      // 使用流式API
      const response = await fetch('http://localhost:8000/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: text,
          parent_node_id: parentNodeId,
          node_id: inputId  // 传递当前节点ID
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let streamingAnswer = '';
      let newInputId = '';
      let nodeCreated = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'init') {
                console.log('初始化节点:', data.node_id);
                // 节点已在前面创建，这里可以记录ID
              } else if (data.type === 'chunk') {
                streamingAnswer += data.content;
                // 实时更新答案
                setNodes(currentNodes => 
                  currentNodes.map(node =>
                    node.id === inputId
                      ? { ...node, data: { ...node.data, answer: streamingAnswer } }
                      : node
                  )
                );
              } else if (data.type === 'complete') {
                console.log('流式响应完成');
                streamingAnswer = data.full_response;
                
                // 创建新的输入节点
                if (!nodeCreated) {
                  newInputId = getNextId();
                  nodeCreated = true;
                  
                  setNodes(currentNodes => {
                    const answeredNodes = currentNodes.map(node =>
                      node.id === inputId
                        ? { ...node, data: { ...node.data, answer: streamingAnswer, onCreateBranch: () => handleCreateBranchRef.current?.(inputId) } }
                        : node
                    );

                    const conversationNode = answeredNodes.find(node => node.id === inputId);
                    if (!conversationNode) {
                      return answeredNodes;
                    }

                    // Get the actual height of the rendered conversation node
                    const nodeElement = document.querySelector(`.react-flow__node[data-id="${inputId}"]`);
                    const nodeHeight = (nodeElement as HTMLElement)?.offsetHeight || 450;
                    const verticalGap = 200;

                    const newInputNode: Node = {
                      id: newInputId,
                      type: 'input',
                      data: {
                        onSend: (id: string, txt: string, el: HTMLInputElement) => {
                          handleSendRef.current?.(id, txt, el);
                        }
                      },
                      position: { 
                        x: conversationNode.position.x, 
                        y: conversationNode.position.y + nodeHeight + verticalGap 
                      },
                    };

                    return [...answeredNodes, newInputNode];
                  });

                  setEdges(currentEdges => {
                    const newEdge: Edge = {
                      id: `${inputId}-${newInputId}`,
                      source: inputId,
                      target: newInputId,
                      animated: true,
                      style: { stroke: '#ff4444', strokeWidth: 2 },
                      markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: '#ff4444',
                      },
                    };
                    return [...currentEdges, newEdge];
                  });
                }
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (parseError) {
              console.error('解析流式数据失败:', parseError);
            }
          }
        }
      }

    } catch (error) {
      console.error('API调用失败:', error);
      
      // 显示错误信息
      setNodes(currentNodes => 
        currentNodes.map(node =>
          node.id === inputId
            ? { ...node, data: { ...node.data, answer: `抱歉，发生了错误：${error instanceof Error ? error.message : '未知错误'}。请检查后端服务是否正常运行。`, onCreateBranch: () => handleCreateBranchRef.current?.(inputId) } }
            : node
        )
      );
    } finally {
      isProcessing.current = false;
    }
  }, [setNodes, setEdges, edges]);

  handleSendRef.current = handleSend;
  handleCreateBranchRef.current = handleCreateBranch;

  React.useEffect(() => {
    setNodes([
      {
        id: 'input-1',
        type: 'input',
        data: {
          onSend: (inputId: string, text: string, inputElement: HTMLInputElement) => {
            handleSendRef.current?.(inputId, text, inputElement);
          }
        },
        position: { x: 400, y: 300 },
      }
    ]);
  }, []);

  const handleNewChat = () => {
    const newChatName = `新话题 ${chatHistory.length + 1}`;
    setChatHistory(prev => [...prev, newChatName]);
    // Optionally, you can clear the canvas or create a new initial node
  };

  const handleSelectChat = (chat: string) => {
    console.log(`Switched to ${chat}`);
    // Here you would typically load the state associated with this chat
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      <Sidebar 
        chatHistory={chatHistory}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
      />
      <div style={{ flexGrow: 1, height: '100vh', backgroundColor: '#222222' }} onKeyDown={onKeyDown} tabIndex={-1}>
        <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        noDragClassName='nodrag'
        fitView
        fitViewOptions={{ maxZoom: 0.8 }}
      >
        <MiniMap />
        <Controls />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}

export default App;
