const { execSync } = require('child_process');

const PORT = Number(process.env.PORT) || 3000;

function killProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano -p tcp | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });

      const pids = new Set();
      output.split('\n').forEach((line) => {
        if (!/LISTENING/i.test(line)) return;
        const match = line.trim().match(/(\d+)\s*$/);
        if (match && match[1] !== '0') {
          pids.add(match[1]);
        }
      });

      pids.forEach((pid) => {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          console.log(`Stopped previous process ${pid} using port ${port}`);
        } catch {
          // ignore if process already exited
        }
      });
      return;
    }

    execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
  } catch {
    // Port is already free
  }
}

killProcessOnPort(PORT);
require('../server.js');
