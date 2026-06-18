import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to python executable in virtual environment
// Note: our current dir is backend/src/utils. The venv is at backend/venv.
const PYTHON_PATH = path.resolve(__dirname, '../../venv/Scripts/python.exe');
const SCRIPT_PATH = path.resolve(__dirname, '../../face_cli.py');

/**
 * Execute an action on the Python face recognition CLI tool.
 * @param {string} action - Action to perform (e.g., 'compare', 'extract_embedding')
 * @param {Object} args - Arguments to pass to the CLI
 * @returns {Promise<Object>} JSON response from the Python CLI
 */
export const runFaceCLI = (action, args = {}) => {
  return new Promise((resolve, reject) => {
    const pyProcess = spawn(PYTHON_PATH, [SCRIPT_PATH]);
    
    let stdoutData = '';
    let stderrData = '';

    pyProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pyProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pyProcess.on('close', (code) => {
      if (stderrData && process.env.DEBUG === 'true') {
        console.error('Python CLI Stderr:', stderrData);
      }
      
      if (code !== 0) {
        return reject(new Error(`Python Face CLI failed with exit code ${code}. Stderr: ${stderrData}`));
      }

      try {
        const result = JSON.parse(stdoutData.trim());
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse Python CLI output: "${stdoutData}". Error: ${err.message}`));
      }
    });

    // Write request JSON to stdin
    pyProcess.stdin.write(JSON.stringify({ action, args }));
    pyProcess.stdin.end();
  });
};

export default runFaceCLI;
