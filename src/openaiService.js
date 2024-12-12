import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

// Generate Flowchart Nodes and Edges from GPT
export const generateFlowchartPattern = async (userInput) => {
  if (!userInput.trim()) return null;

  try {
    // Generate the edges from GPT
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Convert the following input into a flowchart/graph representation of the steps with nodes and edges, which can have conditional statements, loops, etc. Use this exact format: 'Node "name1" to Node "name2" with edge "label"'. The input is:\n\n${userInput}`,
        },
      ],
    });

    const generatedText = response.choices[0].message.content.trim();
    console.log("GPT Response:", generatedText);

    // Parse edges
    const edges = generatedText.split('\n').map((line) => {
      const pattern = /Node "([^"]+)" to Node "([^"]+)"(?: with edge "([^"]+)")?/i;
      const match = pattern.exec(line.trim());

      if (match) {
        return {
          fromNode: match[1],
          toNode: match[2],
          edgeLabel: match[3] || '',
        };
      }

      return null;
    }).filter(Boolean);

    if (edges.length === 0) return [];

    // Extract unique nodes
    const nodeSet = new Set();
    edges.forEach(({ fromNode, toNode }) => {
      nodeSet.add(fromNode);
      nodeSet.add(toNode);
    });

    const nodes = Array.from(nodeSet).map((name) => ({ name }));

    // Validate the root node
    const allToNodes = new Set(edges.map((edge) => edge.toNode));
    const rootNode = nodes.find((node) => !allToNodes.has(node.name));
    if (!rootNode) throw new Error("Root node not found. Please check the input.");

    // Generate positions for each node
    const positions = generateTreeNodePositions(nodes, edges);

    // Format the result with positions
    const flowchartData = edges.map(({ fromNode, toNode, edgeLabel }) => ({
      fromNode,
      fromNodeX: positions[fromNode].x,
      fromNodeY: positions[fromNode].y,
      toNode,
      toNodeX: positions[toNode].x,
      toNodeY: positions[toNode].y,
      edgeLabel,
    }));

    return flowchartData;
  } catch (error) {
    console.error('Error generating flowchart pattern from GPT:', error);
    return [];
  }
};

// Generate Node Positions for Tree-like Structure
export const generateTreeNodePositions = (nodes, edges) => {
  const positions = {};
  const xIncrement = 300; 
  const yIncrement = 100; 

  // Identify the root node dynamically
  const allToNodes = new Set(edges.map((edge) => edge.toNode));
  const rootNode = nodes.find((node) => !allToNodes.has(node.name));
  if (!rootNode) throw new Error("Root node not found.");

  // Position the root node
  positions[rootNode.name] = { x: 200, y: 100 };

  // Helper function to recursively position child nodes
  const positionNodes = (currentNode, currentX, currentY, visitedNodes = new Set()) => {
    visitedNodes.add(currentNode.name);
  
    const childEdges = edges.filter((edge) => edge.fromNode === currentNode.name);
    const totalChildren = childEdges.length;
  
    childEdges.forEach((edge, index) => {
      const childNodeName = edge.toNode;
  
      if (!visitedNodes.has(childNodeName)) {
        // Spread children symmetrically around the parent
        const childX = currentX + (index - (totalChildren - 1) / 2) * xIncrement;
        positions[childNodeName] = { x: childX, y: currentY + yIncrement };
  
        const childNode = nodes.find((node) => node.name === childNodeName);
        if (childNode) {
          positionNodes(childNode, childX, currentY + yIncrement, visitedNodes);
        }
      }
    });
  };

  // Start positioning from the root node
  positionNodes(rootNode, positions[rootNode.name].x, positions[rootNode.name].y);

  return positions;
};


// Full Flowchart Generation
export const generateFlowchart = async (userInput) => {
  try {
    const edges = await generateFlowchartPattern(userInput);
    const nodeSet = new Set();
    edges.forEach(({ fromNode, toNode }) => {
      nodeSet.add(fromNode);
      nodeSet.add(toNode);
    });

    const nodes = Array.from(nodeSet).map((name) => ({ name }));
    const nodePositions = generateTreeNodePositions(nodes, edges);

    return {
      nodes: nodes.map((node) => ({
        ...node,
        position: nodePositions[node.name],
      })),
      edges,
    };
  } catch (error) {
    console.error('Error generating flowchart:', error);
    return { nodes: [], edges: [] };
  }
};
