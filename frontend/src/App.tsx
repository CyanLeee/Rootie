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

 

interface Graph {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

function App() {
  const nodeId = useRef(2); // Start at 2, since 'input-1' is hardcoded
  const getNextId = () => `input-${nodeId.current++}`;
  const isProcessing = useRef(false);

  const [graphs, setGraphs] = useState<Graph[]>([]);
  const [currentGraph, setCurrentGraph] = useState<Graph | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const handleSendRef = useRef<any>(null);
  const handleCreateBranchRef = useRef<any>(null);

  // 加载图谱列表
  const loadGraphs = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/api/graphs');
      if (response.ok) {
        const graphsData = await response.json();
        setGraphs(graphsData);
      }
    } catch (error) {
      console.error('加载图谱列表失败:', error);
    }
  }, []);

  // 创建新图谱
  const createNewGraph = useCallback(async (title: string) => {
    try {
      const response = await fetch('http://localhost:8000/api/graphs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description: '自动创建的对话图谱'
        })
      });
      
      if (response.ok) {
        const newGraph = await response.json();
        setGraphs(prev => [newGraph, ...prev]);
        setCurrentGraph(newGraph);
        
        // 重置画布为初始状态
        setNodes([{
          id: 'input-1',
          type: 'input',
          data: {
            onSend: (inputId: string, text: string, inputElement: HTMLInputElement) => {
              handleSendRef.current?.(inputId, text, inputElement);
            }
          },
          position: { x: 400, y: 300 },
        }]);
        setEdges([]);
        nodeId.current = 2;
        
        return newGraph;
      }
    } catch (error) {
      console.error('创建图谱失败:', error);
    }
    return null;
  }, []);

  // 加载指定图谱
  const loadGraph = useCallback(async (graphId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/graphs/${graphId}/load`);
      if (response.ok) {
        const data = await response.json();
        setCurrentGraph(data.graph);
        
        // 转换节点数据
        const loadedNodes = data.nodes.map((nodeData: any) => {
          if (nodeData.ai_response) {
            // 对话节点
            return {
              id: nodeData.id,
              type: 'conversation',
              data: {
                question: nodeData.user_prompt,
                answer: nodeData.ai_response,
                onCreateBranch: () => handleCreateBranchRef.current?.(nodeData.id)
              },
              position: { 
                x: nodeData.position_x || 400, 
                y: nodeData.position_y || 300 
              },
            };
          } else {
            // 输入节点
            return {
              id: nodeData.id,
              type: 'input',
              data: {
                onSend: (inputId: string, text: string, inputElement: HTMLInputElement) => {
                  handleSendRef.current?.(inputId, text, inputElement);
                }
              },
              position: { 
                x: nodeData.position_x || 400, 
                y: nodeData.position_y || 300 
              },
            };
          }
        });
        
        setNodes(loadedNodes);
        setEdges(data.edges);
        
        // 更新nodeId计数器
        const maxId = Math.max(...loadedNodes.map((n: any) => {
          const match = n.id.match(/input-(\d+)/);
          return match ? parseInt(match[1]) : 0;
        }));
        nodeId.current = maxId + 1;
      }
    } catch (error) {
      console.error('加载图谱失败:', error);
    }
  }, []);

  // 更新图谱标题
  const updateGraphTitle = useCallback(async (graphId: string, newTitle: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/graphs/${graphId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newTitle
        })
      });
      
      if (response.ok) {
        const updatedGraph = await response.json();
        setCurrentGraph(updatedGraph);
        setGraphs(prev => prev.map(g => g.id === graphId ? updatedGraph : g));
        console.log('图谱标题更新成功');
      }
    } catch (error) {
      console.error('更新图谱标题失败:', error);
    }
  }, []);

  // 保存当前图谱
  const saveCurrentGraph = useCallback(async () => {
    if (!currentGraph) return;
    
    try {
      // 准备节点数据
      const nodeData = nodes.map(node => ({
        id: node.id,
        user_prompt: node.data.question || '',
        ai_response: node.data.answer || '',
        parent_node_id: edges.find(e => e.target === node.id)?.source || null,
        created_at: new Date().toISOString(),
        position_x: node.position.x,
        position_y: node.position.y
      }));
      
      const response = await fetch(`http://localhost:8000/api/graphs/${currentGraph.id}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          graph_id: currentGraph.id,
          nodes: nodeData,
          edges: edges
        })
      });
      
      if (response.ok) {
        console.log('图谱保存成功');
      }
    } catch (error) {
      console.error('保存图谱失败:', error);
    }
  }, [currentGraph, nodes, edges]);

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
    (changes: any) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      // 在节点拖动结束后保存
      const positionChange = changes.find((change: any) => change.type === 'position' && change.dragging === false);
      if (positionChange) {
        saveCurrentGraph();
      }
    },
    [setNodes, saveCurrentGraph]
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

    // 确保有当前图谱
    const graph = await ensureCurrentGraph(text);
    if (!graph) {
      isProcessing.current = false;
      return;
    }

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
      // 准备要发送到后端的节点数据
      const nodesForBackend = nodes.map(node => ({
        id: node.id,
        user_prompt: node.data.question || '', // 确保字段存在
        ai_response: node.data.answer || '', // 确保字段存在
        parent_node_id: edges.find(e => e.target === node.id)?.source || null,
        created_at: new Date().toISOString(), // 或者使用节点上已有的时间戳
      }));

      // 使用流式API
      const response = await fetch('http://localhost:8000/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: text,
          parent_node_id: parentNodeId,
          node_id: inputId,  // 传递当前节点ID
          nodes: nodesForBackend, // 发送所有节点数据
          graph_id: currentGraph?.id, // 传递当前图谱ID
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

        if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        
                        if (data.type === 'init') {
                            console.log('初始化节点:', data.node_id);
                        } else if (data.type === 'chunk') {
                            streamingAnswer += data.content;
                            setNodes(currentNodes => 
                                currentNodes.map(node =>
                                    node.id === inputId
                                        ? { ...node, data: { ...node.data, answer: streamingAnswer } }
                                        : node
                                )
                            );
                        }
                    } catch (error) {
                        console.error('解析流数据失败:', error, '原始行:', line);
                    }
                }
            }
        }

        if (done) {
            console.log('流式响应完成');

            // 确保在创建新节点之前，最终的答案被设置
            setNodes(currentNodes => 
                currentNodes.map(node =>
                    node.id === inputId
                        ? { ...node, data: { ...node.data, answer: streamingAnswer } }
                        : node
                )
            );

            if (!nodeCreated) {
                const newInputId = getNextId();
                nodeCreated = true;

                setTimeout(() => {
                    const sourceNodeElement = document.querySelector(`.react-flow__node[data-id="${inputId}"]`);
                    const sourceNodeHeight = (sourceNodeElement as HTMLElement)?.offsetHeight || 250;
                    const verticalGap = 50;

                    setNodes(currentNodes => {
                        const sourceNode = currentNodes.find(n => n.id === inputId);
                        if (!sourceNode) return currentNodes;

                        const finalNode: Node = {
                            ...sourceNode,
                            data: {
                                ...sourceNode.data,
                                answer: streamingAnswer,
                                onCreateBranch: () => handleCreateBranchRef.current?.(inputId)
                            }
                        };

                        const newInputNode: Node = {
                            id: newInputId,
                            type: 'input',
                            data: {
                                onSend: (id: string, txt: string, el: HTMLInputElement) => {
                                    handleSendRef.current?.(id, txt, el);
                                }
                            },
                            position: {
                                x: sourceNode.position.x,
                                y: sourceNode.position.y + sourceNodeHeight + verticalGap
                            },
                        };

                        const updatedNodes = currentNodes.map(n => n.id === inputId ? finalNode : n);
                        if (!updatedNodes.some(n => n.id === newInputId)) {
                            return [...updatedNodes, newInputNode];
                        }
                        return updatedNodes;
                    });

                    setEdges(currentEdges => {
                        if (currentEdges.some(e => e.id === `${inputId}-${newInputId}`)) {
                            return currentEdges;
                        }
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
                    
                    // 自动保存图谱
                    if (currentGraph) {
                        setTimeout(() => {
                            saveCurrentGraph();
                        }, 500);
                    }
                }, 100);
            }
            break;
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

  // 初始化：加载图谱列表
  React.useEffect(() => {
    loadGraphs();
  }, [loadGraphs]);

  // 当没有当前图谱时，显示初始输入节点
  React.useEffect(() => {
    if (!currentGraph && graphs.length === 0) {
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
    }
  }, [currentGraph, graphs]);

  const handleNewChat = async () => {
    // 保存当前图谱（如果有的话）
    if (currentGraph && nodes.length > 0) {
      await saveCurrentGraph();
    }
    
    // 创建新图谱
    const title = `话题 ${graphs.length + 1}`;
    await createNewGraph(title);
    
    // 创建初始输入节点
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
    setEdges([]);
    
    // 重置节点ID计数器
    nodeId.current = 2;
  };

  const handleSelectChat = async (graphId: string) => {
    // 保存当前图谱（如果有的话）
    if (currentGraph && nodes.length > 0) {
      await saveCurrentGraph();
    }
    
    // 加载选中的图谱
    await loadGraph(graphId);
  };

  const handleDeleteChat = async (graphId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/graphs/${graphId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('删除图谱失败');
      }
      
      // 重新加载图谱列表
      await loadGraphs();
      
      // 如果删除的是当前图谱，清空画布并显示初始输入节点
       if (currentGraph?.id === graphId) {
         setCurrentGraph(null);
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
         setEdges([]);
         nodeId.current = 2;
       }
      
      console.log('图谱删除成功');
    } catch (error) {
      console.error('删除图谱失败:', error);
    }
  };

  // 自动创建第一个图谱（当用户首次发送消息时）
  const ensureCurrentGraph = useCallback(async (userPrompt: string) => {
    if (!currentGraph) {
      const title = userPrompt.length > 10 ? userPrompt.substring(0, 10) : userPrompt;
      const newGraph = await createNewGraph(title);
      return newGraph;
    }
    
    // 检查是否需要更新图谱标题（如果当前图谱是新建话题且还没有对话内容）
    const hasConversationNodes = nodes.some(node => node.type === 'conversation');
    if (!hasConversationNodes && currentGraph.title.startsWith('话题')) {
      const newTitle = userPrompt.length > 10 ? userPrompt.substring(0, 10) : userPrompt;
      await updateGraphTitle(currentGraph.id, newTitle);
    }
    
    return currentGraph;
  }, [currentGraph, createNewGraph, updateGraphTitle, nodes]);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      <Sidebar 
          graphs={graphs}
          currentGraph={currentGraph}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
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
