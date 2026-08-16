import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { X, FileText, ChevronRight } from 'lucide-react';
import { Badge } from './ui/badge';
import { api } from '../services/api';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker using cloudflare CDN matching version of local package
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface DocumentSection {
  id: string;
  title: string;
  level: number;
  targetId?: string;
}

interface DocumentViewerProps {
  documentId: string;
  documentName: string;
  documentCode?: string;
  documentType: 'case' | 'code';
  onClose: () => void;
  onDownload?: () => void; 
}

interface PdfPageProps {
  pageNumber: number;
  pdfDoc: any;
}

// Inner component to render an individual PDF page onto a canvas
function PdfPage({ pageNumber, pdfDoc }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadingPage, setLoadingPage] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let renderTask: any = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!isMounted) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Scale to a nice readable width (1.5x zoom)
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
        
        if (isMounted) {
          setLoadingPage(false);
        }
      } catch (err) {
        console.error(`Error rendering page ${pageNumber}:`, err);
      }
    };

    renderPage();
    return () => {
      isMounted = false;
      if (renderTask && renderTask.cancel) {
        renderTask.cancel();
      }
    };
  }, [pageNumber, pdfDoc]);

  return (
    <div className="flex flex-col items-center my-6 bg-white p-4 shadow-lg rounded-md border border-gray-200 max-w-full">
      <div className="text-xs text-gray-400 mb-2 font-medium">Página {pageNumber}</div>
      {loadingPage && (
        <div className="h-[800px] w-[600px] max-w-full flex items-center justify-center animate-pulse bg-gray-50 border border-dashed rounded">
          <p className="text-gray-400 text-sm">Cargando contenido de la página...</p>
        </div>
      )}
      <canvas ref={canvasRef} className={`max-w-full h-auto shadow border rounded ${loadingPage ? 'hidden' : 'block'}`} />
    </div>
  );
}

export function DocumentViewer({ documentId, documentName, documentCode, documentType, onClose, onDownload }: DocumentViewerProps) {
  const [activeSection, setActiveSection] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfSections, setPdfSections] = useState<DocumentSection[]>([]);
  const [documentData, setDocumentData] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    const loadDocument = async () => {
      try {
        setLoading(true);
        setError(null);
        setPdfDoc(null);
        setPdfSections([]);
        setDocumentData(null);

        // 1. Fetch metadata/text content from DB first for header context and fallback
        let textData: any = null;
        try {
          if (documentType === 'code') {
            textData = await api.get<any>(`/codigos/${documentId}/`);
          } else {
            textData = await api.get<any>(`/casos/${documentId}/`);
          }
          if (isMounted) {
            setDocumentData(textData);
          }
        } catch (err) {
          console.warn('No se pudo cargar la metadata de la DB:', err);
        }

        // 2. Fetch and decode the actual PDF file
        const pdfEndpoint = documentType === 'case'
          ? `/casos/${documentId}/descargar-documento/`
          : `/codigos/${documentId}/descargar-documento/`;

        try {
          const { blob } = await api.getFile(pdfEndpoint);
          const arrayBuffer = await blob.arrayBuffer();
          
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const loadedPdf = await loadingTask.promise;
          
          if (isMounted) {
            setPdfDoc(loadedPdf);
            
            // Just section it by pages list
            const pageSections: DocumentSection[] = [];
            for (let i = 1; i <= loadedPdf.numPages; i++) {
              pageSections.push({
                id: `page-${i}`,
                title: 'Página {i}', // Wait! Wait! In Javascript it should be "Página " + i or template string `Página ${i}`!
                // Ah, let's fix template literal syntax: `Página ${i}`!
                level: i === 1 ? 1 : 2,
                targetId: `page-${i}`
              });
            }
            // Let's use correct template literal:
            const correctPageSections: DocumentSection[] = [];
            for (let i = 1; i <= loadedPdf.numPages; i++) {
              correctPageSections.push({
                id: `page-${i}`,
                title: `Página ${i}`,
                level: i === 1 ? 1 : 2,
                targetId: `page-${i}`
              });
            }
            setPdfSections(correctPageSections);
            setActiveSection('page-1');
          }
        } catch (pdfErr) {
          console.warn('Fallo al descargar o decodificar el PDF, activando vista de base de datos:', pdfErr);
          if (isMounted) {
            setActiveSection(documentType === 'code' ? 'norm-title' : 'case-summary');
          }
        }

      } catch (err: any) {
        console.error('Error loading document:', err);
        if (isMounted) {
          setError(err.message || 'Error al cargar el documento legal.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDocument();
    return () => {
      isMounted = false;
    };
  }, [documentId, documentType]);

  const sections: DocumentSection[] = pdfDoc && pdfSections.length > 0
    ? pdfSections
    : documentData
      ? documentType === 'code'
        ? [
            { id: 'norm-title', title: documentData.nombre_norma || documentName, level: 1 },
            { id: 'norm-article', title: `Artículo ${documentData.numero_articulo || documentCode || ''}`, level: 2 }
          ]
        : [
            { id: 'case-summary', title: 'I. Resumen del Caso', level: 1 },
            { id: 'case-details', title: 'II. Detalles del Expediente', level: 2 },
            { id: 'case-dates', title: 'III. Estado y Fechas', level: 2 }
          ]
      : [{ id: 'loading', title: 'Cargando...', level: 1 }];

  const handleSectionClick = (section: DocumentSection) => {
    setActiveSection(section.id);
    const targetId = section.targetId || section.id;
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getSectionParagraphs = (sectionId: string): string[] => {
    if (!documentData) return [];
    if (documentType === 'code') {
      if (sectionId === 'norm-title') {
        return [
          `Este visor presenta los detalles y el texto del artículo registrado bajo la normativa "${documentData.nombre_norma || documentName}".`,
          `Estado de vigencia actual: ${documentData.estado_vigencia || (documentData.vigencia ? 'Vigente' : 'Histórico')}.`
        ];
      }
      if (sectionId === 'norm-article') {
        const text = documentData.texto_contenido || 'No hay contenido disponible para este artículo.';
        return text.split('\n').map((p: string) => p.trim()).filter(Boolean);
      }
    } else {
      if (sectionId === 'case-summary') {
        const text = documentData.descripcion || 'Sin descripción disponible para este caso.';
        return text.split('\n').map((p: string) => p.trim()).filter(Boolean);
      }
      if (sectionId === 'case-details') {
        return [
          `Número de Expediente: ${documentData.numero_expediente || 'No especificado'}`,
          `Juzgado / Dependencia: ${documentData.juzgado || 'No especificado'}`,
          `Abogado Asignado: ${documentData.abogado_nombre || 'No asignado'}`,
          `Tipo de Caso: ${documentData.tipo_caso_nombre || 'No clasificado'}`
        ];
      }
      if (sectionId === 'case-dates') {
        return [
          `Fecha de Inicio del Caso: ${documentData.fecha_inicio || 'No registrada'}`,
          `Fecha de Cierre: ${documentData.fecha_cierre || 'En trámite'}`
        ];
      }
    }
    return [];
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl text-gray-900">{documentName}</h2>
              {documentCode && (
                <p className="text-sm text-gray-600 mt-1">Código: {documentCode}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Side Index */}
          <div className="w-80 border-r bg-gray-50">
            <ScrollArea className="h-full">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <h3 className="text-sm text-gray-900">Índice de Contenido</h3>
                </div>
                {loading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6 pl-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3 pl-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ) : error ? (
                  <p className="text-xs text-red-500">Error al cargar índice</p>
                ) : (
                  <nav className="space-y-1">
                    {sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => handleSectionClick(section)}
                        className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
                          activeSection === section.id
                            ? 'bg-blue-100 text-blue-900'
                            : 'text-gray-700 hover:bg-gray-100'
                        } ${section.level === 2 ? 'pl-6' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          {section.level === 1 && (
                            <ChevronRight className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                              activeSection === section.id ? 'text-blue-600' : 'text-gray-400'
                            }`} />
                          )}
                          <span>
                            {section.title}
                          </span>
                        </div>
                      </button>
                    ))}
                  </nav>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Document Content */}
          <div className="flex-1 overflow-hidden bg-gray-100">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="p-8 max-w-4xl mx-auto space-y-6 animate-pulse">
                  <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                  <div className="flex gap-2">
                    <div className="h-5 bg-gray-200 rounded w-20"></div>
                    <div className="h-5 bg-gray-200 rounded w-24"></div>
                  </div>
                  <div className="space-y-3 pt-6">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  </div>
                  <div className="space-y-3 pt-6">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                  </div>
                </div>
              ) : error ? (
                <div className="flex flex-col justify-center items-center h-full space-y-4 text-center p-8">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                    <X className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">Error al cargar</h3>
                  <p className="text-gray-600 text-sm max-w-md">{error}</p>
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    Reintentar
                  </Button>
                </div>
              ) : pdfDoc ? (
                /* PDF Canvas Render View */
                <div className="p-6 max-w-4xl mx-auto flex flex-col items-center">
                  {Array.from({ length: pdfDoc.numPages }, (_, i) => (
                    <div key={i + 1} id={`page-${i + 1}`} className="scroll-mt-8 w-full flex justify-center">
                      <PdfPage pageNumber={i + 1} pdfDoc={pdfDoc} />
                    </div>
                  ))}
                </div>
              ) : (
                /* Fallback text database reader view */
                <div className="p-8 max-w-4xl mx-auto bg-white my-6 shadow-md rounded border">
                  {/* Document Info */}
                  <div className="mb-8 pb-6 border-b">
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="outline" className="text-xs">
                        {documentType === 'code' ? 'Código Legal' : 'Caso Legal'}
                      </Badge>
                      {documentType === 'code' ? (
                        <Badge variant="outline" className={`text-xs ${documentData?.vigencia ? 'text-green-700 border-green-200 bg-green-50' : 'text-gray-700 border-gray-200 bg-gray-50'}`}>
                          {documentData?.estado_vigencia || (documentData?.vigencia ? 'Vigente' : 'Histórico')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-blue-700 border-blue-200 bg-blue-50">
                          {documentData?.estado_nombre || 'Activo'}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        Última actualización: {documentData?.uploadDate || documentData?.fecha_inicio || 'Reciente'}
                      </Badge>
                    </div>
                    <h1 className="text-3xl text-gray-900 mb-2">
                      {documentType === 'code' ? documentData?.nombre_norma : documentData?.titulo}
                    </h1>
                    <p className="text-gray-600">
                      {documentType === 'code' 
                        ? `Artículo de Referencia: ${documentData?.numero_articulo || documentCode}`
                        : `Expediente: ${documentData?.numero_expediente || documentCode}`}
                    </p>
                  </div>

                  {/* Sections Content */}
                  <div className="space-y-8">
                    {sections.map((section) => (
                      <div key={section.id} id={section.id} className="scroll-mt-8">
                        {section.level === 1 ? (
                          <h2 className="text-2xl text-gray-900 mb-4 pb-2 border-b">
                            {section.title}
                          </h2>
                        ) : (
                          <h3 className="text-xl text-gray-900 mb-3">
                            {section.title}
                          </h3>
                        )}
                        <div className="space-y-4 text-gray-700">
                          {getSectionParagraphs(section.id).map((paragraph, idx) => (
                            <p key={idx} className="leading-relaxed">
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* End of document */}
                  <div className="mt-12 pt-8 border-t text-center text-gray-500">
                    <p>Fin del documento</p>
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Footer with actions */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileText className="w-4 h-4" />
            <span>{sections.length} secciones</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onDownload}>
              Descargar PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              Imprimir
            </Button>
            <Button size="sm" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
