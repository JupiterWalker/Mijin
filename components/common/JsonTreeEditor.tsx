import React, { useRef, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';

interface JsonTreeEditorProps {
  value: string;
  onChange: (val: string) => void;
  height?: string;
}

export const JsonTreeEditor: React.FC<JsonTreeEditorProps> = ({ value, onChange, height = "250px" }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const linesInfo = useMemo(() => {
    const lines = value.split('\n');
    const hexRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/;
    return lines.map((line, idx) => {
      const match = line.match(hexRegex);
      return {
        lineIndex: idx,
        color: match ? match[0] : null,
      };
    });
  }, [value]);

  const handleColorChange = (lineIdx: number, newColor: string) => {
    const lines = value.split('\n');
    const hexRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/;
    lines[lineIdx] = lines[lineIdx].replace(hexRegex, newColor);
    onChange(lines.join('\n'));
  };

  const handleEditorScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = (e.target as HTMLDivElement).scrollTop;
    }
  };

  return (
    <div className="flex rounded-lg border border-slate-700 bg-[#282c34] overflow-hidden shadow-2xl relative">
      <div 
        ref={gutterRef}
        className="w-8 bg-[#1e2227] border-r border-slate-800 flex flex-col items-center no-scrollbar pointer-events-none"
        style={{ height }}
      >
        <div className="w-full flex flex-col" style={{ height: `${linesInfo.length * 20}px` }}>
          {linesInfo.map((info, idx) => (
            <div 
              key={idx} 
              className="h-[20px] w-full flex items-center justify-center pointer-events-auto"
            >
              {info.color && (
                <div className="relative w-4 h-4 rounded-sm overflow-hidden flex items-center justify-center group">
                  <input
                    type="color"
                    value={info.color.length === 4 ? `#${info.color[1]}${info.color[1]}${info.color[2]}${info.color[2]}${info.color[3]}${info.color[3]}` : info.color}
                    onChange={(e) => handleColorChange(idx, e.target.value)}
                    className="color-swatch-input absolute inset-0 w-8 h-8 -translate-x-2 -translate-y-2 cursor-pointer"
                  />
                  <div 
                    className="absolute inset-0 pointer-events-none rounded-sm border border-white/10"
                    style={{ backgroundColor: info.color }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 min-w-0" onScroll={handleEditorScroll}>
        <CodeMirror
          value={value}
          height={height}
          theme={oneDark}
          extensions={[json()]}
          onChange={(val) => onChange(val)}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
          }}
          className="text-xs"
        />
      </div>
    </div>
  );
};
