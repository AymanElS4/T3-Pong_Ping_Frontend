import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { UserPlus, Edit, Trash2, Search, Users } from 'lucide-react';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './ui/pagination';
import { api } from '../services/api';

type UserTier = 'Básico' | 'Profesional' | 'Empresa' | 'Administrador';

interface Member {
  id: string;
  name: string;
  email: string;
  tier: UserTier;
  status: 'Activo' | 'Inactivo';
  joinDate: string;
}

export function MembersManager() {
  const [members, setMembers] = useState<Member[]>([
    {
      id: '1',
      name: 'Juan Pérez',
      email: 'juan.perez@example.com',
      tier: 'Profesional',
      status: 'Activo',
      joinDate: '2024-01-15'
    },
    {
      id: '2',
      name: 'María García',
      email: 'maria.garcia@example.com',
      tier: 'Empresa',
      status: 'Activo',
      joinDate: '2024-02-20'
    },
    {
      id: '3',
      name: 'Carlos López',
      email: 'carlos.lopez@example.com',
      tier: 'Básico',
      status: 'Activo',
      joinDate: '2024-03-10'
    },
    {
      id: '4',
      name: 'Ana Martínez',
      email: 'ana.martinez@example.com',
      tier: 'Profesional',
      status: 'Inactivo',
      joinDate: '2024-01-05'
    },
    {
      id: '5',
      name: 'Roberto Sánchez',
      email: 'roberto.sanchez@example.com',
      tier: 'Empresa',
      status: 'Activo',
      joinDate: '2024-04-12'
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [pagoToApprove, setPagoToApprove] = useState<number | null>(null);

  const itemsPerPage = 10;

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    tier: 'Básico' as UserTier,
    status: 'Activo' as 'Activo' | 'Inactivo'
  });

  // Filter members
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const matchesSearch =
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesSearch;
    });
  }, [members, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredMembers.slice(startIndex, endIndex);
  }, [filteredMembers, currentPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddMember = () => {
    if (formData.name && formData.email) {
      const newMember: Member = {
        id: `member-${Date.now()}`,
        name: formData.name,
        email: formData.email,
        tier: formData.tier,
        status: formData.status,
        joinDate: new Date().toISOString().split('T')[0]
      };
      setMembers([...members, newMember]);
      setFormData({
        name: '',
        email: '',
        tier: 'Básico',
        status: 'Activo'
      });
      setIsAddOpen(false);
    }
  };

  const handleEditMember = () => {
    if (editingMember && formData.name && formData.email) {
      const updatedMembers = members.map(member =>
        member.id === editingMember.id
          ? { ...member, name: formData.name, email: formData.email, tier: formData.tier, status: formData.status }
          : member
      );
      setMembers(updatedMembers);
      setEditingMember(null);
      setFormData({
        name: '',
        email: '',
        tier: 'Básico',
        status: 'Activo'
      });
      setIsEditOpen(false);
    }
  };

  const handleDeleteMember = (id: string) => {
    if (confirm('¿Está seguro de que desea eliminar este miembro?')) {
      setMembers(members.filter(member => member.id !== id));
    }
  };

  const handleOpenEdit = (member: Member) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      email: member.email,
      tier: member.tier,
      status: member.status
    });
    setIsEditOpen(true);
  };

  const getTierColor = (tier: UserTier) => {
    switch (tier) {
      case 'Básico':
        return 'bg-gray-100 text-gray-800';
      case 'Profesional':
        return 'bg-blue-100 text-blue-800';
      case 'Empresa':
        return 'bg-purple-100 text-purple-800';
      case 'Administrador':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Activo':
        return 'bg-green-100 text-green-800';
      case 'Inactivo':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const [solicitudes, setSolicitudes] = useState<any[]>([]);

  useEffect(() => {
    cargarSolicitudes();
  }, []);

  const cargarSolicitudes = async () => {
    try {
      // Pedimos al backend los pagos
      const data: any = await api.get('/pagos/');
      const pagosReales = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
      // Filtramos solo los que estén Pendientes
      setSolicitudes(pagosReales.filter((p: any) => p.estado_pago === 'Pendiente'));
    } catch (error) {
      console.error('Error cargando solicitudes:', error);
    }
  };

  const openApproveDialog = (pagoId: number) => {
    setPagoToApprove(pagoId);
    setIsApproveOpen(true);
  };

  const confirmApprovePlan = async () => {
    if (!pagoToApprove) return;

    try {
      await api.post(`/pagos/${pagoToApprove}/aprobar/`, {});
      setIsApproveOpen(false);
      setPagoToApprove(null);
      cargarSolicitudes();
    } catch (error) {
      console.error('Error aprobando plan:', error);
      alert('Hubo un error al aprobar el plan.');
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-gray-900">Gestión de Miembros</h2>
          <p className="text-gray-600 mt-1">Administre los usuarios de la plataforma</p>
        </div>
        


        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="w-4 h-4" />
              Agregar Miembro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Nuevo Miembro</DialogTitle>
              <DialogDescription>
                Ingrese la información del nuevo miembro
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre Completo</Label>
                <Input
                  id="name"
                  placeholder="Ingrese el nombre completo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tier">Nivel de Suscripción</Label>
                <Select
                  value={formData.tier}
                  onValueChange={(value) => setFormData({ ...formData, tier: value as UserTier })}
                >
                  <SelectTrigger id="tier">
                    <SelectValue placeholder="Seleccione un nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Básico">Básico</SelectItem>
                    <SelectItem value="Profesional">Profesional</SelectItem>
                    <SelectItem value="Empresa">Empresa</SelectItem>
                    <SelectItem value="Administrador">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as 'Activo' | 'Inactivo' })}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Seleccione un estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Activo">Activo</SelectItem>
                    <SelectItem value="Inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddMember}>Agregar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {solicitudes.length > 0 && (
        <Card className="border-blue-200 shadow-md mb-8">
          <CardHeader className="bg-blue-50 border-b border-blue-100">
            <CardTitle className="text-blue-800 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
              Solicitudes de Cambio de Plan Pendientes
            </CardTitle>
            <CardDescription>
              Estos usuarios están esperando que un administrador apruebe su nuevo plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Pago</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitudes.map((solicitud: any) => (
                  <TableRow key={solicitud.oid_pago}>
                    <TableCell>#{solicitud.oid_pago}</TableCell>
                    <TableCell>${solicitud.monto}</TableCell>
                    <TableCell>{solicitud.metodo_pago}</TableCell>
                    <TableCell>{new Date(solicitud.fecha_pago).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => openApproveDialog(solicitud.oid_pago)}
                      >
                        Aprobar Solicitud
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <CardTitle>Miembros de la Plataforma</CardTitle>
            </div>
            <CardDescription>
              {filteredMembers.length} miembro{filteredMembers.length !== 1 ? 's' : ''} encontrado{filteredMembers.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre o correo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Members Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo Electrónico</TableHead>
                <TableHead>Nivel</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha de Ingreso</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No se encontraron miembros</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.name}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge className={getTierColor(member.tier)}>
                        {member.tier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(member.status)}>
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{member.joinDate}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(member)}
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMember(member.id)}
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
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

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Miembro</DialogTitle>
            <DialogDescription>
              Actualice la información del miembro
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre Completo</Label>
              <Input
                id="edit-name"
                placeholder="Ingrese el nombre completo"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Correo Electrónico</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="correo@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tier">Nivel de Suscripción</Label>
              <Select
                value={formData.tier}
                onValueChange={(value) => setFormData({ ...formData, tier: value as UserTier })}
              >
                <SelectTrigger id="edit-tier">
                  <SelectValue placeholder="Seleccione un nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Básico">Básico</SelectItem>
                  <SelectItem value="Profesional">Profesional</SelectItem>
                  <SelectItem value="Empresa">Empresa</SelectItem>
                  <SelectItem value="Administrador">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Estado</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as 'Activo' | 'Inactivo' })}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue placeholder="Seleccione un estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEditMember}>Guardar Cambios</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmación para Aprobar Plan */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar Cambio de Plan</DialogTitle>
            <DialogDescription>
              ¿Está seguro de que desea aprobar esta solicitud? El usuario recibirá una notificación y obtendrá acceso inmediato a sus nuevos beneficios.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsApproveOpen(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white" 
              onClick={confirmApprovePlan}
            >
              Sí, Aprobar Plan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
