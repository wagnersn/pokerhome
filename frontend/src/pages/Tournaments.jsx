import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Link } from "react-router-dom";
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
import { Plus, Trophy, Calendar, Users2, Coins } from "lucide-react";
import { fmtBRL, fmtDateTime, apiErr } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const STATUS_LABEL = {
    scheduled: { label: "Agendado", cls: "bg-secondary text-secondary-foreground" },
    in_progress: { label: "Em andamento", cls: "bg-success/15 text-success border border-success/30" },
    finished: { label: "Finalizado", cls: "bg-muted text-muted-foreground" },
};

export default function Tournaments() {
    const { user } = useAuth();
    const [list, setList] = useState([]);
    const [pointStructures, setPS] = useState([]);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: "",
        type: "NLHE Daily",
        start_at: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
        buy_in: 100,
        rake: 20,
        double_buyin: 200,
        rebuy: 100,
        double_rebuy: 200,
        addon_simple: 50,
        super_addon: 100,
        bonus: 0,
        chips_buy_in: 20000,
        chips_double_buyin: 40000,
        chips_rebuy: 20000,
        chips_double_rebuy: 40000,
        chips_addon: 10000,
        chips_super_addon: 25000,
        chips_bonus: 5000,
        point_structure_id: "",
        notes: "",
    });

    const load = async () => {
        const [t, p] = await Promise.all([api.get("/tournaments"), api.get("/point-structures")]);
        setList(t.data);
        setPS(p.data);
    };

    useEffect(() => { load(); }, []);

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const body = {
                ...form,
                buy_in: Number(form.buy_in),
                rake: Number(form.rake),
                rebuy: Number(form.rebuy),
                addon_simple: Number(form.addon_simple),
                super_addon: Number(form.super_addon),
                bonus: Number(form.bonus),
                start_at: new Date(form.start_at).toISOString(),
                point_structure_id: form.point_structure_id || null,
            };
            await api.post("/tournaments", body);
            toast.success("Torneio criado");
            setOpen(false);
            await load();
        } catch (err) {
            toast.error(apiErr(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto animate-fade-in-up">
            <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-2">Eventos</div>
                    <h1 className="text-4xl font-heading font-bold tracking-tight">Torneios</h1>
                    <p className="text-sm text-muted-foreground mt-1">Crie torneios, gerencie inscrições e calcule prêmios.</p>
                </div>
                {user?.role === "admin" && (
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button data-testid="add-tournament-button" className="bg-primary text-primary-foreground hover:bg-primary/90">
                                <Plus className="size-4" /> Novo torneio
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-surface border-white/10 max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Cadastrar torneio</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={submit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5 col-span-2">
                                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Nome</Label>
                                        <Input data-testid="tour-name-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-surface-elevated border-white/10" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Tipo</Label>
                                        <Input data-testid="tour-type-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="bg-surface-elevated border-white/10" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Data/Hora</Label>
                                        <Input data-testid="tour-start-input" type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} className="bg-surface-elevated border-white/10" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="text-[10px] uppercase tracking-[0.22em] text-primary">Valores (R$)</div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <Money label="Buy-in" value={form.buy_in} on={(v) => setForm({ ...form, buy_in: v })} testid="tour-buyin" />
                                        <Money label="Taxa (Rake)" value={form.rake} on={(v) => setForm({ ...form, rake: v })} testid="tour-rake" />
                                        <Money label="Entrada dupla" value={form.double_buyin} on={(v) => setForm({ ...form, double_buyin: v })} testid="tour-doublebuyin" />
                                        <Money label="Rebuy" value={form.rebuy} on={(v) => setForm({ ...form, rebuy: v })} testid="tour-rebuy" />
                                        <Money label="Rebuy duplo" value={form.double_rebuy} on={(v) => setForm({ ...form, double_rebuy: v })} testid="tour-doublerebuy" />
                                        <Money label="Add-on" value={form.addon_simple} on={(v) => setForm({ ...form, addon_simple: v })} testid="tour-addon" />
                                        <Money label="Super Add-on" value={form.super_addon} on={(v) => setForm({ ...form, super_addon: v })} testid="tour-superaddon" />
                                        <Money label="Bônus / Staff" value={form.bonus} on={(v) => setForm({ ...form, bonus: v })} testid="tour-bonus" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="text-[10px] uppercase tracking-[0.22em] text-primary">Fichas por ação</div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <Chips label="Buy-in" value={form.chips_buy_in} on={(v) => setForm({ ...form, chips_buy_in: v })} testid="tour-chips-buyin" />
                                        <Chips label="Entrada dupla" value={form.chips_double_buyin} on={(v) => setForm({ ...form, chips_double_buyin: v })} testid="tour-chips-doublebuyin" />
                                        <Chips label="Rebuy" value={form.chips_rebuy} on={(v) => setForm({ ...form, chips_rebuy: v })} testid="tour-chips-rebuy" />
                                        <Chips label="Rebuy duplo" value={form.chips_double_rebuy} on={(v) => setForm({ ...form, chips_double_rebuy: v })} testid="tour-chips-doublerebuy" />
                                        <Chips label="Add-on" value={form.chips_addon} on={(v) => setForm({ ...form, chips_addon: v })} testid="tour-chips-addon" />
                                        <Chips label="Super Add-on" value={form.chips_super_addon} on={(v) => setForm({ ...form, chips_super_addon: v })} testid="tour-chips-superaddon" />
                                        <Chips label="Bônus" value={form.chips_bonus} on={(v) => setForm({ ...form, chips_bonus: v })} testid="tour-chips-bonus" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Estrutura de pontos</Label>
                                    <Select value={form.point_structure_id || "none"} onValueChange={(v) => setForm({ ...form, point_structure_id: v === "none" ? "" : v })}>
                                        <SelectTrigger data-testid="tour-points-select" className="bg-surface-elevated border-white/10">
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Sem pontuação</SelectItem>
                                            {pointStructures.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Observações</Label>
                                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="bg-surface-elevated border-white/10" />
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={saving} data-testid="save-tournament-button" className="bg-primary text-primary-foreground hover:bg-primary/90">
                                        {saving ? "Salvando..." : "Criar torneio"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.length === 0 && <div className="text-sm text-muted-foreground col-span-full text-center py-12">Nenhum torneio cadastrado.</div>}
                {list.map((t) => {
                    const s = STATUS_LABEL[t.status] || STATUS_LABEL.scheduled;
                    return (
                        <Link
                            key={t.id}
                            to={`/torneios/${t.id}`}
                            data-testid={`tour-card-${t.id}`}
                            className="rounded-2xl bg-surface border border-white/5 p-5 hover:border-primary/40 transition-all hover:-translate-y-0.5 block group"
                        >
                            <div className="flex items-start justify-between">
                                <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <Trophy className="size-5 text-primary" strokeWidth={1.6} />
                                </div>
                                <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${s.cls}`}>{s.label}</span>
                            </div>
                            <div className="mt-4 font-heading text-lg font-semibold tracking-tight group-hover:text-primary">{t.name}</div>
                            <div className="text-xs text-muted-foreground">{t.type}</div>
                            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="size-3.5" /> {fmtDateTime(t.start_at)}
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <div className="text-muted-foreground text-[10px] uppercase tracking-widest">Buy-in</div>
                                    <div className="font-mono font-semibold">{fmtBRL(t.buy_in + t.rake)}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground text-[10px] uppercase tracking-widest">Rebuy</div>
                                    <div className="font-mono">{fmtBRL(t.rebuy)}</div>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

const Money = ({ label, value, on, testid }) => (
    <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
        <Input data-testid={testid} type="number" min="0" step="0.01" value={value} onChange={(e) => on(e.target.value)} className="bg-surface-elevated border-white/10 font-mono" />
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
