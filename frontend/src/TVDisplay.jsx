import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Trophy, Clock } from 'lucide-react';

export default function TVDisplay() {
  const [matches, setMatches] = useState([]);

  const loadMatches = async () => {
    try {
      const { data: mData, error } = await supabase
        .from('matches')
        .select(`
          *,
          pair1:pairs!matches_pair1_id_fkey(name),
          pair2:pairs!matches_pair2_id_fkey(name),
          category:categories(name)
        `)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;

      const formatted = (mData || []).map(m => ({
        ...m,
        pair1_name: m.pair1?.name,
        pair2_name: m.pair2?.name,
        category_name: m.category?.name
      }));
      setMatches(formatted);
    } catch (e) {
      console.error('Erro ao carregar partidas na TV:', e);
    }
  };

  useEffect(() => {
    loadMatches();

    // Configuração do Realtime (Importante estar ativado no Supabase Dashboard)
    const channel = supabase
      .channel('tv-realtime-matches')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'matches' 
      }, (payload) => {
        console.log('Mudança detectada no Realtime:', payload);
        loadMatches();
      })
      .subscribe((status) => {
        console.log('Status da conexão Realtime:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const activeMatches = matches.filter(m => m.status === 'in_progress');

  return (
    <div className="tv-container" style={{background: '#000', minHeight: '100vh', color: '#fff', padding: '50px'}}>
      <header className="tv-header" style={{textAlign: 'center', marginBottom: '80px'}}>
        <h1 style={{fontSize: '5rem', fontWeight: 900, background: 'linear-gradient(to bottom, #fff, var(--accent-primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textTransform: 'uppercase', marginBottom: '5px'}}>
          Careca’s Club
        </h1>
        <p style={{letterSpacing: 10, color: 'var(--accent-primary)', textTransform: 'uppercase', fontSize: '1.2rem'}}>
          • Placares em Tempo Real •
        </p>
      </header>

      <div className="tv-grid" style={{display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '1200px', margin: '0 auto'}}>
        {activeMatches.length === 0 && (
           <div className="glass-panel" style={{padding: '100px', textAlign: 'center', borderRadius: '40px', border: '1px solid #333'}}>
              <h2 style={{color: '#666', fontSize: '2.5rem'}}>Aguardando início das partidas...</h2>
           </div>
        )}
        
        {activeMatches.map(match => (
          <div key={match.id} className="glass-panel" style={{padding: '50px', borderRadius: '40px', borderLeft: '12px solid var(--accent-primary)', position: 'relative'}}>
            <span style={{position: 'absolute', top: 30, right: 40, background: 'rgba(212,175,55,0.1)', color: 'var(--accent-primary)', padding: '10px 20px', borderRadius: '12px', fontWeight: 800, fontSize: '1.2rem', textTransform: 'uppercase'}}>
              {match.category_name}
            </span>
            
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 50}}>
              {/* Dupla 1 */}
              <div style={{flex: 1, textAlign: 'center'}}>
                <div style={{fontSize: '3rem', fontWeight: 900, marginBottom: 30, lineHeight: 1.1, height: '6rem', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  {match.pair1_name}
                </div>
                <div style={{display: 'flex', justifyContent: 'center', gap: 20}}>
                   <div style={{background: '#111', padding: 20, borderRadius: 20, minWidth: 100, border: '1px solid #222'}}>
                      <div style={{fontSize: '0.8rem', color: '#8b949e', textTransform: 'uppercase', marginBottom: 10}}>Sets</div>
                      <div style={{fontSize: '3rem', fontWeight: 900}}>{match.pair1_sets}</div>
                   </div>
                   <div style={{background: '#111', padding: 20, borderRadius: 20, minWidth: 100, border: '1px solid #222'}}>
                      <div style={{fontSize: '0.8rem', color: '#8b949e', textTransform: 'uppercase', marginBottom: 10}}>Games</div>
                      <div style={{fontSize: '3rem', fontWeight: 900}}>{match.pair1_games}</div>
                   </div>
                   <div style={{background: '#d4af37', padding: 20, borderRadius: 20, minWidth: 120, color: '#000'}}>
                      <div style={{fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase', marginBottom: 10, fontWeight: 'bold'}}>Pontos</div>
                      <div style={{fontSize: '3.5rem', fontWeight: 900}}>{match.pair1_score}</div>
                   </div>
                </div>
              </div>

              <div style={{fontSize: '2.5rem', fontWeight: 900, color: '#333'}}>VS</div>

              {/* Dupla 2 */}
              <div style={{flex: 1, textAlign: 'center'}}>
                <div style={{fontSize: '3rem', fontWeight: 900, marginBottom: 30, lineHeight: 1.1, height: '6rem', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  {match.pair2_name}
                </div>
                <div style={{display: 'flex', justifyContent: 'center', gap: 20}}>
                   <div style={{background: '#d4af37', padding: 20, borderRadius: 20, minWidth: 120, color: '#000'}}>
                      <div style={{fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase', marginBottom: 10, fontWeight: 'bold'}}>Pontos</div>
                      <div style={{fontSize: '3.5rem', fontWeight: 900}}>{match.pair2_score}</div>
                   </div>
                   <div style={{background: '#111', padding: 20, borderRadius: 20, minWidth: 100, border: '1px solid #222'}}>
                      <div style={{fontSize: '0.8rem', color: '#8b949e', textTransform: 'uppercase', marginBottom: 10}}>Games</div>
                      <div style={{fontSize: '3rem', fontWeight: 900}}>{match.pair2_games}</div>
                   </div>
                   <div style={{background: '#111', padding: 20, borderRadius: 20, minWidth: 100, border: '1px solid #222'}}>
                      <div style={{fontSize: '0.8rem', color: '#8b949e', textTransform: 'uppercase', marginBottom: 10}}>Sets</div>
                      <div style={{fontSize: '3rem', fontWeight: 900}}>{match.pair2_sets}</div>
                   </div>
                </div>
              </div>
            </div>

            <div style={{marginTop: 40, textAlign: 'center', color: '#555', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10}}>
                <Clock size={16} /> Atualizado agora mesmo
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
