import 'reactflow/dist/style.css';
import './App.css';
import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  MarkerType
} from 'reactflow';
import { generateFlowchartPattern } from './openaiService';
import { toPng } from 'html-to-image';

function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [userInput, setUserInput] = useState('');
  const [edgeLabel, setEdgeLabel] = useState('');

  // Load nodes and edges from local storage on component mount
  useEffect(() => {
    const savedNodes = JSON.parse(localStorage.getItem('nodes')) || [];
    const savedEdges = JSON.parse(localStorage.getItem('edges')) || [];
    setNodes(savedNodes);
    setEdges(savedEdges);
  }, []);

  // Save nodes and edges to local storage on changes
  useEffect(() => {
    localStorage.setItem('nodes', JSON.stringify(nodes));
  }, [nodes]);

  useEffect(() => {
    localStorage.setItem('edges', JSON.stringify(edges));
  }, [edges]);

  //Download flowchart as png
  function downloadImage(dataUrl) {
    const a = document.createElement('a');
   
    a.setAttribute('download', 'reactflow.png');
    a.setAttribute('href', dataUrl);
    a.click();
  }
  // frame size for png 
  const imageWidth = 1524;
  const imageHeight = 798;
  const exportToImage = useCallback(() => {
    const reactFlowWrapper = document.querySelector('.react-flow');
    
    if (!reactFlowWrapper) {
      console.error('React Flow wrapper not found.');
      return;
    }
  
    toPng(reactFlowWrapper, {
      backgroundColor: '#fffff', 
      width: imageWidth,          
      height: imageHeight,        
      style: {
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transform: 'scale(1)',   
      },
    })
      .then(downloadImage)
      .catch((err) => {
        console.error('Error exporting image:', err);
      });
  }, []);
  
  //update nodes/edges on every change
  const onNodesChange = useCallback(
    (changes) =>
      setNodes((nds) =>
        applyNodeChanges(changes, nds).map((node) => {
          if (node.selected) {
            setSelectedNodeId(node.id);
          }
          return node;
        })
      ),
    []
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    []
  );

  //Select state for nodes/edges to wdit
  const onNodeClick = useCallback(
    (_, node) => {
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
    },
    []
  );

  const onEdgeClick = useCallback(
    (_, edge) => {
      setSelectedEdgeId(edge.id);
      setSelectedNodeId(null);
      setEdgeLabel(edge.label || '');
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  //Add nodes function
  const addNode = (label, x = Math.random() * 500, y = Math.random() * 500) => {
    if (!nodes.some((node) => node.id === label)) {
      const newNode = {
        id: label,
        position: { x, y },
        data: { label },
      };
      setNodes((nds) => [...nds, newNode]);
    }
  };

  //Add edges to generate flowchart
  const addEdgeFromInput = (fromNode, fromX, fromY, toNode, toX, toY, edgeLabel) => {
    addNode(fromNode, fromX, fromY);
    addNode(toNode, toX, toY);

    if (!edges.some((edge) => edge.source === fromNode && edge.target === toNode)) {
      const newEdge = {
        id: `${fromNode}-${toNode}`,
        source: fromNode,
        target: toNode,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
        },
        label: edgeLabel || null,
      };
      setEdges((eds) => [...eds, newEdge]);
    }
  };

  //Delete node button and related edges
  const deleteNode = () => {
    if (selectedNodeId) {
      setNodes((nds) => nds.filter((node) => node.id !== selectedNodeId));
      setEdges((eds) => eds.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
      setSelectedNodeId(null);
    }
  };

  const deleteEdge = () => {
    if (selectedEdgeId) {
      setEdges((eds) => eds.filter((edge) => edge.id !== selectedEdgeId));
      setSelectedEdgeId(null);
    }
  };

  //Update node text/color
  const handleNodeLabelChange = (event) => {
    const updatedLabel = event.target.value;
    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedNodeId ? { ...node, data: { ...node.data, label: updatedLabel } } : node
      )
    );
  };

  const changeNodeColor = (color) => {
    if (selectedNodeId) {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === selectedNodeId
            ? { ...node, style: { ...node.style, backgroundColor: color } }
            : node
        )
      );
    }
  };

  //Update edge text
  const handleEdgeLabelChange = (event) => {
    const updatedLabel = event.target.value;
    setEdges((eds) =>
      eds.map((edge) =>
        edge.id === selectedEdgeId ? { ...edge, label: updatedLabel } : edge
      )
    );
    setEdgeLabel(updatedLabel);
  };

  //Black flowchart
  const clearAll = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  //Get user input and pass param to generate flowchart
  const handleInputSubmit = async () => {
    try {
      const flowchartData = await generateFlowchartPattern(userInput);

      if (flowchartData && flowchartData.length) {
        flowchartData.forEach(({ fromNode, fromNodeX, fromNodeY, toNode, toNodeX, toNodeY, edgeLabel }) => {
          addEdgeFromInput(fromNode, fromNodeX, fromNodeY, toNode, toNodeX, toNodeY, edgeLabel || '');
          console.log(fromNode, fromNodeX, fromNodeY, toNode, toNodeX, toNodeY, edgeLabel);
        });
      } else {
        console.error('No data generated from input.');
      }

      setUserInput('');
    } catch (error) {
      console.error('Error generating flowchart:', error);
    }
  };

  return (
    <div className="reactflow-container">
      <button className="clear-all-button" onClick={clearAll}>
        Clear All
      </button>
      <button className="export-button" onClick={exportToImage}>
        Export
      </button>
      {selectedNodeId ? (
        <div className="node-edit">
          <input
            type="text"
            value={nodes.find((node) => node.id === selectedNodeId)?.data.label || ''}
            onChange={handleNodeLabelChange}
          />
          <div className="color-buttons">
            <button
              className="green"
              onClick={() => changeNodeColor('#A8D5BA')}
            ></button>
            <button
              className="yellow"
              onClick={() => changeNodeColor('#FDFD96')}
            ></button>
            <button
              className="red"
              onClick={() => changeNodeColor('#F4A8A8')}
            ></button>
          </div>

          <button onClick={deleteNode}>Delete Node</button>
        </div>
      ) : selectedEdgeId ? (
        <div className="edge-edit">
          <input type="text" value={edgeLabel} onChange={handleEdgeLabelChange} />
          <button onClick={deleteEdge}>Delete Edge</button>
        </div>
      ) : (
        <button
          className="add-node-button"
          onClick={() => addNode(`Node ${nodes.length + 1}`)}
        >
          + Add Node
        </button>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
      >
        <MiniMap
          nodeColor={(node) => {
            if (node.id === selectedNodeId) return 'green';
            return 'gray';
          }}
          nodeBorderRadius={2}
        />
        <Background />
        <Controls />
      </ReactFlow>
      <div className="user-input-container">
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          rows={5}
          placeholder="e.g., Describe your flowchart"
        />
        <button onClick={handleInputSubmit}>Submit</button>
      </div>
    </div>
  );
}

export default App;
