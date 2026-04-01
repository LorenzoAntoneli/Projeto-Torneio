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
          category:categories(name)
        `)
        .order('updated_at', { ascending: false });
      
      const formattedMatches = (mData || []).map(m => ({
        ...m,
        pair1_name: m.pair1?.name,
        pair2_name: m.pair2?.name,
        category_name: m.category?.name
      }));
      setMatches(formattedMatches);
    } catch (e) {
      console.error(e);
    }
  };

  const showVictory = async (matchId, winnerId) => {
     const { data: match } = await supabase
        .from('matches')
        .select(`
          *,
          category:categories(name),
          winner:pairs(name)
        `)
        .eq('id', matchId)
        .single();
     
     if (match) {
        setVictory({
           winner_name: match.winner?.name,
           category_name: match.category?.name
        });
        setTimeout(() => setVictory(null), 10000);
     }
  };

  useEffect(() => {
    loadMatches();
    const channel = supabase
      .channel('public:matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
        loadMatches();
        if (payload.new && payload.new.status === 'finished' && payload.old.status !== 'finished') {
            showVictory(payload.new.id, payload.new.winner_id);
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const activeMatches = matches.filter(m => m.status === 'in_progress');
  const finishedMatches = matches.filter(m => m.status === 'finished').slice(0, 4); 
  const displayMatches = [...activeMatches, ...finishedMatches];

  return (
    <div className="tv-container">
      <header className="tv-header">
        <h1>Careca’s</h1>
        <p>• Beach Club •</p>
      </header>

      <div className="tv-grid">
        {displayMatches.length === 0 && (
           <div className="glass-panel" style={{gridColumn: '1/-1', padding: '100px', textAlign: 'center', borderRadius: '32px'}}>
              <Swords size={60} color="var(--accent-primary)" style={{marginBottom: 20}} />
              <h2 style={{color: 'var(--text-secondary)'}}>Aguardando início das partidas...</h2>
           </div>
        )}
        
        {displayMatches.map(match => (
          <div key={match.id} className={`glass-panel tv-match-card ${match.status === 'finished' ? 'finished' : ''}`}>
            <span className="tv-match-category">{match.category_name}</span>
            
            <div className="tv-teams-container" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20}}>
              <div className="tv-team-block" style={{flex: 1, textAlign: 'center'}}>
                <div className="tv-player-name">{match.pair1_name}</div>
                <div className="tv-scores" style={{display: 'flex', justifyContent: 'center', gap: 10}}>
                  <div className="score-item"><span className="score-label">S</span><span className="score-val">{match.pair1_sets}</span></div>
                  <div className="score-item"><span className="score-label">G</span><span className="score-val">{match.pair1_games}</span></div>
                  <div className="score-item"><span className="score-label">PTS</span><span className="score-val points">{match.pair1_score}</span></div>
                </div>
              </div>

              <div className="tv-vs-circle" style={{margin: '0 20px'}}>VS</div>

              <div className="tv-team-block" style={{flex: 1, textAlign: 'center'}}>
                <div className="tv-player-name">{match.pair2_name}</div>
                <div className="tv-scores" style={{display: 'flex', justifyContent: 'center', gap: 10}}>
                   <div className="score-item"><span className="score-label">PTS</span><span className="score-val points">{match.pair2_score}</span></div>
                   <div className="score-item"><span className="score-label">G</span><span className="score-val">{match.pair2_games}</span></div>
                   <div className="score-item"><span className="score-label">S</span><span className="score-val">{match.pair2_sets}</span></div>
                </div>
              </div>
            </div>

            {match.status === 'finished' && (
              <div style={{marginTop: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--accent-primary)', fontWeight: 'bold'}}>
                <Trophy size={18} /> PARTIDA FINALIZADA
              </div>
            )}
            
            <div style={{marginTop: 20, textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6}}>
                <Clock size={12} /> {new Date(match.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
          </div>
        ))}
      </div>

      {victory && (
        <div className="victory-overlay" style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, background: 'rgba(0,0,0,0.9)'}}>
          <div className="victory-card glass-panel" style={{padding: '80px', borderRadius: '40px', textAlign: 'center', border: '3px solid var(--accent-primary)', boxShadow: '0 0 50px rgba(212, 175, 55, 0.4)'}}>
            <Trophy size={120} color="var(--accent-primary)" style={{marginBottom: 30}} />
            <div className="gold-text" style={{fontSize: '3.5rem', marginBottom: 10}}>GRANDE VENCEDOR</div>
            <div style={{fontSize: '6.5rem', fontWeight: 900, marginBottom: 20, color: '#fff'}}>{victory.winner_name}</div>
            <div style={{fontSize: '3rem', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: 8}}>{victory.category_name}</div>
          </div>
        </div>
      )}
    </div>
  );
}
