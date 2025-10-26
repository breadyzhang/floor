'use client';

import { useEffect, useRef, useState } from "react";
import { getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import type { RenderTask } from "pdfjs-dist/types/src/display/api";

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
  const [renderSeed, setRenderSeed] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleResize = () => {
      setRenderSeed((seed) => seed + 1);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
    let loadedDocument: PDFDocumentProxy | null = null;

    const loadingTask = getDocument({ url: filePath, disableWorker: true });

    const load = async () => {
      try {
        setStatus("loading");
        setError(null);
        const pdf = await loadingTask.promise;
        if (cancelled) {
          await pdf.destroy();
          return;
        }
        loadedDocument = pdf;
        setDocumentRef(pdf);
        onPageCount?.(pdf.numPages);
        setRenderSeed((seed) => seed + 1);
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
      if (loadedDocument) {
        loadedDocument.destroy().catch(() => {
          /* ignore */
        });
      } else {
        loadingTask.destroy().catch(() => {
          /* ignore */
        });
      }
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
        setStatus("loading");
        const page = await documentRef.getPage(pageIndex + 1);
        if (cancelled) {
          return;
        }

        const baseViewport = page.getViewport({ scale: 1 });
        const containerWidth =
          containerRef.current?.clientWidth ?? baseViewport.width;
        const scale =
          containerWidth > 0
            ? containerWidth / baseViewport.width
            : window.innerWidth / baseViewport.width;
        const viewport = page.getViewport({ scale: Math.max(scale, 1) });

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) {
          return;
        }

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = viewport.width * outputScale;
        canvas.height = viewport.height * outputScale;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

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
  }, [documentRef, pageIndex, renderSeed]);

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
