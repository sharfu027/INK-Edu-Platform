import { runFaceCLI } from './faceBridge.js';

async function testBridge() {
  console.log('Testing Face CLI Bridge...');
  try {
    // We will call the "encrypt" action with a mock 128-d embedding
    const mockEmbedding = Array(128).fill(0.1);
    
    console.log('Sending encrypt action to Python...');
    const result = await runFaceCLI('encrypt', { embeddings: [mockEmbedding] });
    console.log('Result from Python CLI:', result);
    
    if (result.status && result.encrypted_embeddings) {
      console.log('Success! Python Face CLI Bridge is fully operational.');
      process.exit(0);
    } else {
      console.error('Bridge returned unexpected format:', result);
      process.exit(1);
    }
  } catch (err) {
    console.error('Bridge execution failed:', err);
    process.exit(1);
  }
}

testBridge();
