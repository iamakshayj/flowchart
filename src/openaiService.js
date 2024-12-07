
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true 
});

export const generateFlowchartPattern = async (userInput) => {
  if (!userInput.trim()) return;
  console.log(userInput);
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // or use any other model you prefer
      messages: [
        {
          role: 'user',
          content: `Convert the following user input into a flowchart with nodes and edges properly positioned to represent multiple childs, implement conditional logic, and loops spaced with a minimum of 200 pixels. The output should be in this exact format:: 'Node "name1" at x: <x> y: <y> to Node "name2" at x: <x> y: <y> with edge "label"'. The user prompt is \n\n${userInput}`,
        },
      ],
    }); 
    const generatedText = response.choices[0].message.content.trim();
    console.log(generatedText);
    // Split the response into lines and return the lines to be processed
    return generatedText.split('\n').map((line) => {
      const pattern = /Node "([^"]+)" at x: (\d+\.?\d*) y: (\d+\.?\d*) to Node "([^"]+)" at x: (\d+\.?\d*) y: (\d+\.?\d*) with edge "([^"]+)"/i;
      const match = pattern.exec(line.trim());

      if (match) {
        return {
          fromNode: match[1],
          fromNodeX: parseFloat(match[2]),
          fromNodeY: parseFloat(match[3]),
          toNode: match[4],
          toNodeX: parseFloat(match[5]),
          toNodeY: parseFloat(match[6]),
          edgeLabel: match[7] || '',
        };
      }

      return null;
    }).filter(Boolean);
  } catch (error) {
    console.error('Error generating flowchart input:', error);
    return [];
  }
};
