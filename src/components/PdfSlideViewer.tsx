'use client';

import { useEffect, useRef, useState } from "react";
import type {
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist/types/src/display/api";

type PdfModule = typeof import("pdfjs-dist/build/pdf");

let pdfModulePromise: Promise<PdfModule> | null = null;

type CachedDocument = {
  promise: Promise<PDFDocumentProxy>;
  refCount: number;
};

const documentCache = new Map<string, CachedDocument>();
const acquirePdfDocument = async (url: string) => {
  const cached = documentCache.get(url);
  if (cached) {
    cached.refCount += 1;
    return cached.promise;
  }

  const promise = getPdfModule().then((pdfjs) =>
    pdfjs.getDocument({ url }).promise
  );
  documentCache.set(url, { promise, refCount: 1 });
  return promise;
};

const releasePdfDocument = (url: string) => {
  const cached = documentCache.get(url);
  if (!cached) {
    return;
  }
  cached.refCount -= 1;
  if (cached.refCount <= 0) {
    cached.refCount = 0;
  }
};

const getPdfModule = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PDF viewer only available in the browser"));
  }

  if (!pdfModulePromise) {
    pdfModulePromise = import("pdfjs-dist/build/pdf").then((module) => {
      const workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      module.GlobalWorkerOptions.workerSrc = workerSrc;
      return module;
    });
  }

  return pdfModulePromise;
};

interface PdfSlideViewerProps {
  filePath: string | null;
  pageIndex: number;
  onPageCount?: (count: number) => void;
}

export const PdfSlideViewer = ({
  filePath,
  pageIndex,
  onPageCount,
}: PdfSlideViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [documentRef, setDocumentRef] = useState<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) {
      return;
    }
    const updateSize = () => {
      const width = containerRef.current?.getBoundingClientRect().width ?? 0;
      setContainerWidth((prev) =>
        Math.abs(prev - width) > 0.5 ? width : prev
      );
    };
    updateSize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    window.addEventListener("resize", updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  useEffect(() => {
    if (filePath) {
      return undefined;
    }

    let mounted = true;
    const timeoutId =
      typeof window === "undefined"
        ? null
        : window.setTimeout(() => {
            if (!mounted) {
              return;
            }
            setDocumentRef(null);
            setStatus("idle");
            setError(null);
          }, 0);

    return () => {
      mounted = false;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [filePath]);

  useEffect(() => {
    if (!filePath) {
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setStatus((current) => (current === "ready" ? current : "loading"));
        setError(null);
        const pdf = await acquirePdfDocument(filePath);
        if (cancelled) {
          releasePdfDocument(filePath);
          return;
        }
        setDocumentRef(pdf);
        onPageCount?.(pdf.numPages);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setDocumentRef(null);
          setStatus("error");
          setError("Unable to load the selected PDF deck.");
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      releasePdfDocument(filePath);
    };
  }, [filePath, onPageCount]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    const renderPage = async () => {
      if (!documentRef || !canvasRef.current) {
        return;
      }

      if (pageIndex < 0 || pageIndex >= documentRef.numPages) {
        setStatus("ready");
        return;
      }

      try {
        setStatus((prev) => (prev === "ready" ? "ready" : "loading"));
        const page = await documentRef.getPage(pageIndex + 1);
        if (cancelled) {
          return;
        }

        const baseViewport = page.getViewport({ scale: 1 });
        const containerEl = containerRef.current;
        const rawWidth =
          containerWidth ||
          containerEl?.getBoundingClientRect().width ||
          baseViewport.width;
        let availableWidth = rawWidth;
        if (containerEl && typeof window !== "undefined") {
          const style = window.getComputedStyle(containerEl);
          const paddingX =
            parseFloat(style.paddingLeft || "0") +
            parseFloat(style.paddingRight || "0");
          availableWidth = Math.max(rawWidth - paddingX, 0);
        }
        if (availableWidth === 0) {
          availableWidth = baseViewport.width;
        }
        const scale =
          availableWidth > 0
            ? availableWidth / baseViewport.width
            : window.innerWidth / baseViewport.width;
        const viewport = page.getViewport({ scale: Math.max(scale, 1) });

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) {
          return;
        }

        const outputScale = window.devicePixelRatio || 1;
        const cssWidth = viewport.width;
        const cssHeight = viewport.height;
        canvas.width = Math.floor(cssWidth * outputScale);
        canvas.height = Math.floor(cssHeight * outputScale);
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: context,
          viewport,
          transform:
            outputScale !== 1
              ? [outputScale, 0, 0, outputScale, 0, 0]
              : undefined,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;

        if (!cancelled) {
          setStatus("ready");
        }
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "message" in err &&
          (err as { message?: string }).message?.includes("Transport destroyed")
        ) {
          if (!cancelled) {
            setStatus((current) => (current === "ready" ? current : "loading"));
          }
          return;
        }
        if (
          err &&
          typeof err === "object" &&
          "name" in err &&
          (err as { name?: string }).name === "RenderingCancelledException"
        ) {
          return;
        }
        console.error(err);
        if (!cancelled) {
          setStatus("error");
          setError("Unable to render this slide.");
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [containerWidth, documentRef, pageIndex]);

  return (
    <div
      ref={containerRef}
      className="relative flex w-full items-center justify-center rounded-3xl bg-white/80 p-6 shadow-lg ring-1 ring-zinc-200"
    >
      {status === "error" && (
        <div className="flex h-72 w-full items-center justify-center text-center text-sm text-rose-600">
          {error ?? "Something went wrong loading the slide."}
        </div>
      )}
      {(status === "loading" || status === "idle") && (
        <div className="flex h-72 w-full items-center justify-center text-sm text-zinc-500">
          {status === "idle"
            ? "Pick a topic to load the deck."
            : "Loading slide…"}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`w-full max-w-full ${
          status === "ready" ? "block" : "hidden"
        }`}
      />
    </div>
  );
};
