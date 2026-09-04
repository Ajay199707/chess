const fs = require('fs');
let code = fs.readFileSync('src/components/Chessboard.jsx', 'utf8');

code = code.replace(
  'const [animatingMove, setAnimatingMove] = useState(null);',
  'const [animatingMove, setAnimatingMove] = useState(null);\n  const [customHighlights, setCustomHighlights] = useState(new Set());\n  const [arrows, setArrows] = useState([]);\n  const [drawStart, setDrawStart] = useState(null);\n  const [drawCurrent, setDrawCurrent] = useState(null);'
);

code = code.replace(
  '// Clear selections when game state changes',
  \// Arrow & Highlight Handlers
  const handleSquareMouseDown = (e, square) => {
    if (e.button === 2) {
      setDrawStart(square);
      setDrawCurrent(square);
    } else if (e.button === 0) {
      setCustomHighlights(new Set());
      setArrows([]);
    }
  };

  const handleSquareMouseEnter = (square) => {
    if (drawStart) {
      setDrawCurrent(square);
    }
  };

  const handleSquareMouseUp = (e, square) => {
    if (e.button === 2 && drawStart) {
      if (drawStart === square) {
        setCustomHighlights(prev => {
          const next = new Set(prev);
          if (next.has(square)) next.delete(square);
          else next.add(square);
          return next;
        });
      } else {
        setArrows(prev => {
          const existingIdx = prev.findIndex(a => a.start === drawStart && a.end === square);
          if (existingIdx >= 0) {
            return prev.filter((_, i) => i !== existingIdx);
          } else {
            return [...prev, { start: drawStart, end: square }];
          }
        });
      }
      setDrawStart(null);
      setDrawCurrent(null);
    }
  };

  // Clear selections when game state changes\
);

code = code.replace(
  'onClick={() => handleSquareClick(squareName)}',
  'onClick={() => handleSquareClick(squareName)}\n                onMouseDown={(e) => handleSquareMouseDown(e, squareName)}\n                onMouseEnter={() => handleSquareMouseEnter(squareName)}\n                onMouseUp={(e) => handleSquareMouseUp(e, squareName)}'
);

code = code.replace(
  "if (isSelected) squareClass += ' selected';",
  "if (isSelected) squareClass += ' selected';\n            if (customHighlights.has(squareName)) squareClass += ' custom-highlight';"
);

code = code.replace(
  "// Visually move the piece if it\\'s currently premoved",
  \const getSquareCenter = (sq) => {
              const fileIdx = displayFiles.indexOf(sq[0]);
              const rankIdx = displayRanks.indexOf(parseInt(sq[1]));
              return {
                x: fileIdx * 12.5 + 6.25,
                y: rankIdx * 12.5 + 6.25
              };
            };
            
            // Visually move the piece if it's currently premoved\
);

code = code.replace(
  "  return (\n    <div \n      className={\chessboard-wrapper theme-\\}",
  \  // Draw Arrows Overlay
  const renderArrows = () => {
    const allArrows = [...arrows];
    if (drawStart && drawCurrent && drawStart !== drawCurrent) {
      allArrows.push({ start: drawStart, end: drawCurrent, isTemp: true });
    }
    
    if (allArrows.length === 0) return null;

    return (
      <svg className="arrows-overlay" viewBox="0 0 100 100" style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10}}>
        <defs>
          <marker id="arrowhead" markerWidth="4" markerHeight="4" refX="2.5" refY="2" orient="auto">
            <polygon points="0 0, 4 2, 0 4" fill="rgba(235, 97, 80, 0.8)" />
          </marker>
        </defs>
        {allArrows.map((arrow, idx) => {
          const s = getSquareCenter(arrow.start);
          const e = getSquareCenter(arrow.end);
          // Shorten the end slightly so arrowhead doesn't cover center
          const dx = e.x - s.x;
          const dy = e.y - s.y;
          const len = Math.sqrt(dx*dx + dy*dy);
          const shorten = 3;
          const ex = e.x - (dx/len)*shorten;
          const ey = e.y - (dy/len)*shorten;
          
          return (
            <line
              key={idx}
              x1={s.x}
              y1={s.y}
              x2={ex}
              y2={ey}
              stroke="rgba(235, 97, 80, 0.8)"
              strokeWidth="1.8"
              markerEnd="url(#arrowhead)"
            />
          );
        })}
      </svg>
    );
  };

  return (
    <div 
      className={\\\chessboard-wrapper theme-\\\\\\}\
);

code = code.replace(
  '<div className="chessboard">',
  '<div className="chessboard" style={{position: \\'relative\\'}}>\n        {renderArrows()}'
);

fs.writeFileSync('src/components/Chessboard.jsx', code);
