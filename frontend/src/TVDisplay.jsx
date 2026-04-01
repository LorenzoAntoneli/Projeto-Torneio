import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Trophy, Clock } from 'lucide-react';

export default function TVDisplay() {
  const [matches, setMatches] = useState([]);
  const [victory, setVictory] = useState(null);

  const loadMatches = async () => {
    try {
      // Busca as 3 tabelas de forma simples (sem joins)
      const { data: cData } = await supabase.from('categories').select('*');
      const { data: pData } = await supabase.from('pairs').select('*');
      const { data: mData } = await supabase.from('matches').select('*').order('updated_at', { ascending: false });

      const catMap = {}; (cData || []).forEach(c => catMap[c.id] = c);
      const pairMap = {}; (pData || []).forEach(p => pairMap[p.id] = p);

      const formatted = (mData || []).map(m => ({
        ...m,
        pair1_name: pairMap[m.pair1_id]?.name || '?',
        pair2_name: pairMap[m.pair2_id]?.name || '?',
        winner_name: pairMap[m.winner_id]?.name || '?',
        category_name: catMap[m.category_id]?.name || 'Geral'
      }));

      setMatches(formatted);
    } catch (e) { console.error('Erro na TV:', e); }
  };

  const triggerVictory = (matchId) => {
     // Recarrega para pegar o vencedor mais recente e mostra o troféu
     loadMatches().then(() => {
        const match = matches.find(m => m.id === matchId);
        if (match) {
           setVictory({ winner: match.winner_name, category: match.category_name });
           setTimeout(() => setVictory(null), 12000);
        }
     });
  };

  useEffect(() => {
    loadMatches();
    const ch = supabase.channel('tv_rt').on('postgres_changes', { event:'*', schema:'public', table:'matches' }, (payload) => {
        if (payload.new && payload.new.status === 'finished' && payload.old.status !== 'finished') {
           triggerVictory(payload.new.id);
        } else {
           loadMatches();
        }
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const activeMatches = matches.filter(m => m.status !== 'finished');
  const lastResults = matches.filter(m => m.status === 'finished').slice(0, 3);

  return (
    <div className="tv-container" style={{background: '#000', minHeight: '100vh', color: '#fff', padding: '50px'}}>
      <header className="tv-header" style={{textAlign: 'center', marginBottom: '80px'}}>
        <h1 style={{fontSize: '5rem', fontWeight: 900, color: 'var(--accent-primary)', textTransform: 'uppercase'}}>Careca’s Club</h1>
        <p style={{letterSpacing: 10, opacity: 0.6}}>• PLACARES EM TEMPO REAL •</p>
      </header>

      <div className="tv-grid" style={{maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 30}}>
        {activeMatches.map(match => (
          <div key={match.id} className="glass-panel" style={{padding: 50, borderRadius: 40, borderLeft: '15px solid var(--accent-primary)'}}>
            <span style={{background: 'rgba(212,175,55,0.1)', color: 'var(--accent-primary)', padding: '10px 25px', borderRadius: 15, fontWeight: 900, textTransform: 'uppercase'}}>
              {match.category_name}
            </span>
            <div style={{display: 'flex', alignItems: 'center', gap: 50, marginTop: 30, justifyContent:'center'}}>
               <div style={{flex: 1, fontSize: '3.5rem', fontWeight: 900, textAlign: 'right', color: '#fff'}}>{match.pair1_name}</div>
               <div style={{fontSize: '2rem', fontWeight: 900, color: '#333'}}>VS</div>
               <div style={{flex: 1, fontSize: '3.5rem', fontWeight: 900, textAlign: 'left', color: '#fff'}}>{match.pair2_name}</div>
            </div>
          </div>
        ))}

        {lastResults.length > 0 && <h2 style={{marginTop: 50, color: 'var(--accent-primary)'}}>Últimos Resultados</h2>}
        {lastResults.map(match => (
           <div key={match.id} className="glass-panel" style={{padding: 25, borderRadius: 25, display: 'flex', justifyContent: 'space-between', opacity: 0.8}}>
              <span style={{fontSize: '1.8rem'}}>{match.pair1_name} <b style={{color: 'var(--accent-primary)', margin:'0 15px'}}>{match.pair1_games}</b></span>
              <span style={{fontSize: '1.8rem'}}><b style={{color: 'var(--accent-primary)', margin:'0 15px'}}>{match.pair2_games}</b> {match.pair2_name}</span>
           </div>
        ))}
      </div>

      {victory && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.98)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000}}>
           <div style={{textAlign: 'center'}}>
              <Trophy size={180} color="var(--accent-primary)" style={{marginBottom: 30}} />
              <h3 style={{fontSize: '2rem', color: '#fff', letterSpacing: 5}}>{victory.category.toUpperCase()}</h3>
              <h1 style={{fontSize: '8rem', fontWeight: 950, color: '#fff', margin: '20px 0'}}>{victory.winner}</h1>
              <div style={{fontSize: '2.5rem', color: 'var(--accent-primary)', fontWeight: 'bold'}}>CAMPEÕES! 🏆🎾</div>
           </div>
        </div>
      )}
    </div>
  );
}
