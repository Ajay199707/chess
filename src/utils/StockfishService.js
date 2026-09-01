export class StockfishService {
  constructor() {
    this.worker = null;
    this.isReady = false;
    this.evalCallback = null;
    this.bestMoveCallback = null;
  }

  async init() {
    if (this.worker) return;
    
    // In Vite, we can create a worker directly from the node_modules path or a public asset.
    // However, stockfish.js provides a factory. The easiest way in a React/Vite app is to load it from CDN
    // or use a direct worker script. Let's try loading it via a Blob or importing the script.
    
    try {
      this.worker = new Worker('/stockfish.js');
      
      this.worker.onmessage = (e) => this.handleMessage(e);
      this.worker.postMessage('uci');
    } catch (e) {
      console.error("Failed to initialize Stockfish:", e);
    }
  }

  handleMessage(event) {
    const line = typeof event === 'string' ? event : event.data;
    
    if (line === 'uciok') {
      this.isReady = true;
      this.worker.postMessage('isready');
    }

    // Parse evaluation
    // Example: info depth 12 seldepth 17 multipv 1 score cp 33 nodes 53139 nps 1328475 tbhits 0 time 40 pv e2e4 e7e5 ...
    // Example: info depth 12 ... score mate 3 ...
    if (line.startsWith('info depth') && line.includes('score')) {
      const matchCp = line.match(/score cp (-?\d+)/);
      const matchMate = line.match(/score mate (-?\d+)/);
      
      if (matchCp && this.evalCallback) {
        this.evalCallback({ type: 'cp', value: parseInt(matchCp[1], 10) });
      } else if (matchMate && this.evalCallback) {
        this.evalCallback({ type: 'mate', value: parseInt(matchMate[1], 10) });
      }
    }

    if (line.startsWith('bestmove')) {
      const match = line.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
      if (match && this.bestMoveCallback) {
        this.bestMoveCallback(match[1]);
      }
    }
  }

  evaluatePosition(fen, depth = 12, onEval) {
    this.evalCallback = onEval;
    this.worker.postMessage('stop');
    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`go depth ${depth}`);
  }

  stop() {
    if (this.worker) {
      this.worker.postMessage('stop');
    }
  }

  destroy() {
    if (this.worker) {
      this.worker.postMessage('quit');
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}
