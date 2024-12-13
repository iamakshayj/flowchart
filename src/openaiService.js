import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

// Generate Flowchart Nodes and Edges from GPT
export const generateFlowchartPattern = async (userInput) => {
  if (!userInput.trim()) return null;

  try {
    // Generate the response from GPT
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

    // Parse response
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

    if (totalChildren === 0) return; // No children to position

    // Calculate the width of the subtree for even spacing
    const totalSubtreeWidth = totalChildren * xIncrement;
    let startX = currentX - (totalSubtreeWidth - xIncrement) / 2;

    childEdges.forEach((edge) => {
      const childNodeName = edge.toNode;

      if (!visitedNodes.has(childNodeName)) {
        let childX = startX;
        const childY = currentY + yIncrement;

        // Check for overlapping positions and adjust
        while (Object.values(positions).some(pos => pos.x === childX && pos.y === childY)) {
          childX += xIncrement; // Move to the next available position
        }

        positions[childNodeName] = { x: childX, y: childY };

        startX += xIncrement;

        const childNode = nodes.find((node) => node.name === childNodeName);
        if (childNode) {
          // Recursively position grandchildren
          positionNodes(childNode, childX, childY, visitedNodes);
        }
      }
    });
  };

  // Adjust parent node positions based on child positions
  const adjustParentPositions = () => {
    const visitedNodes = new Set();
    const reverseNodes = [...nodes].reverse();

    reverseNodes.forEach((node) => {
      if (visitedNodes.has(node.name)) return;

      const childEdges = edges.filter((edge) => edge.fromNode === node.name);
      const childPositions = childEdges
        .map((edge) => positions[edge.toNode])
        .filter((pos) => pos); // Ensure child positions exist

      if (childPositions.length > 0) {
        // Compute the midpoint of child nodes' x positions
        const minX = Math.min(...childPositions.map((pos) => pos.x));
        const maxX = Math.max(...childPositions.map((pos) => pos.x));
        const midpointX = (minX + maxX) / 2;

        // Update the current node's x position
        positions[node.name].x = midpointX;
      }

      visitedNodes.add(node.name);
    });
  };

  // Fix node merging where children lead to the same node
  const handleMergingNodes = () => {
    // Iterate over all nodes to check if any node is being converged upon
    const childToParents = edges.reduce((acc, edge) => {
      if (!acc[edge.toNode]) acc[edge.toNode] = [];
      acc[edge.toNode].push(edge.fromNode);
      return acc;
    }, {});

    Object.keys(childToParents).forEach((childNode) => {
      const parents = childToParents[childNode];
      if (parents.length > 1) {
        // Multiple parents are leading to the same node (merge situation)
        const childNodePosition = positions[childNode];
        const minX = Math.min(...parents.map((parent) => positions[parent].x));
        const maxX = Math.max(...parents.map((parent) => positions[parent].x));

        // Reposition the converging node (childNode) to be centered
        positions[childNode].x = (minX + maxX) / 2;

        // Ensure there's enough space between parents
        let startX = minX - (parents.length - 1) * (xIncrement / 2);
        let deltaX = xIncrement;

        // Adjust the parents to make sure they don't overlap with each other
        parents.forEach((parent, index) => {
          positions[parent].x = startX + index * deltaX;
        });

        // Ensure proper spacing between the merged child and the parents
        const totalWidth = (parents.length - 1) * xIncrement;
        if (positions[childNode].x < minX + totalWidth) {
          positions[childNode].x = minX + totalWidth + xIncrement;
        }
      }
    });
  };

  // Start positioning from the root node
  positionNodes(rootNode, positions[rootNode.name].x, positions[rootNode.name].y);

  // Handle cases where child nodes are converging to the same node
  handleMergingNodes();

  // Adjust parent positions after initial positioning
  adjustParentPositions();

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
