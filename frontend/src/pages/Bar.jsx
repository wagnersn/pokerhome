import React, { useState, useEffect } from "react";
import { 
    ShoppingCart, X, Minus, Plus, Search, 
    CreditCard, Banknote, UserMinus, History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Select, SelectContent, SelectItem, 
    SelectTrigger, SelectValue 
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { toast } from "sonner";
import api from "@/lib/api";

export default function Bar() {
    const [products, setProducts] = useState([]);
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [cart, setCart] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [salesHistory, setSalesHistory] = useState([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [prodRes, playerRes] = await Promise.all([
                api.get("/bar/products?active_only=true"),
                api.get("/players")
            ]);
            setProducts(prodRes.data);
            setPlayers(playerRes.data.items || []);
        } catch (error) {
            toast.error("Erro ao carregar dados");
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await api.get("/bar/sales");
            setSalesHistory(res.data);
            setIsHistoryOpen(true);
        } catch (error) {
            toast.error("Erro ao carregar histórico");
        }
    };

    const addToCart = (product) => {
        if (product.stock <= 0) {
            toast.error("Produto sem estoque!");
            return;
        }

        const existing = cart.find(item => item.product_id === product.id);
        if (existing) {
            if (existing.quantity >= product.stock) {
                toast.error("Limite de estoque atingido!");
                return;
            }
            setCart(cart.map(item => 
                item.product_id === product.id 
                    ? { ...item, quantity: item.quantity + 1, total_price: (item.quantity + 1) * item.unit_price } 
                    : item
            ));
        } else {
            setCart([...cart, {
                product_id: product.id,
                product_name: product.name,
                quantity: 1,
                unit_price: product.sell_price,
                total_price: product.sell_price
            }]);
        }
    };

    const removeFromCart = (productId) => {
        const item = cart.find(i => i.product_id === productId);
        if (item.quantity > 1) {
            setCart(cart.map(i => 
                i.product_id === productId 
                    ? { ...i, quantity: i.quantity - 1, total_price: (i.quantity - 1) * i.unit_price } 
                    : i
            ));
        } else {
            setCart(cart.filter(i => i.product_id !== productId));
        }
    };

    const cartTotal = cart.reduce((acc, item) => acc + item.total_price, 0);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        if (paymentMethod === "debt" && !selectedPlayer) {
            toast.error("Selecione um jogador para venda fiado (debt)");
            return;
        }

        try {
            setIsProcessing(true);
            await api.post("/bar/sales", {
                items: cart,
                total_amount: cartTotal,
                payment_method: paymentMethod,
                player_id: paymentMethod === "debt" ? selectedPlayer : null
            });
            
            toast.success("Venda realizada com sucesso!");
            setCart([]);
            setSelectedPlayer("");
            fetchData(); // Refresh stock
        } catch (error) {
            toast.error(error.response?.data?.detail || "Erro ao processar venda");
        } finally {
            setIsProcessing(false);
        }
    };

    const categories = ["all", ...new Set(products.map(p => p.category))];
    const filteredProducts = products.filter(p => 
        (categoryFilter === "all" || p.category === categoryFilter) &&
        (p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] p-6 gap-6 overflow-hidden">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Copa / Bar</h1>
                    <p className="text-muted-foreground mt-1">Lançamento rápido de consumo.</p>
                </div>
                <Button variant="outline" onClick={fetchHistory} className="border-slate-800 bg-slate-900/50 hover:bg-slate-800">
                    <History className="mr-2 h-4 w-4" /> Histórico de Vendas
                </Button>
            </div>

            <div className="flex flex-1 gap-6 min-h-0">
                {/* Product Grid Section */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    <div className="flex gap-4 shrink-0">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar produto..."
                                className="pl-8 bg-slate-900/50 border-slate-800"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[180px] bg-slate-900/50 border-slate-800">
                                <SelectValue placeholder="Categoria" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                {categories.map(c => (
                                    <SelectItem key={c} value={c}>{c === "all" ? "Todas Categorias" : c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <ScrollArea className="flex-1 rounded-md border border-slate-800 bg-slate-950/30 p-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {filteredProducts.map(product => (
                                <Card 
                                    key={product.id} 
                                    className={`cursor-pointer transition-all hover:scale-[1.02] border-slate-800 hover:border-primary/50 overflow-hidden ${product.stock <= 0 ? 'opacity-50 grayscale' : 'bg-slate-900/40'}`}
                                    onClick={() => addToCart(product)}
                                >
                                    <CardContent className="p-4 flex flex-col h-full justify-between gap-2">
                                        <div>
                                            <Badge variant="outline" className="mb-2 text-[10px] uppercase tracking-wider border-slate-700 bg-slate-800/50">
                                                {product.category}
                                            </Badge>
                                            <h3 className="font-bold text-white line-clamp-2 leading-tight">{product.name}</h3>
                                        </div>
                                        <div className="flex justify-between items-end mt-4">
                                            <span className="text-xl font-black text-emerald-400">R$ {product.sell_price.toFixed(2)}</span>
                                            <span className={`text-xs ${product.stock <= product.min_stock ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                                                {product.stock} un
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* Cart Section */}
                <div className="w-[380px] shrink-0 flex flex-col gap-4">
                    <Card className="flex-1 flex flex-col border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                        <CardHeader className="border-b border-slate-800 bg-slate-900/80 p-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <ShoppingCart className="h-5 w-5 text-primary" /> Comanda
                                </CardTitle>
                                <Badge variant="secondary" className="bg-primary/20 text-primary hover:bg-primary/20">
                                    {cart.reduce((acc, i) => acc + i.quantity, 0)} itens
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-hidden">
                            <ScrollArea className="h-full p-4">
                                {cart.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground opacity-50">
                                        <ShoppingCart className="h-12 w-12 mb-2" />
                                        <p>Comanda vazia</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {cart.map(item => (
                                            <div key={item.product_id} className="flex justify-between items-center group animate-in fade-in slide-in-from-right-2">
                                                <div className="flex-1 min-w-0 mr-4">
                                                    <p className="font-medium text-white truncate text-sm">{item.product_name}</p>
                                                    <p className="text-xs text-slate-400">R$ {item.unit_price.toFixed(2)} / un</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full border border-slate-700 hover:bg-slate-800" onClick={() => removeFromCart(item.product_id)}>
                                                        <Minus className="h-3 w-3" />
                                                    </Button>
                                                    <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full border border-slate-700 hover:bg-slate-800" onClick={() => addToCart(products.find(p => p.id === item.product_id))}>
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                <div className="w-20 text-right ml-4">
                                                    <p className="font-bold text-sm text-emerald-400">R$ {item.total_price.toFixed(2)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4 border-t border-slate-800 bg-slate-900/80 p-4">
                            <div className="w-full space-y-4">
                                <div className="animate-in slide-in-from-top-2">
                                    <Label className="text-xs text-slate-400 mb-1 block">Selecionar Jogador (Comanda)</Label>
                                    <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                                        <SelectTrigger className="bg-slate-950 border-slate-800 h-12">
                                            <SelectValue placeholder="Selecione o jogador..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-60">
                                            <div className="p-2 sticky top-0 bg-slate-900 z-10">
                                                <Input 
                                                    placeholder="Pesquisar jogador..." 
                                                    className="h-8 bg-slate-950 border-slate-800"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            {players.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <Button 
                                        variant={paymentMethod === "cash" ? "default" : "outline"}
                                        className={`h-12 ${paymentMethod === "cash" ? "bg-emerald-600 hover:bg-emerald-700" : "border-slate-700"}`}
                                        onClick={() => setPaymentMethod("cash")}
                                    >
                                        <Banknote className="h-4 w-4 mr-2" /> Dinheiro
                                    </Button>
                                    <Button 
                                        variant={paymentMethod === "pix" ? "default" : "outline"}
                                        className={`h-12 ${paymentMethod === "pix" ? "bg-blue-600 hover:bg-blue-700" : "border-slate-700"}`}
                                        onClick={() => setPaymentMethod("pix")}
                                    >
                                        <CreditCard className="h-4 w-4 mr-2" /> PIX
                                    </Button>
                                    <Button 
                                        variant={paymentMethod === "debt" ? "default" : "outline"}
                                        className={`h-12 ${paymentMethod === "debt" ? "bg-orange-600 hover:bg-orange-700" : "border-slate-700"}`}
                                        onClick={() => setPaymentMethod("debt")}
                                    >
                                        <UserMinus className="h-4 w-4 mr-2" /> Fiado
                                    </Button>
                                </div>

                                <div className="flex justify-between items-center py-2 border-t border-slate-800 mt-2">
                                    <span className="text-muted-foreground font-medium">Total</span>
                                    <span className="text-3xl font-black text-white">R$ {cartTotal.toFixed(2)}</span>
                                </div>

                                <Button 
                                    className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20" 
                                    size="lg"
                                    disabled={cart.length === 0 || isProcessing || !selectedPlayer}
                                    onClick={handleCheckout}
                                >
                                    {isProcessing ? "Processando..." : (!selectedPlayer ? "SELECIONE UM JOGADOR" : "FINALIZAR VENDA")}
                                </Button>
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            </div>

            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Últimas Vendas</DialogTitle>
                        <DialogDescription className="text-slate-400">Vendas realizadas hoje na copa.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-1 mt-4">
                        <div className="space-y-3">
                            {salesHistory.length === 0 ? (
                                <p className="text-center py-10 text-muted-foreground">Nenhuma venda registrada.</p>
                            ) : (
                                salesHistory.map(sale => (
                                    <div key={sale.id} className="p-3 rounded-lg border border-slate-800 bg-slate-950/50 flex justify-between items-center">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className="bg-slate-800 text-[10px]">
                                                    {new Date(sale.created_at).toLocaleTimeString()}
                                                </Badge>
                                                <span className="text-sm font-bold text-white">
                                                    {sale.items.length} item(s) - {sale.items.map(i => i.product_name).join(", ")}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400">
                                                Operador: {sale.operator_name} | Pgto: <span className="uppercase text-slate-300 font-bold">{sale.payment_method}</span>
                                                {sale.player_id && ` | Jogador: ${players.find(p => p.id === sale.player_id)?.name || '?'}`}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-emerald-400 text-lg">R$ {sale.total_amount.toFixed(2)}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}
