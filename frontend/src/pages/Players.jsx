import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, UserCog, AlertTriangle } from "lucide-react";
import { fmtBRL, fmtDate, apiErr } from "@/lib/format";
import { toast } from "sonner";

export default function Players() {
    const [players, setPlayers] = useState([]);
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
    const [saving, setSaving] = useState(false);

    const load = async () => {
        const { data } = await api.get(`/players${q ? `?q=${encodeURIComponent(q)}` : ""}`);
        setPlayers(data.items || data);
    };

    useEffect(() => {
        const t = setTimeout(load, 250);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post("/players", form);
            toast.success("Jogador cadastrado");
            setOpen(false);
            setForm({ name: "", email: "", phone: "", notes: "" });
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
                    <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-2">CRM</div>
                    <h1 className="text-4xl font-heading font-bold tracking-tight">Jogadores</h1>
                    <p className="text-sm text-muted-foreground mt-1">Cadastro, histórico, dívidas e ROI.</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button data-testid="add-player-button" className="bg-primary text-primary-foreground hover:bg-primary/90">
                            <Plus className="size-4" /> Novo jogador
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-surface border-white/10">
                        <DialogHeader>
                            <DialogTitle>Cadastrar jogador</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={submit} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Nome completo</Label>
                                <Input data-testid="player-name-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-surface-elevated border-white/10" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">E-mail</Label>
                                    <Input data-testid="player-email-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-surface-elevated border-white/10" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Telefone</Label>
                                    <Input data-testid="player-phone-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-surface-elevated border-white/10" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Observações</Label>
                                <Textarea data-testid="player-notes-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="bg-surface-elevated border-white/10" />
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={saving} data-testid="save-player-button" className="bg-primary text-primary-foreground hover:bg-primary/90">
                                    {saving ? "Salvando..." : "Salvar"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="mb-6 relative max-w-md">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                    data-testid="player-search-input"
                    placeholder="Buscar por nome..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="pl-10 bg-surface-elevated border-white/10 h-11"
                />
            </div>

            <div className="rounded-2xl bg-surface border border-white/5 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-surface-elevated text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            <th className="text-left py-3 px-4">Nome</th>
                            <th className="text-left py-3 px-4 hidden md:table-cell">Contato</th>
                            <th className="text-left py-3 px-4 hidden md:table-cell">Cadastro</th>
                            <th className="text-right py-3 px-4">Dívida</th>
                            <th className="w-12"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {players.length === 0 && (
                            <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Nenhum jogador encontrado.</td></tr>
                        )}
                        {players.map((p) => (
                            <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                                <td className="py-3 px-4">
                                    <Link to={`/jogadores/${p.id}`} className="font-medium hover:text-primary" data-testid={`player-link-${p.id}`}>
                                        {p.name}
                                    </Link>
                                </td>
                                <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">
                                    {p.email || "—"} · {p.phone || "—"}
                                </td>
                                <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">{fmtDate(p.created_at)}</td>
                                <td className="py-3 px-4 text-right">
                                    {p.debt_balance > 0 ? (
                                        <span className="inline-flex items-center gap-1.5 text-destructive font-mono">
                                            <AlertTriangle className="size-3.5" /> {fmtBRL(p.debt_balance)}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground font-mono">{fmtBRL(0)}</span>
                                    )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                    <Link to={`/jogadores/${p.id}`}>
                                        <UserCog className="size-4 text-muted-foreground hover:text-primary inline" />
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
