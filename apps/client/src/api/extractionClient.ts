import type { CaptureScanResponse } from "../types/vision";

export type CaptureScanRequest = {
  photoUri: string;
  captureEndpointUrl: string;
  minArea?: number;
  maxDetections?: number;
  maxLookupResults?: number;
  timeoutMs?: number;
};

export const runCaptureLookup = async (
  request: CaptureScanRequest
): Promise<CaptureScanResponse> => {
  const formData = new FormData();
  formData.append("image", {
    uri: request.photoUri,
    name: "capture.jpg",
    type: "image/jpeg"
  } as unknown as Blob);
  formData.append("minArea", String(Math.max(0, Math.round(request.minArea ?? 250))));
  formData.append(
    "maxDetections",
    String(Math.max(1, Math.round(request.maxDetections ?? 50)))
  );
  formData.append(
    "maxLookupResults",
    String(Math.max(1, Math.round(request.maxLookupResults ?? 3)))
  );

  const controller = new AbortController();
  const timeoutHandle = setTimeout(
    () => controller.abort(),
    Math.max(300, request.timeoutMs ?? 120000)
  );

  try {
    const response = await fetch(request.captureEndpointUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`capture_http_${response.status}`);
    }

    const payload = (await response.json()) as CaptureScanResponse;
    return {
      ...payload,
      spines: Array.isArray(payload.spines) ? payload.spines : []
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
};
