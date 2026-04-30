import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fmtBRL, apiErr } from "@/lib/format";
import { toast } from "sonner";
import { 
    Users, Plus, Wallet, History, TrendingUp, Search, 
    MoreVertical, Trash2, Edit2, CheckCircle2, XCircle, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { 
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";

export default function Dealers() {
    const { user } = useAuth();
    const [dealers, setDealers] = useState([]);
    const [performance, setPerformance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    
    const [openDealer, setOpenDealer] = useState(false);
    const [editingDealer, setEditingDealer] = useState(null);
    const [dealerForm, setDealerForm] = useState({ name: "", active: true });
    
    const [openPay, setOpenPay] = useState(false);
    const [selectedDealer, setSelectedDealer] = useState(null);
    const [payForm, setPayForm] = useState({ amount: "", method: "cash", description: "" });

    const load = async () => {
        setLoading(true);
        try {
            const [dRes, pRes] = await Promise.all([
                api.get("/dealers"),
                api.get("/dealers/performance")
            ]);
            setDealers(dRes.data);
            setPerformance(pRes.data);
        } catch (e) { toast.error(apiErr(e)); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const handleSaveDealer = async (e) => {
        e.preventDefault();
        try {
            if (editingDealer) {
                await api.patch(`/dealers/${editingDealer.id}`, dealerForm);
                toast.success("Dealer atualizado");
            } else {
                await api.post("/dealers", dealerForm);
                toast.success("Dealer cadastrado");
            }
            setOpenDealer(false);
            setEditingDealer(null);
            setDealerForm({ name: "", active: true });
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const handlePay = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/dealers/${selectedDealer.id}/pay`, {
                amount: Number(payForm.amount),
                payment_method: payForm.method,
                description: payForm.description
            });
            toast.success("Pagamento registrado");
            setOpenPay(false);
            setPayForm({ amount: "", method: "cash", description: "" });
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Deseja realmente excluir este dealer?")) return;
        try {
            await api.delete(`/dealers/${id}`);
            toast.success("Dealer removido");
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const filtered = dealers.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto animate-fade-in-up">
            <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-2">Equipe · Gestão</div>
                    <h1 className="text-4xl font-heading font-bold tracking-tight">Dealers</h1>
                    <p className="text-sm text-muted-foreground mt-1">Gerencie sua equipe, pagamentos e acompanhe o desempenho individual.</p>
                </div>
                {user?.role === "admin" && (
                    <Button onClick={() => { setEditingDealer(null); setDealerForm({ name: "", active: true }); setOpenDealer(true); }} className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 shadow-lg shadow-primary/20">
                        <Plus className="size-4 mr-2" /> Novo Dealer
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Stats / Performance Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="rounded-2xl bg-surface border border-white/5 p-6 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <TrendingUp className="size-12 text-primary" />
                        </div>
                        <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-medium">Top Performance (Net)</h3>
                        <div className="space-y-4">
                            {performance.sort((a, b) => b.net - a.net).slice(0, 5).map((p, idx) => (
                                <div key={p.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold ${idx === 0 ? "text-amber-500" : "text-muted-foreground"}`}>#{idx + 1}</span>
                                        <span className="text-sm font-medium">{p.name}</span>
                                    </div>
                                    <span className="text-sm font-mono font-bold text-success">{fmtBRL(p.net)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl bg-surface border border-white/5 p-6">
                        <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-medium">Resumo Financeiro</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="text-[10px] text-muted-foreground uppercase mb-1">Total Rake Gerado</div>
                                <div className="text-xl font-heading font-bold text-primary">{fmtBRL(performance.reduce((s, p) => s + p.rake_generated, 0))}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-muted-foreground uppercase mb-1">Total Pago (Equipe)</div>
                                <div className="text-xl font-heading font-bold text-destructive">{fmtBRL(performance.reduce((s, p) => s + p.total_paid, 0))}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main List */}
                <div className="lg:col-span-3">
                    <div className="mb-6 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar dealer..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-surface border-white/5 pl-10 h-12 rounded-xl focus:ring-primary/20"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {loading && [1,2,3,4].map(i => (
                            <div key={i} className="h-32 rounded-2xl bg-surface border border-white/5 animate-pulse" />
                        ))}
                        {!loading && filtered.map(d => {
                            const p = performance.find(x => x.id === d.id) || { rake_generated: 0, total_paid: 0, net: 0 };
                            return (
                                <div key={d.id} className="rounded-2xl bg-surface border border-white/5 p-5 hover:border-white/10 transition-all group relative">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {d.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-heading font-bold text-lg leading-tight">{d.name}</h3>
                                                <span className={`text-[10px] uppercase font-bold tracking-widest ${d.active ? "text-success" : "text-destructive"}`}>
                                                    {d.active ? "Ativo" : "Inativo"}
                                                </span>
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8 -mr-2">
                                                    <MoreVertical className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-surface-elevated border-white/10">
                                                <DropdownMenuItem onClick={() => { setEditingDealer(d); setDealerForm({ name: d.name, active: d.active }); setOpenDealer(true); }} className="gap-2">
                                                    <Edit2 className="size-3" /> Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDelete(d.id)} className="gap-2 text-destructive focus:text-destructive">
                                                    <Trash2 className="size-3" /> Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                                        <div>
                                            <div className="text-[10px] uppercase text-muted-foreground mb-0.5">Rake Gerado</div>
                                            <div className="font-mono font-bold text-sm">{fmtBRL(p.rake_generated)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase text-muted-foreground mb-0.5">Total Pago</div>
                                            <div className="font-mono font-bold text-sm text-destructive">{fmtBRL(p.total_paid)}</div>
                                        </div>
                                    </div>

                                    <Button 
                                        onClick={() => { setSelectedDealer(d); setOpenPay(true); }}
                                        className="w-full mt-4 bg-white/5 hover:bg-white/10 border border-white/5 text-xs h-9 gap-2"
                                    >
                                        <Wallet className="size-3" /> Registrar Pagamento
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Dealer Dialog */}
            <Dialog open={openDealer} onOpenChange={setOpenDealer}>
                <DialogContent className="bg-surface border-white/10">
                    <DialogHeader>
                        <DialogTitle>{editingDealer ? "Editar Dealer" : "Novo Dealer"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveDealer} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome Completo</Label>
                            <Input 
                                required 
                                value={dealerForm.name} 
                                onChange={e => setDealerForm({ ...dealerForm, name: e.target.value })}
                                className="bg-surface-elevated border-white/10"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="active"
                                checked={dealerForm.active}
                                onChange={e => setDealerForm({ ...dealerForm, active: e.target.checked })}
                                className="accent-primary"
                            />
                            <Label htmlFor="active" className="cursor-pointer">Ativo para trabalhar</Label>
                        </div>
                    </form>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpenDealer(false)}>Cancelar</Button>
                        <Button onClick={handleSaveDealer} className="bg-primary text-primary-foreground">Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Payment Dialog */}
            <Dialog open={openPay} onOpenChange={setOpenPay}>
                <DialogContent className="bg-surface border-white/10">
                    <DialogHeader>
                        <DialogTitle>Pagar Dealer: {selectedDealer?.name}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handlePay} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Valor (R$)</Label>
                                <Input 
                                    type="number" required step="0.01"
                                    value={payForm.amount}
                                    onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                                    className="bg-surface-elevated border-white/10 font-mono text-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Método</Label>
                                <select 
                                    value={payForm.method}
                                    onChange={e => setPayForm({ ...payForm, method: e.target.value })}
                                    className="w-full bg-surface-elevated border border-white/10 rounded-md h-10 px-3 text-sm"
                                >
                                    <option value="cash">Dinheiro</option>
                                    <option value="pix">PIX</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Referência / Observação</Label>
                            <Input 
                                placeholder="Ex: Diária 25/04 + Comissões"
                                value={payForm.description}
                                onChange={e => setPayForm({ ...payForm, description: e.target.value })}
                                className="bg-surface-elevated border-white/10"
                            />
                        </div>
                    </form>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpenPay(false)}>Cancelar</Button>
                        <Button onClick={handlePay} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Confirmar Pagamento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
