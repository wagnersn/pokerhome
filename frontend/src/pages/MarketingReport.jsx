import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fmtBRL, fmtDateTime, apiErr, fmtNumber } from "@/lib/format";
import { Trophy, Users, Megaphone, Calendar, TrendingUp, DollarSign, Target, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function MarketingReport() {
    const [data, setData] = useState(null);
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/tournaments/stats/marketing?days=${days}`);
            setData(res.data);
        } catch (e) {
            toast.error(apiErr(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [days]);

    if (!data && loading) return <div className="p-10 text-center animate-pulse text-muted-foreground">Carregando estatísticas...</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-2 font-bold">Marketing & Business Intelligence</div>
                    <h1 className="text-4xl font-heading font-bold tracking-tight">Crescimento & Volume</h1>
                    <p className="text-sm text-muted-foreground mt-1">Estatísticas consolidadas para propaganda e análise de movimentação.</p>
                </div>

                <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-xl border border-white/5">
                    {[7, 30, 90, 365].map((d) => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                days === d ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                            }`}
                        >
                            {d === 365 ? "1 Ano" : `${d} Dias`}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard 
                    icon={Trophy} 
                    label="Premiação Total" 
                    value={fmtBRL(data?.total_prize_pool || 0)} 
                    sub={`${data?.total_tournaments || 0} torneios realizados`}
                    accent="primary"
                />
                <StatCard 
                    icon={Target} 
                    label="Média de Prize Pool" 
                    value={fmtBRL(data?.avg_prize_pool || 0)} 
                    sub="Por torneio realizado"
                    accent="success"
                />
                <StatCard 
                    icon={Users} 
                    label="Público Total" 
                    value={fmtNumber(data?.total_entries || 0)} 
                    sub="Entradas registradas"
                    accent="warning"
                />
                <StatCard 
                    icon={TrendingUp} 
                    label="Média de Jogadores" 
                    value={fmtNumber(data?.avg_entries || 0)} 
                    sub="Por evento"
                    accent="primary"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-2xl bg-surface border border-white/5 overflow-hidden">
                    <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <h3 className="font-heading font-semibold flex items-center gap-2">
                            <Calendar className="size-4 text-muted-foreground" /> Histórico de Volume
                        </h3>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Últimos {days} dias</div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="bg-surface-elevated text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                    <th className="py-3 px-6 font-medium">Torneio</th>
                                    <th className="py-3 px-6 font-medium">Data</th>
                                    <th className="py-3 px-6 font-medium text-center">Jogadores</th>
                                    <th className="py-3 px-6 font-medium text-right">Prize Pool</th>
                                    <th className="py-3 px-6 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {data?.history?.map((t) => (
                                    <tr key={t.id} className="group hover:bg-white/[0.01] transition-colors">
                                        <td className="py-4 px-6 font-medium">{t.name}</td>
                                        <td className="py-4 px-6 text-muted-foreground text-xs">{fmtDateTime(t.date)}</td>
                                        <td className="py-4 px-6 text-center font-mono">{t.entries}</td>
                                        <td className="py-4 px-6 text-right font-mono font-bold text-success">{fmtBRL(t.prize_pool)}</td>
                                        <td className="py-4 px-6">
                                            <Link to={`/torneios/${t.id}`} className="text-muted-foreground hover:text-primary transition-colors">
                                                <ArrowUpRight className="size-4" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {(!data?.history || data.history.length === 0) && (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center text-muted-foreground italic">
                                            Nenhum torneio finalizado neste período.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-amber-900/20 border border-primary/20 p-6 relative overflow-hidden">
                        <Megaphone className="absolute -bottom-4 -right-4 size-32 text-primary/10 -rotate-12" />
                        <h3 className="text-xl font-heading font-bold mb-2">Pronto para Divulgar?</h3>
                        <p className="text-sm text-primary-foreground/70 mb-6">
                            Use estes números em suas redes sociais para atrair mais jogadores. Torneios com grandes prize pools geram credibilidade para a casa.
                        </p>
                        <div className="space-y-3">
                            <PromotionTip text={`"Já pagamos mais de ${fmtBRL(data?.total_prize_pool || 0)} em prêmios nos últimos ${days} dias!"`} />
                            <PromotionTip text={`"Nossa média de prize pool por torneio é de ${fmtBRL(data?.avg_prize_pool || 0)}!"`} />
                        </div>
                    </div>

                    <div className="rounded-2xl bg-surface border border-white/5 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="size-4 text-primary" />
                            <h4 className="font-heading font-semibold">Resumo Operacional</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                <span className="text-xs text-muted-foreground uppercase tracking-widest">Rake Total</span>
                                <span className="font-mono font-bold">{fmtBRL(data?.total_rake || 0)}</span>
                            </div>
                            <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                <span className="text-xs text-muted-foreground uppercase tracking-widest">Inscrições/Dia</span>
                                <span className="font-mono font-bold">{(data?.total_entries / days).toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between items-end">
                                <span className="text-xs text-muted-foreground uppercase tracking-widest">Volume/Torneio</span>
                                <span className="font-mono font-bold">{fmtBRL((data?.total_prize_pool + data?.total_rake) / (data?.total_tournaments || 1))}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, sub, accent }) {
    const accents = {
        primary: "bg-primary/10 border-primary/20 text-primary",
        success: "bg-success/10 border-success/20 text-success",
        warning: "bg-warning/10 border-warning/20 text-warning",
    };

    return (
        <div className="rounded-2xl bg-surface border border-white/5 p-6 transition-all hover:border-white/10 hover:translate-y-[-2px]">
            <div className={`size-10 rounded-xl flex items-center justify-center mb-4 ${accents[accent] || accents.primary}`}>
                <Icon className="size-5" />
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1 font-semibold">{label}</div>
            <div className="text-2xl font-heading font-bold tracking-tight mb-1">{value}</div>
            <div className="text-xs text-muted-foreground font-medium">{sub}</div>
        </div>
    );
}

function PromotionTip({ text }) {
    return (
        <div className="bg-black/20 backdrop-blur-sm border border-white/5 p-3 rounded-xl text-xs font-medium italic text-primary-foreground/90 leading-relaxed">
            {text}
        </div>
    );
}
