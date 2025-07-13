import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Plus, Home, Search, Settings, X } from 'lucide-react';
import apiClient from '../services/apiClient';

// --- TYPE DEFINITIONS ---
interface TreeNode {
  id: string; // This is the IRI
  label: string;
  annotations?: Record<string, string>;
  children?: TreeNode[];
}
interface Property { id: string; label: string; type: string; annotations?: Record<string, string>; }
interface Individual { id: string; label: string; annotations?: Record<string, string>; }
type SelectableItem = TreeNode | Property | Individual;

interface OntologyMetadata {
  filename: string;
  ontologyIRI: string | null;
  versionIRI: string | null;
  classCount: number;
  objectPropertyCount: number;
  dataPropertyCount: number;
  individualCount: number;
  axiomCount: number;
}

interface CreateClassModalProps {
  onClose: () => void;
  onCreate: (className: string, parentId: string | null) => void;
}

// --- MODAL COMPONENT ---
const CreateClassModal = ({ onClose, onCreate }: CreateClassModalProps) => {
    const [className, setClassName] = useState('');
    const handleSubmit = () => {
        if (className.trim()) {
            // We pass null for the parentId for now, this can be enhanced later
            onCreate(className.trim(), null);
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

// --- MAIN DASHBOARD COMPONENT ---
const Dashboard = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<OntologyMetadata | null>(null);
    const [activeTab, setActiveTab] = useState('Classes');
    const [selectedItem, setSelectedItem] = useState<SelectableItem | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
    
    // State for each entity type
    const [classHierarchy, setClassHierarchy] = useState<TreeNode[]>([]);
    const [properties, setProperties] = useState<Property[]>([]);
    const [individuals, setIndividuals] = useState<Individual[]>([]);

    const [isCreateClassModalOpen, setCreateClassModalOpen] = useState(false);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.type) {
                case 'showLoading': setIsLoading(true); break;
                case 'fileReady': setProjectId(message.projectId); break;
                case 'loadingFailed': setIsLoading(false); break;
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const fetchData = async () => {
        if (!projectId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const [metadataResponse, treeResponse, propertiesResponse, individualsResponse] = await Promise.all([
                apiClient.get(`/api/ontology/metadata/${projectId}`),
                apiClient.get(`/api/ontology/classes/tree/${projectId}`),
                apiClient.get(`/api/ontology/properties/${projectId}`),
                apiClient.get(`/api/ontology/individuals/${projectId}`),
            ]);

            // **FIXED**: Handle both {data: ...} and direct data responses from the API
            setMetadata(metadataResponse.data.data || metadataResponse.data);
            
            const treeData = (treeResponse.data.data || treeResponse.data) as TreeNode[];
            setClassHierarchy(treeData);
            if (treeData.length > 0) setExpandedNodes([treeData[0].id]);
            
            setProperties((propertiesResponse.data.data || propertiesResponse.data) || []);
            setIndividuals((individualsResponse.data.data || individualsResponse.data) || []);

        } catch (err) {
            console.error("Failed to fetch ontology data:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [projectId]);
    
    const tabs = [
        { id: 'Classes', label: 'Classes', count: metadata?.classCount },
        { id: 'Properties', label: 'Properties', count: metadata ? metadata.objectPropertyCount + metadata.dataPropertyCount : null },
        { id: 'Individuals', label: 'Individuals', count: metadata?.individualCount },
        { id: 'Changes by Entity', label: 'Changes by Entity' },
        { id: 'History', label: 'History' }
    ];

    const toggleNode = (nodeId: string) => {
        setExpandedNodes(prev => prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]);
    };

    const renderTreeNode = (node: TreeNode, level = 0) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedNodes.includes(node.id);
        return (
            <div key={node.id} className="tree-node">
                <div
                    className={`flex items-center p-1 rounded cursor-pointer hover:bg-gray-100 ${selectedItem?.id === node.id ? 'bg-blue-100' : ''}`}
                    style={{ paddingLeft: `${level * 20 + 8}px` }}
                    onClick={() => setSelectedItem(node)}
                >
                    {hasChildren ? (
                        <button className="p-0.5 rounded hover:bg-gray-200" onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    ) : <span className="w-[18px] inline-block" />}
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

    const handleCreateClass = async (className: string, parentId: string | null) => {
        if (!projectId) return;
        setCreateClassModalOpen(false);
        try {
            await apiClient.post(`/api/ontology/${projectId}/classes`, { name: className, parentId: parentId });
            await fetchData(); // Refetch all data to update UI
        } catch (error) {
            console.error("Failed to create class:", error);
        }
    };
    
    const renderLeftPanelContent = () => {
        switch (activeTab) {
            case 'Classes':
                return classHierarchy.map(node => renderTreeNode(node));
            case 'Properties':
                return properties.map(prop => (
                    <div key={prop.id} className={`flex items-center p-1 rounded cursor-pointer hover:bg-gray-100 text-sm ${selectedItem?.id === prop.id ? 'bg-blue-100' : ''}`} onClick={() => setSelectedItem(prop)}>
                       <span className='ml-1'> {prop.label} </span><span className="ml-2 text-xs text-gray-400">({prop.type})</span>
                    </div>
                ));
            case 'Individuals':
                return individuals.map(ind => (
                    <div key={ind.id} className={`p-1 rounded cursor-pointer hover:bg-gray-100 text-sm ${selectedItem?.id === ind.id ? 'bg-blue-100' : ''}`} onClick={() => setSelectedItem(ind)}>
                       <span className='ml-1'>{ind.label}</span>
                    </div>
                ));
            default:
                return <div className="p-4 text-center text-gray-400">Not implemented yet.</div>;
        }
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-600"><p className="text-lg">Loading Ontology...</p></div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col text-sm">
            <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between h-10 shrink-0">
                <div className="flex items-center gap-3">
                     <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gradient-to-br from-red-400 to-teal-400 rounded-sm"></div>
                        <span className="text-sm text-gray-600 font-medium">{projectId}</span>
                    </div>
                    <button className="flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded" onClick={() => console.log("Home clicked")}><Home size={12} /><span>Home</span></button>
                </div>
                <div className="flex items-center gap-1">
                    <button className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">Display ▼</button>
                    <button className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">Project ▼</button>
                    <button className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">Share</button>
                </div>
            </header>

            <nav className="bg-white border-b border-gray-200 px-4 flex items-center h-9 shrink-0">
                {tabs.map(tab => (
                    <button key={tab.id} className={`px-3 py-2 text-xs font-medium border-b-2 mr-1 ${activeTab === tab.id ? 'text-blue-600 border-blue-600' : 'text-gray-500 hover:text-gray-800 border-transparent'}`} onClick={() => { setActiveTab(tab.id); setSelectedItem(null); }}>
                        {tab.label}
                        {tab.count != null && tab.count > 0 && <span className="ml-2 bg-gray-200 text-gray-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{tab.count}</span>}
                    </button>
                ))}
            </nav>
            
            <main className="flex flex-1 overflow-hidden">
                <aside className="w-80 bg-white border-r border-gray-200 flex flex-col">
                    <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center justify-between text-xs font-bold text-gray-600">
                        <span>{activeTab}</span>
                        <button className="p-1 hover:bg-gray-200 rounded"><X size={14} /></button>
                    </div>
                    <div className="p-2 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                             <button onClick={() => setCreateClassModalOpen(true)} className="p-1 hover:bg-gray-200 rounded" title="Add New"><Plus size={14} /></button>
                             <button className="p-1 hover:bg-gray-200 rounded" title="Search" onClick={() => console.log("Search clicked")}><Search size={14} /></button>
                             <button className="p-1 hover:bg-gray-200 rounded" title="Settings" onClick={() => console.log("Settings clicked")}><Settings size={14} /></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {renderLeftPanelContent()}
                    </div>
                </aside>

                <section className="flex-1 flex flex-col border-r border-gray-200">
                    <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center justify-between text-xs font-bold text-gray-600">
                        <span>{selectedItem ? `Class: ${selectedItem.label}` : 'Details'}</span>
                         <button className="p-1 hover:bg-gray-200 rounded"><X size={14} /></button>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto">
                        {selectedItem ? (
                            <div>
                                <h3 className="text-xs font-bold text-gray-500 uppercase">IRI</h3>
                                <p className="text-sm text-blue-600 break-all mb-4">{selectedItem.id}</p>
                                
                                {selectedItem.annotations && Object.keys(selectedItem.annotations).length > 0 && (
                                   <>
                                     <h3 className="text-xs font-bold text-gray-500 uppercase mt-4">Annotations</h3>
                                     <div className="mt-2 border rounded-md divide-y divide-gray-200">
                                        {Object.entries(selectedItem.annotations).map(([key, value]) => (
                                            <div key={key} className="p-3">
                                                <div className="text-xs text-gray-500 font-semibold">{key}</div>
                                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{value.toString()}</p>
                                            </div>
                                        ))}
                                     </div>
                                   </>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 h-full">
                                <div className="border-2 border-dashed border-gray-300 rounded-lg w-full h-full flex items-center justify-center">
                                    <span className="text-lg">Nothing selected</span>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
                
                 <aside className="w-80 bg-white flex flex-col">
                    <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center justify-between text-xs font-bold text-gray-600">
                        <span>Comments: {selectedItem ? selectedItem.label : ''}</span>
                        <button className="p-1 hover:bg-gray-200 rounded"><X size={14} /></button>
                    </div>
                     <div className="flex-1 p-2 overflow-y-auto">{/* Comments content */}</div>
                     <div className="h-48 shrink-0 border-t border-gray-200 flex flex-col">
                         <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center justify-between text-xs font-bold text-gray-600">
                            <span>Project Feed</span>
                            <button className="p-1 hover:bg-gray-200 rounded"><X size={14} /></button>
                        </div>
                        <div className="flex-1 p-2 overflow-y-auto">{/* Feed content */}</div>
                    </div>
                </aside>
            </main>

            {isCreateClassModalOpen && (
                <CreateClassModal onClose={() => setCreateClassModalOpen(false)} onCreate={handleCreateClass} />
            )}
        </div>
    );
};

export default Dashboard;