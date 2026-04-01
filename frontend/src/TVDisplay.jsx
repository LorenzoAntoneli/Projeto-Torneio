import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Trophy, Clock } from 'lucide-react';

export default function TVDisplay() {
  const [matches, setMatches] = useState([]);
  const [victory, setVictory] = useState(null);

  const loadMatches = async (finishId = null) => {
    try {
      // Busca Falt (Simples) - Garantido que não dá erro 400
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

      // Se acabamos de receber um aviso de finalização, mostramos o troféu
      if (finishId) {
        const winningMatch = formatted.find(m => m.id === finishId);
        if (winningMatch && winningMatch.winner_name !== '?') {
          setVictory({
            winner: winningMatch.winner_name,
            category: winningMatch.category_name
          });
          setTimeout(() => setVictory(null), 12000); // 12 segundos de brilho
        }
      }
    } catch (e) {
      console.error('Erro na TV:', e);
    }
  };

  useEffect(() => {
    loadMatches();

    const channel = supabase
      .channel('tv_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
        console.log('Mudança detectada:', payload);
        // Se a partida mudou para status 'finished'
        if (payload.new && payload.new.status === 'finished' && payload.old.status !== 'finished') {
           loadMatches(payload.new.id);
        } else {
           loadMatches();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const activeMatches = matches.filter(m => m.status !== 'finished');
  const lastResults = matches.filter(m => m.status === 'finished').slice(0, 3);

  return (
    <div className="tv-container" style={{background: '#000', minHeight: '100vh', color: '#fff', padding: '50px'}}>
      <header className="tv-header" style={{textAlign: 'center', marginBottom: '80px'}}>
        <h1 style={{fontSize: '5rem', fontWeight: 950, color: 'var(--accent-primary)', textTransform: 'uppercase'}}>Careca’s Club</h1>
        <p style={{letterSpacing: 10, opacity: 0.6}}>• PLACARES EM TEMPO REAL •</p>
      </header>

      <div className="tv-grid" style={{maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 30}}>
        {activeMatches.map(match => (
          <div key={match.id} className="glass-panel" style={{padding: 50, borderRadius: 40, borderLeft: '15px solid var(--accent-primary)', background: 'rgba(15,15,15,0.7)'}}>
            <span style={{background: 'rgba(212,175,55,0.1)', color: 'var(--accent-primary)', padding: '10px 25px', borderRadius: 15, fontWeight: 900, textTransform: 'uppercase'}}>
              {match.category_name}
            </span>
            <div style={{display: 'flex', alignItems: 'center', gap: 50, marginTop: 30, justifyContent:'center'}}>
               <div style={{flex: 1, fontSize: '3.8rem', fontWeight: 900, textAlign: 'right', color: '#fff'}}>{match.pair1_name}</div>
               <div style={{fontSize: '2rem', fontWeight: 900, color: '#333'}}>VS</div>
               <div style={{flex: 1, fontSize: '3.8rem', fontWeight: 900, textAlign: 'left', color: '#fff'}}>{match.pair2_name}</div>
            </div>
          </div>
        ))}

        {lastResults.length > 0 && <h2 style={{marginTop: 50, color: 'var(--accent-primary)', letterSpacing: 5, fontSize: '1rem', textTransform: 'uppercase', textAlign:'center'}}>Últimos Resultados</h2>}
        <div style={{display:'grid', gap: 15}}>
          {lastResults.map(match => (
             <div key={match.id} className="glass-panel" style={{padding: 25, borderRadius: 25, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8}}>
                <span style={{fontSize: '1.8rem', fontWeight: 900}}>{match.pair1_name} <b style={{color: 'var(--accent-primary)', margin:'0 15px'}}>{match.pair1_games}</b></span>
                <span style={{fontSize: '1.8rem', fontWeight: 900}}><b style={{color: 'var(--accent-primary)', margin:'0 15px'}}>{match.pair2_games}</b> {match.pair2_name}</span>
             </div>
          ))}
        </div>
      </div>

      {/* ANIMAÇÃO DE VITÓRIA (MODAL) */}
      {victory && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.98)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000}}>
           <div style={{textAlign: 'center'}}>
              <Trophy size={200} color="var(--accent-primary)" style={{marginBottom: 40}} />
              <h3 style={{fontSize: '2rem', color: '#fff', letterSpacing: 8, opacity: 0.7}}>{victory.category.toUpperCase()}</h3>
              <h1 style={{fontSize: '8rem', fontWeight: 950, color: '#fff', margin: '30px 0', textShadow: '0 0 50px rgba(212,175,55,0.3)'}}>{victory.winner}</h1>
              <div style={{fontSize: '2.5rem', color: 'var(--accent-primary)', fontWeight: '900', letterSpacing: 3}}>CAMPEÕES DA PARTIDA! 🏆🎾</div>
           </div>
        </div>
      )}
    </div>
  );
}
