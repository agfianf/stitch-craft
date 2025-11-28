export interface Layer {
  id: string;
  file: File;
  imageUrl: string;
  name: string;
  x: number;
  y: number;
  rotation: number; // degrees
  scale: number;
  opacity: number; // 0 to 1
  visible: boolean;
  width: number;
  height: number;
}

export interface Coordinates {
  x: number;
  y: number;
}

export interface ExportData {
  filename: string;
  shift_x: number;
  shift_y: number;
  rotate: number;
  layer_order: number;
}