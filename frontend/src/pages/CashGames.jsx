import React, { useEffect, useState } from "react";
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
import { Plus, Spade, UserPlus, Phone, X, ChevronUp, ChevronDown } from "lucide-react";
import { fmtBRL, apiErr } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function CashGames() {
    const { user } = useAuth();
    const [tables, setTables] = useState([]);
    const [waitlists, setWaitlists] = useState({}); // table_id -> list
    const [players, setPlayers] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: "", game_type: "Texas Hold'em", small_blind: 1, big_blind: 2, max_seats: 9 });
    const [waitOpen, setWaitOpen] = useState(null);
    const [pid, setPid] = useState("");

    const load = async () => {
        const [t, p] = await Promise.all([api.get("/cash-tables"), api.get("/players")]);
        setTables(t.data); setPlayers(p.data);
        const wls = {};
        await Promise.all(t.data.map(async (tt) => {
            const { data } = await api.get(`/cash-tables/${tt.id}/waitlist`);
            wls[tt.id] = data;
        }));
        setWaitlists(wls);
    };
    useEffect(() => { load(); }, []);

    const createTable = async (e) => {
        e.preventDefault();
        try {
            await api.post("/cash-tables", { ...form, small_blind: Number(form.small_blind), big_blind: Number(form.big_blind), max_seats: Number(form.max_seats) });
            toast.success("Mesa criada");
            setOpen(false);
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const toggle = async (t) => {
        try {
            await api.post(`/cash-tables/${t.id}/${t.status === "open" ? "close" : "open"}`);
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const seatDelta = async (t, delta) => {
        try {
            await api.post(`/cash-tables/${t.id}/seat?delta=${delta}`);
            load();
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

    const updateWait = async (wid, status) => {
        try {
            await api.post(`/waitlist/${wid}/status?status=${status}`);
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto animate-fade-in-up">
            <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-2">Salão</div>
                    <h1 className="text-4xl font-heading font-bold tracking-tight">Cash Games</h1>
                    <p className="text-sm text-muted-foreground mt-1">Gerencie mesas, ocupação e listas de espera.</p>
                </div>
                {user?.role === "admin" && (
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button data-testid="add-table-button" className="bg-primary text-primary-foreground hover:bg-primary/90">
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
                                    <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest text-muted-foreground">SB</Label><Input data-testid="table-sb" type="number" step="0.5" value={form.small_blind} onChange={(e) => setForm({ ...form, small_blind: e.target.value })} className="bg-surface-elevated border-white/10 font-mono" /></div>
                                    <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest text-muted-foreground">BB</Label><Input data-testid="table-bb" type="number" step="0.5" value={form.big_blind} onChange={(e) => setForm({ ...form, big_blind: e.target.value })} className="bg-surface-elevated border-white/10 font-mono" /></div>
                                    <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest text-muted-foreground">Lugares</Label><Input data-testid="table-seats" type="number" min="2" max="10" value={form.max_seats} onChange={(e) => setForm({ ...form, max_seats: e.target.value })} className="bg-surface-elevated border-white/10 font-mono" /></div>
                                </div>
                                <DialogFooter><Button type="submit" data-testid="save-table-button" className="bg-primary text-primary-foreground hover:bg-primary/90">Criar</Button></DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
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
                                    <div className="text-xs text-muted-foreground mt-0.5">Blinds <span className="font-mono">{fmtBRL(t.small_blind)}/{fmtBRL(t.big_blind)}</span></div>
                                </div>
                                <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${t.status === "open" ? "bg-success/15 text-success border border-success/30" : "bg-muted text-muted-foreground"}`}>
                                    {t.status === "open" ? "Aberta" : "Fechada"}
                                </span>
                            </div>

                            <div className="mt-5 grid grid-cols-2 gap-3">
                                <div className="rounded-lg bg-surface-elevated border border-white/5 p-3">
                                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Ocupação</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="font-heading text-lg font-bold">{t.seated_count}/{t.max_seats}</div>
                                        {t.status === "open" && (
                                            <div className="ml-auto flex flex-col">
                                                <button onClick={() => seatDelta(t, 1)} data-testid={`seat-up-${t.id}`} className="size-5 rounded-md hover:bg-white/10 flex items-center justify-center"><ChevronUp className="size-3.5" /></button>
                                                <button onClick={() => seatDelta(t, -1)} data-testid={`seat-down-${t.id}`} className="size-5 rounded-md hover:bg-white/10 flex items-center justify-center"><ChevronDown className="size-3.5" /></button>
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
                                <Button onClick={() => toggle(t)} data-testid={`toggle-table-${t.id}`} className={t.status === "open" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 flex-1" : "bg-primary text-primary-foreground hover:bg-primary/90 flex-1"}>
                                    {t.status === "open" ? "Fechar mesa" : "Abrir mesa"}
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
                                                    <button onClick={() => updateWait(w.id, "seated")} data-testid={`seat-${w.id}`} title="Sentar" className="text-success hover:underline"><Spade className="size-3.5" /></button>
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
        </div>
    );
}
