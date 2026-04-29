import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fmtBRL, fmtDateTime, apiErr } from "@/lib/format";
import { Landmark, Coins, FileText, AlertCircle, CheckCircle2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function RakeReport() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/cashier/rake/history?days=30");
            setHistory(data);
        } catch (e) { toast.error(apiErr(e)); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    // Filter real transactions (Manual entries)
    const realRake = history.filter(t => t.type === "income" && t?.description?.includes("Rake")).reduce((s, t) => s + t.amount, 0);
    const realJack = history.filter(t => (t.type === "income" || t.type === "jackpot_in") && t?.description?.includes("Jackpot")).reduce((s, t) => s + t.amount, 0);

    // Filter projections (Automatic calculations)
    const projRake = history.filter(t => t.type === "projection_rake").reduce((s, t) => s + t.amount, 0);
    const projJack = history.filter(t => t.type === "projection_jackpot").reduce((s, t) => s + t.amount, 0);

    const variance = realRake - projRake;

    return (
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto animate-fade-in-up">
            <div className="mb-8">
                <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-2">Financeiro · Auditoria</div>
                <h1 className="text-4xl font-heading font-bold tracking-tight">Relatório de Rake</h1>
                <p className="text-sm text-muted-foreground mt-1">Conferência entre o Rake Real (lançado manualmente) e o Projetado (calculado pelo sistema).</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="rounded-2xl bg-surface border border-white/5 p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CheckCircle2 className="size-12 text-primary" />
                    </div>
                    <div className="flex items-center gap-3 mb-4 text-muted-foreground uppercase text-[10px] tracking-widest">
                        <Landmark className="size-4 text-primary" /> Rake Real (Manual)
                    </div>
                    <div className="text-3xl font-heading font-bold text-primary">{fmtBRL(realRake)}</div>
                    <div className="text-[10px] text-muted-foreground mt-2">Valores confirmados no caixa</div>
                </div>

                <div className="rounded-2xl bg-surface border border-white/5 p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="size-12 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-3 mb-4 text-muted-foreground uppercase text-[10px] tracking-widest">
                        <TrendingUp className="size-4 text-muted-foreground" /> Rake Projetado (Auto)
                    </div>
                    <div className="text-3xl font-heading font-bold text-muted-foreground">{fmtBRL(projRake)}</div>
                    <div className="text-[10px] text-muted-foreground mt-2">Expectativa baseada no jogo</div>
                </div>

                <div className={`rounded-2xl bg-surface border border-white/5 p-6 relative overflow-hidden group ${variance < 0 ? "border-destructive/30" : "border-success/30"}`}>
                    <div className="flex items-center gap-3 mb-4 text-muted-foreground uppercase text-[10px] tracking-widest">
                        <AlertCircle className={`size-4 ${variance < 0 ? "text-destructive" : "text-success"}`} /> Desvio / Variância
                    </div>
                    <div className={`text-3xl font-heading font-bold ${variance < 0 ? "text-destructive" : "text-success"}`}>
                        {variance > 0 ? "+" : ""}{fmtBRL(variance)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-2">Diferença entre Real e Projetado</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="rounded-2xl bg-surface border border-white/5 p-5">
                    <div className="flex items-center gap-3 mb-4 text-muted-foreground uppercase text-[10px] tracking-widest">
                        <Coins className="size-4 text-amber-500" /> Jackpot Real: <span className="text-foreground ml-1 font-bold">{fmtBRL(realJack)}</span>
                    </div>
                </div>
                <div className="rounded-2xl bg-surface border border-white/5 p-5">
                    <div className="flex items-center gap-3 mb-4 text-muted-foreground uppercase text-[10px] tracking-widest">
                        <TrendingUp className="size-4 text-muted-foreground" /> Jackpot Projetado: <span className="text-foreground ml-1 font-bold">{fmtBRL(projJack)}</span>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl bg-surface border border-white/5 overflow-hidden">
                <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <h3 className="font-heading font-semibold flex items-center gap-2"><FileText className="size-4 text-muted-foreground" /> Auditoria de Lançamentos</h3>
                    <div className="text-xs text-muted-foreground">Últimos 30 dias</div>
                </div>
                <table className="w-full text-sm text-left">
                    <thead>
                        <tr className="bg-surface-elevated text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            <th className="py-3 px-4 font-medium">Data/Hora</th>
                            <th className="py-3 px-4 font-medium">Tipo</th>
                            <th className="py-3 px-4 font-medium">Descrição</th>
                            <th className="py-3 px-4 font-medium text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td colSpan={4} className="text-center py-12 text-muted-foreground animate-pulse">Carregando auditoria...</td></tr>}
                        {!loading && history.length === 0 && <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">Nenhum registro encontrado.</td></tr>}
                        {history.map((t) => (
                            <tr key={t.id} className="border-t border-white/5 hover:bg-white/[0.01]">
                                <td className="py-3 px-4 text-muted-foreground">{fmtDateTime(t.created_at)}</td>
                                <td className="py-3 px-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${t.type.startsWith("projection") ? "bg-white/5 text-muted-foreground" : "bg-primary/10 text-primary border border-primary/20"}`}>
                                        {t.type.startsWith("projection") ? "Projeção" : "Real"}
                                    </span>
                                </td>
                                <td className="py-3 px-4 font-medium">{t.description}</td>
                                <td className="py-3 px-4 text-right font-mono font-bold">{fmtBRL(t.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
