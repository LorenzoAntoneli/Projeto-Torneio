import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Trophy, Clock } from 'lucide-react';

export default function TVDisplay() {
  const [matches, setMatches] = useState([]);
  const [victory, setVictory] = useState(null);

  const loadMatches = async (finishId = null) => {
    try {
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

      if (finishId) {
        const winningMatch = formatted.find(m => m.id === finishId);
        if (winningMatch && winningMatch.winner_name !== '?') {
          setVictory({
            winner: winningMatch.winner_name,
            category: winningMatch.category_name,
            score: `${winningMatch.pair1_games}/${winningMatch.pair2_games}` + 
                   (winningMatch.pair1_tiebreak || winningMatch.pair2_tiebreak ? ` (${winningMatch.pair1_tiebreak}-${winningMatch.pair2_tiebreak})` : '')
          });
          setTimeout(() => setVictory(null), 12000);
        }
      }
    } catch (e) { console.error('Erro TV:', e); }
  };

  useEffect(() => {
    loadMatches();
    const ch = supabase.channel('tv_rt').on('postgres_changes', { event:'*', schema:'public', table:'matches' }, (p) => {
        if (p.new && p.new.status === 'finished' && p.old.status !== 'finished') { loadMatches(p.new.id); }
        else { loadMatches(); }
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const activeMatches = matches.filter(m => m.status !== 'finished');
  const lastResults = matches.filter(m => m.status === 'finished').slice(0, 3);

  return (
    <div className="tv-container" style={{background: '#000', minHeight: '100vh', color: '#fff', padding: '50px'}}>
      <header className="tv-header" style={{textAlign: 'center', marginBottom: '80px'}}>
        <h1 style={{fontSize: '5rem', fontWeight: 950, color: 'var(--accent-primary)', textTransform: 'uppercase'}}>Careca’s Club</h1>
        <p style={{letterSpacing: 10, opacity: 0.6}}>• RESULTADOS AO VIVO •</p>
      </header>

      <div className="tv-grid" style={{maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 30}}>
        {activeMatches.map(m => (
          <div key={m.id} className="glass-panel" style={{padding: 50, borderRadius: 40, borderLeft: '15px solid var(--accent-primary)'}}>
            <span style={{background: 'rgba(212,175,55,0.1)', color: 'var(--accent-primary)', padding: '10px 25px', borderRadius: 15, fontWeight: 900}}>{m.category_name}</span>
            <div style={{display: 'flex', alignItems: 'center', gap: 50, marginTop: 30, justifyContent:'center'}}>
               <div style={{flex: 1, fontSize: '3.5rem', fontWeight: 900, textAlign: 'right'}}>{m.pair1_name}</div>
               <div style={{fontSize: '2rem', fontWeight: 900, color: '#333'}}>VS</div>
               <div style={{flex: 1, fontSize: '3.5rem', fontWeight: 900, textAlign: 'left'}}>{m.pair2_name}</div>
            </div>
          </div>
        ))}

        {lastResults.length > 0 && <h2 style={{marginTop: 50, color: 'var(--accent-primary)', textTransform:'uppercase', fontSize:'1rem', letterSpacing:5}}>Últimos Resultados</h2>}
        <div style={{display:'grid', gap: 15}}>
          {lastResults.map(m => (
             <div key={m.id} className="glass-panel" style={{
               padding: 25, 
               borderRadius: 25, 
               display: 'grid', 
               gridTemplateColumns: '1fr auto 1fr', 
               alignItems: 'center', 
               gap: 20,
               opacity: 0.9,
               background: 'rgba(255,255,255,0.03)'
             }}>
                {/* Lado Esquerdo */}
                <span style={{fontSize: '1.8rem', fontWeight: 900, textAlign: 'right'}}>
                  <span style={{opacity: 0.7, marginRight: 15, fontSize: '1.5rem'}}>{m.pair1_name}</span> 
                  <b style={{color: 'var(--accent-primary)', fontSize: '2.2rem'}}>{m.pair1_games}</b>
                </span>

                {/* Centro (X ou Tie-break) */}
                <div style={{minWidth: 120, textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                  {m.pair1_tiebreak || m.pair2_tiebreak ? (
                     <div style={{
                       fontSize: '1.2rem', 
                       color: '#fff', 
                       background: 'rgba(212,175,55,0.2)', 
                       padding: '5px 15px', 
                       borderRadius: 10,
                       fontWeight: 900,
                       border: '1px solid var(--accent-primary)'
                     }}>
                        {m.pair1_tiebreak}-{m.pair2_tiebreak}
                     </div>
                  ) : (
                    <span style={{color: 'var(--accent-primary)', fontWeight: 900, fontSize: '1.2rem', opacity: 0.5}}>X</span>
                  )}
                </div>

                {/* Lado Direito */}
                <span style={{fontSize: '1.8rem', fontWeight: 900, textAlign: 'left'}}>
                  <b style={{color: 'var(--accent-primary)', fontSize: '2.2rem', marginRight: 15}}>{m.pair2_games}</b>
                  <span style={{opacity: 0.7, fontSize: '1.5rem'}}>{m.pair2_name}</span>
                </span>
             </div>
          ))}
        </div>
      </div>

      {victory && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.98)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000}}>
           <div style={{textAlign: 'center'}}>
              <Trophy size={180} color="var(--accent-primary)" style={{marginBottom: 30}} />
              <h3 style={{fontSize: '1.5rem', color: '#fff', letterSpacing: 5, opacity: 0.6}}>{victory.category.toUpperCase()}</h3>
              <h1 style={{fontSize: '7rem', fontWeight: 950, color: '#fff', margin: '20px 0'}}>{victory.winner}</h1>
              <div style={{fontSize: '2.5rem', color: 'var(--accent-primary)', fontWeight: '900'}}>{victory.score} • VENCEDORES DA PARTIDA! 🏆🎾</div>
           </div>
        </div>
      )}
    </div>
  );
}
