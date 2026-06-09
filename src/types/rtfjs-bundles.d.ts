declare module "rtf.js/dist/EMFJS.bundle.js" {
  const EMFJS: {
    Renderer: new (blob: ArrayBuffer) => {
      render: (info: {
        width: string;
        height: string;
        wExt: number;
        hExt: number;
        xExt: number;
        yExt: number;
        mapMode: number;
      }) => SVGElement;
    };
    loggingEnabled: (enabled: boolean) => void;
    Error: new (message: string) => Error;
  };
  export default EMFJS;
}

declare module "rtf.js/dist/WMFJS.bundle.js" {
  const WMFJS: {
    Renderer: new (blob: ArrayBuffer) => {
      render: (info: {
        width: string;
        height: string;
        wExt: number;
        hExt: number;
        xExt: number;
        yExt: number;
        mapMode: number;
      }) => SVGElement;
    };
    loggingEnabled: (enabled: boolean) => void;
    Error: new (message: string) => Error;
  };
  export default WMFJS;
}
