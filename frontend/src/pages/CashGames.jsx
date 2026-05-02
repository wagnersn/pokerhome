import React, { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Spade, UserPlus, Phone, X, ChevronUp, ChevronDown, Trash2, Landmark, Coins } from "lucide-react";
import { fmtBRL, apiErr } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function CashGames() {
    const { user } = useAuth();
    const [tables, setTables] = useState([]);
    const [waitlists, setWaitlists] = useState({}); // table_id -> list
    const [players, setPlayers] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: "", game_type: "Texas Hold'em", small_blind: 1, big_blind: 2, max_seats: 9, bb_on_button: false, rake_percent: 0, rake_cap: 0, jackpot_percent: 0, jackpot_cap: 0 });
    const [waitOpen, setWaitOpen] = useState(null);
    const [pid, setPid] = useState("");
    const [seatOpen, setSeatOpen] = useState(null); // waitlist entry
    const [seatForm, setSeatForm] = useState({ amount: "", method: "debt" });
    const [cashoutOpen, setCashoutOpen] = useState(null);
    const [cashoutForm, setCashoutForm] = useState({ amount: "", method: "cash" });
    const [closeTableOpen, setCloseTableOpen] = useState(null);
    const [closeForm, setCloseForm] = useState({ rake: 0, jackpot: 0, total_collected: 0 });
    const [activeTable, setActiveTable] = useState(null);
    const [seatedPlayers, setSeatedPlayers] = useState([]);
    const [deleteTableId, setDeleteTableId] = useState(null);
    const [jackpotBalance, setJackpotBalance] = useState(0);
    const [jackpotOpen, setJackpotOpen] = useState(false);
    const [jackpotForm, setJackpotForm] = useState({ amount: "", desc: "Ajuste Manual" });
    const [manualRakeOpen, setManualRakeOpen] = useState(null);
    const [manualRakeForm, setManualRakeForm] = useState({ rake: "", jackpot: "", notes: "", dealer_id: "" });
    const [dealers, setDealers] = useState([]);

    const loadSeated = async (tid) => {
        try {
            const { data } = await api.get(`/cash-tables/${tid}/seated`);
            setSeatedPlayers(data);
        } catch (e) { toast.error(apiErr(e)); }
    };

    const load = useCallback(async () => {
        try {
            const [tablesRes, playersRes, jackpotRes, dealersRes] = await Promise.all([
                api.get("/cash-tables"),
                api.get("/players"),
                api.get("/cashier/jackpot"),
                api.get("/dealers")
            ]);
            setTables(tablesRes.data);
            setPlayers(playersRes.data.items || playersRes.data);
            setJackpotBalance(jackpotRes.data.balance || 0);
            setDealers(dealersRes.data.filter(d => d.active));
            const wls = {};
            await Promise.all(tablesRes.data.map(async (tt) => {
                const { data } = await api.get(`/cash-tables/${tt.id}/waitlist`);
                wls[tt.id] = data;
            }));
            setWaitlists(wls);
        } catch (e) { toast.error(apiErr(e)); }
    }, []);

    const openTableDetail = (t) => {
        setActiveTable(t);
        loadSeated(t.id);
    };

    useEffect(() => { load(); }, [load]);

    const createTable = async (e) => {
        e.preventDefault();
        try {
            await api.post("/cash-tables", { 
                ...form, 
                small_blind: Number(form.small_blind), 
                big_blind: Number(form.big_blind), 
                max_seats: Number(form.max_seats),
                rake_percent: Number(form.rake_percent),
                rake_cap: Number(form.rake_cap),
                jackpot_percent: Number(form.jackpot_percent),
                jackpot_cap: Number(form.jackpot_cap)
            });
            toast.success("Mesa criada");
            setOpen(false);
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const toggle = async (t) => {
        if (t.status === "open") {
            try {
                const { data } = await api.get(`/cash-tables/${t.id}/summary`);
                setCloseForm({ rake: Math.max(0, data.suggested_rake), jackpot: Math.max(0, data.suggested_jackpot), total_collected: data.total_collected, total_buyin: data.total_buyin, total_cashout: data.total_cashout });
                setCloseTableOpen(t);
            } catch (e) { toast.error(apiErr(e)); }
        } else {
            try {
                await api.post(`/cash-tables/${t.id}/open`);
                load();
            } catch (e) { toast.error(apiErr(e)); }
        }
    };

    const confirmCloseTable = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/cash-tables/${closeTableOpen.id}/close`, { rake: Number(closeForm.rake), jackpot: Number(closeForm.jackpot) });
            toast.success("Mesa fechada com sucesso");
            setCloseTableOpen(null);
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const seatDelta = async (t, delta) => {
        try {
            await api.post(`/cash-tables/${t.id}/seat?delta=${delta}`);
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const confirmCashout = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/cash-tables/waitlist/${cashoutOpen.id}/cashout?amount=${cashoutForm.amount}&method=${cashoutForm.method}`);
            toast.success("Acerto realizado com sucesso");
            setCashoutOpen(null);
            if (activeTable) loadSeated(activeTable.id);
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const confirmJackpot = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/cashier/jackpot/adjust?amount=${jackpotForm.amount}&description=${encodeURIComponent(jackpotForm.desc)}`);
            toast.success("Jackpot atualizado");
            setJackpotOpen(false);
            setJackpotForm({ amount: "", desc: "Ajuste Manual" });
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const confirmManualRake = async (e) => {
        e.preventDefault();
        try {
            await api.post("/cashier/rake/manual", {
                rake: Number(manualRakeForm.rake) || 0,
                jackpot: Number(manualRakeForm.jackpot) || 0,
                table_name: manualRakeOpen.name,
                notes: manualRakeForm.notes,
                dealer_id: manualRakeForm.dealer_id
            });
            toast.success("Rake lançado com sucesso");
            setManualRakeOpen(null);
            setManualRakeForm({ rake: "", jackpot: "", notes: "", dealer_id: "" });
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const removeTable = async () => {
        if (!deleteTableId) return;
        try {
            await api.delete(`/cash-tables/${deleteTableId}`);
            toast.success("Mesa excluída");
            load();
            if (activeTable?.id === deleteTableId) setActiveTable(null);
            setDeleteTableId(null);
        } catch (e) { toast.error(apiErr(e)); }
    };

    const addToWait = async (tableId) => {
        if (!pid) return;
        try {
            await api.post(`/cash-tables/${tableId}/waitlist?player_id=${pid}`);
            toast.success("Adicionado à fila");
            setPid("");
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const updateWait = async (wid, status, amount = 0, method = "debt") => {
        try {
            await api.post(`/cash-tables/waitlist/${wid}/status?status=${status}&amount=${amount}&method=${method}`);
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const confirmSeat = async (e) => {
        e.preventDefault();
        if (!seatOpen) return;
        await updateWait(seatOpen.id, "seated", Number(seatForm.amount) || 0, seatForm.method);
        toast.success("Jogador sentado na mesa");
        setSeatOpen(null);
        setSeatForm({ amount: "", method: "debt" });
        // Recarrega a lista de jogadores sentados no modal de detalhe
        if (activeTable) loadSeated(activeTable.id);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto animate-fade-in-up">
            <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-2">Salão</div>
                    <h1 className="text-4xl font-heading font-bold tracking-tight">Cash Games</h1>
                    <p className="text-sm text-muted-foreground mt-1">Gerencie mesas, ocupação e listas de espera.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto mt-4 md:mt-0">
                    <div
                        onClick={() => user?.role === "admin" && setJackpotOpen(true)}
                        className={`bg-surface-elevated px-4 py-2 rounded-xl border border-white/10 text-sm flex items-center gap-3 w-full sm:w-auto ${user?.role === "admin" ? "cursor-pointer hover:border-white/20 transition-colors" : ""}`}
                        title={user?.role === "admin" ? "Ajustar Jackpot" : "Jackpot Acumulado"}
                    >
                        <div className="text-muted-foreground uppercase tracking-widest text-[10px]">Jackpot Acumulado</div>
                        <div className="font-mono font-bold text-amber-500 text-lg">{fmtBRL(jackpotBalance)}</div>
                    </div>
                    {user?.role === "admin" && (
                        <Dialog open={open} onOpenChange={setOpen}>
                            <DialogTrigger asChild>
                                <Button data-testid="add-table-button" className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
                                    <Plus className="size-4" /> Nova mesa
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-surface border-white/10">
                                <DialogHeader><DialogTitle>Cadastrar mesa</DialogTitle></DialogHeader>
                                <form onSubmit={createTable} className="space-y-4">
                                    <Input data-testid="table-name-input" placeholder="Nome (Mesa 1)" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-surface-elevated border-white/10" />
                                    <div className="space-y-1.5">
                                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Modalidade</Label>
                                    <Select value={form.game_type} onValueChange={(v) => setForm({ ...form, game_type: v })}>
                                        <SelectTrigger data-testid="table-type-select" className="bg-surface-elevated border-white/10"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Texas Hold'em">Texas Hold'em</SelectItem>
                                            <SelectItem value="Omaha">Omaha</SelectItem>
                                            <SelectItem value="PLO">PLO</SelectItem>
                                            <SelectItem value="Mixed">Mixed Games</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest text-muted-foreground">SB</Label><Input data-testid="table-sb" type="number" step="0.5" value={form.small_blind} onChange={(e) => setForm({ ...form, small_blind: e.target.value })} disabled={form.bb_on_button} className="bg-surface-elevated border-white/10 font-mono disabled:opacity-40" /></div>
                                    <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest text-muted-foreground">BB</Label><Input data-testid="table-bb" type="number" step="0.5" value={form.big_blind} onChange={(e) => setForm({ ...form, big_blind: e.target.value })} className="bg-surface-elevated border-white/10 font-mono" /></div>
                                    <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest text-muted-foreground">Lugares</Label><Input data-testid="table-seats" type="number" min="2" max="10" value={form.max_seats} onChange={(e) => setForm({ ...form, max_seats: e.target.value })} className="bg-surface-elevated border-white/10 font-mono" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest text-muted-foreground">Rake (%)</Label><Input type="number" step="0.1" value={form.rake_percent} onChange={(e) => setForm({ ...form, rake_percent: e.target.value })} className="bg-surface-elevated border-white/10 font-mono" /></div>
                                    <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest text-muted-foreground">Cap (R$)</Label><Input type="number" step="1" value={form.rake_cap} onChange={(e) => setForm({ ...form, rake_cap: e.target.value })} className="bg-surface-elevated border-white/10 font-mono" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest text-muted-foreground">Jackpot (%)</Label><Input type="number" step="0.1" value={form.jackpot_percent} onChange={(e) => setForm({ ...form, jackpot_percent: e.target.value })} className="bg-surface-elevated border-white/10 font-mono" /></div>
                                    <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest text-muted-foreground">Cap (R$)</Label><Input type="number" step="1" value={form.jackpot_cap} onChange={(e) => setForm({ ...form, jackpot_cap: e.target.value })} className="bg-surface-elevated border-white/10 font-mono" /></div>
                                </div>
                                <label className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-elevated border border-white/5 cursor-pointer">
                                    <input type="checkbox" checked={form.bb_on_button} onChange={(e) => setForm({ ...form, bb_on_button: e.target.checked, small_blind: e.target.checked ? 0 : form.small_blind })} className="size-4 accent-primary" />
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold">BB no Botão</div>
                                        <div className="text-[10px] text-muted-foreground">Sem Small Blind. O botão posta o Big.</div>
                                    </div>
                                </label>
                                <DialogFooter><Button type="submit" data-testid="save-table-button" className="bg-primary text-primary-foreground hover:bg-primary/90">Criar</Button></DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
        </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tables.length === 0 && <div className="text-sm text-muted-foreground col-span-full text-center py-12">Nenhuma mesa cadastrada.</div>}
                {tables.map((t) => {
                    const wl = waitlists[t.id] || [];
                    return (
                        <div key={t.id} data-testid={`table-card-${t.id}`} className="rounded-2xl bg-surface border border-white/5 p-5 flex flex-col">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{t.game_type}</div>
                                    <div className="font-heading text-xl font-semibold mt-1">{t.name}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        {t.bb_on_button ? (
                                            <span>BB no Botão: <span className="font-mono">{fmtBRL(t.big_blind)}</span></span>
                                        ) : (
                                            <span>Blinds <span className="font-mono">{fmtBRL(t.small_blind)}/{fmtBRL(t.big_blind)}</span></span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${t.status === "open" ? "bg-success/15 text-success border border-success/30" : "bg-muted text-muted-foreground"}`}>
                                        {t.status === "open" ? "Aberta" : "Fechada"}
                                    </span>
                                    {user?.role === "admin" && (
                                        <button onClick={() => setDeleteTableId(t.id)} title="Excluir Mesa" className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors">
                                            <Trash2 className="size-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="mt-5 grid grid-cols-2 gap-3">
                                <div className="rounded-lg bg-surface-elevated border border-white/5 p-3">
                                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Ocupação</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="font-heading text-lg font-bold">{t.seated_count}/{t.max_seats}</div>
                                        {t.status === "open" && (
                                            <div className="ml-auto flex flex-col">
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="rounded-lg bg-surface-elevated border border-white/5 p-3">
                                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Espera</div>
                                    <div className="font-heading text-lg font-bold mt-1">{wl.filter((w) => w.status === "waiting").length}</div>
                                </div>
                            </div>

                            <div className="mt-5 flex items-center gap-2">
                                <Button onClick={() => openTableDetail(t)} variant="outline" className="flex-1 bg-surface-elevated border-white/10 hover:bg-white/10">Ver Mesa</Button>
                                {t.status === "open" && (
                                    <Button onClick={() => { setManualRakeOpen(t); setManualRakeForm({ rake: "", jackpot: "", notes: "" }); }} variant="outline" className="bg-primary/5 text-primary border-primary/20 hover:bg-primary/10">
                                        <Landmark className="size-4" />
                                    </Button>
                                )}
                                <Button onClick={() => toggle(t)} data-testid={`toggle-table-${t.id}`} className={t.status === "open" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 w-12" : "bg-primary text-primary-foreground hover:bg-primary/90 flex-1"}>
                                    {t.status === "open" ? <X className="size-4"/> : "Abrir"}
                                </Button>
                                <Button variant="secondary" onClick={() => setWaitOpen(t.id)} data-testid={`open-waitlist-${t.id}`}>
                                    <UserPlus className="size-4" />
                                </Button>
                            </div>

                            {wl.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Fila de espera</div>
                                    <div className="space-y-1">
                                        {wl.slice(0, 4).map((w) => (
                                            <div key={w.id} className="flex items-center justify-between text-xs gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="font-mono w-5 text-muted-foreground">{w.position}</span>
                                                    <span className="truncate">{w.player_name}</span>
                                                    {w.status === "called" && <span className="text-[10px] uppercase tracking-widest text-warning">chamado</span>}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {w.status === "waiting" && <button onClick={() => updateWait(w.id, "called")} data-testid={`call-${w.id}`} title="Chamar" className="text-primary hover:underline"><Phone className="size-3.5" /></button>}
                                                    <button onClick={() => { setSeatOpen(w); setSeatForm({ amount: "", method: "debt" }); }} data-testid={`seat-${w.id}`} title="Sentar" className="text-success hover:underline"><Spade className="size-3.5" /></button>
                                                    <button onClick={() => updateWait(w.id, "cancelled")} data-testid={`cancel-${w.id}`} title="Cancelar" className="text-muted-foreground hover:text-destructive"><X className="size-3.5" /></button>
                                                </div>
                                            </div>
                                        ))}
                                        {wl.length > 4 && <div className="text-[10px] text-muted-foreground">+ {wl.length - 4} aguardando…</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Waitlist add dialog */}
            <Dialog open={!!waitOpen} onOpenChange={(o) => !o && setWaitOpen(null)}>
                <DialogContent className="bg-surface border-white/10 max-w-md">
                    <DialogHeader><DialogTitle>Adicionar à fila de espera</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <Select value={pid} onValueChange={setPid}>
                            <SelectTrigger data-testid="wait-player-select" className="bg-surface-elevated border-white/10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                                {players.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => { addToWait(waitOpen); setWaitOpen(null); }} data-testid="confirm-wait-button" className="bg-primary text-primary-foreground hover:bg-primary/90">Adicionar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Seating Dialog (Buy-in + Payment) */}
            <Dialog open={!!seatOpen} onOpenChange={(o) => !o && setSeatOpen(null)}>
                <DialogContent className="bg-surface border-white/10 max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Sentar Jogador</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={confirmSeat} className="space-y-4">
                        <div className="text-sm text-muted-foreground mb-2">
                            Mesa: <strong>{seatOpen?.player_name}</strong>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Valor em Fichas (Buy-in)</Label>
                            <Input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={seatForm.amount}
                                onChange={(e) => setSeatForm({ ...seatForm, amount: e.target.value })}
                                className="bg-surface-elevated border-white/10 font-mono text-lg"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Pagamento</Label>
                            <Select value={seatForm.method} onValueChange={(v) => setSeatForm({ ...seatForm, method: v })}>
                                <SelectTrigger className="bg-surface-elevated border-white/10 text-base py-6">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="debt">📝 Fiado (Pendente)</SelectItem>
                                    <SelectItem value="cash">💵 Dinheiro Vivo</SelectItem>
                                    <SelectItem value="pix">⚡ PIX</SelectItem>
                                    <SelectItem value="card">💳 Cartão de Crédito/Débito</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">Confirmar Assento</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Table Detail Dialog */}
            <Dialog open={!!activeTable} onOpenChange={(o) => !o && setActiveTable(null)}>
                <DialogContent className="bg-surface border-white/10 max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{activeTable?.name} - {activeTable?.game_type}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-surface-elevated p-3 rounded-lg border border-white/5">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Rake</div>
                                <div className="font-mono text-sm mt-1">{activeTable?.rake_percent}% {activeTable?.rake_cap > 0 ? `(Cap ${fmtBRL(activeTable.rake_cap)})` : ""}</div>
                            </div>
                            <div className="bg-surface-elevated p-3 rounded-lg border border-white/5">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Jackpot</div>
                                <div className="font-mono text-sm mt-1">{activeTable?.jackpot_percent}% {activeTable?.jackpot_cap > 0 ? `(Cap ${fmtBRL(activeTable.jackpot_cap)})` : ""}</div>
                            </div>
                        </div>
                        
                        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mt-4 mb-2">Jogadores Sentados</div>
                        <div className="space-y-2">
                            {seatedPlayers.length === 0 && <div className="text-sm text-muted-foreground py-4">Nenhum jogador sentado.</div>}
                            {seatedPlayers.map((p) => (
                                <div key={p.id} className="flex flex-wrap items-center justify-between p-3 rounded-lg bg-surface-elevated border border-white/5 text-sm gap-2">
                                    <div className="flex-1 min-w-[120px] font-semibold">{p.player_name}</div>
                                    <div className="text-muted-foreground min-w-[120px]">
                                        Compra: <span className="font-mono text-foreground">{fmtBRL(p.total_buyin || 0)}</span>
                                        <br/>
                                        <span className="text-[10px]">Saída: <span className="font-mono text-foreground">{fmtBRL(p.total_cashout || 0)}</span></span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="secondary" size="sm" onClick={() => { setCashoutOpen(p); setCashoutForm({ amount: "", method: "cash" }); }} className="h-8 text-xs bg-surface border-white/10 hover:bg-white/10">
                                            Cashout
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => updateWait(p.id, "cancelled")} className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Cancelar assento">
                                            <X className="size-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Cashout Dialog */}
            <Dialog open={!!cashoutOpen} onOpenChange={(o) => !o && setCashoutOpen(null)}>
                <DialogContent className="bg-surface border-white/10 max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Acerto de Jogador (Cashout)</DialogTitle>
                    </DialogHeader>
                    <div className="text-sm text-muted-foreground mb-1">
                        Jogador: <strong>{cashoutOpen?.player_name}</strong>
                    </div>
                    <form onSubmit={confirmCashout} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Fichas Devolvidas</Label>
                            <Input
                                type="number" required min="0" step="0.01" value={cashoutForm.amount}
                                onChange={(e) => setCashoutForm({ ...cashoutForm, amount: e.target.value })}
                                className="bg-surface-elevated border-white/10 font-mono text-lg" autoFocus
                            />
                        </div>
                        <div className="bg-surface-elevated p-3 rounded-xl border border-white/5 space-y-2 mb-4">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Entrada (Buy-in):</span>
                                <span className="font-mono text-foreground">{fmtBRL(cashoutOpen?.total_buyin || 0)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Fichas Devolvidas:</span>
                                <span className="font-mono text-foreground">{fmtBRL(Number(cashoutForm.amount) || 0)}</span>
                            </div>
                            <div className="pt-2 border-t border-white/5 flex justify-between font-bold">
                                <span className="text-sm">Resultado:</span>
                                <span className={`font-mono ${Number(cashoutForm.amount) - (cashoutOpen?.total_buyin || 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                                    {fmtBRL(Number(cashoutForm.amount) - (cashoutOpen?.total_buyin || 0))}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                                {Number(cashoutForm.amount) - (cashoutOpen?.total_buyin || 0) >= 0 
                                    ? "Forma de Pagamento (Casa -> Jogador)" 
                                    : "Forma de Acerto (Jogador -> Casa)"}
                            </Label>
                            <Select value={cashoutForm.method} onValueChange={(v) => setCashoutForm({ ...cashoutForm, method: v })}>
                                <SelectTrigger className="bg-surface-elevated border-white/10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Number(cashoutForm.amount) - (cashoutOpen?.total_buyin || 0) >= 0 ? (
                                        <>
                                            <SelectItem value="cash">💵 Pagar em Dinheiro Vivo</SelectItem>
                                            <SelectItem value="pix">⚡ Pagar em PIX</SelectItem>
                                            <SelectItem value="debt">📝 Abater de Dívida Existente</SelectItem>
                                        </>
                                    ) : (
                                        <>
                                            <SelectItem value="cash">💵 Receber em Dinheiro Vivo</SelectItem>
                                            <SelectItem value="pix">⚡ Receber em PIX</SelectItem>
                                            <SelectItem value="debt">📝 Lançar Restante como Dívida</SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">Confirmar Saída</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Close Table Summary Dialog */}
            <Dialog open={!!closeTableOpen} onOpenChange={(o) => !o && setCloseTableOpen(null)}>
                <DialogContent className="bg-surface border-white/10 max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Encerrar Mesa</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={confirmCloseTable} className="space-y-4">
                        <div className="bg-surface-elevated p-4 rounded-xl border border-white/5 space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Total Buy-ins:</span>
                                <span className="font-mono font-bold text-success">{fmtBRL(closeForm.total_buyin || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Total Cashouts:</span>
                                <span className="font-mono font-bold text-destructive">{fmtBRL(closeForm.total_cashout || 0)}</span>
                            </div>
                            <div className="pt-2 border-t border-white/10 flex justify-between text-sm font-bold">
                                <span>Saldo da Mesa:</span>
                                <span className={`font-mono ${(closeForm.total_collected || 0) >= 0 ? "text-foreground" : "text-destructive"}`}>
                                    {fmtBRL(closeForm.total_collected || 0)}
                                </span>
                            </div>
                            {(closeForm.total_collected || 0) < 0 && (
                                <div className="text-[10px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2 text-center">
                                    ⚠️ Saldo negativo: cashouts excedem buy-ins. Verifique os lançamentos antes de fechar.
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Rake da Casa</Label>
                            <Input
                                type="number" required min="0" step="0.01" value={closeForm.rake}
                                onChange={(e) => setCloseForm({ ...closeForm, rake: e.target.value })}
                                className="bg-surface-elevated border-white/10 font-mono"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Jackpot</Label>
                            <Input
                                type="number" required min="0" step="0.01" value={closeForm.jackpot}
                                onChange={(e) => setCloseForm({ ...closeForm, jackpot: e.target.value })}
                                className="bg-surface-elevated border-white/10 font-mono"
                            />
                        </div>

                        <DialogFooter className="mt-4">
                            <Button type="submit" className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full">Confirmar Fechamento</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Manual Rake Dialog */}
            <Dialog open={!!manualRakeOpen} onOpenChange={(o) => !o && setManualRakeOpen(null)}>
                <DialogContent className="bg-surface border-white/10 max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Lançar Rake Manual</DialogTitle>
                    </DialogHeader>
                    <div className="text-sm text-muted-foreground mb-1">
                        Mesa: <strong>{manualRakeOpen?.name}</strong>
                    </div>
                    <form onSubmit={confirmManualRake} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Dealer Responsável</Label>
                                <select 
                                    required
                                    value={manualRakeForm.dealer_id}
                                    onChange={(e) => setManualRakeForm({ ...manualRakeForm, dealer_id: e.target.value })}
                                    className="w-full bg-surface-elevated border border-white/10 rounded-md h-10 px-3 text-sm"
                                >
                                    <option value="">Selecione o dealer...</option>
                                    {dealers.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Rake (R$)</Label>
                                <Input
                                    type="number" required step="0.01" value={manualRakeForm.rake}
                                    onChange={(e) => setManualRakeForm({ ...manualRakeForm, rake: e.target.value })}
                                    className="bg-surface-elevated border-white/10 font-mono" placeholder="0.00"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Jackpot (R$)</Label>
                                <Input
                                    type="number" step="0.01" value={manualRakeForm.jackpot}
                                    onChange={(e) => setManualRakeForm({ ...manualRakeForm, jackpot: e.target.value })}
                                    className="bg-surface-elevated border-white/10 font-mono" placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Observações</Label>
                            <Input
                                value={manualRakeForm.notes}
                                onChange={(e) => setManualRakeForm({ ...manualRakeForm, notes: e.target.value })}
                                className="bg-surface-elevated border-white/10" placeholder="Ex: Troca de dealer"
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">Confirmar Lançamento</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Jackpot Adjust Dialog */}
            <Dialog open={jackpotOpen} onOpenChange={setJackpotOpen}>
                <DialogContent className="bg-surface border-white/10 max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Ajustar Jackpot</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={confirmJackpot} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Valor (Use negativo para pagar/retirar)</Label>
                            <Input
                                type="number" required step="0.01" value={jackpotForm.amount}
                                onChange={(e) => setJackpotForm({ ...jackpotForm, amount: e.target.value })}
                                className="bg-surface-elevated border-white/10 font-mono" placeholder="-500 ou 100"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Descrição</Label>
                            <Input
                                required value={jackpotForm.desc}
                                onChange={(e) => setJackpotForm({ ...jackpotForm, desc: e.target.value })}
                                className="bg-surface-elevated border-white/10" placeholder="Ex: Pagamento Quadra"
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">Aplicar Ajuste</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Alert */}
            <AlertDialog open={!!deleteTableId} onOpenChange={(o) => !o && setDeleteTableId(null)}>
                <AlertDialogContent className="bg-surface border-white/10">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apagar Mesa?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir esta mesa? O histórico financeiro no Caixa não será afetado.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-surface-elevated border-white/10">Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={removeTable} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Sim, apagar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
