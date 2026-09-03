import React from 'react';

export function CamouflageScreen() {
  const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
  const rows = Array.from({ length: 50 }, (_, i) => i + 1);

  return (
    <div style={{ background: '#fff', color: '#000', height: '100vh', width: '100vw', fontFamily: 'Arial, sans-serif', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, zIndex: 99999 }}>
      {/* Fake Header / Ribbon */}
      <div style={{ background: '#f8f9fa', padding: '10px 15px', borderBottom: '1px solid #dadce0', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <div style={{ width: '20px', height: '24px', background: '#0f9d58', borderRadius: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '10px', height: '2px', background: '#fff', margin: '1px 0' }}></div>
            <div style={{ width: '10px', height: '2px', background: '#fff', margin: '1px 0' }}></div>
            <div style={{ width: '10px', height: '2px', background: '#fff', margin: '1px 0' }}></div>
          </div>
          <span style={{ fontSize: '16px', color: '#202124', paddingLeft: '8px' }}>Untitled spreadsheet</span>
        </div>
      </div>
      <div style={{ background: '#f8f9fa', padding: '4px 15px 8px 15px', borderBottom: '1px solid #dadce0', display: 'flex', gap: '18px', fontSize: '13px', color: '#202124' }}>
        <span>File</span><span>Edit</span><span>View</span><span>Insert</span><span>Format</span><span>Data</span><span>Tools</span><span>Extensions</span><span>Help</span>
      </div>

      {/* Fake Formula Bar */}
      <div style={{ padding: '6px 15px', borderBottom: '1px solid #dadce0', display: 'flex', gap: '10px', alignItems: 'center', background: '#fff' }}>
        <span style={{ fontSize: '13px', fontStyle: 'italic', color: '#5f6368', width: '25px', textAlign: 'center' }}>fx</span>
        <div style={{ flex: 1, height: '22px', border: '1px solid #dadce0', borderRadius: '2px', background: '#fff' }}></div>
      </div>

      {/* Fake Grid */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Row Headers */}
        <div style={{ width: '46px', background: '#f8f9fa', borderRight: '1px solid #c0c0c0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: '25px', borderBottom: '1px solid #c0c0c0' }}></div>
          {rows.map(r => (
            <div key={r} style={{ height: '21px', borderBottom: '1px solid #e0e0e0', fontSize: '12px', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {r}
            </div>
          ))}
        </div>
        {/* Cells */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', background: '#f8f9fa', borderBottom: '1px solid #c0c0c0' }}>
            {cols.map(c => (
              <div key={c} style={{ width: '100px', height: '25px', borderRight: '1px solid #c0c0c0', fontSize: '12px', color: '#5f6368', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {c}
              </div>
            ))}
          </div>
          {/* Cell Grid Lines */}
          <div style={{ flex: 1, background: '#fff', backgroundImage: 'linear-gradient(to right, #e0e0e0 1px, transparent 1px), linear-gradient(to bottom, #e0e0e0 1px, transparent 1px)', backgroundSize: '100px 21px' }}>
          </div>
        </div>
      </div>
    </div>
  );
}
