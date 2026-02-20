declare module "jpeg-js" {
  export type JpegDecodeResult = {
    width: number;
    height: number;
    data: Uint8Array;
  };

  export function decode(
    data: Uint8Array,
    options?: {
      useTArray?: boolean;
      formatAsRGBA?: boolean;
      maxResolutionInMP?: number;
      maxMemoryUsageInMB?: number;
    }
  ): JpegDecodeResult;
}
