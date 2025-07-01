import './Sidebar.css';

interface SidebarProps {
  chatHistory: string[];
  onNewChat: () => void;
  onSelectChat: (chat: string) => void;
}

const Sidebar = ({ chatHistory, onNewChat, onSelectChat }: SidebarProps) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Rootie</span>
      </div>
      <button className="new-chat-button" onClick={onNewChat}>
        新建话题
      </button>
      <div className="chat-history">
        {chatHistory.map((chat, index) => (
          <div key={index} className="chat-history-item" onClick={() => onSelectChat(chat)}>
            {chat}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;