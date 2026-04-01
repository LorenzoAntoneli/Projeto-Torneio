import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Trophy, Swords } from 'lucide-react';

export default function TVDisplay() {
  const [matches, setMatches] = useState([]);
  const [victory, setVictory] = useState(null);

  const loadMatches = async () => {
    try {
      const { data: mData } = await supabase
        .from('matches')
        .select('*, pair1:pairs!matches_pair1_id_fkey(name), pair2:pairs!matches_pair2_id_fkey(name), category:categories(name)')
        .order('updated_at', { ascending: false });
      
      const formatted = (mData || []).map(m => ({ ...m, pair1_name: m.pair1?.name, pair2_name: m.pair2?.name, category_name: m.category?.name }));
      setMatches(formatted);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    loadMatches();
    const channel = supabase.channel('tv_updates').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => loadMatches()).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <div className="tv-container" style={{background: '#000', minHeight: '100vh', color: '#fff'}}>
      <header className="tv-header">
        <h1>Careca’s Club</h1>
        <p style={{letterSpacing: 8, color: 'var(--accent-primary)'}}>• Torneio de Beach Tennis •</p>
      </header>

      <div className="tv-grid" style={{display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center'}}>
        {matches.map(m => (
          <div key={m.id} className="glass-panel" style={{width: 600, padding: 30, borderRadius: 20, borderLeft: '8px solid var(--accent-primary)'}}>
             <span className="cat-badge" style={{color: 'var(--accent-primary)'}}>{m.category_name}</span>
             <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20}}>
                <div style={{flex: 1, textAlign: 'center'}}>
                   <div className="tv-player-name">{m.pair1_name}</div>
                   <div className="score-val">{m.pair1_score}</div>
                   <div style={{color: '#8b949e'}}>Games: {m.pair1_games} | Sets: {m.pair1_sets}</div>
                </div>
                <div style={{fontSize: '2rem', fontWeight: 900, color: '#333'}}>VS</div>
                <div style={{flex: 1, textAlign: 'center'}}>
                   <div className="tv-player-name">{m.pair2_name}</div>
                   <div className="score-val">{m.pair2_score}</div>
                   <div style={{color: '#8b949e'}}>Games: {m.pair2_games} | Sets: {m.pair2_sets}</div>
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
