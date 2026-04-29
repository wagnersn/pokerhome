import React, { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trophy, Filter, Crown, Calendar as CalendarIcon } from "lucide-react";
import { fmtNumber } from "@/lib/format";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function DatePicker({ date, setDate, placeholder = "Selecione" }) {
  const selectedDate = date ? new Date(date + "T12:00:00") : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal bg-surface-elevated border-white/10 hover:bg-white/5",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-surface-elevated border-white/10" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(d) => {
            if (d) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                setDate(`${year}-${month}-${day}`);
            } else {
                setDate("");
            }
          }}
          initialFocus
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  );
}

export default function Rankings() {
    const [tournaments, setTournaments] = useState([]);
    const [filterMode, setFilterMode] = useState("all"); // all | type | select
    const [type, setType] = useState("");
    const [selectedIds, setSelectedIds] = useState([]);
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [discards, setDiscards] = useState(0);
    const [data, setData] = useState({ ranking: [], count: 0, tournaments: [] });

    useEffect(() => {
        (async () => {
            const { data } = await api.get("/tournaments");
            setTournaments(data);
        })();
    }, []);

    const types = useMemo(() => Array.from(new Set(tournaments.map((t) => t.type))).sort(), [tournaments]);

    useEffect(() => {
        const params = new URLSearchParams();
        if (filterMode === "type" && type) params.append("types", type);
        if (filterMode === "select" && selectedIds.length) params.append("tournament_ids", selectedIds.join(","));
        if (from) params.append("date_from", from);
        if (to) params.append("date_to", to);
        if (discards > 0) params.append("discards", discards);
        api.get(`/rankings${params.toString() ? `?${params.toString()}` : ""}`).then(({ data }) => setData(data));
    }, [filterMode, type, selectedIds, from, to, discards]);

    return (
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto animate-fade-in-up">
            <div className="mb-8">
                <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-2">Performance</div>
                <h1 className="text-4xl font-heading font-bold tracking-tight">Ranking</h1>
                <p className="text-sm text-muted-foreground mt-1">Acompanhe os melhores jogadores do clube com filtros avançados.</p>
            </div>

            {/* Filtros */}
            <div className="rounded-2xl bg-surface border border-white/5 p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="size-4 text-muted-foreground" />
                    <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Filtros</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Modo</Label>
                        <Select value={filterMode} onValueChange={setFilterMode}>
                            <SelectTrigger data-testid="filter-mode-select" className="bg-surface-elevated border-white/10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os torneios</SelectItem>
                                <SelectItem value="type">Por tipo</SelectItem>
                                <SelectItem value="select">Selecionar torneios</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {filterMode === "type" && (
                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Tipo</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger data-testid="filter-type-select" className="bg-surface-elevated border-white/10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                    {types.map((tp) => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">De</Label>
                        <DatePicker date={from} setDate={setFrom} />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Até</Label>
                        <DatePicker date={to} setDate={setTo} />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-widest text-muted-foreground" title="Exclui as piores pontuações do jogador">Descartes</Label>
                        <Input type="number" min="0" value={discards} onChange={(e) => setDiscards(Number(e.target.value) || 0)} className="bg-surface-elevated border-white/10" />
                    </div>
                </div>
                {filterMode === "select" && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto scrollbar-thin">
                        {tournaments.map((t) => (
                            <label key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface-elevated border border-white/5 cursor-pointer hover:border-white/10">
                                <Checkbox
                                    data-testid={`filter-tour-${t.id}`}
                                    checked={selectedIds.includes(t.id)}
                                    onCheckedChange={(v) => setSelectedIds(v ? [...selectedIds, t.id] : selectedIds.filter((x) => x !== t.id))}
                                />
                                <span className="text-sm">{t.name}</span>
                                <span className="ml-auto text-xs text-muted-foreground">{t.type}</span>
                            </label>
                        ))}
                    </div>
                )}
                <div className="mt-4 text-xs text-muted-foreground">
                    {data.tournaments?.length || 0} torneios considerados · {data.count} jogadores no ranking
                </div>
            </div>

            {/* Ranking list */}
            <div className="rounded-2xl bg-surface border border-white/5 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-surface-elevated text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            <th className="text-left py-3 px-4 w-16">#</th>
                            <th className="text-left py-3 px-4">Jogador</th>
                            <th className="text-center py-3 px-4 hidden sm:table-cell">Torneios</th>
                            <th className="text-center py-3 px-4 hidden sm:table-cell">ITM</th>
                            <th className="text-center py-3 px-4 hidden md:table-cell">Melhor</th>
                            <th className="text-right py-3 px-4">Pontos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.ranking.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-12">Nenhuma pontuação registrada ainda.</td></tr>}
                        {data.ranking.map((r) => (
                            <tr key={r.player_id} data-testid={`rank-row-${r.player_id}`} className="border-t border-white/5 hover:bg-white/[0.02]">
                                <td className="py-3 px-4">
                                    {r.rank <= 3 ? (
                                        <div className="flex items-center gap-2">
                                            <Crown className={`size-4 ${r.rank === 1 ? "text-primary" : r.rank === 2 ? "text-gold-soft" : "text-amber-700"}`} />
                                            <span className="font-mono font-bold">{r.rank}</span>
                                        </div>
                                    ) : <span className="font-mono text-muted-foreground">{r.rank}</span>}
                                </td>
                                <td className="py-3 px-4 font-medium">{r.player_name}</td>
                                <td className="text-center font-mono hidden sm:table-cell">{fmtNumber(r.tournaments)}</td>
                                <td className="text-center font-mono hidden sm:table-cell">{fmtNumber(r.itm)}</td>
                                <td className="text-center hidden md:table-cell">{r.best_position ? `#${r.best_position}` : "—"}</td>
                                <td className="text-right py-3 px-4 font-mono font-semibold text-primary">{fmtNumber(r.total_points)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
