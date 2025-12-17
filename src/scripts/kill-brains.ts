// import psList from 'ps-list';
import { exec } from 'child_process';

const isWin = process.platform === 'win32';

if (isWin) {
  // Find node processes and filter
  exec('wmic process where "name=\'node.exe\'" get commandline,processid', (err, stdout) => {
    if (err) return console.error(err);
    
    const lines = stdout.split('\n');
    lines.forEach(line => {
      if (line.includes('brain/index.ts') || line.includes('brain\\index.ts')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        console.log(`Killing Brain PID: ${pid}`);
        try {
            process.kill(Number(pid), 'SIGKILL');
        } catch (e) { console.log('Already dead'); }
      }
    });
  });
} else {
    // Linux/Mac
     exec('pkill -f "brain/index.ts"', (err) => {
         console.log('Killed brain processes');
     });
}

