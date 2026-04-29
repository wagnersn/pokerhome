import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
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
import { ArrowLeft, Plus, RefreshCw, RotateCw, PackagePlus, Crown, Sparkles, Flag, Trophy, Coins, Users2, CircleDollarSign, Layers } from "lucide-react";
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
    const [search, setSearch] = useState("");

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

    useEffect(() => {
        const t = setTimeout(async () => {
            const { data } = await api.get(`/players${search ? `?q=${encodeURIComponent(search)}` : ""}`);
            setPlayers(data.slice(0, 50));
        }, 200);
        return () => clearTimeout(t);
    }, [search]);

    const ACTION_LABEL = {
        rebuy: "Rebuy", double_rebuy: "Rebuy duplo", double_entry: "Entrada dupla",
        addon: "Add-on", super_addon: "Super Add-on", bonus: "Bônus",
    };
    const ACTION_CHIPS = {
        rebuy: "chips_rebuy", double_rebuy: "chips_double_rebuy", double_entry: "chips_double_buyin",
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
            await api.post(`/tournaments/${id}/entries?player_id=${selectedPlayer}&allow_debt=${allowDebt}`);
            toast.success("Jogador inscrito");
            setAddOpen(false);
            setSelectedPlayer("");
            setSearch("");
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
                        <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-1">{t.type}</div>
                        <h1 className="text-3xl font-heading font-bold tracking-tight">{t.name}</h1>
                        <div className="text-sm text-muted-foreground mt-1">{fmtDateTime(t.start_at)}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full ${status.cls}`}>{status.label}</span>
                        {user?.role === "admin" && (
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
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
                    <Pill label="Buy-in" v={fmtBRL(t.buy_in + t.rake)} sub={`${fmtNumber(t.chips_buy_in || 0)} fichas`} />
                    <Pill label="Entrada dupla" v={fmtBRL(t.double_buyin || 0)} sub={`${fmtNumber(t.chips_double_buyin || 0)} fichas`} />
                    <Pill label="Rebuy" v={fmtBRL(t.rebuy)} sub={`${fmtNumber(t.chips_rebuy || 0)} fichas`} />
                    <Pill label="Rebuy duplo" v={fmtBRL(t.double_rebuy || 0)} sub={`${fmtNumber(t.chips_double_rebuy || 0)} fichas`} />
                    <Pill label="Add-on / Super" v={`${fmtBRL(t.addon_simple)} · ${fmtBRL(t.super_addon)}`} sub={`${fmtNumber(t.chips_addon || 0)}/${fmtNumber(t.chips_super_addon || 0)}`} />
                    <Pill label="Bônus" v={fmtBRL(t.bonus)} sub={`${fmtNumber(t.chips_bonus || 0)} fichas`} />
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                <FinStat icon={Users2} label="Inscrições" v={`${fmtNumber(totals.entries)}${totals.double_entries ? ` (+${totals.double_entries})` : ""}`} />
                <FinStat icon={Coins} label="Bruto" v={fmtBRL(totals.gross)} />
                <FinStat icon={Crown} label="Rake" v={fmtBRL(totals.rake)} accent="warning" />
                <FinStat icon={Trophy} label="Prize Pool" v={fmtBRL(totals.prize_pool)} accent="success" />
                <FinStat icon={Layers} label="Fichas em Jogo" v={fmtNumber(totals.total_chips || 0)} accent="primary" />
            </div>

            {/* Inscrições + ações */}
            <div className="rounded-2xl bg-surface border border-white/5 overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-white/5">
                    <div>
                        <h3 className="font-heading text-xl font-semibold">Inscritos</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Use os botões rápidos para registrar ações na mesa.</p>
                    </div>
                    <div className="flex items-center gap-2">
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
                                <th className="text-center py-3 px-2" title="Entrada dupla">2x</th>
                                <th className="text-center py-3 px-2">Re</th>
                                <th className="text-center py-3 px-2" title="Rebuy duplo">Re2x</th>
                                <th className="text-center py-3 px-2">Add</th>
                                <th className="text-center py-3 px-2">Sup</th>
                                <th className="text-center py-3 px-2">Bn</th>
                                <th className="text-right py-3 px-4">Fichas</th>
                                <th className="text-right py-3 px-4">Total</th>
                                <th className="text-right py-3 px-4">Pago</th>
                                <th className="text-right py-3 px-4">Pos.</th>
                                <th className="text-right py-3 px-4">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.length === 0 && <tr><td colSpan={12} className="text-center text-muted-foreground py-12">Nenhuma inscrição.</td></tr>}
                            {entries.map((e) => (
                                <tr key={e.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                                    <td className="py-3 px-4">
                                        <Link to={`/jogadores/${e.player_id}`} className="font-medium hover:text-primary">{e.player_name}</Link>
                                        {e.pending_amount > 0 && <div className="text-[10px] text-warning uppercase tracking-widest mt-0.5">Pendente {fmtBRL(e.pending_amount)}</div>}
                                    </td>
                                    <td className="text-center font-mono">{e.double_entries || 0}</td>
                                    <td className="text-center font-mono">{e.rebuys}</td>
                                    <td className="text-center font-mono">{e.double_rebuys || 0}</td>
                                    <td className="text-center font-mono">{e.addons_simple}</td>
                                    <td className="text-center font-mono">{e.super_addons}</td>
                                    <td className="text-center">{e.bonus ? "✓" : "—"}</td>
                                    <td className="text-right font-mono text-primary font-semibold">{fmtNumber(e.total_chips || 0)}</td>
                                    <td className="text-right font-mono">{fmtBRL(e.total_spent)}</td>
                                    <td className="text-right font-mono text-success">{fmtBRL(e.paid_amount)}</td>
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
                                            <ActBtn label="Entrada dupla" icon={CircleDollarSign} onClick={() => action(e.id, "double_entry")} testid={`act-double-entry-${e.id}`} />
                                            <ActBtn label="Rebuy" icon={RotateCw} onClick={() => action(e.id, "rebuy")} testid={`act-rebuy-${e.id}`} />
                                            <ActBtn label="Rebuy duplo" icon={RefreshCw} onClick={() => action(e.id, "double_rebuy")} testid={`act-double-rebuy-${e.id}`} />
                                            <ActBtn label="Add-on" icon={PackagePlus} onClick={() => action(e.id, "addon")} testid={`act-addon-${e.id}`} />
                                            <ActBtn label="Super" icon={Layers} onClick={() => action(e.id, "super_addon")} testid={`act-super-${e.id}`} />
                                            <ActBtn label="Bônus" icon={Sparkles} onClick={() => action(e.id, "bonus")} disabled={e.bonus} testid={`act-bonus-${e.id}`} accent />
                                        </div>
                                    </td>
                                </tr>
                            ))}
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

const FinStat = ({ icon: Icon, label, v, accent = "primary" }) => (
    <div className="rounded-2xl bg-surface border border-white/5 p-4 flex items-center gap-3">
        <div className={`size-10 rounded-lg flex items-center justify-center bg-${accent}/10 border border-${accent}/20`}>
            <Icon className={`size-4 text-${accent}`} strokeWidth={1.6} />
        </div>
        <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className="font-mono text-lg font-bold">{v}</div>
        </div>
    </div>
);

const ActBtn = ({ icon: Icon, label, onClick, disabled, accent, testid }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        data-testid={testid}
        title={label}
        className={`size-8 rounded-md flex items-center justify-center transition-all border ${disabled ? "opacity-40 cursor-not-allowed border-white/5" : accent ? "bg-primary/10 hover:bg-primary/20 border-primary/30 text-primary" : "border-white/10 hover:bg-white/5 hover:border-white/20"}`}
    >
        <Icon className="size-4" strokeWidth={1.6} />
    </button>
);
