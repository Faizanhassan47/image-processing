import { useEffect, useRef } from 'react';
import { Maximize2, Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import WsiViewer from '../WsiViewer/WsiViewer';
import './SlideViewer.css';

export default function SlideViewer({ slide, zoom, setZoom, position, setPosition, dragStart, setDragStart,
  isDragging, setIsDragging, viewerRef, reset, onError, syncViews, syncedViewerRef }) {
  const transformRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    if (transformRef.current) transformRef.current.style.transform = `translate(${position.x}px, ${position.y}px)`;
    if (imageRef.current) imageRef.current.style.width = `${zoom * 100}%`;
  }, [position.x, position.y, zoom]);

  if (slide.file_type === 'wsi') return <WsiViewer slide={slide} onError={onError} syncViews={syncViews} syncedViewerRef={syncedViewerRef} externalViewerRef={viewerRef} />;

  const down = (event) => {
    setIsDragging(true);
    setDragStart({ x: event.clientX - position.x, y: event.clientY - position.y });
  };
  const move = (event) => isDragging && setPosition({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });
  const up = () => setIsDragging(false);

  return <div className="viewer-canvas-container">
    <div className="viewer-hint-bar"><span><Move size={13} /> Wheel to zoom · Drag to pan</span>
      <div className="controls"><button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(.2, value / 1.4))}><ZoomOut size={16} /></button>
        <span className="zoom-display" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(10, value * 1.4))}><ZoomIn size={16} /></button>
        <button type="button" className="btn-control-secondary" onClick={reset}><RotateCcw size={15} /> Reset</button>
        <button type="button" className="btn-control-secondary" onClick={() => { setZoom(.5); setPosition({ x: 0, y: 0 }); }}><Maximize2 size={15} /> Fit</button></div></div>
    <div ref={viewerRef} className={`viewer ${isDragging ? 'grabbing' : 'grabbable'}`}
      onWheel={(event) => { event.preventDefault(); setZoom((value) => event.deltaY < 0 ? Math.min(10, value * 1.15) : Math.max(.2, value / 1.15)); }}
      onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}>
      <div ref={transformRef} className="viewer-transform-layer"><img ref={imageRef} src={slide.image_url} alt={`Slide ${slide.label}`} draggable={false} /></div>
    </div>
  </div>;
}
