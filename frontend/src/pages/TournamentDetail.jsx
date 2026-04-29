import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowLeft, Plus, RefreshCw, RotateCw, PackagePlus, Crown, Sparkles, Flag, Trophy, Coins, Users2, Layers, Skull, RotateCcw, Calculator, Edit3, Trash2 } from "lucide-react";
import { fmtBRL, fmtDateTime, apiErr, fmtNumber } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const STATUS_LABEL = {
    scheduled: { label: "Agendado", cls: "bg-secondary text-secondary-foreground" },
    in_progress: { label: "Em andamento", cls: "bg-success/15 text-success border border-success/30" },
    finished: { label: "Finalizado", cls: "bg-muted text-muted-foreground" },
};

const DEFAULT_DIST = [
    { position: 1, percent: 40 },
    { position: 2, percent: 25 },
    { position: 3, percent: 15 },
    { position: 4, percent: 10 },
    { position: 5, percent: 6 },
    { position: 6, percent: 4 },
];

export default function TournamentDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [t, setT] = useState(null);
    const [entries, setEntries] = useState([]);
    const [summary, setSummary] = useState(null);
    const [players, setPlayers] = useState([]);
    const [addOpen, setAddOpen] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [debtConfirm, setDebtConfirm] = useState(null); // {player_id, message}
    const [posDialog, setPosDialog] = useState(null);
    const [posValue, setPosValue] = useState("");
    const [prizeOpen, setPrizeOpen] = useState(false);
    const [dist, setDist] = useState(DEFAULT_DIST);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [chipDialog, setChipDialog] = useState(null); // entry being edited
    const [chipValue, setChipValue] = useState("");
    const [countMode, setCountMode] = useState(false);
    const [entryType, setEntryType] = useState("simple"); // simple | double for new enrollment
    
    // Edit Tournament State
    const [editOpen, setEditOpen] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [editForm, setEditForm] = useState({});

    useEffect(() => {
        if (editOpen && t) {
            setEditForm({
                ...t,
                start_at: t.start_at ? t.start_at.slice(0, 16) : "",
                buy_in: t.buy_in || 0,
                rake: t.rake || 0,
                rebuy: t.rebuy || 0,
                double_buyin: t.double_buyin || 0,
                double_rebuy: t.double_rebuy || 0,
                addon_simple: t.addon_simple || 0,
                super_addon: t.super_addon || 0,
                bonus: t.bonus || 0,
            });
        }
    }, [editOpen, t]);

    const saveEdit = async (e) => {
        e.preventDefault();
        setSavingEdit(true);
        try {
            const body = {
                ...editForm,
                buy_in: Number(editForm.buy_in),
                rake: Number(editForm.rake),
                rebuy: Number(editForm.rebuy),
                double_buyin: Number(editForm.double_buyin),
                double_rebuy: Number(editForm.double_rebuy),
                addon_simple: Number(editForm.addon_simple),
                super_addon: Number(editForm.super_addon),
                bonus: Number(editForm.bonus),
                chips_buy_in: Number(editForm.chips_buy_in),
                chips_double_buyin: Number(editForm.chips_double_buyin),
                chips_rebuy: Number(editForm.chips_rebuy),
                chips_double_rebuy: Number(editForm.chips_double_rebuy),
                chips_addon: Number(editForm.chips_addon),
                chips_super_addon: Number(editForm.chips_super_addon),
                chips_bonus: Number(editForm.chips_bonus),
                start_at: new Date(editForm.start_at).toISOString(),
            };
            
            // Clean up extra fields not in TournamentIn
            delete body.id;
            delete body.status;
            delete body.created_at;
            delete body.prize_distribution;
            
            await api.put(`/tournaments/${id}`, body);
            toast.success("Torneio atualizado");
            setEditOpen(false);
            load();
        } catch (err) {
            toast.error(apiErr(err));
        } finally {
            setSavingEdit(false);
        }
    };

    const load = useCallback(async () => {
        const [t, e, s] = await Promise.all([
            api.get(`/tournaments/${id}`),
            api.get(`/tournaments/${id}/entries`),
            api.get(`/tournaments/${id}/summary`),
        ]);
        setT(t.data);
        setEntries(e.data);
        setSummary(s.data);
        if (t.data.prize_distribution?.length) setDist(t.data.prize_distribution.map((d) => ({ position: d.position, percent: d.percent })));
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const removeTournament = async () => {
        try {
            await api.delete(`/tournaments/${id}`);
            toast.success("Torneio excluído");
            navigate("/tournaments");
        } catch (err) {
            toast.error(apiErr(err));
        }
    };

    useEffect(() => {
        const t = setTimeout(async () => {
            const { data } = await api.get(`/players${search ? `?q=${encodeURIComponent(search)}` : ""}`);
            setPlayers(data.slice(0, 50));
        }, 200);
        return () => clearTimeout(t);
    }, [search]);

    const ACTION_LABEL = {
        rebuy: "Rebuy", double_rebuy: "Rebuy duplo",
        addon: "Add-on", super_addon: "Super Add-on", bonus: "Bônus",
    };
    const ACTION_CHIPS = {
        rebuy: "chips_rebuy", double_rebuy: "chips_double_rebuy",
        addon: "chips_addon", super_addon: "chips_super_addon", bonus: "chips_bonus",
    };

    const action = async (entryId, act) => {
        try {
            await api.post(`/entries/${entryId}/action?action=${act}`);
            const chips = Number(t?.[ACTION_CHIPS[act]] || 0);
            toast.success(`${ACTION_LABEL[act]} registrado${chips ? ` · +${chips.toLocaleString("pt-BR")} fichas` : ""}`);
            load();
        } catch (e) {
            toast.error(apiErr(e));
        }
    };

    const enroll = async (allowDebt = false) => {
        if (!selectedPlayer) return;
        try {
            await api.post(`/tournaments/${id}/entries?player_id=${selectedPlayer}&entry_type=${entryType}&allow_debt=${allowDebt}`);
            toast.success(`Jogador inscrito (${entryType === "double" ? "entrada dupla" : "entrada simples"})`);
            setAddOpen(false);
            setSelectedPlayer("");
            setSearch("");
            setEntryType("simple");
            setDebtConfirm(null);
            load();
        } catch (e) {
            const msg = apiErr(e);
            if (e?.response?.status === 409) {
                setDebtConfirm({ player_id: selectedPlayer, message: msg });
            } else {
                toast.error(msg);
            }
        }
    };

    const setStatus = async (status) => {
        try {
            await api.post(`/tournaments/${id}/status?status=${status}`);
            toast.success("Status atualizado");
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const savePosition = async () => {
        if (!posDialog) return;
        try {
            await api.put(`/entries/${posDialog.id}/position?position=${Number(posValue)}`);
            toast.success("Posição registrada");
            setPosDialog(null);
            setPosValue("");
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const savePrize = async () => {
        try {
            await api.put(`/tournaments/${id}/prize-distribution`, { distribution: dist.map((d) => ({ position: Number(d.position), percent: Number(d.percent) })) });
            toast.success("Premiação calculada");
            setPrizeOpen(false);
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const eliminate = async (entry) => {
        if (!window.confirm(`Eliminar ${entry.player_name}? As fichas (${fmtNumber(entry.current_chips)}) já estão com outros jogadores.`)) return;
        try {
            await api.post(`/entries/${entry.id}/eliminate`);
            toast.success(`${entry.player_name} eliminado`);
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const reactivate = async (entry) => {
        try {
            await api.post(`/entries/${entry.id}/reactivate`);
            toast.success(`${entry.player_name} reativado`);
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const saveChipCount = async () => {
        if (!chipDialog) return;
        try {
            await api.put(`/entries/${chipDialog.id}/chip-count?count=${Number(chipValue)}`);
            toast.success(`Stack atualizado · ${fmtNumber(chipValue)} fichas`);
            setChipDialog(null);
            setChipValue("");
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    if (!t || !summary) return <div className="p-8 text-muted-foreground">Carregando...</div>;
    const totals = summary.totals;
    const status = STATUS_LABEL[t.status];
    const totalPercent = dist.reduce((s, d) => s + Number(d.percent || 0), 0);

    return (
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto animate-fade-in-up">
            <Link to="/torneios" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-6">
                <ArrowLeft className="size-4" /> Voltar para torneios
            </Link>

            <div className="rounded-2xl bg-surface border border-white/5 p-6 mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-1">{t.type}{t.is_freeroll && " · Freeroll"}</div>
                        <h1 className="text-3xl font-heading font-bold tracking-tight">{t.name}</h1>
                        <div className="text-sm text-muted-foreground mt-1">{fmtDateTime(t.start_at)}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {t.is_freeroll && <span className="text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full bg-success/15 text-success border border-success/30">Freeroll</span>}
                        <span className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full ${status.cls}`}>{status.label}</span>
                        {user?.role === "admin" && (
                            <>
                                <Select value={t.status} onValueChange={setStatus}>
                                    <SelectTrigger data-testid="tour-status-select" className="w-44 bg-surface-elevated border-white/10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="scheduled">Agendado</SelectItem>
                                        <SelectItem value="in_progress">Em andamento</SelectItem>
                                        <SelectItem value="finished">Finalizado</SelectItem>
                                    </SelectContent>
                                </Select>
                                
                                <div className="flex gap-2">
                                    <Button variant="secondary" size="icon" onClick={() => setDeleteOpen(true)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Apagar Torneio">
                                        <Trash2 className="size-4" />
                                    </Button>
                                    <Dialog open={editOpen} onOpenChange={setEditOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="secondary" size="icon" data-testid="edit-tournament-btn" title="Editar Torneio">
                                                <Edit3 className="size-4" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="bg-surface border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
                                            <DialogHeader>
                                                <DialogTitle>Editar torneio</DialogTitle>
                                            </DialogHeader>
                                            <form onSubmit={saveEdit} className="space-y-4">
                                            <label className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-elevated border border-white/5 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editForm.is_freeroll}
                                                    onChange={(e) => setEditForm({ ...editForm, is_freeroll: e.target.checked })}
                                                    className="size-4 accent-primary"
                                                />
                                                <div className="flex-1">
                                                    <div className="text-sm font-semibold">Freeroll</div>
                                                    <div className="text-xs text-muted-foreground">Sem buy-in nem rake. Rebuys e add-ons opcionais.</div>
                                                </div>
                                            </label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5 col-span-2">
                                                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Nome</Label>
                                                    <Input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="bg-surface-elevated border-white/10" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Tipo</Label>
                                                    <Input value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className="bg-surface-elevated border-white/10" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Data/Hora</Label>
                                                    <Input type="datetime-local" value={editForm.start_at} onChange={(e) => setEditForm({ ...editForm, start_at: e.target.value })} className="bg-surface-elevated border-white/10" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="text-[10px] uppercase tracking-[0.22em] text-primary">Valores (R$)</div>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <Money label="Buy-in" value={editForm.buy_in} on={(v) => setEditForm({ ...editForm, buy_in: v })} disabled={editForm.is_freeroll} />
                                                    <Money label="Taxa (Rake)" value={editForm.rake} on={(v) => setEditForm({ ...editForm, rake: v })} disabled={editForm.is_freeroll} />
                                                    <Money label="Entrada dupla" value={editForm.double_buyin} on={(v) => setEditForm({ ...editForm, double_buyin: v })} disabled={editForm.is_freeroll} />
                                                    <Money label="Rebuy" value={editForm.rebuy} on={(v) => setEditForm({ ...editForm, rebuy: v })} />
                                                    <Money label="Rebuy duplo" value={editForm.double_rebuy} on={(v) => setEditForm({ ...editForm, double_rebuy: v })} />
                                                    <Money label="Add-on" value={editForm.addon_simple} on={(v) => setEditForm({ ...editForm, addon_simple: v })} />
                                                    <Money label="Super Add-on" value={editForm.super_addon} on={(v) => setEditForm({ ...editForm, super_addon: v })} />
                                                    <Money label="Bônus / Staff" value={editForm.bonus} on={(v) => setEditForm({ ...editForm, bonus: v })} />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="text-[10px] uppercase tracking-[0.22em] text-primary">Fichas por ação</div>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <Chips label="Buy-in" value={editForm.chips_buy_in} on={(v) => setEditForm({ ...editForm, chips_buy_in: v })} />
                                                    <Chips label="Entrada dupla" value={editForm.chips_double_buyin} on={(v) => setEditForm({ ...editForm, chips_double_buyin: v })} />
                                                    <Chips label="Rebuy" value={editForm.chips_rebuy} on={(v) => setEditForm({ ...editForm, chips_rebuy: v })} />
                                                    <Chips label="Rebuy duplo" value={editForm.chips_double_rebuy} on={(v) => setEditForm({ ...editForm, chips_double_rebuy: v })} />
                                                    <Chips label="Add-on" value={editForm.chips_addon} on={(v) => setEditForm({ ...editForm, chips_addon: v })} />
                                                    <Chips label="Super Add-on" value={editForm.chips_super_addon} on={(v) => setEditForm({ ...editForm, chips_super_addon: v })} />
                                                    <Chips label="Bônus" value={editForm.chips_bonus} on={(v) => setEditForm({ ...editForm, chips_bonus: v })} />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Observações</Label>
                                                <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="bg-surface-elevated border-white/10" />
                                            </div>
                                            <DialogFooter>
                                                <Button type="submit" disabled={savingEdit} className="bg-primary text-primary-foreground hover:bg-primary/90">
                                                    {savingEdit ? "Salvando..." : "Salvar alterações"}
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-6">
                    <Pill label={t.is_freeroll ? "Buy-in" : "Buy-in"} v={t.is_freeroll ? "Gratuito" : fmtBRL(t.buy_in)} sub={`${fmtNumber(t.chips_buy_in || 0)} fichas`} />
                    <Pill label="Taxa (Rake)" v={t.is_freeroll ? "—" : fmtBRL(t.rake || 0)} sub="Por inscrição" />
                    <Pill label="Entrada dupla" v={t.is_freeroll ? "—" : fmtBRL(t.double_buyin || 0)} sub={`${fmtNumber(t.chips_double_buyin || 0)} fichas`} />
                    <Pill label="Rebuy" v={fmtBRL(t.rebuy)} sub={`${fmtNumber(t.chips_rebuy || 0)} fichas`} />
                    <Pill label="Rebuy duplo" v={fmtBRL(t.double_rebuy || 0)} sub={`${fmtNumber(t.chips_double_rebuy || 0)} fichas`} />
                    <Pill label="Add-on / Super" v={`${fmtBRL(t.addon_simple)} · ${fmtBRL(t.super_addon)}`} sub={`${fmtNumber(t.chips_addon || 0)}/${fmtNumber(t.chips_super_addon || 0)}`} />
                    <Pill label="Bônus" v={fmtBRL(t.bonus)} sub={`${fmtNumber(t.chips_bonus || 0)} fichas`} />
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
                <FinStat icon={Users2} label="Inscrições" v={`${fmtNumber(totals.entries)}${totals.double_entries ? ` (+${totals.double_entries})` : ""}`} />
                <FinStat icon={Coins} label="Bruto" v={fmtBRL(totals.gross)} />
                <FinStat icon={Crown} label="Rake" v={fmtBRL(totals.rake)} accent="warning" />
                <FinStat icon={Trophy} label="Prize Pool" v={fmtBRL(totals.prize_pool)} accent="success" />
                <FinStat icon={Layers} label="Fichas em Jogo" v={fmtNumber(totals.total_chips || 0)} accent="primary" />
                <FinStat icon={Calculator} label="Média / Ativo" v={`${fmtNumber(totals.average_chips || 0)}`} accent="primary" sub={`${totals.active_count || 0} ativos`} />
            </div>

            {/* Leaderboard de fichas */}
            {summary.leaderboard?.length > 0 && (
                <div className="rounded-2xl bg-surface border border-white/5 p-5 mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Crown className="size-4 text-primary" />
                            <h3 className="font-heading text-lg font-semibold">Líderes em fichas</h3>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">total ativo: {fmtNumber(totals.current_chips_total || 0)}</div>
                    </div>
                    <div className="space-y-2">
                        {summary.leaderboard.map((l, idx) => {
                            const max = summary.leaderboard[0]?.current_chips || 1;
                            const pct = (l.current_chips / max) * 100;
                            const aboveAvg = totals.average_chips ? l.current_chips >= totals.average_chips : false;
                            return (
                                <div key={l.entry_id} data-testid={`leader-${idx}`} className="flex items-center gap-3">
                                    <div className="w-6 text-right font-mono text-sm text-muted-foreground">{idx + 1}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <Link to={`/jogadores/${l.player_id}`} className="text-sm font-medium hover:text-primary truncate">{l.player_name}</Link>
                                            <span className={`text-sm font-mono font-semibold ${aboveAvg ? "text-success" : "text-warning"}`}>{fmtNumber(l.current_chips)}</span>
                                        </div>
                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className={`h-full ${idx === 0 ? "bg-primary" : "bg-primary/40"}`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Inscrições + ações */}
            <div className="rounded-2xl bg-surface border border-white/5 overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-white/5">
                    <div>
                        <h3 className="font-heading text-xl font-semibold">Inscritos</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Use os botões rápidos para registrar ações na mesa.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button
                            variant={countMode ? "default" : "secondary"}
                            onClick={() => setCountMode(!countMode)}
                            data-testid="count-mode-toggle"
                            className={countMode ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                        >
                            <Calculator className="size-4" /> {countMode ? "Sair da contagem" : "Contagem de fichas"}
                        </Button>
                        <Button onClick={() => setPrizeOpen(true)} variant="secondary" data-testid="prize-pool-button">
                            <Trophy className="size-4" /> Premiação
                        </Button>
                        <Dialog open={addOpen} onOpenChange={setAddOpen}>
                            <DialogTrigger asChild>
                                <Button data-testid="add-entry-button" className="bg-primary text-primary-foreground hover:bg-primary/90">
                                    <Plus className="size-4" /> Inscrever
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-surface border-white/10">
                                <DialogHeader>
                                    <DialogTitle>Inscrever jogador</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-3">
                                    {!t.is_freeroll && (t.double_buyin || 0) > 0 && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                data-testid="entry-type-simple"
                                                onClick={() => setEntryType("simple")}
                                                className={`rounded-lg px-3 py-3 text-left border transition-all ${entryType === "simple" ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface-elevated border-white/5 hover:border-white/15"}`}
                                            >
                                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Entrada simples</div>
                                                <div className="font-mono font-semibold mt-0.5">{fmtBRL((t.buy_in || 0) + (t.rake || 0))}</div>
                                                <div className="text-[10px] text-muted-foreground font-mono">{fmtNumber(t.chips_buy_in || 0)} fichas</div>
                                            </button>
                                            <button
                                                type="button"
                                                data-testid="entry-type-double"
                                                onClick={() => setEntryType("double")}
                                                className={`rounded-lg px-3 py-3 text-left border transition-all ${entryType === "double" ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface-elevated border-white/5 hover:border-white/15"}`}
                                            >
                                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Entrada dupla</div>
                                                <div className="font-mono font-semibold mt-0.5">{fmtBRL((t.double_buyin || 0) + (t.rake || 0))}</div>
                                                <div className="text-[10px] text-muted-foreground font-mono">{fmtNumber(t.chips_double_buyin || 0)} fichas</div>
                                            </button>
                                        </div>
                                    )}
                                    <Input data-testid="entry-search-input" placeholder="Buscar jogador..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-surface-elevated border-white/10" />
                                    <div className="max-h-72 overflow-y-auto scrollbar-thin space-y-1">
                                        {players.map((p) => (
                                            <button
                                                key={p.id}
                                                data-testid={`select-player-${p.id}`}
                                                onClick={() => setSelectedPlayer(p.id)}
                                                className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between ${selectedPlayer === p.id ? "bg-primary/10 border border-primary/30" : "hover:bg-white/5 border border-transparent"}`}
                                            >
                                                <div>
                                                    <div className="text-sm font-medium">{p.name}</div>
                                                    {p.debt_balance > 0 && <div className="text-xs text-destructive">Dívida: {fmtBRL(p.debt_balance)}</div>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={() => enroll(false)} disabled={!selectedPlayer} data-testid="confirm-enroll-button" className="bg-primary text-primary-foreground hover:bg-primary/90">
                                        Inscrever
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-surface-elevated text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                <th className="text-left py-3 px-4">Jogador</th>
                                <th className="text-center py-3 px-2">Re</th>
                                <th className="text-center py-3 px-2" title="Rebuy duplo">Re2x</th>
                                <th className="text-center py-3 px-2">Add</th>
                                <th className="text-center py-3 px-2">Sup</th>
                                <th className="text-center py-3 px-2">Bn</th>
                                <th className="text-right py-3 px-4">Stack atual</th>
                                <th className="text-right py-3 px-4 hidden xl:table-cell">Comprado</th>
                                <th className="text-right py-3 px-4 hidden lg:table-cell">Total R$</th>
                                <th className="text-right py-3 px-4">Pos.</th>
                                <th className="text-right py-3 px-4">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.length === 0 && <tr><td colSpan={11} className="text-center text-muted-foreground py-12">Nenhuma inscrição.</td></tr>}
                            {entries.map((e) => {
                                const isElim = e.status === "eliminated";
                                const isFinal = e.status === "finalized";
                                const aboveAvg = totals.average_chips && e.current_chips >= totals.average_chips;
                                return (
                                <tr key={e.id} data-testid={`entry-row-${e.id}`} className={`border-t border-white/5 hover:bg-white/[0.02] ${isElim ? "opacity-50" : ""}`}>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Link to={`/jogadores/${e.player_id}`} className="font-medium hover:text-primary">{e.player_name}</Link>
                                            {e.entry_type === "double" && <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">2x</span>}
                                            {isElim && <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/30">Eliminado</span>}
                                        </div>
                                        {e.pending_amount > 0 && <div className="text-[10px] text-warning uppercase tracking-widest mt-0.5">Pendente {fmtBRL(e.pending_amount)}</div>}
                                    </td>
                                    <td className="text-center font-mono">{e.rebuys}</td>
                                    <td className="text-center font-mono">{e.double_rebuys || 0}</td>
                                    <td className="text-center font-mono">{e.addons_simple}</td>
                                    <td className="text-center font-mono">{e.super_addons}</td>
                                    <td className="text-center">{e.bonus ? "✓" : "—"}</td>
                                    <td className="text-right">
                                        <button
                                            disabled={isElim || isFinal}
                                            onClick={() => { setChipDialog(e); setChipValue(String(e.current_chips || 0)); }}
                                            data-testid={`edit-chips-${e.id}`}
                                            className={`inline-flex items-center gap-1.5 font-mono font-semibold ${isElim ? "text-muted-foreground" : aboveAvg ? "text-success hover:underline" : "text-warning hover:underline"} disabled:no-underline disabled:cursor-not-allowed`}
                                        >
                                            {fmtNumber(e.current_chips || 0)}
                                            {!isElim && !isFinal && <Edit3 className="size-3 opacity-60" />}
                                        </button>
                                    </td>
                                    <td className="text-right font-mono text-muted-foreground hidden xl:table-cell">{fmtNumber(e.total_chips || 0)}</td>
                                    <td className="text-right font-mono hidden lg:table-cell">{fmtBRL(e.total_spent)}</td>
                                    <td className="text-right">
                                        {e.final_position ? (
                                            <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">#{e.final_position} · {e.points} pts</span>
                                        ) : (
                                            <button onClick={() => { setPosDialog(e); setPosValue(""); }} className="text-xs text-muted-foreground hover:text-primary" data-testid={`set-pos-${e.id}`}>
                                                <Flag className="size-3.5 inline" /> definir
                                            </button>
                                        )}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-end gap-1 flex-wrap">
                                            {countMode && !isElim && !isFinal ? (
                                                <Button size="sm" variant="secondary" onClick={() => { setChipDialog(e); setChipValue(String(e.current_chips || 0)); }} data-testid={`count-${e.id}`}>
                                                    <Calculator className="size-3.5" /> Contar
                                                </Button>
                                            ) : isElim ? (
                                                <Button size="sm" variant="secondary" onClick={() => reactivate(e)} data-testid={`reactivate-${e.id}`}>
                                                    <RotateCcw className="size-3.5" /> Reativar
                                                </Button>
                                            ) : (
                                                <>
                                                    <ActBtn label="Rebuy" icon={RotateCw} onClick={() => action(e.id, "rebuy")} testid={`act-rebuy-${e.id}`} />
                                                    <ActBtn label="Rebuy duplo" icon={RefreshCw} onClick={() => action(e.id, "double_rebuy")} testid={`act-double-rebuy-${e.id}`} />
                                                    <ActBtn label="Add-on" icon={PackagePlus} onClick={() => action(e.id, "addon")} testid={`act-addon-${e.id}`} />
                                                    <ActBtn label="Super" icon={Layers} onClick={() => action(e.id, "super_addon")} testid={`act-super-${e.id}`} />
                                                    <ActBtn label="Bônus" icon={Sparkles} onClick={() => action(e.id, "bonus")} disabled={e.bonus} testid={`act-bonus-${e.id}`} accent />
                                                    <ActBtn label="Eliminar" icon={Skull} onClick={() => eliminate(e)} testid={`act-eliminate-${e.id}`} danger />
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );})}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Prize distribution dialog */}
            <Dialog open={prizeOpen} onOpenChange={setPrizeOpen}>
                <DialogContent className="bg-surface border-white/10 max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Distribuição da premiação</DialogTitle>
                    </DialogHeader>
                    <div className="text-sm text-muted-foreground mb-3">
                        Prize Pool atual: <span className="text-foreground font-mono font-semibold">{fmtBRL(totals.prize_pool)}</span>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
                        {dist.map((d, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <div className="w-12 text-right font-mono text-sm">#{d.position}</div>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={d.percent}
                                    onChange={(e) => setDist(dist.map((x, i) => i === idx ? { ...x, percent: e.target.value } : x))}
                                    className="bg-surface-elevated border-white/10 font-mono w-28"
                                    data-testid={`dist-pct-${idx}`}
                                />
                                <span className="text-xs text-muted-foreground">%</span>
                                <div className="flex-1 text-right font-mono text-sm">{fmtBRL(totals.prize_pool * (Number(d.percent || 0) / 100))}</div>
                                <Button variant="ghost" size="sm" onClick={() => setDist(dist.filter((_, i) => i !== idx))}>×</Button>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <Button variant="secondary" size="sm" onClick={() => setDist([...dist, { position: dist.length + 1, percent: 0 }])}>
                            + Posição
                        </Button>
                        <div className="text-xs text-muted-foreground">Total: <span className={`font-mono font-semibold ${Math.abs(totalPercent - 100) < 0.01 ? "text-success" : "text-warning"}`}>{totalPercent.toFixed(2)}%</span></div>
                    </div>
                    <DialogFooter>
                        <Button onClick={savePrize} data-testid="save-prize-button" className="bg-primary text-primary-foreground hover:bg-primary/90">Salvar premiação</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Chip count dialog */}
            <Dialog open={!!chipDialog} onOpenChange={(o) => !o && setChipDialog(null)}>
                <DialogContent className="bg-surface border-white/10 max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Contagem de fichas · {chipDialog?.player_name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="text-xs text-muted-foreground font-mono">
                            Comprado: <span className="text-foreground">{fmtNumber(chipDialog?.total_chips || 0)}</span>
                            {totals.average_chips ? <> · Média atual: <span className="text-foreground">{fmtNumber(totals.average_chips)}</span></> : null}
                        </div>
                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Stack atual</Label>
                        <Input
                            data-testid="chip-count-input"
                            type="number"
                            min="0"
                            step="500"
                            value={chipValue}
                            onChange={(e) => setChipValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveChipCount()}
                            autoFocus
                            className="bg-surface-elevated border-white/10 font-mono text-lg h-12"
                        />
                    </div>
                    <DialogFooter>
                        <Button onClick={saveChipCount} data-testid="save-chip-count-button" className="bg-primary text-primary-foreground hover:bg-primary/90">Atualizar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Position dialog */}
            <Dialog open={!!posDialog} onOpenChange={(o) => !o && setPosDialog(null)}>
                <DialogContent className="bg-surface border-white/10 max-w-sm">
                    <DialogHeader><DialogTitle>Posição final · {posDialog?.player_name}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Posição</Label>
                        <Input data-testid="pos-input" type="number" min="1" value={posValue} onChange={(e) => setPosValue(e.target.value)} className="bg-surface-elevated border-white/10 font-mono" />
                    </div>
                    <DialogFooter>
                        <Button onClick={savePosition} data-testid="save-pos-button" className="bg-primary text-primary-foreground hover:bg-primary/90">Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Debt confirmation */}
            <AlertDialog open={!!debtConfirm} onOpenChange={(o) => !o && setDebtConfirm(null)}>
                <AlertDialogContent className="bg-surface border-white/10">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Jogador com dívida</AlertDialogTitle>
                        <AlertDialogDescription>{debtConfirm?.message} Deseja inscrever mesmo assim?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction data-testid="confirm-debt-enroll" onClick={() => enroll(true)} className="bg-primary text-primary-foreground">Inscrever assim mesmo</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* Delete Alert */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent className="bg-surface border-white/10">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apagar Torneio?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja apagar este torneio? Todas as inscrições associadas serão perdidas. O histórico no Caixa (compras e dívidas) permanecerá intacto.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-surface-elevated border-white/10">Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={removeTournament} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Sim, apagar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

const Pill = ({ label, v, sub }) => (
    <div className="rounded-lg bg-surface-elevated border border-white/5 px-3 py-2">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-mono text-sm font-semibold">{v}</div>
        {sub && <div className="text-[10px] text-primary/80 font-mono mt-0.5">{sub}</div>}
    </div>
);

const FinStat = ({ icon: Icon, label, v, sub, accent = "primary" }) => (
    <div className="rounded-2xl bg-surface border border-white/5 p-4 flex items-center gap-3">
        <div className={`size-10 rounded-lg flex items-center justify-center bg-${accent}/10 border border-${accent}/20`}>
            <Icon className={`size-4 text-${accent}`} strokeWidth={1.6} />
        </div>
        <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className="font-mono text-lg font-bold leading-tight">{v}</div>
            {sub && <div className="text-[10px] text-muted-foreground font-mono">{sub}</div>}
        </div>
    </div>
);

const ActBtn = ({ icon: Icon, label, onClick, disabled, accent, danger, testid }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        data-testid={testid}
        title={label}
        className={`size-8 rounded-md flex items-center justify-center transition-all border ${
            disabled ? "opacity-40 cursor-not-allowed border-white/5"
            : danger ? "bg-destructive/10 hover:bg-destructive/20 border-destructive/30 text-destructive"
            : accent ? "bg-primary/10 hover:bg-primary/20 border-primary/30 text-primary"
            : "border-white/10 hover:bg-white/5 hover:border-white/20"
        }`}
    >
        <Icon className="size-4" strokeWidth={1.6} />
    </button>
);

const Money = ({ label, value, on, testid, disabled }) => (
    <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
        <Input data-testid={testid} type="number" min="0" step="0.01" value={value} onChange={(e) => on(e.target.value)} disabled={disabled} className="bg-surface-elevated border-white/10 font-mono disabled:opacity-40" />
    </div>
);

const Chips = ({ label, value, on, testid }) => (
    <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
        <div className="relative">
            <Input data-testid={testid} type="number" min="0" step="500" value={value} onChange={(e) => on(e.target.value)} className="bg-surface-elevated border-white/10 font-mono pr-10" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-muted-foreground">fichas</span>
        </div>
    </div>
);
