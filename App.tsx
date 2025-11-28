import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layer, ExportData, Coordinates } from './types';
import { Icons } from './components/Icon';

// --- Constants ---
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

// --- Helpers ---

const calculateRotatedDimensions = (width: number, height: number, rotation: number, scale: number) => {
  // Normalize rotation to 0-360 positive range for cleaner logic
  let r = rotation % 360;
  if (r < 0) r += 360;

  const s = isNaN(scale) ? 1 : scale;
  const w = isNaN(width) ? 0 : width;
  const h = isNaN(height) ? 0 : height;

  const scaledW = w * s;
  const scaledH = h * s;

  // Snap to exact values for orthogonal angles to prevent float distortion
  // 0, 180, 360: Width/Height remain (just inverted if 180, but bbox size is same)
  if (Math.abs(r - 0) < 0.05 || Math.abs(r - 180) < 0.05 || Math.abs(r - 360) < 0.05) {
      return { width: scaledW, height: scaledH };
  }
  // 90, 270: Width/Height swap exactly
  if (Math.abs(r - 90) < 0.05 || Math.abs(r - 270) < 0.05) {
      return { width: scaledH, height: scaledW };
  }

  const angleRad = Math.abs((rotation * Math.PI) / 180);
  const cos = Math.abs(Math.cos(angleRad));
  const sin = Math.abs(Math.sin(angleRad));
  
  // Matches Python: new_w = (h * sin) + (w * cos)
  const newW = (scaledH * sin) + (scaledW * cos);
  const newH = (scaledH * cos) + (scaledW * sin);

  return { width: newW, height: newH };
};

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }> = ({ 
  className = '', 
  variant = 'secondary', 
  children, 
  ...props 
}) => {
  const baseStyles = "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:ring-offset-1 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 backdrop-blur-sm";
  
  // Frosted Glass Variants
  const variants = {
    primary: "bg-sky-500/90 hover:bg-sky-500 text-white shadow-lg shadow-sky-500/30 border border-sky-400/50",
    secondary: "bg-white/40 hover:bg-white/70 text-slate-700 border border-white/60 shadow-sm hover:shadow-md",
    danger: "bg-red-50/50 hover:bg-red-100/80 text-red-500 border border-red-100/50",
    ghost: "bg-transparent hover:bg-white/40 text-slate-500 hover:text-slate-800"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const InputGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5 mb-5">
    <label className="text-[10px] font-bold text-slate-500/80 uppercase tracking-widest px-1 drop-shadow-sm">{label}</label>
    {children}
  </div>
);

const NumberInput: React.FC<{ 
  value: number | ''; 
  onChange: (val: number) => void; 
  onBlur?: () => void;
  step?: number;
  label?: string;
  placeholder?: string;
}> = ({ value, onChange, onBlur, step = 1, label, placeholder }) => {
  // Local state to handle intermediate inputs (like "-", empty string, "0.")
  const [localValue, setLocalValue] = useState<string>(value === '' ? '' : value.toString());

  // Sync with external value changes
  useEffect(() => {
    if (value !== '' && typeof value === 'number' && !isNaN(value)) {
       // Only sync if the parsed local value is different to avoid cursor jumps
       // or interfering with typing (e.g. typing "1.0" where float val is 1)
       // We use a loose comparison or parseFloat to check logic
       if (parseFloat(localValue) !== value) {
         setLocalValue(value.toString());
       }
    } else if (value === '') {
        setLocalValue('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]); // Intentionally omitting localValue to prevent typing loops

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);

    const parsed = parseFloat(newVal);
    // Only propagate valid numbers to parent
    // Allow empty string to pass if needed, or handle clearing logic
    if (!isNaN(parsed) && newVal !== '' && newVal !== '-') {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    // When leaving field, ensure we show the valid parent value, scrubbing any partial input like "-"
    if (value !== '' && !isNaN(Number(value))) {
        setLocalValue(value.toString());
    } else {
        setLocalValue('');
    }
    if (onBlur) onBlur();
  };

  return (
    <div className="flex items-center bg-white/30 hover:bg-white/50 border border-white/50 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-sky-400/50 focus-within:bg-white/60 transition-all shadow-sm backdrop-blur-sm">
      {label && <span className="pl-3 text-xs text-slate-500 select-none font-semibold">{label}</span>}
      <input
        type="text" // Use text to allow "-" and custom formatting while typing
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-slate-700 p-2.5 outline-none appearance-none placeholder-slate-400/70 font-medium"
      />
    </div>
  );
};

const AngleInput: React.FC<{
  value: number | '';
  onChange: (val: number) => void;
  onBlur?: () => void;
  step: number;
  label?: string;
  placeholder?: string;
}> = ({ value, onChange, onBlur, step, label, placeholder }) => {
  const [localValue, setLocalValue] = useState<string>(value === '' ? '' : value.toString());

  useEffect(() => {
    if (value !== '' && typeof value === 'number' && !isNaN(value)) {
      if (parseFloat(localValue) !== value) {
        setLocalValue(value.toString());
      }
    } else if (value === '') {
      setLocalValue('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const increment = () => {
    const current = typeof value === 'number' ? value : 0;
    onChange(current + step);
  };

  const decrement = () => {
    const current = typeof value === 'number' ? value : 0;
    onChange(current - step);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      increment();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      decrement();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);

    const parsed = parseFloat(newVal);
    if (!isNaN(parsed) && newVal !== '' && newVal !== '-') {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    if (value !== '' && !isNaN(Number(value))) {
      setLocalValue(value.toString());
    } else {
      setLocalValue('');
    }
    if (onBlur) onBlur();
  };

  return (
    <div className="flex items-center gap-1">
      <div className="flex-1 flex items-center bg-white/30 hover:bg-white/50 border border-white/50 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-sky-400/50 focus-within:bg-white/60 transition-all shadow-sm backdrop-blur-sm">
        {label && <span className="pl-3 text-xs text-slate-500 select-none font-semibold">{label}</span>}
        <input
          type="text"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-slate-700 p-2.5 outline-none appearance-none placeholder-slate-400/70 font-medium"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <button
          onClick={increment}
          className="p-1 bg-white/50 hover:bg-white/70 border border-white/50 rounded-md text-slate-500 hover:text-slate-700 transition-all shadow-sm active:scale-95"
          type="button"
          title="Increase angle"
        >
          <Icons.ChevronUp size={14} />
        </button>
        <button
          onClick={decrement}
          className="p-1 bg-white/50 hover:bg-white/70 border border-white/50 rounded-md text-slate-500 hover:text-slate-700 transition-all shadow-sm active:scale-95"
          type="button"
          title="Decrease angle"
        >
          <Icons.ChevronDown size={14} />
        </button>
      </div>
    </div>
  );
};

const StepInput: React.FC<{
  value: number;
  onChange: (val: number) => void;
}> = ({ value, onChange }) => {
  const [localValue, setLocalValue] = useState<string>(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);
    const parsed = parseFloat(newVal);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 90) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(localValue);
    if (isNaN(parsed) || parsed <= 0 || parsed > 90) {
      setLocalValue(value.toString());
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[9px] text-slate-400 font-semibold">Step:</span>
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className="w-12 px-1.5 py-0.5 text-[10px] bg-white/40 border border-white/60 rounded text-slate-600 text-center font-medium focus:outline-none focus:ring-1 focus:ring-sky-400/50"
      />
      <span className="text-[9px] text-slate-400">°</span>
    </div>
  );
};

// --- Modals ---

const ExportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  data: string;
  filename: string;
  type: string;
}> = ({ isOpen, onClose, data, filename, type }) => {
  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(data);
  };

  const handleDownload = () => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 backdrop-blur-md p-4 transition-all">
      <div className="bg-white/80 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] ring-1 ring-white/40">
        <div className="flex items-center justify-between p-6 border-b border-slate-200/30">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
            <div className="p-2.5 bg-sky-100/50 rounded-xl text-sky-600 shadow-sm border border-sky-100">
                <Icons.Download size={20} /> 
            </div>
            Export Preview
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-white/50 rounded-full">
            <Icons.X size={20} />
          </button>
        </div>
        
        <div className="p-6 flex-1 overflow-hidden flex flex-col">
          <p className="text-sm text-slate-500 mb-4 font-medium">
            Review the generated {type === 'application/json' ? 'JSON' : 'CSV'} content below:
          </p>
          <pre className="flex-1 bg-white/40 p-5 rounded-2xl border border-white/60 text-xs font-mono text-slate-600 overflow-auto whitespace-pre-wrap select-text shadow-inner backdrop-blur-sm">
            {data}
          </pre>
        </div>

        <div className="p-6 border-t border-slate-200/30 flex justify-end gap-3 bg-white/20 rounded-b-3xl">
          <Button onClick={onClose} variant="ghost">Cancel</Button>
          <Button onClick={handleCopy}>
            <Icons.Copy size={16} /> Copy
          </Button>
          <Button onClick={handleDownload} variant="primary">
            <Icons.Download size={16} /> Download {filename}
          </Button>
        </div>
      </div>
    </div>
  );
};

const InfoModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 backdrop-blur-md p-4 transition-all">
      <div className="bg-white/80 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] ring-1 ring-white/40">
        <div className="flex items-center justify-between p-6 border-b border-slate-200/30">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100/50 rounded-xl text-indigo-600 shadow-sm border border-indigo-100">
                <Icons.Info size={20} /> 
            </div>
            How it Works
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-white/50 rounded-full">
            <Icons.X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          
          {/* Coordinate System Explanation */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Coordinate System Logic</h4>
            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 text-sm text-slate-600 space-y-4">
              <p>
                 The coordinate system is designed to match Python <code>cv2.warpAffine</code> logic for image stitching.
              </p>
              
              <div className="relative h-40 bg-white/60 rounded-xl border border-indigo-100/50 overflow-hidden flex items-center justify-center">
                  {/* Illustration */}
                  <div className="relative w-32 h-32 border-2 border-dashed border-slate-300 flex items-center justify-center">
                       <span className="absolute -top-5 -left-2 text-[10px] font-mono text-slate-400">Shift X, Y</span>
                       <div className="absolute top-0 left-0 w-2 h-2 bg-indigo-500 rounded-full z-10 -translate-x-1/2 -translate-y-1/2"></div>
                       {/* Rotated Rect */}
                       <div className="w-20 h-16 border-2 border-sky-500 bg-sky-500/10 transform rotate-12 flex items-center justify-center">
                           <span className="text-[10px] text-sky-700 font-bold">Image</span>
                       </div>
                  </div>
              </div>

              <ul className="list-disc pl-4 space-y-2">
                 <li>
                    <span className="font-bold text-indigo-700">Bounding Box:</span> When an image is rotated, its "footprint" expands. The app calculates this bounding box exactly like OpenCV.
                 </li>
                 <li>
                    <span className="font-bold text-indigo-700">Shift X / Shift Y:</span> These values represent the <strong>Top-Left corner of the Bounding Box</strong>, not the unrotated image corner.
                 </li>
                 <li>
                    <span className="font-bold text-indigo-700">Rotation:</span> Happens around the center of the image.
                 </li>
              </ul>
              <div className="bg-white/60 p-3 rounded-xl border border-indigo-100/50 text-xs font-mono text-indigo-800">
                New Width = H * |sin(θ)| + W * |cos(θ)|
              </div>
            </div>
          </div>

           {/* FAQ */}
           <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">FAQ</h4>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="p-3 bg-white/40 rounded-xl border border-white/60">
                 <p className="font-semibold text-slate-700 mb-1">Q: Why does X/Y change when I rotate?</p>
                 <p>A: Because rotating changes the size of the bounding box. To keep the image visually centered in the same spot, the top-left corner (Shift X/Y) must move.</p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Controls</h4>
            <ul className="grid grid-cols-2 gap-2 text-xs text-slate-600">
               <li className="flex items-center gap-2 p-2 bg-white/30 rounded-lg"><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono">Cmd/Ctrl</kbd> + Drag to Pan</li>
               <li className="flex items-center gap-2 p-2 bg-white/30 rounded-lg"><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono">Space</kbd> + Drag to Pan</li>
               <li className="flex items-center gap-2 p-2 bg-white/30 rounded-lg"><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono">Scroll</kbd> Zoom In/Out</li>
               <li className="flex items-center gap-2 p-2 bg-white/30 rounded-lg"><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono">Shift</kbd> + Click Multi-select</li>
               <li className="flex items-center gap-2 p-2 bg-white/30 rounded-lg"><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono">Del</kbd> Delete Layer</li>
            </ul>
          </div>

        </div>

        <div className="p-6 border-t border-slate-200/30 flex justify-end bg-white/20 rounded-b-3xl">
          <Button onClick={onClose} variant="primary">
             Got it
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  // State
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerIds, setSelectedLayerIds] = useState<Set<string>>(new Set());
  const [checkedLayers, setCheckedLayers] = useState<Set<string>>(new Set());
  
  // Drag and Drop Layer State
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  
  // Undo/Redo History
  const [history, setHistory] = useState<Layer[][]>([]);
  const [future, setFuture] = useState<Layer[][]>([]);

  // Canvas Viewport State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<Coordinates>({ x: 0, y: 0 });
  const [showGuides, setShowGuides] = useState<boolean>(true);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [angleStep, setAngleStep] = useState<number>(() => {
    const saved = localStorage.getItem('angleStep');
    return saved ? parseFloat(saved) : 0.1;
  });

  // Sidebar Collapse State
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState<boolean>(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState<boolean>(false);

  // Interaction State
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [isDraggingLayer, setIsDraggingLayer] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ start: Coordinates; current: Coordinates } | null>(null);

  const [dragStart, setDragStart] = useState<Coordinates>({ x: 0, y: 0 });
  const [initialPan, setInitialPan] = useState<Coordinates>({ x: 0, y: 0 });
  
  // Export Modal
  const [exportModal, setExportModal] = useState<{ show: boolean; data: string; filename: string; type: string }>({
    show: false,
    data: '',
    filename: '',
    type: ''
  });
  
  // Store initial positions of all selected layers when drag starts
  const [initialLayerPositions, setInitialLayerPositions] = useState<Record<string, Coordinates>>({});
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- History Helpers ---
  const addToHistory = useCallback(() => {
    setHistory(prev => {
      const newHistory = [...prev, layers];
      if (newHistory.length > 50) newHistory.shift(); // Limit history size
      return newHistory;
    });
    setFuture([]);
  }, [layers]);

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    setFuture(prev => [layers, ...prev]);
    setHistory(newHistory);
    setLayers(previous);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    
    setHistory(prev => [...prev, layers]);
    setFuture(newFuture);
    setLayers(next);
  };

  // --- Handlers ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addToHistory(); // Save state before adding
      const newLayers: Layer[] = [];
      const files = Array.from(e.target.files);

      let loadedCount = 0;
      files.forEach((file) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.src = url;
        img.onload = () => {
          newLayers.push({
            id: Math.random().toString(36).substr(2, 9),
            file: file,
            imageUrl: url,
            name: file.name,
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1,
            opacity: 1,
            visible: true,
            width: img.naturalWidth,
            height: img.naturalHeight
          });
          loadedCount++;
          if (loadedCount === files.length) {
            setLayers((prev) => [...prev, ...newLayers]);
            // Automatically select the first new layer if nothing is selected
            if (newLayers.length > 0 && selectedLayerIds.size === 0) {
              setSelectedLayerIds(new Set([newLayers[0].id]));
            }
          }
        };
      });
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateLayer = (id: string, changes: Partial<Layer>, recordHistory = true) => {
    if (recordHistory) addToHistory();
    setLayers((prev) => prev.map(l => l.id === id ? { ...l, ...changes } : l));
  };

  // Wrapper for property panel updates to capture history on change
  const updateSelectedLayers = (changes: Partial<Layer>) => {
    addToHistory();
    setLayers((prev) => prev.map(l => {
        if (!selectedLayerIds.has(l.id)) return l;

        // If updating rotation, we want to rotate around the CENTER of the current bounding box
        // This implies the bounding box size changes, so top-left (x,y) must shift to maintain center
        if (changes.rotation !== undefined) {
             const oldDims = calculateRotatedDimensions(l.width, l.height, l.rotation, l.scale);
             const oldCenterX = l.x + oldDims.width / 2;
             const oldCenterY = l.y + oldDims.height / 2;
             
             const newRotation = changes.rotation;
             const newDims = calculateRotatedDimensions(l.width, l.height, newRotation, l.scale);
             
             // Calculate new X,Y (Top-Left) to preserve center
             const newX = oldCenterX - newDims.width / 2;
             const newY = oldCenterY - newDims.height / 2;

             return { ...l, ...changes, x: newX, y: newY };
        }
        
        // If updating scale, similar logic applies: expand/contract from center
        if (changes.scale !== undefined) {
             const oldDims = calculateRotatedDimensions(l.width, l.height, l.rotation, l.scale);
             const oldCenterX = l.x + oldDims.width / 2;
             const oldCenterY = l.y + oldDims.height / 2;
             
             const newScale = changes.scale;
             const newDims = calculateRotatedDimensions(l.width, l.height, l.rotation, newScale);
             
             const newX = oldCenterX - newDims.width / 2;
             const newY = oldCenterY - newDims.height / 2;

             return { ...l, ...changes, x: newX, y: newY };
        }

        return { ...l, ...changes };
    }));
  };

  const deleteSelectedLayers = () => {
    if (selectedLayerIds.size === 0) return;
    addToHistory();
    setLayers((prev) => prev.filter(l => !selectedLayerIds.has(l.id)));
    
    const newChecked = new Set(checkedLayers);
    for (const id of selectedLayerIds) {
      newChecked.delete(id);
    }
    setCheckedLayers(newChecked);
    setSelectedLayerIds(new Set());
  };

  // Reorder layers (move item at fromIndex to toIndex)
  const reorderLayers = (fromIndex: number, toIndex: number) => {
    addToHistory();
    const newLayers = [...layers];
    const [removed] = newLayers.splice(fromIndex, 1);
    newLayers.splice(toIndex, 0, removed);
    setLayers(newLayers);
  };

  // --- Drag and Drop Handlers for Layer List ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedLayerId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedLayerId || draggedLayerId === targetId) return;

    const fromIndex = layers.findIndex(l => l.id === draggedLayerId);
    const toIndex = layers.findIndex(l => l.id === targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
        reorderLayers(fromIndex, toIndex);
    }
    setDraggedLayerId(null);
  };

  const handleDragEnd = () => {
      setDraggedLayerId(null);
  };


  const toggleLayerCheck = (id: string) => {
    const newChecked = new Set(checkedLayers);
    if (newChecked.has(id)) {
      newChecked.delete(id);
    } else {
      newChecked.add(id);
    }
    setCheckedLayers(newChecked);
  };

  const toggleAllChecks = () => {
    if (checkedLayers.size === layers.length && layers.length > 0) {
      setCheckedLayers(new Set());
    } else {
      setCheckedLayers(new Set(layers.map(l => l.id)));
    }
  };

  const toggleLayerSelection = (id: string, multi: boolean) => {
    if (multi) {
      const newSet = new Set(selectedLayerIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedLayerIds(newSet);
    } else {
      setSelectedLayerIds(new Set([id]));
    }
  };

  // --- Fit To View ---
  const fitToView = () => {
    if (layers.length === 0 || !canvasRef.current) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    layers.forEach(l => {
        // Calculate bbox for current rotation/scale
        const dims = calculateRotatedDimensions(l.width, l.height, l.rotation, l.scale);
        minX = Math.min(minX, l.x);
        minY = Math.min(minY, l.y);
        maxX = Math.max(maxX, l.x + dims.width);
        maxY = Math.max(maxY, l.y + dims.height);
    });

    if (minX === Infinity) return;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const centerX = minX + contentWidth / 2;
    const centerY = minY + contentHeight / 2;

    const viewportWidth = canvasRef.current.clientWidth;
    const viewportHeight = canvasRef.current.clientHeight;

    const padding = 50;
    const scaleX = (viewportWidth - padding * 2) / contentWidth;
    const scaleY = (viewportHeight - padding * 2) / contentHeight;
    const newZoom = Math.min(Math.min(scaleX, scaleY), 1); 

    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;

    const newPanX = viewportCenterX - centerX * newZoom;
    const newPanY = viewportCenterY - centerY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };


  const prepareExport = (format: 'json' | 'csv') => {
    if (layers.length === 0) return;

    const layersToExport = checkedLayers.size > 0 
      ? layers.filter(l => checkedLayers.has(l.id))
      : layers;

    if (layersToExport.length === 0) return;

    let content = '';
    let type = '';
    let filename = '';

    if (format === 'json') {
      const data: ExportData[] = layersToExport.map((layer, index) => ({
        filename: layer.name,
        shift_x: Math.round(layer.x),
        shift_y: Math.round(layer.y),
        rotate: Math.round(layer.rotation * 100) / 100,
        layer_order: index
      }));
      content = JSON.stringify(data, null, 2);
      type = 'application/json';
      filename = 'stitching_data.json';
    } else {
      const headers = ['filename', 'shift_x', 'shift_y', 'rotate', 'layer_order'];
      const rows = layersToExport.map((layer, index) => [
        `"${layer.name.replace(/"/g, '""')}"`,
        Math.round(layer.x),
        Math.round(layer.y),
        Math.round(layer.rotation * 100) / 100,
        index
      ]);
      content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      type = 'text/csv';
      filename = 'stitching_data.csv';
    }

    setExportModal({
        show: true,
        data: content,
        filename,
        type
    });
  };

  // --- Mouse Interaction Logic ---

  const handleMouseDown = (e: React.MouseEvent, layerId?: string) => {
    e.preventDefault(); 
    
    // Blur any active input elements (like Property fields) when clicking canvas
    if (document.activeElement instanceof HTMLElement) {
       document.activeElement.blur();
    }

    const isMiddleClick = e.button === 1;
    const isMultiSelect = e.ctrlKey || e.metaKey || e.shiftKey;
    // Allow Cmd/Ctrl to act as Pan key on empty space or if no layer is clicked
    const isCmdPan = (e.ctrlKey || e.metaKey) && !layerId;

    // Case 1: Panning
    if (isSpacePressed || isMiddleClick || isCmdPan) {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setInitialPan({ ...pan });
      return;
    }

    // Case 2: Layer Interaction
    if (layerId) {
      e.stopPropagation(); 
      
      let newSet = new Set(selectedLayerIds);
      
      if (isMultiSelect) {
        if (newSet.has(layerId)) newSet.delete(layerId);
        else newSet.add(layerId);
        setSelectedLayerIds(newSet);
      } else {
        if (!newSet.has(layerId)) {
          newSet = new Set([layerId]);
        }
        setSelectedLayerIds(newSet);
      }
      
      if (newSet.has(layerId)) {
        setIsDraggingLayer(true);
        addToHistory();
        
        setDragStart({ x: e.clientX, y: e.clientY });
        
        const initialPos: Record<string, Coordinates> = {};
        layers.forEach(l => {
          if (newSet.has(l.id)) {
            initialPos[l.id] = { x: l.x, y: l.y };
          }
        });
        setInitialLayerPositions(initialPos);
      }
      return;
    }

    // Case 3: Box Selection
    if (!layerId && !isSpacePressed && !isMiddleClick && !isCmdPan) {
        setIsSelecting(true);
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        if (canvasRect) {
            const startX = e.clientX - canvasRect.left;
            const startY = e.clientY - canvasRect.top;
            setSelectionBox({
                start: { x: startX, y: startY },
                current: { x: startX, y: startY }
            });
            
            if (!e.shiftKey) {
                setSelectedLayerIds(new Set());
            }
        }
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingCanvas) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPan({
        x: initialPan.x + dx,
        y: initialPan.y + dy
      });
      return;
    }

    if (isDraggingLayer) {
      const dx = (e.clientX - dragStart.x) / zoom;
      const dy = (e.clientY - dragStart.y) / zoom;
      
      setLayers(prev => prev.map(l => {
        if (initialLayerPositions[l.id]) {
          return {
            ...l,
            x: initialLayerPositions[l.id].x + dx,
            y: initialLayerPositions[l.id].y + dy
          };
        }
        return l;
      }));
      return;
    }

    if (isSelecting && selectionBox && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const currentX = e.clientX - canvasRect.left;
        const currentY = e.clientY - canvasRect.top;
        
        setSelectionBox(prev => prev ? { ...prev, current: { x: currentX, y: currentY } } : null);
        
        const x = Math.min(selectionBox.start.x, currentX);
        const y = Math.min(selectionBox.start.y, currentY);
        const w = Math.abs(selectionBox.start.x - currentX);
        const h = Math.abs(selectionBox.start.y - currentY);
        
        const newSelected = new Set(e.shiftKey ? selectedLayerIds : []);
        
        layers.forEach(l => {
            // Get Axis-Aligned Bounding Box
            const dims = calculateRotatedDimensions(l.width, l.height, l.rotation, l.scale);
            const lx = l.x * zoom + pan.x;
            const ly = l.y * zoom + pan.y;
            const lw = dims.width * zoom;
            const lh = dims.height * zoom;
            
            // Box intersection
            if (x < lx + lw && x + w > lx && y < ly + lh && y + h > ly) {
                newSelected.add(l.id);
            }
        });
        
        setSelectedLayerIds(newSelected);
    }

  }, [isDraggingCanvas, isDraggingLayer, isSelecting, selectionBox, dragStart, initialPan, initialLayerPositions, zoom, pan, layers, selectedLayerIds]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingCanvas(false);
    setIsDraggingLayer(false);
    setIsSelecting(false);
    setSelectionBox(null);
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomChange = -e.deltaY * 0.001;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + zoomChange));
      setZoom(newZoom);
    }
  };

  // Persist angleStep to localStorage
  useEffect(() => {
    localStorage.setItem('angleStep', angleStep.toString());
  }, [angleStep]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      if (e.code === 'Space') {
          setIsSpacePressed(true);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      if (selectedLayerIds.size === 0) return;
      
      const shiftMultiplier = e.shiftKey ? 10 : 1;
      
      switch (e.key) {
        case 'ArrowUp':
          setLayers(prev => prev.map(l => selectedLayerIds.has(l.id) ? { ...l, y: l.y - 1 * shiftMultiplier } : l));
          break;
        case 'ArrowDown':
            setLayers(prev => prev.map(l => selectedLayerIds.has(l.id) ? { ...l, y: l.y + 1 * shiftMultiplier } : l));
          break;
        case 'ArrowLeft':
            setLayers(prev => prev.map(l => selectedLayerIds.has(l.id) ? { ...l, x: l.x - 1 * shiftMultiplier } : l));
          break;
        case 'ArrowRight':
            setLayers(prev => prev.map(l => selectedLayerIds.has(l.id) ? { ...l, x: l.x + 1 * shiftMultiplier } : l));
          break;
        case 'Delete':
        case 'Backspace':
          deleteSelectedLayers();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            setIsSpacePressed(false);
            setIsDraggingCanvas(false);
        }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedLayerIds, layers, checkedLayers, history, future]); 

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Load sidebar collapse state from localStorage
  useEffect(() => {
    const savedLeftCollapsed = localStorage.getItem('leftSidebarCollapsed');
    const savedRightCollapsed = localStorage.getItem('rightSidebarCollapsed');

    if (savedLeftCollapsed !== null) {
      setLeftSidebarCollapsed(savedLeftCollapsed === 'true');
    }
    if (savedRightCollapsed !== null) {
      setRightSidebarCollapsed(savedRightCollapsed === 'true');
    }
  }, []);

  const selectedCount = selectedLayerIds.size;
  const firstSelectedId = selectedLayerIds.values().next().value;
  const firstSelectedLayer = layers.find(l => l.id === firstSelectedId);
  
  const getCommonValue = (key: keyof Layer): number | '' => {
    if (selectedCount === 0) return '';
    let commonVal: any = undefined;
    let isMixed = false;
    
    layers.forEach(l => {
        if (selectedLayerIds.has(l.id)) {
            if (commonVal === undefined) commonVal = l[key];
            else if (commonVal !== l[key]) isMixed = true;
        }
    });
    return isMixed ? '' : (commonVal as number);
  };

  const commonOpacity = getCommonValue('opacity');

  // Calculate dynamic style for zoom-independent thickness
  const guideThickness = Math.max(1, 2 / zoom);
  const labelScale = 1 / zoom;

  // Toggle functions for sidebar collapse
  const toggleLeftSidebar = () => {
    const newState = !leftSidebarCollapsed;
    setLeftSidebarCollapsed(newState);
    localStorage.setItem('leftSidebarCollapsed', String(newState));
  };

  const toggleRightSidebar = () => {
    const newState = !rightSidebarCollapsed;
    setRightSidebarCollapsed(newState);
    localStorage.setItem('rightSidebarCollapsed', String(newState));
  };

  return (
    <div className="flex h-screen w-screen font-sans overflow-hidden p-4 gap-4 bg-[url('https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?q=80&w=2787&auto=format&fit=crop')] bg-cover bg-center">
      {/* Overlay to soften the background image */}
      <div className="absolute inset-0 bg-slate-50/70 backdrop-blur-[4px] z-0 pointer-events-none"></div>

      <ExportModal 
        isOpen={exportModal.show} 
        onClose={() => setExportModal({ ...exportModal, show: false })}
        data={exportModal.data}
        filename={exportModal.filename}
        type={exportModal.type}
      />

      <InfoModal 
        isOpen={showInfo} 
        onClose={() => setShowInfo(false)} 
      />

      {/* --- Sidebar (Left) --- */}
      {leftSidebarCollapsed ? (
        // COLLAPSED STATE
        <aside className="w-16 flex flex-col bg-white/60 backdrop-blur-2xl border border-white/50 rounded-[2rem] shadow-2xl z-20 flex-shrink-0 transition-all duration-300 ease-in-out ring-1 ring-white/40">
          {/* Header with expand button */}
          <div className="p-4 border-b border-white/40 flex justify-center">
            <button
              onClick={toggleLeftSidebar}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/40 rounded-xl transition-all duration-200 active:scale-95"
              title="Expand Layers Panel"
              aria-label="Expand Layers Panel"
            >
              <Icons.ChevronRight size={20} />
            </button>
          </div>

          {/* Vertical icon strip */}
          <div className="flex-1 flex flex-col items-center gap-4 p-4">
            {/* Import button icon */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-slate-500 hover:text-sky-600 hover:bg-sky-50/50 rounded-xl transition-all duration-200 border border-white/40 backdrop-blur-sm"
              title="Import Images"
              aria-label="Import Images"
            >
              <Icons.Upload size={20} />
            </button>

            {/* Export JSON icon */}
            <button
              onClick={() => prepareExport('json')}
              disabled={layers.length === 0}
              className="p-3 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/50 rounded-xl transition-all duration-200 border border-white/40 backdrop-blur-sm disabled:opacity-30 disabled:cursor-not-allowed"
              title="Export JSON"
              aria-label="Export JSON"
            >
              <Icons.FileJson size={18} />
            </button>

            {/* Export CSV icon */}
            <button
              onClick={() => prepareExport('csv')}
              disabled={layers.length === 0}
              className="p-3 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 rounded-xl transition-all duration-200 border border-white/40 backdrop-blur-sm disabled:opacity-30 disabled:cursor-not-allowed"
              title="Export CSV"
              aria-label="Export CSV"
            >
              <Icons.FileText size={18} />
            </button>

            {/* Layer count badge */}
            <div className="mt-auto">
              <div className="w-12 h-12 bg-sky-500/10 rounded-xl flex items-center justify-center border border-sky-200/40">
                <div className="flex flex-col items-center">
                  <Icons.Layers size={16} className="text-sky-600 mb-0.5" />
                  <span className="text-xs font-bold text-sky-600">{layers.length}</span>
                </div>
              </div>
            </div>
          </div>
          <input
            type="file"
            multiple
            accept="image/*"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileUpload}
          />
        </aside>
      ) : (
        // EXPANDED STATE
        <aside className="w-80 flex flex-col bg-white/60 backdrop-blur-2xl border border-white/50 rounded-[2rem] shadow-2xl z-20 flex-shrink-0 transition-all duration-300 ease-in-out ring-1 ring-white/40">
          <div className="p-6 border-b border-white/40 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3 tracking-tight">
                <div className="p-2 bg-sky-500/90 rounded-xl text-white shadow-lg shadow-sky-500/30 ring-1 ring-sky-400/50">
                    <Icons.Layers size={22} />
                </div>
                StitchCraft
              </h1>
              <p className="text-xs text-slate-500 mt-1.5 font-medium pl-1 tracking-wide">Precision Image Alignment</p>
            </div>
            <button
              onClick={toggleLeftSidebar}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/40 rounded-xl transition-all duration-200 active:scale-95"
              title="Collapse Layers Panel"
              aria-label="Collapse Layers Panel"
            >
              <Icons.ChevronLeft size={20} />
            </button>
          </div>

        {/* Action Bar */}
        <div className="p-5 flex flex-col gap-3 border-b border-white/40 bg-white/20 backdrop-blur-sm">
          <Button variant="primary" onClick={() => fileInputRef.current?.click()} className="w-full py-3 shadow-lg shadow-sky-500/20">
            <Icons.Upload size={18} /> Import Images
          </Button>
          <input 
            type="file" 
            multiple 
            accept="image/*" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileUpload} 
          />
          
          <div className="grid grid-cols-2 gap-3 mt-1">
            <Button 
              onClick={() => prepareExport('json')} 
              disabled={layers.length === 0} 
              className="bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100/80 border-emerald-200/50"
            >
              <Icons.FileJson size={16} /> 
              {checkedLayers.size > 0 ? `Export (${checkedLayers.size})` : 'JSON'}
            </Button>
            <Button 
              onClick={() => prepareExport('csv')} 
              disabled={layers.length === 0} 
              className="bg-indigo-50/60 text-indigo-700 hover:bg-indigo-100/80 border-indigo-200/50"
            >
              <Icons.FileText size={16} /> 
               {checkedLayers.size > 0 ? `Export (${checkedLayers.size})` : 'CSV'}
            </Button>
          </div>
        </div>

        {/* Layers List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          <div className="flex items-center justify-between px-3 py-2 mb-2">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest drop-shadow-sm">
               Layers ({layers.length})
            </div>
            {layers.length > 0 && (
               <div className="flex items-center gap-2 group cursor-pointer" onClick={toggleAllChecks}>
                  <input 
                     type="checkbox" 
                     checked={checkedLayers.size === layers.length && layers.length > 0}
                     onChange={toggleAllChecks}
                     className="w-3.5 h-3.5 rounded border-slate-300 bg-white/50 checked:bg-sky-500 checked:border-sky-500 transition-colors cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 group-hover:text-sky-600 transition-colors font-medium">Select All</span>
               </div>
            )}
          </div>

          {layers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
              <div className="p-4 bg-white/30 rounded-full">
                <Icons.Layers size={32} className="opacity-40" />
              </div>
              <span className="text-sm font-medium opacity-60">No images imported</span>
            </div>
          )}
          
          {/* Note: Rendering reversed map, but we need correct index for drag and drop */}
          {[...layers].reverse().map((layer, reverseIndex) => {
            const actualIndex = layers.length - 1 - reverseIndex;
            const isSelected = selectedLayerIds.has(layer.id);
            const isDragged = draggedLayerId === layer.id;

            return (
              <div 
                key={layer.id}
                draggable
                onDragStart={(e) => handleDragStart(e, layer.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, layer.id)}
                onDragEnd={handleDragEnd}
                className={`group flex items-center gap-3 p-2.5 rounded-xl cursor-pointer border backdrop-blur-sm transition-all duration-200 select-none ${
                  isDragged ? 'opacity-40 scale-95' : ''
                } ${
                  isSelected 
                    ? 'bg-sky-50/80 border-sky-200/60 shadow-md shadow-sky-500/5 ring-1 ring-sky-300/30' 
                    : 'bg-white/30 border-white/40 hover:bg-white/60 hover:shadow-md hover:border-white/60'
                }`}
                onClick={(e) => toggleLayerSelection(layer.id, e.ctrlKey || e.metaKey || e.shiftKey)}
              >
                {/* Drag Handle */}
                <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 pl-0.5">
                    <Icons.GripVertical size={14} />
                </div>

                <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
                   <input 
                      type="checkbox" 
                      checked={checkedLayers.has(layer.id)}
                      onChange={() => toggleLayerCheck(layer.id)}
                      className="w-4 h-4 rounded border-slate-300 bg-white/50 checked:bg-sky-500 checked:border-sky-500 transition-colors cursor-pointer"
                   />
                </div>

                <div 
                  className={`p-1.5 rounded-lg transition-colors ${layer.visible ? 'text-slate-400 hover:text-sky-500 hover:bg-sky-50/80' : 'text-slate-300 hover:text-slate-500'}`}
                  onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }, false); }}
                >
                  {layer.visible ? <Icons.Eye size={14} /> : <Icons.EyeOff size={14} />}
                </div>
                
                <div className="w-10 h-10 bg-white/50 rounded-lg overflow-hidden flex-shrink-0 border border-white/50 shadow-sm relative group-hover:shadow-md transition-shadow">
                  <img src={layer.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold truncate ${isSelected ? 'text-sky-700' : 'text-slate-700'}`}>
                    {layer.name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <input
          type="file"
          multiple
          accept="image/*"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileUpload}
        />
      </aside>
      )}

      {/* --- Main Workspace --- */}
      <main className="flex-1 relative flex flex-col bg-white/40 backdrop-blur-xl rounded-[2rem] overflow-hidden shadow-2xl border border-white/60 z-10 ring-1 ring-white/40">
        {/* Toolbar */}
        <div className="h-16 bg-white/60 backdrop-blur-xl border-b border-white/40 flex items-center justify-between px-6 z-10 shadow-sm">
          <div className="flex items-center gap-2">
            
            <div className="flex items-center gap-1 mr-4 border-r border-slate-200/40 pr-4">
               <Button variant="ghost" onClick={undo} disabled={history.length === 0} title="Undo (Ctrl+Z)" className="text-slate-600">
                  <Icons.Undo size={18} />
               </Button>
               <Button variant="ghost" onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Y)" className="text-slate-600">
                  <Icons.Redo size={18} />
               </Button>
            </div>

            <div className="flex items-center bg-white/40 rounded-xl p-1 border border-white/50 shadow-sm">
                <Button variant="ghost" onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP))} className="h-8 w-8 p-0">
                <Icons.ZoomOut size={16} />
                </Button>
                <span className="text-xs font-bold text-slate-600 w-12 text-center select-none">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP))} className="h-8 w-8 p-0">
                <Icons.ZoomIn size={16} />
                </Button>
            </div>
            
            <div className="w-px h-6 bg-slate-300/30 mx-2" />
            
            <Button 
                variant={showGuides ? "secondary" : "ghost"} 
                onClick={() => setShowGuides(!showGuides)}
                title="Toggle Reference Lines"
                className={`px-3 ${showGuides ? 'bg-sky-50/50 text-sky-600 border-sky-100/50' : ''}`}
            >
                <Icons.Grid size={18} />
            </Button>
            <Button variant="ghost" onClick={fitToView} title="Fit to all images">
                <Icons.Minimize size={18} /> <span className="hidden lg:inline">Fit</span>
            </Button>
            <Button variant="ghost" onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }}>
              <Icons.Maximize size={18} /> <span className="hidden lg:inline">Reset</span>
            </Button>
            <Button variant="ghost" onClick={() => setShowInfo(true)} title="How it Works" className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50/50">
               <Icons.Info size={18} />
            </Button>
          </div>
          <div className="text-xs font-medium text-slate-500/80 flex items-center gap-4 hidden md:flex">
             <span className="flex items-center gap-1"><Icons.MousePointer size={14}/> Drag to Select</span>
             <span className={`flex items-center gap-1 transition-colors px-2.5 py-1.5 rounded-lg border ${isSpacePressed ? 'bg-sky-50/80 border-sky-200/50 text-sky-600' : 'border-transparent'}`}>
                <span className={`bg-white/60 px-1.5 py-0.5 rounded border border-slate-200/50 text-slate-500 shadow-sm font-mono text-[10px] ${isSpacePressed ? 'border-sky-200/60 text-sky-600' : ''}`}>SPACE</span> to Pan
             </span>
          </div>
        </div>

        {/* Canvas Area */}
        <div 
          ref={canvasRef}
          className={`flex-1 relative bg-slate-50/30 overflow-hidden checkerboard-bg ${isSpacePressed ? 'cursor-grab' : 'cursor-crosshair'}`}
          onMouseDown={(e) => handleMouseDown(e)}
          onWheel={handleWheel}
        >
          {/* Transform Container */}
          <div 
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0
            }}
          >
            {/* Reference Lines (Axes) */}
            {showGuides && (
                <>
                    {/* Horizontal Line */}
                    <div 
                      className="absolute top-0 left-[-100000px] w-[200000px] border-t border-dashed border-sky-400/50 z-0 pointer-events-none" 
                      style={{ borderTopWidth: `${guideThickness}px` }}
                    />
                    {/* Vertical Line */}
                    <div 
                      className="absolute left-0 top-[-100000px] h-[200000px] border-l border-dashed border-sky-400/50 z-0 pointer-events-none" 
                      style={{ borderLeftWidth: `${guideThickness}px` }}
                    />
                    {/* Origin Marker */}
                    <div 
                      className="absolute top-0 left-0 border-l border-t border-sky-600 z-50 pointer-events-none shadow-sm"
                      style={{ 
                         width: `${16 / zoom}px`, 
                         height: `${16 / zoom}px`,
                         borderTopWidth: `${guideThickness * 1.5}px`,
                         borderLeftWidth: `${guideThickness * 1.5}px`
                      }} 
                    />
                    {/* Origin Label */}
                    <div 
                      className="absolute top-0 left-0 text-sky-600 font-bold -translate-y-full pl-1 pointer-events-none"
                      style={{ 
                        fontSize: '10px',
                        transform: `scale(${labelScale})`,
                        transformOrigin: 'bottom left'
                      }}
                    >
                      0,0
                    </div>
                </>
            )}

            {/* Images */}
            {layers.map((layer) => {
               const isSelected = selectedLayerIds.has(layer.id);
               // New rendering logic: Calculate Bounding Box dimensions based on rotation
               const dims = calculateRotatedDimensions(layer.width, layer.height, layer.rotation, layer.scale);
               
               return layer.visible && (
                <div
                  key={layer.id}
                  onMouseDown={(e) => handleMouseDown(e, layer.id)}
                  style={{
                    position: 'absolute',
                    // The layer's X,Y now corresponds to the top-left of the BOUNDING BOX
                    left: layer.x,
                    top: layer.y,
                    width: dims.width,
                    height: dims.height,
                    zIndex: layers.indexOf(layer), 
                    cursor: isDraggingLayer && isSelected ? 'grabbing' : isSpacePressed ? 'grab' : 'move',
                    // Outline the Bounding Box
                    outline: isSelected ? `${Math.max(2, 2/zoom)}px solid #0ea5e9` : 'none', 
                    boxShadow: isSelected ? `0 0 0 ${Math.max(4, 4/zoom)}px rgba(14, 165, 233, 0.2)` : 'none',
                    transition: isDraggingLayer ? 'none' : 'box-shadow 0.2s',
                  }}
                  className="select-none"
                >
                  {/* Rotated Image Inner Container */}
                  <img 
                    src={layer.imageUrl} 
                    alt={layer.name}
                    className="pointer-events-none block absolute" 
                    draggable={false}
                    style={{
                        // Center the image within the bounding box
                        left: '50%',
                        top: '50%',
                        width: `${layer.width * layer.scale}px`,
                        height: `${layer.height * layer.scale}px`,
                        // Rotate around its own center
                        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
                        transformOrigin: 'center',
                        opacity: layer.opacity,
                        maxWidth: 'none',
                        maxHeight: 'none',
                        minWidth: '0',
                        minHeight: '0',
                        objectFit: 'fill',
                    }}
                  />
                  
                  {isSelected && (
                    <div 
                      className="absolute -top-10 left-0 bg-sky-500/90 backdrop-blur-md text-white font-bold px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap pointer-events-none z-50 border border-sky-400/50 flex items-center gap-2"
                      style={{
                        transform: `scale(${1 / zoom})`, // Use simpler zoom scale here since we aren't scaling the parent div anymore
                        transformOrigin: 'bottom left',
                        fontSize: '10px'
                      }}
                    >
                       <span>X: {Math.round(layer.x)}</span>
                       <span className="opacity-50">|</span>
                       <span>Y: {Math.round(layer.y)}</span>
                    </div>
                  )}
                </div>
               );
            })}
          </div>

          {/* Selection Box Overlay */}
          {isSelecting && selectionBox && (
              <div 
                style={{
                    position: 'absolute',
                    left: Math.min(selectionBox.start.x, selectionBox.current.x),
                    top: Math.min(selectionBox.start.y, selectionBox.current.y),
                    width: Math.abs(selectionBox.start.x - selectionBox.current.x),
                    height: Math.abs(selectionBox.start.y - selectionBox.current.y),
                    backgroundColor: 'rgba(14, 165, 233, 0.1)', // sky-500/10
                    border: '1px solid #0ea5e9', // sky-500
                    borderRadius: '4px',
                    pointerEvents: 'none',
                    zIndex: 9999
                }}
              />
          )}

        </div>
      </main>

      {/* --- Properties Panel (Right) --- */}
      {rightSidebarCollapsed ? (
        // COLLAPSED STATE
        <aside className="w-16 flex flex-col bg-white/60 backdrop-blur-2xl border border-white/50 rounded-[2rem] shadow-2xl z-20 flex-shrink-0 transition-all duration-300 ease-in-out ring-1 ring-white/40">
          {/* Header with expand button */}
          <div className="p-4 border-b border-white/40 flex justify-center">
            <button
              onClick={toggleRightSidebar}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/40 rounded-xl transition-all duration-200 active:scale-95"
              title="Expand Properties Panel"
              aria-label="Expand Properties Panel"
            >
              <Icons.ChevronLeft size={20} />
            </button>
          </div>

          {/* Vertical icon strip */}
          <div className="flex-1 flex flex-col items-center gap-4 p-4">
            {/* Properties/Sliders icon */}
            <div className="p-3 bg-slate-100/50 rounded-xl text-slate-500 border border-white/40">
              <Icons.Sliders size={20} />
            </div>

            {/* Selection indicator (if items selected) */}
            {selectedCount > 0 && (
              <div className="mt-2">
                <div className="w-12 h-12 bg-sky-500/10 rounded-xl flex items-center justify-center border border-sky-200/40">
                  <div className="flex flex-col items-center">
                    <Icons.Settings size={16} className="text-sky-600 mb-0.5" />
                    <span className="text-xs font-bold text-sky-600">{selectedCount}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      ) : (
        // EXPANDED STATE
        <aside className="w-72 bg-white/60 backdrop-blur-2xl border border-white/50 rounded-[2rem] flex flex-col z-20 shadow-xl flex-shrink-0 transition-all duration-300 ease-in-out ring-1 ring-white/40">
          <div className="p-6 border-b border-white/40 bg-white/20 rounded-t-[2rem] flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500/80 uppercase tracking-widest flex items-center gap-2">
              <Icons.Settings size={14} /> Properties
            </h2>
            <button
              onClick={toggleRightSidebar}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/40 rounded-xl transition-all duration-200 active:scale-95"
              title="Collapse Properties Panel"
              aria-label="Collapse Properties Panel"
            >
              <Icons.ChevronRight size={20} />
            </button>
          </div>

        {selectedCount > 0 ? (
          <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            
            {/* Info */}
            <div className="bg-white/40 p-4 rounded-2xl border border-white/60 shadow-sm backdrop-blur-sm">
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                 {selectedCount === 1 ? 'Selected Item' : 'Selection Group'}
               </div>
               <div className="text-sm text-slate-800 font-bold truncate flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]"></div>
                 {selectedCount === 1 ? firstSelectedLayer?.name : `${selectedCount} items`}
               </div>
               {selectedCount === 1 && (
                 <div className="text-xs text-slate-500 mt-1 pl-4">{firstSelectedLayer?.width} x {firstSelectedLayer?.height} px</div>
               )}
            </div>

            <hr className="border-slate-200/40" />

            {/* Position */}
            <InputGroup label="Position (Top-Left)">
              <div className="grid grid-cols-2 gap-3">
                <NumberInput 
                  label="X" 
                  value={getCommonValue('x')} 
                  onChange={(v) => updateSelectedLayers({ x: v })}
                  placeholder="Mixed" 
                />
                <NumberInput 
                  label="Y" 
                  value={getCommonValue('y')} 
                  onChange={(v) => updateSelectedLayers({ y: v })}
                  placeholder="Mixed"
                />
              </div>
            </InputGroup>

            {/* Transformation */}
            <div className="flex flex-col gap-1.5 mb-5">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-bold text-slate-500/80 uppercase tracking-widest drop-shadow-sm">
                  Transformation
                </label>
                <StepInput value={angleStep} onChange={setAngleStep} />
              </div>
              <div className="space-y-3">
                 <div className="flex items-center gap-2">
                    <div className="p-2.5 bg-white/50 rounded-xl text-slate-500 border border-white/50 shadow-sm">
                        <Icons.RotateCw size={14} />
                    </div>
                    <div className="flex-1">
                      <AngleInput
                        label="Angle"
                        value={getCommonValue('rotation')}
                        onChange={(v) => updateSelectedLayers({ rotation: v })}
                        step={angleStep}
                        placeholder="Mixed"
                      />
                      <div className="mt-2 px-1">
                         <input 
                           type="range"
                           min="-180"
                           max="180"
                           step="1"
                           value={typeof getCommonValue('rotation') === 'number' ? getCommonValue('rotation') as number : 0}
                           onChange={(e) => {
                              let val = parseFloat(e.target.value);
                              // Snap logic
                              const snaps = [-180, -90, 0, 90, 180];
                              for (const snap of snaps) {
                                  if (Math.abs(val - snap) <= 5) val = snap;
                              }
                              updateSelectedLayers({ rotation: val });
                           }}
                           className="w-full h-1.5 bg-slate-200/60 rounded-lg appearance-none cursor-pointer accent-sky-500" 
                         />
                         <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1 select-none">
                            <span>-180°</span>
                            <span>0°</span>
                            <span>180°</span>
                         </div>
                      </div>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="p-2.5 bg-white/50 rounded-xl text-slate-500 border border-white/50 shadow-sm">
                        <Icons.ZoomIn size={14} />
                    </div>
                    <div className="flex-1">
                      <NumberInput 
                         label="Scale"
                         value={getCommonValue('scale')} 
                         onChange={(v) => updateSelectedLayers({ scale: v })} 
                         step={0.01}
                         placeholder="Mixed"
                      />
                    </div>
                 </div>
              </div>
            </div>

            {/* Appearance */}
            <InputGroup label="Opacity">
              <div className="bg-white/40 p-4 rounded-2xl border border-white/50 shadow-sm backdrop-blur-sm">
                <div className="flex justify-between text-xs font-medium text-slate-500 mb-3">
                  <span>Transparent</span>
                  <span>
                    {commonOpacity !== '' ? Math.round((commonOpacity as number) * 100) + '%' : 'Mixed'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={typeof commonOpacity === 'number' ? commonOpacity : 1}
                  onChange={(e) => updateSelectedLayers({ opacity: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-200/60 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>
            </InputGroup>

            <div className="pt-4 border-t border-slate-200/40">
              <Button 
                variant="danger" 
                className="w-full justify-center shadow-sm" 
                onClick={deleteSelectedLayers}
              >
                <Icons.Trash2 size={16} /> Delete {selectedCount > 1 ? `(${selectedCount})` : ''}
              </Button>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
            <div className="bg-white/40 p-5 rounded-full mb-4 ring-1 ring-white/50 shadow-sm">
                <Icons.MousePointer className="opacity-50 text-slate-400" size={24} />
            </div>
            <p className="text-sm font-medium text-slate-600">No selection</p>
            <p className="text-xs mt-1 text-slate-400/80">Click a layer or drag to select items</p>
          </div>
        )}
        </aside>
      )}
    </div>
  );
}