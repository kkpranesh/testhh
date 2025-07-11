import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Plus, Home, X, Search, Settings } from 'lucide-react';
import apiClient from '../services/apiClient';

// Define the structure for a single node in the hierarchy
interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}

// Define the props for the modal component for type safety
interface CreateClassModalProps {
  onClose: () => void;
  onCreate: (className: string) => void;
}

const CreateClassModal = ({ onClose, onCreate }: CreateClassModalProps) => {
    const [className, setClassName] = useState('');

    const handleSubmit = () => {
        if (className.trim()) {
            onCreate(className.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
                <h3 className="text-lg font-medium mb-4">Create Class</h3>
                <input
                    type="text"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="Enter class name"
                />
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 rounded text-gray-600 bg-gray-100 hover:bg-gray-200">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600">Create</button>
                </div>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('Classes');
    const [selectedClass, setSelectedClass] = useState<TreeNode | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
    const [classHierarchy, setClassHierarchy] = useState<TreeNode[]>([]);
    const [isCreateClassModalOpen, setCreateClassModalOpen] = useState(false);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.type) {
                case 'showLoading':
                    setIsLoading(true);
                    break;
                case 'fileReady':
                    setProjectId(message.projectId);
                    break;
                case 'loadingFailed':
                    setIsLoading(false);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    useEffect(() => {
        if (projectId) {
            apiClient.get(`/api/ontology/metadata/${projectId}`)
                .then(response => {
                    const data = response.data as TreeNode[];
                    setClassHierarchy(data);
                    if (data.length > 0) {
                        setExpandedNodes([data[0].id]);
                    }
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch class hierarchy:", err);
                    setIsLoading(false);
                });
        } else {
             // For testing UI without a project loaded
             setIsLoading(false);
             setProjectId("test1");
             const mockData = [{ id: 'owl:Thing', label: 'owl:Thing', children: [{ id: 'go:promoter', label: 'go:promoter', children: [] }, { id: 'systems biology representation', label: 'systems biology representation', children: [] }] }];
             setClassHierarchy(mockData);
             setExpandedNodes(['owl:Thing']);
        }
    }, [projectId]);

    const tabs = [
        { id: 'Classes', label: 'Classes' },
        { id: 'Properties', label: 'Properties' },
        { id: 'Individuals', label: 'Individuals' },
        { id: 'Comments', label: 'Comments' },
        { id: 'Changes by Entity', label: 'Changes by Entity' },
        { id: 'History', label: 'History' }
    ];

    const handleClassSelection = (node: TreeNode) => {
        setSelectedClass(node);
    };

    const toggleNode = (nodeId: string) => {
        setExpandedNodes(prev =>
            prev.includes(nodeId)
                ? prev.filter(id => id !== nodeId)
                : [...prev, nodeId]
        );
    };

    const renderTreeNode = (node: TreeNode, level = 0) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedNodes.includes(node.id);

        return (
            <div key={node.id} className="tree-node">
                <div
                    className={`flex items-center p-1 rounded cursor-pointer hover:bg-gray-100 ${selectedClass?.id === node.id ? 'bg-blue-100' : ''}`}
                    style={{ paddingLeft: `${level * 20 + 8}px` }}
                    onClick={() => handleClassSelection(node)}
                >
                    {hasChildren ? (
                        <button
                            className="p-0.5 rounded hover:bg-gray-200"
                            onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}
                        >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    ) : (
                      <span className="w-[18px] inline-block" />
                    )}
                    <span className="ml-1 text-sm text-gray-700">{node.label}</span>
                </div>
                {hasChildren && isExpanded && (
                    <div className="tree-children">
                        {node.children?.map(child => renderTreeNode(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };
    
    const handleCreateClass = (className: string) => {
        console.log("Creating class:", className);
        setCreateClassModalOpen(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-600">
                <p className="text-lg">Loading Ontology...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col text-sm">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between h-10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gradient-to-br from-red-400 to-teal-400 rounded-sm"></div>
                        <span className="text-sm text-gray-600 font-medium">{projectId}</span>
                    </div>
                    <button className="flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">
                        <Home size={12} />
                        <span>Home</span>
                    </button>
                </div>
                <div className="flex items-center gap-1">
                    <button className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">Display ▼</button>
                    <button className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">Project ▼</button>
                    <button className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">Share</button>
                    <button className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">pranesh6 ▼</button>
                    <button className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">Help ▼</button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white border-b border-gray-200 px-4 flex items-center h-9 shrink-0">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`px-3 py-2 text-xs font-medium border-b-2 mr-1 ${
                            activeTab === tab.id
                                ? 'text-blue-600 border-blue-600'
                                : 'text-gray-500 hover:text-gray-800 border-transparent'
                        }`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
                <div className="ml-auto">
                    <button className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded">Add tab</button>
                </div>
            </div>
            
            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel - Class Hierarchy */}
                <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                    <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center justify-between text-xs font-bold text-gray-600">
                        <span>Class Hierarchy</span>
                        <button className="p-1 hover:bg-gray-200 rounded"><X size={14} /></button>
                    </div>
                    <div className="p-2 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                             <button onClick={() => setCreateClassModalOpen(true)} className="p-1 hover:bg-gray-200 rounded"><Plus size={14} /></button>
                             <button className="p-1 hover:bg-gray-200 rounded"><Search size={14} /></button>
                             <button className="p-1 hover:bg-gray-200 rounded"><Settings size={14} /></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {classHierarchy.map(node => renderTreeNode(node))}
                    </div>
                </div>

                {/* Center Panel - Class Details */}
                <div className="flex-1 flex flex-col border-r border-gray-200">
                     <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center justify-between text-xs font-bold text-gray-600">
                        <span>Class</span>
                        <button className="p-1 hover:bg-gray-200 rounded"><X size={14} /></button>
                    </div>
                    <div className="flex-1">
                    {selectedClass ? (
                        <div className="p-4 overflow-y-auto">
                            <h2 className="text-lg font-bold">{selectedClass.label}</h2>
                            <p className="text-sm text-gray-500">ID: {selectedClass.id}</p>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400 bg-white m-4 rounded">
                            <div className="border-2 border-dashed border-gray-300 rounded-lg w-full h-full flex items-center justify-center">
                                <span className="text-lg">Nothing selected</span>
                            </div>
                        </div>
                    )}
                    </div>
                    
                    {/* Bottom Panel - Project Feed */}
                    <div className="h-40 shrink-0 border-t border-gray-200 flex flex-col">
                         <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center justify-between text-xs font-bold text-gray-600">
                            <span>Project Feed</span>
                            <button className="p-1 hover:bg-gray-200 rounded"><X size={14} /></button>
                        </div>
                        <div className="flex-1 p-2 overflow-y-auto">
                            {/* Feed content goes here */}
                        </div>
                    </div>
                </div>

                {/* Right Panel - Comments */}
                <div className="w-80 bg-white flex flex-col">
                    <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center justify-between text-xs font-bold text-gray-600">
                        <span>Comments</span>
                        <button className="p-1 hover:bg-gray-200 rounded"><X size={14} /></button>
                    </div>
                    <div className="flex-1 p-2 overflow-y-auto">
                        {/* Comments content goes here */}
                    </div>
                </div>
            </div>

            {isCreateClassModalOpen && (
                <CreateClassModal
                    onClose={() => setCreateClassModalOpen(false)}
                    onCreate={handleCreateClass}
                />
            )}
        </div>
    );
};

export default Dashboard;