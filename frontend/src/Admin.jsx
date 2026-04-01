import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Swords, LogOut, Monitor, PlusCircle, UserPlus, Gamepad2, Settings, MapPin, LayoutList } from 'lucide-react';

export default function Admin() {
  const [session, setSession] = useState(localStorage.getItem('bt_session'));
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('scoreboard');
  
  // States do Banco
  const [matches, setMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [courts, setCourts] = useState([]);
  
  // Form States
  const [selectedT, setSelectedT] = useState('');
  const [selectedC, setSelectedC] = useState('');
  const [newTName, setNewTName] = useState('');
  const [newCName, setNewCName] = useState('');
  const [newCourtName, setNewCourtName] = useState('');
  const [atleta1, setAtleta1] = useState('');
  const [atleta2, setAtleta2] = useState('');
  const [matchP1, setMatchP1] = useState('');
  const [matchP2, setMatchP2] = useState('');
  const [matchCourt, setMatchCourt] = useState('');
  const [matchTime, setMatchTime] = useState('');

  const loadData = async () => {
    try {
      const { data: tData } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
      const { data: cData } = await supabase.from('categories').select('*');
      const { data: pData } = await supabase.from('pairs').select('*');
      const { data: coData } = await supabase.from('courts').select('*');
      const { data: mData } = await supabase.from('matches').select('*').order('updated_at', { ascending: false });

      setTournaments(tData || []);
      const catMap = {}; (cData || []).forEach(c => catMap[c.id] = c);
      const pairMap = {}; (pData || []).forEach(p => pairMap[p.id] = p);
      const courtMap = {}; (coData || []).forEach(c => courtMap[c.id] = c);

      const formatted = (mData || []).map(m => ({
        ...m,
        pair1: pairMap[m.pair1_id],
        pair2: pairMap[m.pair2_id],
        category: catMap[m.category_id],
        court: courtMap[m.court_id]
      }));

      setMatches(formatted);
      if (selectedT) {
        setCategories((cData || []).filter(c => c.tournament_id === selectedT));
        setCourts((coData || []).filter(c => c.tournament_id === selectedT));
      }
      if (selectedC) setPairs((pData || []).filter(p => p.category_id === selectedC));
    } catch(e) { console.error(e); }
  };

  useEffect(() => { if (session) loadData(); }, [session, selectedT, selectedC]);

  const handleLogin = (e) => { e.preventDefault(); if (password === 'admin123') { localStorage.setItem('bt_session', 'logged'); setSession('logged'); } else alert('Senha Incorreta!'); };
  const handleLogout = () => { localStorage.removeItem('bt_session'); setSession(null); };

  const finishMatch = async (match, g1, g2, t1, t2) => {
    let games1 = parseInt(g1);
    let games2 = parseInt(g2);
    const tb1 = t1 ? parseInt(t1) : 0;
    const tb2 = t2 ? parseInt(t2) : 0;
    if (games1 === 6 && games2 === 6) {
      if (tb1 === 0 && tb2 === 0) return alert('⚠️ No 6x6 você deve preencher os pontos do Tie-break!');
      if (tb1 === tb2) return alert('⚠️ O Tie-break não pode terminar empatado!');
      if (tb1 > tb2) games1 = 7; else games2 = 7;
    } else if (games1 === games2) return alert('⚠️ Não pode haver empate!');

    const winnerId = games1 > games2 ? match.pair1_id : match.pair2_id;
    const { error } = await supabase.from('matches').update({ 
      pair1_games: games1, pair2_games: games2, pair1_tiebreak: tb1, pair2_tiebreak: tb2,
      status: 'finished', winner_id: winnerId, updated_at: new Date().toISOString()
    }).eq('id', match.id);
    if (error) alert(error.message); else { alert('✅ Placar Oficializado!'); loadData(); }
  };

  const createTournament = async () => { if (!newTName) return; await supabase.from('tournaments').insert([{ name: newTName }]); setNewTName(''); loadData(); };
  const createCategory = async () => { if (!selectedT || !newCName) return; await supabase.from('categories').insert([{ tournament_id: selectedT, name: newCName }]); setNewCName(''); loadData(); };
  const createCourt = async () => { if (!selectedT || !newCourtName) return; await supabase.from('courts').insert([{ tournament_id: selectedT, name: newCourtName }]); setNewCourtName(''); loadData(); };
  const createPair = async () => { if (!selectedC || !atleta1 || !atleta2) return; await supabase.from('pairs').insert([{ category_id: selectedC, name: `${atleta1} / ${atleta2}` }]); setAtleta1(''); setAtleta2(''); loadData(); };
  const createMatch = async () => { if (!selectedT || !selectedC || !matchP1 || !matchP2) return; await supabase.from('matches').insert([{ tournament_id: selectedT, category_id: selectedC, pair1_id: matchP1, pair2_id: matchP2, court_id: matchCourt || null, scheduled_time: matchTime || null, status: 'pending' }]); loadData(); setActiveTab('scoreboard'); };

  if (!session) return (
    <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#000', padding:20}}>
      <div className="app-card" style={{width:'100%', maxWidth:400, textAlign:'center'}}>
        <h2 style={{color:'var(--accent-primary)', marginBottom:30, letterSpacing:2}}>CARECA’S ACCESS</h2>
        <form onSubmit={handleLogin}><input type="password" placeholder="Senha Master" value={password} onChange={e => setPassword(e.target.value)} /><button type="submit" className="btn-primary" style={{width:'100%', padding:18}}>ENTRAR AGORA</button></form>
      </div>
    </div>
  );

  return (
    <div className="admin-wrapper">
      {/* SIDEBAR (Desktop Only) */}
      <aside className="sidebar">
        <div className="sidebar-logo">CARECA’S CLUB</div>
        <nav className="nav-group">
          <div className={`nav-item ${activeTab === 'scoreboard' ? 'active' : ''}`} onClick={() => setActiveTab('scoreboard')}><Swords size={20}/> Score (Ativos)</div>
          <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}><LayoutList size={20}/> Partidas (Encerradas)</div>
          <div className={`nav-item ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}><Gamepad2 size={20}/> Agendar Jogo</div>
          <div className={`nav-item ${activeTab === 'pairs' ? 'active' : ''}`} onClick={() => setActiveTab('pairs')}><UserPlus size={20}/> Duplas</div>
          <div className={`nav-item ${activeTab === 'setup' ? 'active' : ''}`} onClick={() => setActiveTab('setup')}><Settings size={20}/> 1. Configurar</div>
          <div style={{marginTop:'auto'}}><a href="/tv" target="_blank" className="nav-item" style={{textDecoration:'none'}}><Monitor size={20}/> Ver TV</a><div className="nav-item" onClick={handleLogout} style={{color:'var(--accent-secondary)'}}><LogOut size={20}/> Sair</div></div>
        </nav>
      </aside>

      {/* MOBILE BOTTOM NAV */}
      <nav className="mobile-nav" style={{justifyContent:'space-around', padding:'0 5px'}}>
        <div className={`m-nav-item ${activeTab === 'scoreboard' ? 'active' : ''}`} onClick={() => setActiveTab('scoreboard')}><Swords size={20} /><small>Score</small></div>
        <div className={`m-nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}><LayoutList size={20} /><small>Partidas</small></div>
        <div className={`m-nav-item ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}><Gamepad2 size={20} /><small>Agendar</small></div>
        <div className={`m-nav-item ${activeTab === 'pairs' ? 'active' : ''}`} onClick={() => setActiveTab('pairs')}><UserPlus size={20} /><small>Duplas</small></div>
        <div className={`m-nav-item ${activeTab === 'setup' ? 'active' : ''}`} onClick={() => setActiveTab('setup')}><Settings size={20} /><small>Setup</small></div>
      </nav>

      <main className="content-area">
        {activeTab === 'scoreboard' && (
          <div>
            <h1 className="section-title">Em Quadra</h1>
            {matches.filter(m => m.status !== 'finished').map(m => (
              <div key={m.id} className="app-card" style={{borderLeftColor: 'var(--accent-primary)'}}>
                <div style={{textAlign:'center', marginBottom:20, display:'flex', gap:10, justifyContent:'center'}}>
                   <span className="cat-badge">{m.category?.name || 'Geral'}</span>
                   {m.court && <span className="cat-badge" style={{background:'rgba(255,255,255,0.05)', color:'#fff'}}>{m.court.name}</span>}
                   {m.scheduled_time && <span className="cat-badge" style={{background:'rgba(255,255,255,0.05)', color:'#fff'}}>{m.scheduled_time}</span>}
                </div>
                <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:15, marginBottom:25}}>
                  <div style={{flex:1, textAlign:'center'}}><div style={{fontWeight:800, marginBottom:10, fontSize:'0.9rem', height:'2rem'}}>{m.pair1?.name}</div><input id={`g1-${m.id}`} type="number" placeholder="0" style={{width:80, height:80, textAlign:'center', fontSize:'2rem', fontWeight:900, marginBottom:0, background:'#1a1a1a', border:'1px solid #333', borderRadius:12, color:'#fff'}} /></div>
                  <div style={{fontSize:'1.5rem', opacity:0.3, fontWeight:900}}>X</div>
                  <div style={{flex:1, textAlign:'center'}}><div style={{fontWeight:800, marginBottom:10, fontSize:'0.9rem', height:'2rem'}}>{m.pair2?.name}</div><input id={`g2-${m.id}`} type="number" placeholder="0" style={{width:80, height:80, textAlign:'center', fontSize:'2rem', fontWeight:900, marginBottom:0, background:'#1a1a1a', border:'1px solid #333', borderRadius:12, color:'#fff'}} /></div>
                </div>
                <div style={{display:'flex', justifyContent:'center', gap:10, opacity:0.6, marginBottom:20}}>
                   <div><div style={{fontSize:'0.6rem', textAlign:'center', fontWeight:900}}>TB Pts</div><input id={`t1-${m.id}`} type="number" style={{width:60, padding:8, textAlign:'center', marginBottom:0, background:'#111', border:'1px solid #222', borderRadius:8, color:'#fff'}} /></div>
                   <div style={{alignSelf:'flex-end', paddingBottom:10}}>-</div>
                   <div><div style={{fontSize:'0.6rem', textAlign:'center', fontWeight:900}}>TB Pts</div><input id={`t2-${m.id}`} type="number" style={{width:60, padding:8, textAlign:'center', marginBottom:0, background:'#111', border:'1px solid #222', borderRadius:8, color:'#fff'}} /></div>
                </div>
                <button className="btn-primary" style={{width:'100%', height:60}} onClick={() => {
                  const g1 = document.getElementById(`g1-${m.id}`).value;
                  const g2 = document.getElementById(`g2-${m.id}`).value;
                  const t1 = document.getElementById(`t1-${m.id}`).value;
                  const t2 = document.getElementById(`t2-${m.id}`).value;
                  if (g1 === '' || g2 === '') return alert('Games Mandatórios!');
                  finishMatch(m, g1, g2, t1, t2);
                }}>Lançar Placar</button>
              </div>
            ))}
            {matches.filter(m => m.status !== 'finished').length === 0 && <p style={{textAlign:'center', opacity:0.2, padding:100, marginTop:50}}>Nenhum jogo em quadra no momento.</p>}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h1 className="section-title">Partidas Encerradas</h1>
            <div style={{display:'grid', gap:10}}>
              {matches.filter(m => m.status === 'finished').map(m => (
                <div key={m.id} className="app-card" style={{padding: 15, opacity: 0.9, borderLeft: '4px solid var(--accent-primary)'}}>
                   <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.7rem', marginBottom:10}}>
                      <span style={{color:'var(--accent-primary)', fontWeight:800}}>{m.category?.name} • {m.court?.name}</span>
                      <span style={{opacity:0.5}}>{new Date(m.updated_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                   </div>
                   <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div style={{flex: 1, fontWeight: m.winner_id === m.pair1_id ? 900 : 400, color: m.winner_id === m.pair1_id ? '#fff' : '#666'}}>
                        {m.pair1?.name} <span style={{color:'var(--accent-primary)', marginLeft:10}}>{m.pair1_games}</span>
                      </div>
                      <div style={{fontSize:'0.8rem', opacity:0.3, margin:'0 10px'}}>X</div>
                      <div style={{flex: 1, fontWeight: m.winner_id === m.pair2_id ? 900 : 400, color: m.winner_id === m.pair2_id ? '#fff' : '#666', textAlign:'right'}}>
                        <span style={{color:'var(--accent-primary)', marginRight:10}}>{m.pair2_games}</span> {m.pair2?.name}
                      </div>
                   </div>
                   {(m.pair1_tiebreak || m.pair2_tiebreak) && (
                     <div style={{textAlign:'center', fontSize:'0.7rem', opacity:0.3, marginTop:5}}>
                        Tie-break: {m.pair1_tiebreak} - {m.pair2_tiebreak}
                     </div>
                   )}
                </div>
              ))}
              {matches.filter(m => m.status === 'finished').length === 0 && <p style={{textAlign:'center', opacity:0.2, padding:100}}>Nenhum resultado registrado ainda.</p>}
            </div>
          </div>
        )}

        {activeTab === 'setup' && (
          <div style={{maxWidth:600, margin:'0 auto'}}>
            <h1 className="section-title">Configurar</h1>
            <div className="app-card"><label className="input-label">Novo Torneio</label><input value={newTName} onChange={e => setNewTName(e.target.value)} placeholder="Ex: Open Verão" /><button onClick={createTournament} className="btn-primary" style={{width:'100%', height:55}}>Salvar Evento</button></div>
            {tournaments.length > 0 && (
              <>
                <div className="app-card"><label className="input-label">Selecionar Torneio</label><select value={selectedT} onChange={e => setSelectedT(e.target.value)}><option value="">Escolha...</option>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                {selectedT && (
                  <div style={{display:'grid', gap:20}}>
                    <div className="app-card"><label className="input-label">Nova Categoria</label><div style={{display:'flex', gap:10}}><input value={newCName} onChange={e => setNewCName(e.target.value)} placeholder="Ex: Masculino A" style={{marginBottom:0}} /><button onClick={createCategory} className="btn-primary" style={{padding:'0 25px'}}><PlusCircle/></button></div></div>
                    <div className="app-card"><label className="input-label">Nova Quadra</label><div style={{display:'flex', gap:10}}><input value={newCourtName} onChange={e => setNewCourtName(e.target.value)} placeholder="Ex: Quadra 01" style={{marginBottom:0}} /><button onClick={createCourt} className="btn-primary" style={{padding:'0 25px'}}><MapPin/></button></div></div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'pairs' && (
          <div style={{maxWidth:600, margin:'0 auto'}}>
            <h1 className="section-title">2. Duplas</h1>
            <div className="app-card">
               <label className="input-label">Torneio e Categoria</label>
               <div style={{display:'grid', gap:10, marginBottom:20}}><select value={selectedT} onChange={e => setSelectedT(e.target.value)} style={{marginBottom:0}}><option value="">Torneio...</option>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><select value={selectedC} onChange={e => setSelectedC(e.target.value)} style={{marginBottom:0}}><option value="">Categoria...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
               {selectedC && <><label className="input-label">Nomes dos Atletas</label><input placeholder="Atleta 1" value={atleta1} onChange={e => setAtleta1(e.target.value)} /><input placeholder="Atleta 2" value={atleta2} onChange={e => setAtleta2(e.target.value)} /><button onClick={createPair} className="btn-primary" style={{width:'100%', height:55}}>REGISTRAR DUPLA</button></>}
            </div>
          </div>
        )}

        {activeTab === 'matches' && (
          <div style={{maxWidth:600, margin:'0 auto'}}>
            <h1 className="section-title">3. Agendar Jogo</h1>
            <div className="app-card">
               <label className="input-label">Torneio e Categoria</label>
               <div style={{display:'grid', gap:10, marginBottom:20}}><select value={selectedT} onChange={e => setSelectedT(e.target.value)} style={{marginBottom:0}}><option value="">Torneio...</option>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><select value={selectedC} onChange={e => setSelectedC(e.target.value)} style={{marginBottom:0}}><option value="">Categoria...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
               {selectedC && (
                 <>
                   <label className="input-label">Escolher Confronto</label>
                   <select value={matchP1} onChange={e => setMatchP1(e.target.value)} style={{marginBottom:10}}><option value="">Selecione Dupla 1</option>{pairs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                   <div style={{textAlign:'center', fontWeight:900, marginBottom:10, color:'var(--accent-primary)', fontSize:'0.7rem'}}>VERSUS</div>
                   <select value={matchP2} onChange={e => setMatchP2(e.target.value)}><option value="">Selecione Dupla 2</option>{pairs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                   
                   <label className="input-label" style={{marginTop:20}}>Informações de Quadra</label>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                     <select value={matchCourt} onChange={e => setMatchCourt(e.target.value)}><option value="">Quadra...</option>{courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                     <input type="time" value={matchTime} onChange={e => setMatchTime(e.target.value)} />
                   </div>
                   
                   <button onClick={createMatch} className="btn-primary" style={{width:'100%', height:60, marginTop:10}}>GERAR JOGO E QUADRA</button>
                 </>
               )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
