import { useState, useMemo, useEffect } from 'react';
import { api } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Upload, Download, Eye, Trash2, BookOpen, Search, Filter, Lock, Folder, File, ArrowLeft, ChevronRight, Home, FolderOpen } from 'lucide-react';
import { Badge } from './ui/badge';
//import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
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
  code: string;
  jurisdiction: string;
  uploadDate: string;
  size: string;
  category: 'Civil' | 'Penal' | 'Constitucional' | 'Administrativo';
  status: 'Vigente' | 'Histórico' | 'Derogado';
}

type Item = FolderItem | FileItem;

type UserTier = 'Básico' | 'Profesional' | 'Empresa' | 'Administrador';

interface LegalCodeManagerProps {
  userTier: UserTier;
}

export function LegalCodeManager({ userTier }: LegalCodeManagerProps) {
  // Sample hierarchical data structure
  // State for items from backend
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadCodigos = async () => {
    try {
      const raw = await api.get<any>('/codigos/');
      const data: any[] = Array.isArray(raw) ? raw : raw?.results ?? raw?.data ?? [];

      if (!Array.isArray(data)) {
        console.warn('Unexpected response shape for /codigos/:', raw);
      }

      const mappedCodes: FileItem[] = (data || []).map((codigo: any) => ({
        id: codigo.oid_codigo?.toString() ?? `code-${Date.now()}`,
        name: codigo.nombre_norma || 'Sin Nombre',
        type: 'file',
        parentId: 'root',
        code: codigo.numero_articulo || '0',
        jurisdiction: codigo.jurisdiccion || 'Federal',
        uploadDate: codigo.fecha_publicada || new Date().toISOString().split('T')[0],
        size: '0 KB',
        category: (codigo.categoria as any) || 'Civil',
        status: (codigo.estado_vigencia as any) || 'Vigente'
      }));

      // Grouping by norm name as "folders"
      const uniqueNorms = Array.from(new Set((data || []).map((c: any) => c.nombre_norma)));
      const normFolders: FolderItem[] = uniqueNorms.map((norm: any, idx: number) => ({
        id: `norm-folder-${idx}`,
        name: norm || 'Sin Nombre',
        type: 'folder',
        parentId: null
      }));

      // Re-parent articles to their norm folders
      mappedCodes.forEach(c => {
        const original = (data || []).find((oc: any) => oc.oid_codigo?.toString() === c.id);
        const folder = normFolders.find(f => f.name === original?.nombre_norma);
        if (folder) c.parentId = folder.id;
      });

      setItems([...normFolders, ...mappedCodes]);
    } catch (error) {
      console.error('Error fetching codes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCodigos();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [newCodeTitle, setNewCodeTitle] = useState('');
  const [newCodeNumber, setNewCodeNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'Todos' | 'Civil' | 'Penal' | 'Constitucional' | 'Administrativo'>('Todos');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Vigente' | 'Histórico' | 'Derogado'>('Todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [viewingDocument, setViewingDocument] = useState<FileItem | null>(null);

  const isPremiumUser = userTier === 'Profesional' || userTier === 'Empresa' || userTier === 'Administrador' || userTier === 'Básico';

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
        fileItem.code.toLowerCase().includes(searchQuery.toLowerCase());
      
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

  // Reset to page 1 when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [searchQuery, categoryFilter, statusFilter, startDate, endDate, currentFolderId]);

  const handleUpload = async () => {
    if (!isPremiumUser) {
      alert('Necesita un plan Premium o superior para subir códigos legales. Por favor, actualice su plan.');
      return;
    }
    if (newCodeTitle && newCodeNumber) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('nombre_norma', newCodeTitle);
        formData.append('numero_articulo', newCodeNumber);
        formData.append('texto_contenido', `Contenido de la norma ${newCodeTitle}, artículo ${newCodeNumber}.`);
        formData.append('vigencia', 'true');
        if (selectedFile) {
          formData.append('archivo_pdf', selectedFile, selectedFile.name);
        }

        await api.postForm('/codigos/', formData);
        await loadCodigos();
        setNewCodeTitle('');
        setNewCodeNumber('');
        setSelectedFile(null);
        setIsUploadOpen(false);
      } catch (error) {
        console.error('Error uploading code:', error);
        alert('No se pudo subir el código legal: ' + (error as Error).message);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleDownload = async (file: FileItem) => {
    if (!isPremiumUser) {
      alert('Necesita un plan Premium o superior para descargar códigos legales. Por favor, actualice su plan.');
      return;
    }
    setDownloadingId(file.id);
    try {
      const { blob, filename } = await api.getFile(`/codigos/${file.id}/descargar-documento/`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename && filename !== 'documento.pdf' ? filename : `${file.name}_Art_${file.code}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al descargar:', error);
      alert('No se pudo descargar el documento. Es posible que el archivo no exista o no esté en formato PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleView = (file: FileItem) => {
    setViewingDocument(file);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de que desea eliminar este código legal?')) {
      try {
        await api.delete(`/codigos/${id}/`);
        await loadCodigos();
        alert('Código legal eliminado correctamente.');
      } catch (error) {
        const errorMessage = (error as Error).message || '';
        if (errorMessage.toLowerCase().includes('json') || errorMessage.toLowerCase().includes('end of input')) {
          console.log('Validación: Borrado exitoso en Neon (Estado 204 sin JSON). Actualizando interfaz...');
          await loadCodigos();
        } else {
          console.error('Error real eliminando código:', error);
          alert('No se pudo eliminar el código legal: ' + errorMessage);
        }
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Civil':
        return 'bg-blue-100 text-blue-800';
      case 'Penal':
        return 'bg-red-100 text-red-800';
      case 'Constitucional':
        return 'bg-purple-100 text-purple-800';
      case 'Administrativo':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Vigente':
        return 'bg-green-100 text-green-800';
      case 'Histórico':
        return 'bg-gray-100 text-gray-800';
      case 'Derogado':
        return 'bg-red-100 text-red-800';
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
          <h2 className="text-2xl text-gray-900">Biblioteca de Códigos Legales</h2>
          <p className="text-gray-600 mt-1">Acceda a todos los códigos y artículos legales organizados</p>
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
                      Subir Código
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
              <DialogTitle>Subir Nuevo Código Legal</DialogTitle>
              <DialogDescription>
                Agregue un nuevo código legal a su biblioteca
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="code-title">Título del Código</Label>
                <Input
                  id="code-title"
                  placeholder="Ingrese el título del código"
                  value={newCodeTitle}
                  onChange={(e) => setNewCodeTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code-number">Código de Referencia</Label>
                <Input
                  id="code-number"
                  placeholder="Ingrese el código de referencia"
                  value={newCodeNumber}
                  onChange={(e) => setNewCodeNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file-upload">Documento del Código</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
                {selectedFile && (
                  <p className="text-sm text-gray-600 font-medium">
                    Archivo seleccionado: {selectedFile.name}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setIsUploadOpen(false); setSelectedFile(null); }} disabled={uploading}>
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
            Usted no tiene permiso para descargar y subir códigos legales.
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
              <BookOpen className="w-5 h-5" />
              <CardTitle>
                {currentFolderId 
                  ? breadcrumbPath[breadcrumbPath.length - 1]?.name || 'Carpeta'
                  : 'Todos los Códigos'}
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
                placeholder="Buscar carpetas y códigos..."
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
                    Aplique filtros para refinar su búsqueda de códigos legales
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
                        {(['Todos', 'Civil', 'Penal', 'Constitucional', 'Administrativo'] as const).map((category) => (
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
                        {(['Todos', 'Vigente', 'Histórico', 'Derogado'] as const).map((status) => (
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
                <TableHead>Código</TableHead>
                <TableHead>Jurisdicción</TableHead>
                <TableHead>Fecha</TableHead>
                {/* <TableHead>Tamaño</TableHead> */}
                <TableHead>Categoría</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-400" />
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
                          <Folder className="w-5 h-5 text-purple-600" />
                          <span>{item.name}</span>
                        </TableCell>
                        <TableCell className="text-gray-400">—</TableCell>
                        <TableCell className="text-gray-400">—</TableCell>
                        <TableCell className="text-gray-400">—</TableCell>
                        {/* <TableCell className="text-gray-400">—</TableCell> */}
                        <TableCell>
                          <Badge variant="outline">Carpeta</Badge>
                        </TableCell>
                        <TableCell className="text-gray-400">—</TableCell>
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
                        <TableCell>{file.code}</TableCell>
                        <TableCell>{file.jurisdiction}</TableCell>
                        <TableCell>{file.uploadDate}</TableCell>
                        {/* <TableCell>{file.size}</TableCell> */}
                        <TableCell>
                          <Badge className={getCategoryColor(file.category)}>
                            {file.category}
                          </Badge>
                        </TableCell>
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
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDownload(file)}
                                    title="Descargar"
                                    disabled={!isPremiumUser || downloadingId === file.id}
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
          documentCode={viewingDocument.code}
          documentType="code"
          onClose={() => setViewingDocument(null)}
          onDownload={() => handleDownload(viewingDocument)}
        />
      )}
    </div>
  );
}
