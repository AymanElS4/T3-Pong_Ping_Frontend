import { useState, useMemo, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Upload, Download, Eye, Trash2, FolderOpen, Search, Filter, Lock, Folder, File, ArrowLeft, ChevronRight, Home, Link2, BookOpen, X } from 'lucide-react';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './ui/pagination';
import { DocumentViewer } from './DocumentViewer';

interface FolderItem {
  id: string;
  name: string;
  type: 'folder';
  parentId: string | null;
}

interface FileItem {
  id: string;
  name: string;
  type: 'file';
  parentId: string;
  caseNumber: string;
  uploadDate: string;
  size: string;
  status: 'Activo' | 'Cerrado' | 'Pendiente' | 'Histórico' | 'Archivado';
  category?: string;
}

type Item = FolderItem | FileItem;

type UserTier = 'Básico' | 'Profesional' | 'Empresa' | 'Administrador';

interface LegalCaseManagerProps {
  userTier: UserTier;
}

export function LegalCaseManager({ userTier }: LegalCaseManagerProps) {
  // State for items from backend
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  useEffect(() => {
    const fetchCasos = async () => {
      try {
        const raw = await api.get<any>('/casos/');
        // Handle different possible API shapes (array, { results: [] }, { data: [] }, etc.)
        const data: any[] = Array.isArray(raw)
          ? raw
          : raw?.results ?? raw?.data ?? [];

        if (!Array.isArray(data)) {
          console.warn('Unexpected response shape for /casos/:', raw);
        }

        const mappedCases: FileItem[] = data.map((caso: any) => ({
          id: caso.oid_caso?.toString() ?? `case-${Date.now()}`,
          name: caso.titulo || 'Sin título',
          type: 'file',
          parentId: 'root', // Flat structure for now or categorized by type
          caseNumber: caso.numero_expediente || '0',
          uploadDate: caso.fecha_inicio || new Date().toISOString().split('T')[0],
          size: '0 KB', // Not in current backend model
          status: (caso.estado_nombre as any) || 'Pendiente',
          category: caso.tipo_caso_nombre || 'Sin Categoría'
        }));

        // Optionally create folders based on TipoCaso
        const uniqueTypes = Array.from(new Set((data || []).map((c: any) => c.tipo_caso_nombre)));
        const typeFolders: FolderItem[] = uniqueTypes.map((type: any, idx: number) => ({
          id: `folder-${idx}`,
          name: type || 'Sin Categoría',
          type: 'folder',
          parentId: null
        }));

        // Re-parent cases to their type folders
        mappedCases.forEach(c => {
          const original = (data || []).find((oc: any) => oc.oid_caso?.toString() === c.id);
          const folder = typeFolders.find(f => f.name === original?.tipo_caso_nombre);
          if (folder) c.parentId = folder.id;
        });

        setItems([...typeFolders, ...mappedCases]);
      } catch (error) {
        console.error('Error fetching cases:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCasos();
  }, []);
  
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [newCaseName, setNewCaseName] = useState('');
  const [newCaseNumber, setNewCaseNumber] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCaseType, setSelectedCaseType] = useState('');
  const [selectedCaseState, setSelectedCaseState] = useState('');
  const [tiposCaso, setTiposCaso] = useState<any[]>([]);
  const [estadosCaso, setEstadosCaso] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'Todos' | 'Civil' | 'Penal' | 'Laboral' | 'Corporativo'>('Todos');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Activo' | 'Cerrado' | 'Pendiente' | 'Histórico' | 'Archivado'>('Todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [viewingDocument, setViewingDocument] = useState<FileItem | null>(null);

  // Asociar artículos legales (normativas) a un caso — HU "associate legal articles with a case"
  const [linkingCase, setLinkingCase] = useState<FileItem | null>(null);
  const [codeSearch, setCodeSearch] = useState('');
  const [codeResults, setCodeResults] = useState<any[]>([]);
  const [searchingCodes, setSearchingCodes] = useState(false);
  const [references, setReferences] = useState<any[]>([]);
  const [refLoading, setRefLoading] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const { user } = useAuth();
  const isPremiumUser = userTier === 'Profesional' || userTier === 'Empresa' || userTier === 'Administrador';
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Get current folder path (breadcrumb)
  const getBreadcrumbPath = () => {
    const path: FolderItem[] = [];
    let currentId = currentFolderId;
    
    while (currentId) {
      const folder = items.find(item => item.id === currentId && item.type === 'folder') as FolderItem;
      if (folder) {
        path.unshift(folder);
        currentId = folder.parentId;
      } else {
        break;
      }
    }
    
    return path;
  };

  // Get current items (folders and files in current directory)
  const currentItems = useMemo(() => {
    return items.filter(item => item.parentId === currentFolderId);
  }, [items, currentFolderId]);

  // Filter items
  const filteredItems = useMemo(() => {
    const hasActiveDeepFilters = categoryFilter !== 'Todos' || statusFilter !== 'Todos' || startDate !== '' || endDate !== '';
    const hasSearch = searchQuery !== '';

    const baseItems = (hasActiveDeepFilters || hasSearch) 
      ? items.filter(item => item.type === 'file') 
      : currentItems;

    return baseItems.filter((item) => {
      if (item.type === 'folder') {
        return item.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      
      const fileItem = item as FileItem;
      const matchesSearch =
        fileItem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fileItem.caseNumber.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === 'Todos' || fileItem.category === categoryFilter;
      
      const matchesStatus = statusFilter === 'Todos' || fileItem.status === statusFilter;
      
      const caseDate = new Date(fileItem.uploadDate);
      const matchesStartDate = !startDate || caseDate >= new Date(startDate);
      const matchesEndDate = !endDate || caseDate <= new Date(endDate);
      
      return matchesSearch && matchesCategory && matchesStatus && matchesStartDate && matchesEndDate;
    });
  }, [items, currentItems, searchQuery, categoryFilter, statusFilter, startDate, endDate]);

  // Sort items: folders first, then files
  const sortedItems = useMemo(() => {
    const folders = filteredItems.filter(item => item.type === 'folder');
    const files = filteredItems.filter(item => item.type === 'file');
    return [...folders, ...files];
  }, [filteredItems]);

  // Pagination
  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedItems.slice(startIndex, endIndex);
  }, [sortedItems, currentPage]);
const loadCasos = async () => {
    try {
      const raw = await api.get<any>('/casos/');
      const data: any[] = Array.isArray(raw) ? raw : raw?.results ?? raw?.data ?? [];

      const mappedCases: FileItem[] = data.map((caso: any) => ({
        id: caso.oid_caso?.toString() ?? `case-${Date.now()}`,
        name: caso.titulo || 'Sin título',
        type: 'file',
        parentId: 'root',
        caseNumber: caso.numero_expediente || '0',
        uploadDate: caso.fecha_inicio || new Date().toISOString().split('T')[0],
        size: '0 KB',
        status: (caso.estado_nombre as any) || 'Pendiente',
        category: caso.tipo_caso_nombre || 'Sin Categoría'
      }));

      const uniqueTypes = Array.from(new Set((data || []).map((c: any) => c.tipo_caso_nombre)));
      const typeFolders: FolderItem[] = uniqueTypes.map((type: any, idx: number) => ({
        id: `folder-type-${idx}`,
        name: type || 'Sin Categoría',
        type: 'folder',
        parentId: null
      }));

      const stateFolders: FolderItem[] = [];
      let stateFolderIdCounter = 0;

      mappedCases.forEach(c => {
        const original = (data || []).find((oc: any) => oc.oid_caso?.toString() === c.id);
        const typeFolder = typeFolders.find(f => f.name === original?.tipo_caso_nombre);
        if (typeFolder) {
          const stateName = original?.estado_nombre || 'Sin Estado';
          let stateFolder = stateFolders.find(f => f.parentId === typeFolder.id && f.name === stateName);
          if (!stateFolder) {
            stateFolder = {
              id: `folder-state-${stateFolderIdCounter++}`,
              name: stateName,
              type: 'folder',
              parentId: typeFolder.id
            };
            stateFolders.push(stateFolder);
          }
          c.parentId = stateFolder.id;
        }
      });

      setItems([...typeFolders, ...stateFolders, ...mappedCases]);
    } catch (error) {
      console.error('Error fetching cases:', error);
    } finally {
      setLoading(false);
    }
  };

  // Se ejecuta solo una vez al cargar el componente
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const resTipos = await api.get<any>('/tipos-caso/');
        const dataTipos = Array.isArray(resTipos) ? resTipos : resTipos?.results ?? resTipos?.data ?? [];
        setTiposCaso(dataTipos);
        if (dataTipos.length > 0) setSelectedCaseType(dataTipos[0].oid_tipo_caso.toString());

        const resEstados = await api.get<any>('/estados-caso/');
        const dataEstados = Array.isArray(resEstados) ? resEstados : resEstados?.results ?? resEstados?.data ?? [];
        setEstadosCaso(dataEstados);
        if (dataEstados.length > 0) setSelectedCaseState(dataEstados[0].oid_estado.toString());
      } catch (error) {
        console.error('Error fetching metadata:', error);
      }
    };
    const timer = setTimeout(() => {
      loadCasos();
      loadMetadata();
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [searchQuery, categoryFilter, statusFilter, startDate, endDate, currentFolderId]);
  const resetForm = () => {
    setNewCaseName('');
    setNewCaseNumber('');
    setSelectedFile(null);
    if (tiposCaso.length > 0) setSelectedCaseType(tiposCaso[0].oid_tipo_caso.toString());
    else setSelectedCaseType('');
    if (estadosCaso.length > 0) setSelectedCaseState(estadosCaso[0].oid_estado.toString());
    else setSelectedCaseState('');
    setUploadError(null);
    setUploadProgress(0);
  };
  const handleUpload = async () => {
    if (!isPremiumUser) {
      alert('Necesita un plan Premium o superior para subir casos legales. Por favor, actualice su plan.');
      return;
    }

    if (!newCaseName || !newCaseNumber || !selectedFile) {
      alert('Por favor complete el nombre del caso, número de caso y seleccione un archivo PDF.');
      return;
    }

    if (!user) {
      alert('No se encontró el usuario. Por favor cierre sesión e inicie sesión de nuevo.');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('oid_abogado', user.oid_usuario.toString());
      formData.append('oid_tipo_caso', selectedCaseType.toString());
      formData.append('oid_estado', selectedCaseState.toString());
      formData.append('titulo', newCaseName);
      formData.append('numero_expediente', newCaseNumber);
      formData.append('fecha_inicio', new Date().toISOString().split('T')[0]);
      formData.append('archivo_pdf', selectedFile, selectedFile.name);

      const createdCase = await api.postForm<any>('/casos/', formData);

      const newFile: FileItem = {
        id: createdCase?.oid_caso?.toString() ?? `file-${Date.now()}`,
        name: newCaseName,
        type: 'file',
        parentId: currentFolderId || 'root',
        caseNumber: newCaseNumber,
        uploadDate: createdCase?.fecha_inicio || new Date().toISOString().split('T')[0],
        size: `${Math.round(selectedFile.size / 1024)} KB`,
        status: createdCase?.estado_nombre || 'Activo'
      };

      setItems([...items, newFile]);
      setNewCaseName('');
      setNewCaseNumber('');
      setSelectedFile(null);
      if (tiposCaso.length > 0) setSelectedCaseType(tiposCaso[0].oid_tipo_caso.toString());
      else setSelectedCaseType('');
      if (estadosCaso.length > 0) setSelectedCaseState(estadosCaso[0].oid_estado.toString());
      else setSelectedCaseState('');
      setIsUploadOpen(false);
      setTimeout(async () => {
        await loadCasos(); // Vuelve a pedir los datos frescos al backend de forma invisible
        resetForm();
        setIsUploadOpen(false);
      }, 500);
    } catch (error) {
      console.error('Error subiendo caso:', error);
      alert('No se pudo subir el caso. Revise la consola y vuelva a intentarlo.');
    } finally {
      setUploading(false);
    }
  };

const handleDownload = async (file: FileItem) => {
  if (!isPremiumUser) {
    alert('Necesita un plan Premium o superior para descargar casos.');
    return;
  }

  setDownloadingId(file.id);

  try {

    const { blob, filename } = await api.getFile(`/casos/${file.id}/descargar-documento/`);
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    a.download = filename && filename !== 'documento.pdf' ? filename : `${file.caseNumber}.pdf`;

    document.body.appendChild(a);

    a.click(); // Disparamos la descarga
    
    // Limpiamos la memoria y el DOM
    a.remove();
    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Error al descargar:', error);
    // Puedes usar un toast aquí, o un alert si prefieres
    alert('No se pudo descargar el documento. Es posible que el archivo ya no exista.');
  } finally {
    setDownloadingId(null);
  }
};

  const handleView = (file: FileItem) => {
    setViewingDocument(file);
  };

  // ── Asociación de artículos legales a un caso ───────────────────────────
  const loadReferences = async (caseId: string) => {
    setRefLoading(true);
    try {
      const raw = await api.get<any>(`/caso-normativas/?oid_caso=${caseId}`);
      const data: any[] = Array.isArray(raw) ? raw : raw?.results ?? raw?.data ?? [];
      setReferences(data);
    } catch (error) {
      console.error('Error cargando referencias:', error);
      setReferences([]);
    } finally {
      setRefLoading(false);
    }
  };

  const openLinkDialog = (file: FileItem) => {
    setLinkingCase(file);
    setCodeSearch('');
    setCodeResults([]);
    setLinkError(null);
    loadReferences(file.id);
  };

  const handleSearchCodes = async () => {
    setSearchingCodes(true);
    setLinkError(null);
    try {
      const raw = await api.get<any>(`/codigos/?search=${encodeURIComponent(codeSearch)}`);
      const data: any[] = Array.isArray(raw) ? raw : raw?.results ?? raw?.data ?? [];
      setCodeResults(data);
    } catch (error) {
      console.error('Error buscando códigos:', error);
      setLinkError('No se pudieron buscar los artículos.');
    } finally {
      setSearchingCodes(false);
    }
  };

  const handleLink = async (codigo: any) => {
    if (!linkingCase) return;
    setLinkBusy(true);
    setLinkError(null);
    try {
      await api.post('/caso-normativas/', {
        oid_caso: Number(linkingCase.id),
        oid_codigo: codigo.oid_codigo,
      });
      await loadReferences(linkingCase.id);
    } catch (error) {
      setLinkError((error as Error).message || 'No se pudo vincular el artículo.');
    } finally {
      setLinkBusy(false);
    }
  };

  const handleUnlink = async (relacionId: number) => {
    if (!linkingCase) return;
    setLinkBusy(true);
    setLinkError(null);
    try {
      await api.delete(`/caso-normativas/${relacionId}/`);
      await loadReferences(linkingCase.id);
    } catch (error) {
      setLinkError((error as Error).message || 'No se pudo desvincular el artículo.');
    } finally {
      setLinkBusy(false);
    }
  };
  // ────────────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de que desea eliminar este caso?')) {
      try {
        await api.delete(`/casos/${id}/`);
        await loadCasos();
      } catch (error) {
        console.error('Error al eliminar caso:', error);
        alert('No se pudo eliminar el caso: ' + (error as Error).message);
      }
    }
  };

  const handleOpenFolder = (folderId: string) => {
    setCurrentFolderId(folderId);
    setCurrentPage(1);
  };

  const handleGoBack = () => {
    const currentFolder = items.find(item => item.id === currentFolderId && item.type === 'folder') as FolderItem;
    if (currentFolder) {
      setCurrentFolderId(currentFolder.parentId);
      setCurrentPage(1);
    }
  };

  const handleGoToRoot = () => {
    setCurrentFolderId(null);
    setCurrentPage(1);
  };

  const handleBreadcrumbClick = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setCategoryFilter('Todos');
    setStatusFilter('Todos');
    setStartDate('');
    setEndDate('');
    setFilterOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Activo':
        return 'bg-green-100 text-green-800';
      case 'Cerrado':
        return 'bg-gray-100 text-gray-800';
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'Histórico':
        return 'bg-blue-100 text-blue-800';
      case 'Archivado':
        return 'bg-gray-200 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const hasActiveFilters = categoryFilter !== 'Todos' || statusFilter !== 'Todos' || startDate || endDate;
  const breadcrumbPath = getBreadcrumbPath();
  const folders = sortedItems.filter(item => item.type === 'folder');
  const files = sortedItems.filter(item => item.type === 'file');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-gray-900">Directorio de Casos Legales</h2>
          <p className="text-gray-600 mt-1">Administre y acceda a todos sus archivos de casos legales</p>
        </div>
        
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <DialogTrigger asChild>
                    <Button className="gap-2" disabled={!isPremiumUser}>
                      {!isPremiumUser && <Lock className="w-4 h-4" />}
                      {isPremiumUser && <Upload className="w-4 h-4" />}
                      Subir Caso
                    </Button>
                  </DialogTrigger>
                </div>
              </TooltipTrigger>
              {!isPremiumUser && (
                <TooltipContent>
                  <p>Se requiere plan Premium o superior</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Subir Nuevo Caso Legal</DialogTitle>
              <DialogDescription>
                Agregue un nuevo caso legal a su directorio
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="case-name">Nombre del Caso</Label>
                <Input
                  id="case-name"
                  placeholder="Ingrese el nombre del caso"
                  value={newCaseName}
                  onChange={(e) => setNewCaseName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="case-number">Número de Caso</Label>
                <Input
                  id="case-number"
                  placeholder="Ingrese el número de caso"
                  value={newCaseNumber}
                  onChange={(e) => setNewCaseNumber(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="case-type">Tipo de Caso</Label>
                  <Select value={selectedCaseType} onValueChange={(value) => setSelectedCaseType(value)}>
                    <SelectTrigger id="case-type">
                      <SelectValue placeholder="Seleccione tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposCaso.map((tipo) => (
                        <SelectItem key={tipo.oid_tipo_caso} value={tipo.oid_tipo_caso.toString()}>
                          {tipo.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="case-state">Estado</Label>
                  <Select value={selectedCaseState} onValueChange={(value) => setSelectedCaseState(value)}>
                    <SelectTrigger id="case-state">
                      <SelectValue placeholder="Seleccione estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {estadosCaso.map((estado) => (
                        <SelectItem key={estado.oid_estado} value={estado.oid_estado.toString()}>
                          {estado.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="file-upload">Documento PDF del Caso</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
                {selectedFile && (
                  <p className="text-sm text-gray-600">Archivo seleccionado: {selectedFile.name}</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsUploadOpen(false)} disabled={uploading}>
                  Cancelar
                </Button>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Subiendo...' : 'Subir'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!isPremiumUser && (
        <Alert className="bg-amber-50 border-amber-200">
          <Lock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Usted no tiene permiso para descargar y subir casos legales.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="space-y-3">
            {/* Breadcrumb navigation */}
            <div className="flex items-center gap-2 text-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoToRoot}
                className="gap-1 h-8 px-2"
              >
                <Home className="w-4 h-4" />
                Inicio
              </Button>
              {breadcrumbPath.map((folder, index) => (
                <div key={folder.id} className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBreadcrumbClick(folder.id)}
                    className="h-8 px-2"
                  >
                    {folder.name}
                  </Button>
                </div>
              ))}
            </div>

            {/* Back button */}
            {currentFolderId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoBack}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Button>
            )}

            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              <CardTitle>
                {currentFolderId 
                  ? breadcrumbPath[breadcrumbPath.length - 1]?.name || 'Carpeta'
                  : 'Todos los Casos'}
              </CardTitle>
            </div>
            <CardDescription>
              {folders.length} carpeta{folders.length !== 1 ? 's' : ''} • {files.length} archivo{files.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter Section */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar carpetas y casos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Filtrar
                  {hasActiveFilters && <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-5">•</Badge>}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Filtros de Búsqueda</DialogTitle>
                  <DialogDescription>
                    Aplique filtros para refinar su búsqueda de casos legales
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  {hasActiveFilters && (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="h-auto p-1 text-xs"
                      >
                        Limpiar todo
                      </Button>
                    </div>
                  )}

                  <Separator />

                  {/* Category and Status Filters Side by Side */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Category Filter */}
                    <div className="space-y-2">
                      <Label className="text-sm">Categoría</Label>
                      <div className="space-y-1">
                        {(['Todos', 'Civil', 'Penal', 'Laboral', 'Corporativo'] as const).map((category) => (
                          <div
                            key={category}
                            onClick={() => setCategoryFilter(category)}
                            className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                              categoryFilter === category
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-accent'
                            }`}
                          >
                            <span className="text-sm">{category}</span>
                            {categoryFilter === category && (
                              <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-2">
                      <Label className="text-sm">Estado</Label>
                      <div className="space-y-1">
                        {(['Todos', 'Activo', 'Cerrado', 'Pendiente', 'Histórico', 'Archivado'] as const).map((status) => (
                          <div
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                              statusFilter === status
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-accent'
                            }`}
                          >
                            <span className="text-sm">{status}</span>
                            {statusFilter === status && (
                              <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Date Filter */}
                  <div className="space-y-3">
                    <Label className="text-sm">Rango de Fechas</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="start-date" className="text-xs text-gray-600">Fecha de inicio</Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="end-date" className="text-xs text-gray-600">Fecha de fin</Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setFilterOpen(false)}>
                      Cerrar
                    </Button>
                    <Button onClick={() => setFilterOpen(false)}>
                      Aplicar Filtros
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Combined Table for Folders and Files */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Número de Caso</TableHead>
                <TableHead>Fecha de Subida</TableHead>
                {/* <TableHead>Tamaño</TableHead> */}
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                    <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>Esta carpeta está vacía</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item) => {
                  if (item.type === 'folder') {
                    return (
                      <TableRow 
                        key={item.id} 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleOpenFolder(item.id)}
                      >
                        <TableCell className="flex items-center gap-2">
                          <Folder className="w-5 h-5 text-blue-600" />
                          <span>{item.name}</span>
                        </TableCell>
                        <TableCell className="text-gray-400">—</TableCell>
                        <TableCell className="text-gray-400">—</TableCell>
                        {/* <TableCell className="text-gray-400">—</TableCell> */}
                        <TableCell>
                          <Badge variant="outline">Carpeta</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenFolder(item.id);
                            }}
                            title="Abrir"
                          >
                            <FolderOpen className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  } else {
                    const file = item as FileItem;
                    return (
                      <TableRow key={file.id}>
                        <TableCell className="flex items-center gap-2">
                          <File className="w-4 h-4 text-gray-500" />
                          {file.name}
                        </TableCell>
                        <TableCell>{file.caseNumber}</TableCell>
                        <TableCell>{file.uploadDate}</TableCell>
                        {/* <TableCell>{file.size}</TableCell> */}
                        <TableCell>
                          <Badge className={getStatusColor(file.status)}>
                            {file.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(file)}
                              title="Ver"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openLinkDialog(file)}
                              title="Vincular artículos legales"
                            >
                              <Link2 className="w-4 h-4 text-indigo-600" />
                            </Button>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDownload(file)}
                                    title="Descargar"
                                    disabled={!isPremiumUser}
                                  >
                                    {!isPremiumUser ? <Lock className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                                  </Button>
                                </TooltipTrigger>
                                {!isPremiumUser && (
                                  <TooltipContent>
                                    <p>Se requiere plan Premium o superior</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(file.id)}
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first page, last page, current page, and pages around current
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <PaginationEllipsis key={page} />;
                    }
                    return null;
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Viewer */}
      {viewingDocument && (
        <DocumentViewer
          documentId={viewingDocument.id}
          documentName={viewingDocument.name}
          documentCode={viewingDocument.caseNumber}
          documentType="case"
          onClose={() => setViewingDocument(null)}
          onDownload={() => handleDownload(viewingDocument)}
        />
      )}

      {/* Vincular artículos legales (normativas) a un caso */}
      <Dialog
        open={!!linkingCase}
        onOpenChange={(open) => {
          if (!open) {
            setLinkingCase(null);
            setCodeResults([]);
            setReferences([]);
            setLinkError(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Artículos legales del caso
            </DialogTitle>
            <DialogDescription>
              {linkingCase
                ? `Vincule artículos legales para fundamentar el caso "${linkingCase.name}".`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {linkError && (
            <Alert className="bg-red-50 border-red-200">
              <AlertDescription className="text-red-800">{linkError}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
            {/* Buscador y resultados */}
            <div className="space-y-3">
              <Label className="text-sm">Buscar artículos</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Nombre de norma o número de artículo..."
                    value={codeSearch}
                    onChange={(e) => setCodeSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearchCodes();
                    }}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleSearchCodes} disabled={searchingCodes}>
                  {searchingCodes ? 'Buscando...' : 'Buscar'}
                </Button>
              </div>

              <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
                {codeResults.length === 0 ? (
                  <p className="text-sm text-gray-500 p-4 text-center">
                    Busque un artículo para vincularlo al caso.
                  </p>
                ) : (
                  codeResults.map((codigo) => {
                    const alreadyLinked = references.some(
                      (r) => r.oid_codigo === codigo.oid_codigo
                    );
                    return (
                      <div
                        key={codigo.oid_codigo}
                        className="flex items-center justify-between gap-2 p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm truncate">{codigo.nombre_norma}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {codigo.numero_articulo} ·{' '}
                            {codigo.estado_vigencia ||
                              (codigo.vigencia ? 'Vigente' : 'Histórico')}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 shrink-0"
                          disabled={alreadyLinked || linkBusy}
                          onClick={() => handleLink(codigo)}
                        >
                          <Link2 className="w-4 h-4" />
                          {alreadyLinked ? 'Vinculado' : 'Vincular'}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Referencias actuales */}
            <div className="space-y-3">
              <Label className="text-sm">
                Referencias{' '}
                {references.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {references.length}
                  </Badge>
                )}
              </Label>
              <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
                {refLoading ? (
                  <p className="text-sm text-gray-500 p-4 text-center">Cargando...</p>
                ) : references.length === 0 ? (
                  <p className="text-sm text-gray-500 p-4 text-center">
                    Sin referencias aún.
                  </p>
                ) : (
                  references.map((ref) => (
                    <div
                      key={ref.oid_relacion}
                      className="flex items-center justify-between gap-2 p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm truncate">{ref.codigo_nombre}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {ref.codigo_numero_articulo}
                          {ref.codigo_vigencia === false ? ' · Histórico' : ''}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 shrink-0 text-red-600"
                        disabled={linkBusy}
                        onClick={() => handleUnlink(ref.oid_relacion)}
                        title="Desvincular"
                      >
                        <X className="w-4 h-4" />
                        Desvincular
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setLinkingCase(null)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
