import { useState } from 'react';
import { ChevronRight, ChevronDown, Home, X, Search, Settings } from 'lucide-react';

const Dashboard = () => {
    const [activeTab, setActiveTab] = useState('Classes');
    const [selectedClass, setSelectedClass] = useState(null);
    const [expandedNodes, setExpandedNodes] = useState(['owl:Thing']);


    const tabs = [
        { id: 'Classes', label: 'Classes', count: null },
        { id: 'Properties', label: 'Properties', count: null },
        { id: 'Individuals', label: 'Individuals', count: null },
        { id: 'Comments', label: 'Comments', count: null },
        { id: 'Changes', label: 'Changes by Entity', count: null },
        { id: 'History', label: 'History', count: null }
    ];

    const classHierarchy = [
        {
            id: 'owl:Thing',
            label: 'owl:Thing',
            children: [
                {
                    id: 'RDPQU',
                    label: 'RDPQUGqrgqNn9p2RER3GUD',
                    children: []
                }
            ]
        }
    ];

    const toggleNode = (nodeId: string) => {
        setExpandedNodes(prev => 
            prev.includes(nodeId) 
                ? prev.filter(id => id !== nodeId)
                : [...prev, nodeId]
        );
    };

    const renderTreeNode = (node: any, level = 0) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedNodes.includes(node.id);
        
        return (
            <div key={node.id} className="tree-node">
                <div 
                    className={`tree-node-content ${selectedClass === node.id ? 'selected' : ''}`}
                    style={{ paddingLeft: `${level * 20 + 8}px` }}
                    onClick={() => setSelectedClass(node.id)}
                >
                    {hasChildren && (
                        <button 
                            className="tree-expand-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleNode(node.id);
                            }}
                        >
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                    )}
                    {!hasChildren && <span className="tree-spacer" />}
                    <span className="tree-label">{node.label}</span>
                </div>
                {hasChildren && isExpanded && (
                    <div className="tree-children">
                        {node.children.map((child: any) => renderTreeNode(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

   

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between h-10">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gradient-to-br from-red-400 to-teal-400 rounded-sm"></div>
                        <span className="text-sm text-gray-600">test</span>
                    </div>
                    <button className="flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">
                        <Home size={12} />
                        <span>Home</span>
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">Display ▼</button>
                    <button className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">Project ▼</button>
                    <button className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">Share</button>
                    <button className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">pranesh6 ▼</button>
                    <button className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">Help ▼</button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white border-b border-gray-200 px-4 flex items-center h-9">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`px-3 py-2 text-xs rounded-t border-b-2 mr-1 ${
                            activeTab === tab.id
                                ? 'bg-blue-500 text-white border-blue-500'
                                : 'text-gray-600 hover:bg-gray-100 border-transparent'
                        }`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                        {tab.count && <span className="ml-1 bg-gray-200 text-gray-700 px-1 rounded-full text-xs">{tab.count}</span>}
                    </button>
                ))}
                <div className="ml-auto">
                    <button className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">Add tab</button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex h-[calc(100vh-76px)]">
                {/* Left Panel - Class Hierarchy */}
                <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                    <div className="bg-gray-600 text-white px-3 py-2 flex items-center justify-between text-sm">
                        <span>Class Hierarchy</span>
                        <button className="text-white hover:bg-gray-700 w-4 h-4 flex items-center justify-center rounded">
                            <X size={12} />
                        </button>
                    </div>
                    <div className="p-2 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                            <button className="p-1 hover:bg-gray-100 rounded">
                                <Settings size={14} />
                            </button>
                            <button className="p-1 hover:bg-gray-100 rounded">
                                <Search size={14} />
                            </button>
                            <button className="p-1 hover:bg-gray-100 rounded text-gray-600">
                                ⚙️
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {classHierarchy.map(node => renderTreeNode(node))}
                    </div>
                </div>

                {/* Center Panel - Class Details */}
                <div className="flex-1 bg-white border-r border-gray-200 flex flex-col">
                    <div className="bg-gray-600 text-white px-3 py-2 flex items-center justify-between text-sm">
                        <span>Class</span>
                        <button className="text-white hover:bg-gray-700 w-4 h-4 flex items-center justify-center rounded">
                            <X size={12} />
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-50 border-2 border-dashed border-gray-300 m-4 rounded">
                        <span className="text-lg">Nothing selected</span>
                    </div>
                </div>

                {/* Right Panel - Comments */}
                <div className="w-80 bg-white flex flex-col">
                    <div className="bg-gray-600 text-white px-3 py-2 flex items-center justify-between text-sm">
                        <span>Comments</span>
                        <button className="text-white hover:bg-gray-700 w-4 h-4 flex items-center justify-center rounded">
                            <X size={12} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {/* Comments content would go here */}
                    </div>
                </div>
            </div>

            {/* Bottom Panel - Project Feed */}
            <div className="bg-white border-t border-gray-200">
                <div className="bg-gray-600 text-white px-3 py-1 flex items-center justify-between text-sm">
                    <span>Project Feed</span>
                    <button className="text-white hover:bg-gray-700 w-4 h-4 flex items-center justify-center rounded">
                        <X size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;