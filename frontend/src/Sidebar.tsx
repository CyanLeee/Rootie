import React from 'react';
import './Sidebar.css';

interface Graph {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface SidebarProps {
  graphs: Graph[];
  currentGraph: Graph | null;
  onNewChat: () => void;
  onSelectChat: (graphId: string) => void;
  onDeleteChat: (graphId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ graphs, currentGraph, onNewChat, onSelectChat, onDeleteChat }) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Rootie</span>
      </div>
      <button className="new-chat-button" onClick={onNewChat}>
        新建话题
      </button>
      <div className="chat-history">
        {graphs.map((graph) => (
          <div 
            key={graph.id} 
            className={`chat-history-item ${currentGraph?.id === graph.id ? 'active' : ''}`}
          >
            <span 
              className="chat-title"
              onClick={() => onSelectChat(graph.id)}
            >
              {graph.title}
            </span>
            <button 
              className="delete-button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteChat(graph.id);
              }}
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;