/// <reference types="vite/client" />

declare module 'https://cdn.jsdelivr.net/gh/wipeautcrafter/jscolorpicker@main/dist/colorpicker.min.js' {
  const ColorPicker: new (input: HTMLInputElement, options?: Record<string, unknown>) => {
    on(event: string, callback: (color: { string(format: string): string } | null) => void): void;
    destroy(): void;
  };
  export default ColorPicker;
}
