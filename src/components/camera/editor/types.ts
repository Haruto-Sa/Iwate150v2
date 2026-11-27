export type StickerItem = { id: string; char: string; x: number; y: number; size: number };
export type TextItem = { 
  id: string; 
  text: string; 
  font: string; 
  color: string; 
  size: number; 
  x: number; 
  y: number;
};

export type EditMode = "move" | "resize";
export type ToolPanel = "sticker" | "text" | null;

