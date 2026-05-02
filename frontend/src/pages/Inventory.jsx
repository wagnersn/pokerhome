import React, { useState, useEffect } from "react";
import { 
    Plus, Search, Edit2, Trash2, Package, AlertTriangle, 
    TrendingUp, TrendingDown, Layers, DollarSign 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Table, TableBody, TableCell, TableHead, 
    TableHeader, TableRow 
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    Select, SelectContent, SelectItem, 
    SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import api from "@/lib/api";

const CATEGORIES = ["Bebida", "Salgadinho", "Salgado", "Janta", "Sushi", "Drink", "Guloseima", "Sobremesa", "Outros"];

export default function Inventory() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({
        name: "",
        category: "Bebida",
        buy_price: 0,
        sell_price: 0,
        stock: 0,
        min_stock: 5,
        active: true
    });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const res = await api.get("/bar/products");
            setProducts(res.data);
        } catch (error) {
            toast.error("Erro ao carregar estoque");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (product = null) => {
        if (product) {
            setEditingProduct(product);
            setFormData({ ...product });
        } else {
            setEditingProduct(null);
            setFormData({
                name: "",
                category: "Bebida",
                buy_price: 0,
                sell_price: 0,
                stock: 0,
                min_stock: 5,
                active: true
            });
        }
        setIsDialogOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingProduct) {
                await api.put(`/bar/products/${editingProduct.id}`, formData);
                toast.success("Produto atualizado com sucesso");
            } else {
                await api.post("/bar/products", formData);
                toast.success("Produto criado com sucesso");
            }
            setIsDialogOpen(false);
            fetchProducts();
        } catch (error) {
            toast.error("Erro ao salvar produto");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Tem certeza que deseja excluir este produto?")) return;
        try {
            await api.delete(`/bar/products/${id}`);
            toast.success("Produto excluído");
            fetchProducts();
        } catch (error) {
            toast.error("Erro ao excluir produto");
        }
    };

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        totalItems: products.length,
        lowStock: products.filter(p => p.stock <= p.min_stock).length,
        inventoryValue: products.reduce((acc, p) => acc + (p.stock * p.buy_price), 0),
        potentialProfit: products.reduce((acc, p) => acc + (p.stock * (p.sell_price - p.buy_price)), 0)
    };

    const toggleStatus = async (product) => {
        try {
            const newStatus = !product.active;
            await api.put(`/bar/products/${product.id}`, { ...product, active: newStatus });
            toast.success(`Produto ${newStatus ? 'ativado' : 'desativado'}`);
            fetchProducts();
        } catch (error) {
            toast.error("Erro ao alterar status");
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Controle de Estoque</h1>
                    <p className="text-muted-foreground mt-1">Gerencie produtos, preços e níveis de estoque da copa.</p>
                </div>
                <Button onClick={() => handleOpenDialog()} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Plus className="mr-2 h-4 w-4" /> Novo Produto
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalItems}</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
                        <AlertTriangle className={`h-4 w-4 ${stats.lowStock > 0 ? "text-yellow-500" : "text-muted-foreground"}`} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.lowStock}</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Valor em Estoque</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {stats.inventoryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Lucro Potencial</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {stats.potentialProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <CardTitle>Produtos</CardTitle>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar produto ou categoria..."
                                className="pl-8 bg-slate-950 border-slate-800"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-800 hover:bg-transparent">
                                <TableHead className="text-slate-400">Nome</TableHead>
                                <TableHead className="text-slate-400">Categoria</TableHead>
                                <TableHead className="text-slate-400 text-right">Custo</TableHead>
                                <TableHead className="text-slate-400 text-right">Venda</TableHead>
                                <TableHead className="text-slate-400 text-center">Estoque</TableHead>
                                <TableHead className="text-slate-400 text-center">Status</TableHead>
                                <TableHead className="text-right text-slate-400">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Carregando...</TableCell>
                                </TableRow>
                            ) : filteredProducts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum produto encontrado.</TableCell>
                                </TableRow>
                            ) : (
                                Object.entries(
                                    filteredProducts.reduce((acc, p) => {
                                        if (!acc[p.category]) acc[p.category] = [];
                                        acc[p.category].push(p);
                                        return acc;
                                    }, {})
                                ).map(([category, items]) => (
                                    <React.Fragment key={category}>
                                        <TableRow className="bg-slate-900/80 border-slate-800">
                                            <TableCell colSpan={7} className="py-2 px-4 font-bold text-primary uppercase tracking-wider text-[10px]">
                                                {category} ({items.length})
                                            </TableCell>
                                        </TableRow>
                                        {items.map((product) => (
                                            <TableRow key={product.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                                                <TableCell className="font-medium pl-8">{product.name}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="bg-slate-800 border-slate-700">{product.category}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">R$ {product.buy_price.toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-semibold text-emerald-400">R$ {product.sell_price.toFixed(2)}</TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <span className={`font-bold ${product.stock <= product.min_stock ? "text-red-500" : "text-white"}`}>
                                                            {product.stock}
                                                        </span>
                                                        {product.stock <= product.min_stock && (
                                                            <AlertTriangle className="h-3 w-3 text-red-500" />
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Switch 
                                                            checked={product.active} 
                                                            onCheckedChange={() => toggleStatus(product)}
                                                        />
                                                        <Badge className={product.active ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/50" : "bg-slate-800 text-slate-400"}>
                                                            {product.active ? "Ativo" : "Inativo"}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(product)} className="h-8 w-8 hover:bg-blue-500/20 hover:text-blue-500">
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)} className="h-8 w-8 hover:bg-red-500/20 hover:text-red-500">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </React.Fragment>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Preencha as informações do produto abaixo.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Nome do Produto</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="bg-slate-950 border-slate-800"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="category">Categoria</Label>
                                <Select 
                                    value={formData.category} 
                                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                                >
                                    <SelectTrigger className="bg-slate-950 border-slate-800">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        {CATEGORIES.map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="stock">Estoque Inicial</Label>
                                <Input
                                    id="stock"
                                    type="number"
                                    value={formData.stock}
                                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                                    className="bg-slate-950 border-slate-800"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="buy_price">Preço de Custo (R$)</Label>
                                <Input
                                    id="buy_price"
                                    type="number"
                                    step="0.01"
                                    value={formData.buy_price}
                                    onChange={(e) => setFormData({ ...formData, buy_price: parseFloat(e.target.value) || 0 })}
                                    className="bg-slate-950 border-slate-800"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="sell_price">Preço de Venda (R$)</Label>
                                <Input
                                    id="sell_price"
                                    type="number"
                                    step="0.01"
                                    value={formData.sell_price}
                                    onChange={(e) => setFormData({ ...formData, sell_price: parseFloat(e.target.value) || 0 })}
                                    className="bg-slate-950 border-slate-800"
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="min_stock">Alerta de Estoque Baixo (mínimo)</Label>
                            <Input
                                id="min_stock"
                                type="number"
                                value={formData.min_stock}
                                onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                                className="bg-slate-950 border-slate-800"
                            />
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                            <div className="space-y-0.5">
                                <Label htmlFor="active-dialog">Status do Produto</Label>
                                <p className="text-[10px] text-muted-foreground">Ativar para aparecer na tela de vendas</p>
                            </div>
                            <Switch
                                id="active-dialog"
                                checked={formData.active}
                                onCheckedChange={(v) => setFormData({ ...formData, active: v })}
                            />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="hover:bg-slate-800">
                                Cancelar
                            </Button>
                            <Button type="submit" className="bg-primary hover:bg-primary/90">
                                {editingProduct ? "Atualizar" : "Criar"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
