import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Trophy, Clock, MapPin, Star } from 'lucide-react';

export default function TVDisplay() {
  const [matches, setMatches] = useState([]);
  const [victory, setVictory] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  const [callingMatch, setCallingMatch] = useState(null);
  const [calledIds, setCalledIds] = useState(new Set());
  const [audioEnabled, setAudioEnabled] = useState(false);

  // Som de Notificação (DONG profissional)
  const playChime = () => {
    // URL mais estável e robusta
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    audio.play().catch((e) => console.log('Áudio bloqueado:', e));
  };

  const loadMatches = async (finishId = null) => {
    try {
      const { data: cData } = await supabase.from('categories').select('*');
      const { data: pData } = await supabase.from('pairs').select('*');
      const { data: coData } = await supabase.from('courts').select('*');
      const { data: mData } = await supabase.from('matches').select('*').order('scheduled_time', { ascending: true });

      const catMap = {}; (cData || []).forEach(c => catMap[c.id] = c);
      const pairMap = {}; (pData || []).forEach(p => pairMap[p.id] = p);
      const courtMap = {}; (coData || []).forEach(c => courtMap[c.id] = c);

      const formatted = (mData || []).map(m => ({
        ...m,
        pair1_name: pairMap[m.pair1_id]?.name || '?',
        pair2_name: pairMap[m.pair2_id]?.name || '?',
        winner_name: pairMap[m.winner_id]?.name || '?',
        category_name: catMap[m.category_id]?.name || 'Geral',
        court_name: courtMap[m.court_id]?.name || 'A definir'
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
    const timer = setInterval(() => {
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setCurrentTime(now);
    }, 10000);

    // Ajuste na detecção em tempo real (INSERT e UPDATE)
    const ch = supabase.channel('tv_rt').on('postgres_changes', { event:'*', schema:'public', table:'matches' }, (payload) => {
        console.log('RT Update:', payload);
        if (payload.eventType === 'UPDATE' && payload.new.status === 'finished' && payload.old?.status !== 'finished') {
          loadMatches(payload.new.id);
        } else {
          loadMatches();
        }
      }).subscribe();
    
    return () => { clearInterval(timer); supabase.removeChannel(ch); };
  }, []);

  // Lógica de Chamada de Dupla Sequencial com SOM
  useEffect(() => {
    const toCallList = matches.filter(m => m.status === 'pending' && m.scheduled_time === currentTime && !calledIds.has(m.id));
    
    if (toCallList.length > 0 && !callingMatch) {
      const nextMatch = toCallList[0];
      setCallingMatch(nextMatch);
      setCalledIds(prev => new Set(prev).add(nextMatch.id));
      if (audioEnabled) playChime(); 
      setTimeout(() => setCallingMatch(null), 15000);
    }
  }, [currentTime, matches, calledIds, callingMatch, audioEnabled]);

  // Agrupar por categoria
  const activeMatches = matches.filter(m => m.status !== 'finished');
  const categoriesPresent = [...new Set(activeMatches.map(m => m.category_name))];
  
  // Resultados: Ordenados pelo mais recente (updated_at)
  const lastResults = matches
    .filter(m => m.status === 'finished')
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 8);

  return (
    <div className="tv-container" style={{background: '#000', minHeight: '100vh', color: '#fff', padding: '40px', position: 'relative'}}>
      
      {/* Relógio e Logo */}
      <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 60, borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: 20}}>
        <div>
           <h1 style={{fontSize: '3.5rem', fontWeight: 950, color: 'var(--accent-primary)', textTransform: 'uppercase', margin: 0}}>Careca’s Club</h1>
           <p style={{letterSpacing: 8, opacity: 0.5, fontSize: '0.8rem'}}>Torneio em Tempo Real</p>
        </div>
        <div style={{textAlign: 'right'}}>
           <div style={{fontSize: '3rem', fontWeight: 900, color: '#fff'}}>{currentTime}</div>
           <div style={{color: 'var(--accent-primary)', fontWeight: 800}}>HORÁRIO OFICIAL</div>
        </div>
      </header>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 350px', gap: 40}}>
        
        {/* Painel Principal: Jogos por Categoria */}
        <section>
          {categoriesPresent.map(cat => (
            <div key={cat} style={{marginBottom: 40}}>
              <h2 style={{color: 'var(--accent-primary)', fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: 4, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 15}}>
                <Star size={18}/> {cat}
              </h2>
              <div style={{display: 'grid', gap: 15}}>
                {activeMatches.filter(m => m.category_name === cat).map(m => (
                  <div key={m.id} className="glass-panel" style={{padding: '25px 35px', borderRadius: 25, borderLeft: '10px solid var(--accent-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div style={{flex: 1}}>
                       <div style={{fontSize: '2rem', fontWeight: 900}}>{m.pair1_name} <span style={{opacity: 0.2, fontSize: '1rem', margin: '0 10px'}}>VS</span> {m.pair2_name}</div>
                    </div>
                    <div style={{display: 'flex', gap: 30, alignItems: 'center'}}>
                       <div style={{textAlign: 'center'}}>
                          <div style={{fontSize: '0.7rem', opacity: 0.5, fontWeight: 900}}>QUADRA</div>
                          <div style={{fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-primary)'}}>{m.court_name}</div>
                       </div>
                       <div style={{textAlign: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px 15px', borderRadius: 12}}>
                          <div style={{fontSize: '0.7rem', opacity: 0.5, fontWeight: 900}}>INÍCIO</div>
                          <div style={{fontSize: '1.4rem', fontWeight: 900}}>{m.scheduled_time || '--:--'}</div>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {activeMatches.length === 0 && <div style={{textAlign:'center', padding:100, opacity:0.2, fontSize:'2rem'}}>Aguardando próximas partidas...</div>}
        </section>

        {/* Sidebar: Últimos Resultados */}
        <aside>
           <h2 style={{fontSize: '1rem', opacity: 0.5, letterSpacing: 3, marginBottom: 20, textTransform: 'uppercase'}}>Encerrados</h2>
           <div style={{display: 'grid', gap: 15}}>
             {lastResults.map(m => (
               <div key={m.id} className="glass-panel" style={{padding: 20, borderRadius: 20, opacity: 0.7}}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize: '0.6rem', color: 'var(--accent-primary)', fontWeight: 900, marginBottom: 12, textTransform:'uppercase', letterSpacing:2}}>
                    <span>{m.category_name}</span>
                    <span style={{opacity:0.5}}>{new Date(m.updated_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:8}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span style={{fontSize: '1rem', fontWeight: m.winner_id === m.pair1_id ? 900 : 400, color: m.winner_id === m.pair1_id ? '#fff' : '#888'}}>{m.pair1_name}</span>
                      <span style={{fontSize: '1.2rem', fontWeight: 900, color:'var(--accent-primary)'}}>{m.pair1_games}</span>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span style={{fontSize: '1rem', fontWeight: m.winner_id === m.pair2_id ? 900 : 400, color: m.winner_id === m.pair2_id ? '#fff' : '#888'}}>{m.pair2_name}</span>
                      <span style={{fontSize: '1.2rem', fontWeight: 900, color:'var(--accent-primary)'}}>{m.pair2_games}</span>
                    </div>
                  </div>
                  {(m.pair1_tiebreak || m.pair2_tiebreak) && (
                    <div style={{fontSize: '0.7rem', opacity: 0.3, textAlign: 'center', marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 5}}>
                      Tie-break: {m.pair1_tiebreak} - {m.pair2_tiebreak}
                    </div>
                  )}
               </div>
             ))}
           </div>
        </aside>
      </div>

      {/* OVERLAY: Chamada de Dupla (Alert) */}
      {callingMatch && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.95)', zIndex: 20000, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
           <div style={{textAlign: 'center', animation: 'pulse 1.5s infinite'}}>
              <Clock size={120} color="var(--accent-primary)" style={{marginBottom: 30}} />
              <h2 style={{fontSize: '2rem', letterSpacing: 10, opacity: 0.6}}>CHAMADA DE JOGO</h2>
              <h1 style={{fontSize: '5rem', fontWeight: 950, margin: '20px 0'}}>{callingMatch.pair1_name} <br/> <small style={{fontSize:'2rem', opacity:0.2}}>X</small> <br/> {callingMatch.pair2_name}</h1>
              <div style={{background: 'var(--accent-primary)', color: '#000', padding: '20px 50px', borderRadius: 20, fontSize: '2.5rem', fontWeight: 900, marginTop: 40}}>
                DIRIJAM-SE À {callingMatch.court_name.toUpperCase()}
              </div>
           </div>
        </div>
      )}

      {/* OVERLAY: Vitória */}
      {victory && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.98)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000}}>
           <div style={{textAlign: 'center'}}>
              <Trophy size={180} color="var(--accent-primary)" style={{marginBottom: 30}} />
              <h3 style={{fontSize: '1.5rem', color: '#fff', letterSpacing: 5, opacity: 0.6}}>{victory.category.toUpperCase()}</h3>
              <h1 style={{fontSize: '7rem', fontWeight: 950, color: '#fff', margin: '20px 0'}}>{victory.winner}</h1>
              <div style={{fontSize: '2.5rem', color: 'var(--accent-primary)', fontWeight: '900'}}>{victory.score} • VENCEU A PARTIDA! 🏆🎾</div>
           </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>

      {/* Overlay de Ativação Inicial (Para permitir áudio) */}
      {!audioEnabled && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.95)', zIndex: 100000, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column'}}>
           <Trophy size={100} color="var(--accent-primary)" style={{marginBottom: 30}} />
           <h2 style={{color: '#fff', fontSize: '2rem', marginBottom: 40, letterSpacing: 5}}>CARECA’S BEACH CLUB</h2>
           <button 
             className="btn-primary" 
             style={{padding: '30px 60px', fontSize: '1.5rem', fontWeight: 900, borderRadius: 30, display: 'flex', alignItems: 'center', gap: 20}}
             onClick={() => { setAudioEnabled(true); playChime(); }}
           >
             <Star size={30} fill="currentColor" /> INICIAR PAINEL DA TV
           </button>
           <p style={{marginTop: 30, opacity: 0.4, fontSize: '0.8rem'}}>Clique acima para ativar o sinal sonoro das quadras.</p>
        </div>
      )}
    </div>
  );
}
