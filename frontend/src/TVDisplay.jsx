import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Trophy, Swords, Clock } from 'lucide-react';

export default function TVDisplay() {
  const [matches, setMatches] = useState([]);
  const [victory, setVictory] = useState(null);

  const loadMatches = async () => {
    try {
      const { data: mData } = await supabase
        .from('matches')
        .select(`
          *,
          pair1:pairs!matches_pair1_id_fkey(name),
          pair2:pairs!matches_pair2_id_fkey(name),
          category:categories(name),
          winner:pairs!matches_winner_id_fkey(name)
        `)
        .order('updated_at', { ascending: false });
      
      const formatted = (mData || []).map(m => ({
        ...m,
        pair1_name: m.pair1?.name,
        pair2_name: m.pair2?.name,
        category_name: m.category?.name,
        winner_name: m.winner?.name
      }));
      setMatches(formatted);
    } catch (e) {
      console.error(e);
    }
  };

  const triggerVictory = (matchId, winnerId) => {
    // Buscar os dados da partida que acabou de fechar
    supabase.from('matches')
      .select('*, pairs!matches_winner_id_fkey(name), categories(name)')
      .eq('id', matchId)
      .single()
      .then(({ data }) => {
        if (data && data.pairs) {
          setVictory({
            winner: data.pairs.name,
            category: data.categories.name
          });
          // Esconde o troféu após 10 segundos
          setTimeout(() => setVictory(null), 10000);
        }
      });
  };

  useEffect(() => {
    loadMatches();
    
    const channel = supabase
      .channel('tv_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
        loadMatches();
        // Se a partida mudou para status 'finished', dispara a animação
        if (payload.new && payload.new.status === 'finished' && payload.old.status !== 'finished') {
           triggerVictory(payload.new.id, payload.new.winner_id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const activeMatches = matches.filter(m => m.status === 'pending' || m.status === 'in_progress');
  const lastResults = matches.filter(m => m.status === 'finished').slice(0, 3);

  return (
    <div className="tv-container" style={{background: '#000', minHeight: '100vh', color: '#fff', padding: '50px'}}>
      <header className="tv-header" style={{textAlign: 'center', marginBottom: '80px'}}>
        <h1 style={{fontSize: '5rem', fontWeight: 900, color: 'var(--accent-primary)', textTransform: 'uppercase'}}>Careca’s Club</h1>
        <p style={{letterSpacing: 10, color: '#fff', opacity: 0.6}}>• RESULTADOS EM TEMPO REAL •</p>
      </header>

      <div className="tv-grid" style={{maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 30}}>
        {activeMatches.length === 0 && lastResults.length === 0 && (
           <div className="glass-panel" style={{padding: 100, textAlign: 'center', borderRadius: 40}}>
              <Swords size={60} color="#333" />
              <h2 style={{color: '#333'}}>Aguardando início do torneio...</h2>
           </div>
        )}

        {/* Partidas que estão para rolar agora */}
        {activeMatches.map(match => (
          <div key={match.id} className="glass-panel" style={{padding: 50, borderRadius: 40, borderLeft: '15px solid var(--accent-primary)'}}>
            <span style={{background: 'rgba(212,175,55,0.1)', color: 'var(--accent-primary)', padding: '10px 25px', borderRadius: 15, fontWeight: 900, textTransform: 'uppercase'}}>
              {match.category_name}
            </span>
            <div style={{display: 'flex', alignItems: 'center', gap: 50, marginTop: 30}}>
               <div style={{flex: 1, fontSize: '3rem', fontWeight: 900, textAlign: 'right'}}>{match.pair1_name}</div>
               <div style={{fontSize: '2rem', fontWeight: 900, color: '#333'}}>VS</div>
               <div style={{flex: 1, fontSize: '3rem', fontWeight: 900, textAlign: 'left'}}>{match.pair2_name}</div>
            </div>
            <div style={{textAlign: 'center', marginTop: 30, color: 'var(--accent-primary)', fontWeight: 'bold', letterSpacing: 2}}>JOGO AGENDADO</div>
          </div>
        ))}

        {/* Últimos Resultados (Quem acabou de ganhar) */}
        {lastResults.length > 0 && <h2 style={{marginTop: 50, color: 'var(--accent-primary)', textTransform: 'uppercase', fontSize: '1rem', letterSpacing: 5}}>Últimos Resultados</h2>}
        {lastResults.map(match => (
           <div key={match.id} className="glass-panel" style={{padding: 30, borderRadius: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8}}>
              <span style={{fontSize: '1.5rem', fontWeight: 900}}>{match.pair1_name} <b style={{color: 'var(--accent-primary)'}}>{match.pair1_games}</b></span>
              <div style={{fontSize: '1rem', color: '#555'}}>X</div>
              <span style={{fontSize: '1.5rem', fontWeight: 900}}><b style={{color: 'var(--accent-primary)'}}>{match.pair2_games}</b> {match.pair2_name}</span>
              <span style={{color: 'var(--accent-success)', fontWeight: 'bold'}}>FINALIZADO</span>
           </div>
        ))}
      </div>

      {/* ANIMAÇÃO DE VITÓRIA (MODAL GIGANTE) */}
      {victory && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000}}>
           <div style={{textAlign: 'center', animation: 'victoryPop 0.5s ease-out'}}>
              <Trophy size={150} color="var(--accent-primary)" style={{marginBottom: 30}} />
              <h3 style={{fontSize: '2rem', color: '#fff', letterSpacing: 5}}>VITÓRIA NA CATEGORIA: {victory.category.toUpperCase()}</h3>
              <h1 style={{fontSize: '7rem', fontWeight: 950, color: '#fff', margin: '20px 0'}}>{victory.winner}</h1>
              <div style={{fontSize: '2rem', color: 'var(--accent-primary)', fontWeight: 'bold'}}>CAMPEÕES! 🏆🎾</div>
           </div>
           <style>{`
             @keyframes victoryPop {
               0% { transform: scale(0.5); opacity: 0; }
               100% { transform: scale(1); opacity: 1; }
             }
           `}</style>
        </div>
      )}
    </div>
  );
}
