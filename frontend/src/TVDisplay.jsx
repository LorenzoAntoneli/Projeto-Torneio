import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Trophy, Clock } from 'lucide-react';

export default function TVDisplay() {
  const [matches, setMatches] = useState([]);
  const [victory, setVictory] = useState(null);

  const loadMatches = async () => {
    try {
      const { data: mData, error } = await supabase
        .from('matches')
        .select(`
          *,
          pair1:pairs!pair1_id(name),
          pair2:pairs!pair2_id(name),
          category:categories!category_id(name)
        `)
        .order('updated_at', { ascending: false });
      
      if (error) {
         console.error('Erro na TV (400):', error);
         const { data: simpleData } = await supabase.from('matches').select('*').order('updated_at', { ascending: false });
         setMatches(simpleData || []);
      } else {
         const formatted = (mData || []).map(m => ({
           ...m,
           pair1_name: m.pair1?.name || '?',
           pair2_name: m.pair2?.name || '?',
           category_name: m.category?.name || 'Geral'
         }));
         setMatches(formatted);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const triggerVictory = (matchId) => {
    supabase.from('matches')
      .select('*, pairs!winner_id(name), categories!category_id(name)')
      .eq('id', matchId)
      .single()
      .then(({ data }) => {
        if (data && data.pairs) {
          setVictory({
            winner: data.pairs.name,
            category: data.categories.name
          });
          setTimeout(() => setVictory(null), 12000); // 12 seg de troféu
        }
      });
  };

  useEffect(() => {
    loadMatches();
    const channel = supabase.channel('tv_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
        loadMatches();
        if (payload.new && payload.new.status === 'finished' && payload.old.status !== 'finished') {
           triggerVictory(payload.new.id);
        }
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const activeMatches = matches.filter(m => m.status !== 'finished');
  const lastResults = matches.filter(m => m.status === 'finished').slice(0, 3);

  return (
    <div className="tv-container" style={{background: '#000', minHeight: '100vh', color: '#fff', padding: '50px'}}>
      <header className="tv-header" style={{textAlign: 'center', marginBottom: '80px'}}>
        <h1 style={{fontSize: '5rem', fontWeight: 900, color: 'var(--accent-primary)', textTransform: 'uppercase'}}>Careca’s Club</h1>
        <p style={{letterSpacing: 10, opacity: 0.6}}>• RESULTADOS AO VIVO •</p>
      </header>

      <div className="tv-grid" style={{maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 30}}>
        {activeMatches.map(match => (
          <div key={match.id} className="glass-panel" style={{padding: 50, borderRadius: 40, borderLeft: '15px solid var(--accent-primary)'}}>
            <span style={{background: 'rgba(212,175,55,0.1)', color: 'var(--accent-primary)', padding: '10px 25px', borderRadius: 15, fontWeight: 900, textTransform: 'uppercase'}}>
              {match.category_name}
            </span>
            <div style={{display: 'flex', alignItems: 'center', gap: 50, marginTop: 30, justifyContent:'center'}}>
               <div style={{flex: 1, fontSize: '3.2rem', fontWeight: 900, textAlign: 'right'}}>{match.pair1_name}</div>
               <div style={{fontSize: '2rem', fontWeight: 900, color: '#333'}}>VS</div>
               <div style={{flex: 1, fontSize: '3.2rem', fontWeight: 900, textAlign: 'left'}}>{match.pair2_name}</div>
            </div>
          </div>
        ))}

        {lastResults.length > 0 && <h2 style={{marginTop: 50, color: 'var(--accent-primary)', textTransform: 'uppercase', fontSize: '1rem', letterSpacing: 5}}>Últimos Resultados</h2>}
        {lastResults.map(match => (
           <div key={match.id} className="glass-panel" style={{padding: 30, borderRadius: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8}}>
              <span style={{fontSize: '1.8rem', fontWeight: 900}}>{match.pair1_name} <b style={{color: 'var(--accent-primary)', margin:'0 15px'}}>{match.pair1_games}</b></span>
              <div style={{fontSize: '1rem', color: '#555'}}>X</div>
              <span style={{fontSize: '1.8rem', fontWeight: 900}}><b style={{color: 'var(--accent-primary)', margin:'0 15px'}}>{match.pair2_games}</b> {match.pair2_name}</span>
           </div>
        ))}
      </div>

      {victory && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.98)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000}}>
           <div style={{textAlign: 'center'}}>
              <Trophy size={180} color="var(--accent-primary)" style={{marginBottom: 30}} />
              <h3 style={{fontSize: '2rem', color: '#fff', letterSpacing: 5}}>VITÓRIA NA CATEGORIA: {victory.category.toUpperCase()}</h3>
              <h1 style={{fontSize: '7rem', fontWeight: 950, color: '#fff', margin: '20px 0'}}>{victory.winner}</h1>
              <div style={{fontSize: '2rem', color: 'var(--accent-primary)', fontWeight: 'bold'}}>CAMPEÕES! 🏆🎾</div>
           </div>
        </div>
      )}
    </div>
  );
}
