"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase, Player, Match } from '@/lib/supabase';
import { Trophy, Activity, History, X, Target, Users, User } from 'lucide-react';

export default function Chronicle() {
    // --- STATE ---
    const [players, setPlayers] = useState<Player[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [view, setView] = useState<'players' | 'teams'>('players');

    // Modals
    const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
    const [isTeamCreatorOpen, setIsTeamCreatorOpen] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

    // Form States
    const [playerName, setPlayerName] = useState('');
    const [teamName, setTeamName] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [winnerId, setWinnerId] = useState('');
    const [loserId, setLoserId] = useState('');
    const [gameName, setGameName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- DATA LOADING (FIXED CASCADING RENDER) ---
    //
    const loadData = useCallback(async () => {
        const { data: pData } = await supabase.from('players').select('*').order('rating', { ascending: false });
        const { data: mData } = await supabase.from('matches').select('*').order('created_at', { ascending: false });
        const { data: tData } = await supabase.from('teams').select('*').order('rating', { ascending: false });

        if (pData) setPlayers(pData);
        if (mData) setMatches(mData);
        if (tData) setTeams(tData);
    }, []);

    useEffect(() => {
        let isMounted = true;
        const init = async () => {
            const { data: pData } = await supabase.from('players').select('*').order('rating', { ascending: false });
            const { data: mData } = await supabase.from('matches').select('*').order('created_at', { ascending: false });
            const { data: tData } = await supabase.from('teams').select('*').order('rating', { ascending: false });

            if (isMounted) {
                setPlayers(pData || []);
                setMatches(mData || []);
                setTeams(tData || []);
            }
        };
        init();
        return () => { isMounted = false; };
    }, []);

    const getPlayerStats = (name: string) => {
        const wins = matches.filter(m => m.winner_name === name);
        const counts: Record<string, number> = {};
        wins.forEach(m => {
            if (m.game_name) counts[m.game_name] = (counts[m.game_name] || 0) + 1;
        });
        return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 10);
    };

    // --- SEQUENTIAL RELATIONAL UPDATES ---
    async function recordMatch(e: React.FormEvent) {
        e.preventDefault();
        if (!winnerId || !loserId || !gameName.trim() || winnerId === loserId) return;
        setIsSubmitting(true);

        try {
            const source = view === 'players' ? players : teams;
            const winner = source.find(s => s.id === winnerId)!;
            const loser = source.find(s => s.id === loserId)!;

            const change = Math.round(32 * (1 - (1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400)))));
            const table = view === 'players' ? 'players' : 'teams';

            // 1. Update primary entities
            await supabase.from(table).update({ rating: winner.rating + change, wins: (winner.wins || 0) + 1 }).eq('id', winner.id);
            await supabase.from(table).update({ rating: loser.rating - change, losses: (loser.losses || 0) + 1 }).eq('id', loser.id);
            await supabase.from('matches').insert([{ winner_name: winner.name, loser_name: loser.name, rating_change: change, game_name: gameName.trim() }]);

            // 2. Trickle-down logic for team matches
            if (view === 'teams') {
                const { data: winMembers } = await supabase.from('team_members').select('player_id').eq('team_id', winner.id);
                const { data: loseMembers } = await supabase.from('team_members').select('player_id').eq('team_id', loser.id);

                if (winMembers) {
                    for (const m of winMembers) {
                        const p = players.find(player => player.id === m.player_id);
                        if (p) await supabase.from('players').update({ rating: p.rating + Math.round(change / 2), wins: (p.wins || 0) + 1 }).eq('id', p.id);
                    }
                }
                if (loseMembers) {
                    for (const m of loseMembers) {
                        const p = players.find(player => player.id === m.player_id);
                        if (p) await supabase.from('players').update({ rating: p.rating - Math.round(change / 2), losses: (p.losses || 0) + 1 }).eq('id', p.id);
                    }
                }
            }

            setIsMatchModalOpen(false);
            setWinnerId('');
            setLoserId('');
            setGameName('');
            await loadData();
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8 md:p-12 font-mono">
            <div className="max-w-6xl mx-auto">
                {/* HEADER */}
                <header className="mb-16 flex flex-col md:flex-row justify-between items-start gap-8 border-b border-zinc-900 pb-12">
                    <div>
                        <h1 className="text-5xl font-black italic tracking-tighter flex items-center gap-4 text-white uppercase">
                            <Trophy className="text-yellow-500" size={48} /> Chronicle
                        </h1>
                        <p className="text-zinc-600 text-[10px] uppercase tracking-[0.5em] font-bold mt-2">Boardgame ELO System</p>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setView(view === 'players' ? 'teams' : 'players')} className="w-32 h-32 flex flex-col items-center justify-center gap-3 bg-zinc-900 border border-zinc-800 rounded-3xl hover:bg-zinc-800 transition-all shadow-lg">
                            <Users className={view === 'teams' ? 'text-yellow-500' : 'text-yellow-500'} size={28} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center px-4 leading-tight">Switch<br />View</span>
                        </button>
                        <button onClick={() => setIsMatchModalOpen(true)} className="w-32 h-32 flex flex-col items-center justify-center gap-3 bg-white text-black rounded-3xl hover:bg-zinc-200 active:scale-95 transition-all shadow-2xl">
                            <Activity className="text-yellow-500"  size={32} />
                            <span className="text-[11px] font-black uppercase tracking-widest text-center px-4 leading-tight">Record<br />Match</span>
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <div className="lg:col-span-2 space-y-10">
                        <div className="flex justify-between items-center px-2">
                            <h2 className="text-2xl font-black tracking-tighter uppercase flex items-center gap-3 text-white">
                                {view === 'players' ? <User className="text-yellow-500" size={28} /> : <Users className="text-blue-500" size={28} />}
                                {view === 'players' ? 'Player Rankings' : 'Team Roster'}
                            </h2>
                            {view === 'teams' && (
                                <button onClick={() => setIsTeamCreatorOpen(true)} className="px-5 py-2.5 text-[11px] font-black bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all uppercase tracking-widest shadow-lg shadow-blue-500/20">
                                    + Create Team
                                </button>
                            )}
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                            <table className="w-full text-left">
                                <thead className="bg-zinc-950 text-zinc-500 text-[9px] uppercase tracking-[0.2em]">
                                    <tr><th className="p-6">Rank</th><th className="p-6">Entity</th><th className="p-6 text-center">ELO</th><th className="p-6 text-right">Performance</th></tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800">
                                    {(view === 'players' ? players : teams).map((item, i) => (
                                        <tr key={item.id} onClick={() => view === 'players' && setSelectedPlayer(item)} className="hover:bg-white/[0.04] cursor-pointer transition-all group">
                                            <td className="p-6 text-zinc-700 font-black italic text-xl">#{i + 1}</td>
                                            <td className={`p-6 font-black text-2xl ${view === 'teams' ? 'text-blue-400' : 'group-hover:text-yellow-500'} transition-colors`}>{item.name}</td>
                                            <td className="p-6 text-center font-black text-3xl tabular-nums text-white tracking-tighter">{item.rating}</td>
                                            <td className="p-6 text-right text-[11px] font-bold text-zinc-500 uppercase tracking-widest tabular-nums leading-none">
                                                {item.wins || 0}W<br /><span className="text-[9px] opacity-40">/</span> {item.losses || 0}L
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {view === 'players' && (
                            <form onSubmit={async (e) => { e.preventDefault(); if (!playerName.trim()) return; await supabase.from('players').insert([{ name: playerName.trim() }]); setPlayerName(''); loadData(); }} className="flex gap-4 p-5 bg-zinc-900 border-2 border-zinc-800 rounded-[2rem] shadow-xl">
                                <input type="text" placeholder="New Player name..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="flex-1 bg-transparent px-6 outline-none text-base font-bold text-white placeholder:text-zinc-700" />
                                <button className="bg-zinc-100 text-black text-zinc-500 px-8 py-4 rounded-2xl font-black uppercase text-xs hover:bg-white active:scale-95 transition-all">Add Player</button>
                            </form>
                        )}
                    </div>

                    <div className="space-y-8">
                        <h2 className="text-[11px] font-black uppercase tracking-[0.5em] text-zinc-700 flex items-center gap-4 px-4">
                            <History size={18} /> Match History
                        </h2>
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar pr-2 text-white">
                            {matches.slice(0, 15).map(m => (
                                <div key={m.id} className="bg-zinc-900/50 border-2 border-zinc-800 p-6 rounded-[2rem] relative overflow-hidden group hover:border-zinc-700 transition-all">
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-zinc-800 group-hover:bg-yellow-400 transition-all" />
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{m.game_name}</span>
                                        <span className="text-green-500 text-xs font-black">+{m.rating_change}</span>
                                    </div>
                                    <div className="text-sm font-black leading-tight">
                                        {m.winner_name} <span className="text-zinc-800 text-[9px] mx-1 lowercase font-bold">def.</span> {m.loser_name}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL: RECORD MATCH */}
            {isMatchModalOpen && (
                <div className="fixed inset-0 bg-black/98 backdrop-blur-md z-50 flex items-center justify-center p-6 text-white">
                    <div className="bg-zinc-900 border-2 border-zinc-800 p-12 rounded-[4rem] w-full max-w-lg shadow-[0_0_100px_rgba(0,0,0,0.5)] relative">
                        <button onClick={() => setIsMatchModalOpen(false)} className="absolute right-10 top-10 text-zinc-600 hover:text-white transition-colors"><X size={32} /></button>
                        <h3 className="text-4xl font-black mb-10 text-center tracking-tighter uppercase text-white leading-none italic">{view}<br />Verification</h3>
                        <form onSubmit={recordMatch} className="space-y-8">
                            <input type="text" placeholder="Game Played" required value={gameName} onChange={(e) => setGameName(e.target.value)} className="w-full bg-zinc-950 border-2 border-zinc-800 p-6 rounded-3xl outline-none focus:border-yellow-400 font-bold text-white text-lg shadow-inner" />
                            <div className="space-y-4">
                                <select value={winnerId} onChange={(e) => setWinnerId(e.target.value)} className="w-full bg-zinc-950 border-2 border-zinc-800 p-6 rounded-3xl outline-none focus:border-green-400 font-bold appearance-none text-white shadow-inner"><option value="">Select Victor...</option>{(view === 'players' ? players : teams).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                                <select value={loserId} onChange={(e) => setLoserId(e.target.value)} className="w-full bg-zinc-950 border-2 border-zinc-800 p-6 rounded-3xl outline-none focus:border-red-400 font-bold appearance-none text-white shadow-inner"><option value="">Select Defeated...</option>{(view === 'players' ? players : teams).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                            </div>
                            <button disabled={isSubmitting || !gameName} className="w-full bg-white text-black py-6 rounded-3xl font-black text-xl hover:bg-zinc-200 transition-all uppercase tracking-[0.2em] shadow-2xl active:scale-95">Commit Entry</button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: TEAM CREATOR */}
            {isTeamCreatorOpen && (
                <div className="fixed inset-0 bg-black/98 backdrop-blur-md z-50 flex items-center justify-center p-6 text-white">
                    <div className="bg-zinc-900 border-2 border-zinc-800 p-12 rounded-[4rem] w-full max-w-2xl shadow-2xl relative">
                        <button onClick={() => setIsTeamCreatorOpen(false)} className="absolute right-10 top-10 text-zinc-600 hover:text-white"><X size={32} /></button>
                        <h3 className="text-4xl font-black mb-10 text-center uppercase tracking-tighter text-white italic">Assemble<br />Team</h3>
                        <form onSubmit={async (e) => { e.preventDefault(); if (!teamName.trim() || selectedMemberIds.length === 0) return; const { data: tData } = await supabase.from('teams').insert([{ name: teamName.trim() }]).select().single(); if (tData) { await supabase.from('team_members').insert(selectedMemberIds.map(id => ({ team_id: tData.id, player_id: id }))); setIsTeamCreatorOpen(false); setTeamName(''); setSelectedMemberIds([]); loadData(); } }} className="space-y-8">
                            <input type="text" placeholder="Unit Designation (Team Name)" required value={teamName} onChange={(e) => setTeamName(e.target.value)} className="w-full bg-zinc-950 border-2 border-zinc-800 p-6 rounded-3xl outline-none focus:border-blue-400 font-bold text-white text-lg shadow-inner" />
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-56 overflow-y-auto no-scrollbar p-1">
                                {players.map(p => (
                                    <button key={p.id} type="button" onClick={() => setSelectedMemberIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])} className={`p-5 rounded-3xl text-[11px] font-black uppercase tracking-widest border-2 transition-all ${selectedMemberIds.includes(p.id) ? 'bg-blue-500/20 border-blue-400 text-blue-400' : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:border-zinc-700'}`}>{p.name}</button>
                                ))}
                            </div>
                            <button className="w-full bg-blue-500 text-white py-6 rounded-3xl font-black uppercase text-xl hover:bg-blue-400 transition-all shadow-2xl active:scale-95">Verify Registry</button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: PLAYER DRILL-DOWN */}
            {selectedPlayer && (
                <div className="fixed inset-0 bg-black/98 backdrop-blur-xl z-[60] flex items-center justify-center p-6 text-white">
                    <div className="bg-zinc-900 border border-zinc-800 p-12 rounded-[3.5rem] w-full max-w-2xl shadow-2xl relative overflow-hidden">
                        <button onClick={() => setSelectedPlayer(null)} className="absolute top-10 right-10 text-zinc-600 hover:text-white transition-colors"><X size={32} /></button>
                        <div className="flex items-center gap-8 mb-12 border-b border-zinc-800/50 pb-12 text-white">
                            <div className="w-24 h-24 bg-yellow-500/10 border border-yellow-500/30 rounded-[2.5rem] flex items-center justify-center text-yellow-500"><Target size={48} /></div>
                            <div>
                                <h2 className="text-6xl font-black tracking-tighter uppercase leading-none italic">{selectedPlayer.name}</h2>
                                <span className="text-yellow-500 font-black text-xs uppercase tracking-[0.4em] mt-4 block">{selectedPlayer.rating} ELO Rating</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6 mb-12 text-center font-black">
                            <div className="bg-zinc-950 p-8 rounded-3xl border border-zinc-800/50"><div className="text-green-500 text-5xl">{selectedPlayer.wins || 0}</div><div className="text-[10px] text-zinc-600 uppercase font-black tracking-widest mt-2">Victories</div></div>
                            <div className="bg-zinc-950 p-8 rounded-3xl border border-zinc-800/50"><div className="text-red-500 text-5xl">{selectedPlayer.losses || 0}</div><div className="text-[10px] text-zinc-600 uppercase font-black tracking-widest mt-2">Defeats</div></div>
                        </div>
                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Game Insight</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {getPlayerStats(selectedPlayer.name).map(([game, count], i) => (
                                    <div key={game} className="bg-zinc-950/30 p-5 rounded-2xl border border-zinc-800/30 flex justify-between items-center group hover:border-yellow-500/50 transition-all">
                                        <span className="text-sm font-bold text-zinc-400 italic">#{i + 1} {game}</span>
                                        <span className="bg-yellow-500/10 text-yellow-500 px-4 py-1 rounded-full text-[10px] font-black">{count} WINS</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}