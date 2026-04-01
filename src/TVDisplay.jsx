import { useEffect, useState } from 'react';
import { supabase } from './supabase';

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
        setTimeout(() => setVictory(null), 8000);
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const activeMatches = matches.filter(m => m.status === 'in_progress');
  const finishedMatches = matches.filter(m => m.status === 'finished').slice(0, 4); 
  const displayMatches = [...activeMatches, ...finishedMatches];

  return (
    <div className="tv-container">
      <div className="tv-header">
        <h1>Torneio Beach Tennis</h1>
        <p>Partidas em Tempo Real</p>
      </div>

      <div className="tv-grid">
        {displayMatches.length === 0 && <p style={{textAlign: 'center', width: '100%', color: '#8b949e', gridColumn: '1 / -1', fontSize: '1.2rem'}}>Aguardando início das partidas...</p>}
        {displayMatches.map(match => (
          <div key={match.id} className={`tv-match-card ${match.status === 'finished' ? 'finished' : ''}`}>
            <span className="tv-category-badge">{match.category_name}</span>
            {match.status === 'finished' && <div style={{position: 'absolute', top: 15, left: 15, fontSize: '0.8rem', color: 'var(--text-success)', fontWeight: 'bold'}}>FINALIZADO</div>}
            
            <div className="tv-match-teams">
              <div className="tv-team">
                <div className="tv-team-name">{match.pair1_name}</div>
                <div className="tv-score-box">
                  <div className="tv-score-set"><span className="tv-score-label">Sets</span><span className="tv-score-value">{match.pair1_sets}</span></div>
                  <div className="tv-score-game"><span className="tv-score-label">Games</span><span className="tv-score-value">{match.pair1_games}</span></div>
                  <div className="tv-score-point" style={{background: '#161b22', border: '1px solid var(--border-color)'}}>
                    <span className="tv-score-label" style={{color: 'var(--text-primary)'}}>Pts</span>
                    <span className="tv-score-value" style={{color: 'var(--text-primary)'}}>{match.pair1_score}</span>
                  </div>
                </div>
              </div>
              <div className="tv-vs">VS</div>
              <div className="tv-team">
                <div className="tv-team-name">{match.pair2_name}</div>
                <div className="tv-score-box">
                   <div className="tv-score-point" style={{background: '#161b22', border: '1px solid var(--border-color)'}}>
                    <span className="tv-score-label" style={{color: 'var(--text-primary)'}}>Pts</span>
                    <span className="tv-score-value" style={{color: 'var(--text-primary)'}}>{match.pair2_score}</span>
                  </div>
                  <div className="tv-score-game"><span className="tv-score-label">Games</span><span className="tv-score-value">{match.pair2_games}</span></div>
                  <div className="tv-score-set"><span className="tv-score-label">Sets</span><span className="tv-score-value">{match.pair2_sets}</span></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {victory && (
        <div className="victory-overlay">
          <div className="victory-title">GRANDE CAMPEÃO</div>
          <div className="victory-name">{victory.winner_name}</div>
          <div className="victory-category">{victory.category_name}</div>
        </div>
      )}
    </div>
  );
}
