import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Trophy, Swords, LayoutList, Users, LogOut, FileUp, Monitor, CheckCircle2, PlusCircle, UserPlus, Gamepad2, Settings } from 'lucide-react';

export default function Admin() {
  const [session, setSession] = useState(localStorage.getItem('bt_session'));
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('scoreboard');
  
  // States do Banco
  const [matches, setMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pairs, setPairs] = useState([]);
  
  // Form States
  const [selectedT, setSelectedT] = useState('');
  const [selectedC, setSelectedC] = useState('');
  const [newTName, setNewTName] = useState('');
  const [newCName, setNewCName] = useState('');
  const [atleta1, setAtleta1] = useState('');
  const [atleta2, setAtleta2] = useState('');
  const [matchP1, setMatchP1] = useState('');
  const [matchP2, setMatchP2] = useState('');

  const loadData = async () => {
    try {
      const { data: tData } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
      const { data: cData } = await supabase.from('categories').select('*');
      const { data: pData } = await supabase.from('pairs').select('*');
      const { data: mData } = await supabase.from('matches').select('*').order('updated_at', { ascending: false });

      setTournaments(tData || []);
      const catMap = {}; (cData || []).forEach(c => catMap[c.id] = c);
      const pairMap = {}; (pData || []).forEach(p => pairMap[p.id] = p);

      const formatted = (mData || []).map(m => ({
        ...m,
        pair1: pairMap[m.pair1_id],
        pair2: pairMap[m.pair2_id],
        category: catMap[m.category_id]
      }));

      setMatches(formatted);
      if (selectedT) setCategories((cData || []).filter(c => c.tournament_id === selectedT));
      if (selectedC) setPairs((pData || []).filter(p => p.category_id === selectedC));
    } catch(e) { console.error(e); }
  };

  useEffect(() => { if (session) loadData(); }, [session, selectedT, selectedC]);

  const handleLogin = (e) => { e.preventDefault(); if (password === 'admin123') { localStorage.setItem('bt_session', 'logged'); setSession('logged'); } else alert('Senha Incorreta!'); };
  const handleLogout = () => { localStorage.removeItem('bt_session'); setSession(null); };

  const finishMatch = async (match, g1, g2, t1, t2) => {
    const games1 = parseInt(g1);
    const games2 = parseInt(g2);
    if (games1 === 6 && games2 === 6) return alert('⚠️ Em 6x6 o jogo deve ir até 7! Digite 7x6 para o vencedor.');
    if (games1 === games2) return alert('⚠️ Não pode haver empate no Beach Tennis!');

    const winnerId = games1 > games2 ? match.pair1_id : match.pair2_id;
    const { error } = await supabase.from('matches').update({ 
      pair1_games: games1, pair2_games: games2, 
      pair1_tiebreak: t1 ? parseInt(t1) : 0, pair2_tiebreak: t2 ? parseInt(t2) : 0,
      status: 'finished', winner_id: winnerId, updated_at: new Date().toISOString()
    }).eq('id', match.id);
    if (error) alert(error.message); else { alert('Resultado Enviado!'); loadData(); }
  };

  const createTournament = async () => { if (!newTName) return; await supabase.from('tournaments').insert([{ name: newTName }]); setNewTName(''); loadData(); };
  const createCategory = async () => { if (!selectedT || !newCName) return; await supabase.from('categories').insert([{ tournament_id: selectedT, name: newCName }]); setNewCName(''); loadData(); };
  const createPair = async () => { if (!selectedC || !atleta1 || !atleta2) return; await supabase.from('pairs').insert([{ category_id: selectedC, name: `${atleta1} / ${atleta2}` }]); setAtleta1(''); setAtleta2(''); loadData(); };
  const createMatch = async () => { if (!selectedT || !selectedC || !matchP1 || !matchP2) return; await supabase.from('matches').insert([{ tournament_id: selectedT, category_id: selectedC, pair1_id: matchP1, pair2_id: matchP2, status: 'pending' }]); loadData(); setActiveTab('scoreboard'); };

  if (!session) return (
    <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#000', padding:20}}>
      <div className="app-card" style={{width:'100%', maxWidth:400, textAlign:'center'}}>
        <h2 style={{color:'var(--accent-primary)', marginBottom:30, letterSpacing:2}}>CARECA’S ACCESS</h2>
        <form onSubmit={handleLogin}>
          <input type="password" placeholder="Senha Master" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit" className="btn-primary" style={{width:'100%', padding:18}}>ENTRAR AGORA</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="admin-wrapper">
      {/* SIDEBAR (Desktop Only) */}
      <aside className="sidebar">
        <div className="sidebar-logo">CARECA’S CLUB</div>
        <nav className="nav-group">
          <div className={`nav-item ${activeTab === 'scoreboard' ? 'active' : ''}`} onClick={() => setActiveTab('scoreboard')}><Swords size={20}/> Resultados</div>
          <div className={`nav-item ${activeTab === 'setup' ? 'active' : ''}`} onClick={() => setActiveTab('setup')}><Settings size={20}/> 1. Configurar</div>
          <div className={`nav-item ${activeTab === 'pairs' ? 'active' : ''}`} onClick={() => setActiveTab('pairs')}><UserPlus size={20}/> 2. Duplas</div>
          <div className={`nav-item ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}><Gamepad2 size={20}/> 3. Partidas</div>
          <div style={{marginTop:'auto'}}>
            <a href="/tv" target="_blank" className="nav-item" style={{textDecoration:'none'}}><Monitor size={20}/> Ver TV</a>
            <div className="nav-item" onClick={handleLogout} style={{color:'var(--accent-secondary)'}}><LogOut size={20}/> Sair</div>
          </div>
        </nav>
      </aside>

      {/* MOBILE BOTTOM NAV */}
      <nav className="mobile-nav">
        <div className={`m-nav-item ${activeTab === 'scoreboard' ? 'active' : ''}`} onClick={() => setActiveTab('scoreboard')}><Swords /><small>Score</small></div>
        <div className={`m-nav-item ${activeTab === 'setup' ? 'active' : ''}`} onClick={() => setActiveTab('setup')}><Settings /><small>Setup</small></div>
        <div className={`m-nav-item ${activeTab === 'pairs' ? 'active' : ''}`} onClick={() => setActiveTab('pairs')}><UserPlus /><small>Duplas</small></div>
        <div className={`m-nav-item ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}><Gamepad2 /><small>Partidas</small></div>
      </nav>

      <main className="content-area">
        {activeTab === 'scoreboard' && (
          <div>
            <h1 className="section-title">Resultados</h1>
            {matches.filter(m => m.status !== 'finished').map(m => (
              <div key={m.id} className="app-card">
                <div style={{textAlign:'center', marginBottom:20}}><span className="cat-badge">{m.category?.name || 'Iniciante'}</span></div>
                <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:15, marginBottom:25}}>
                  <div style={{flex:1, textAlign:'center'}}>
                    <div style={{fontWeight:800, marginBottom:10, fontSize:'0.9rem', height:'2rem'}}>{m.pair1?.name}</div>
                    <input id={`g1-${m.id}`} type="number" placeholder="0" className="score-input" style={{width:80, height:80, textAlign:'center', fontSize:'2rem', fontWeight:900, marginBottom:0}} />
                  </div>
                  <div style={{fontSize:'1.5rem', opacity:0.3, fontWeight:900}}>X</div>
                  <div style={{flex:1, textAlign:'center'}}>
                    <div style={{fontWeight:800, marginBottom:10, fontSize:'0.9rem', height:'2rem'}}>{m.pair2?.name}</div>
                    <input id={`g2-${m.id}`} type="number" placeholder="0" className="score-input" style={{width:80, height:80, textAlign:'center', fontSize:'2rem', fontWeight:900, marginBottom:0}} />
                  </div>
                </div>
                
                {/* Tie Break */}
                <div style={{display:'flex', justifyContent:'center', gap:10, opacity:0.6, marginBottom:20}}>
                   <div><div style={{fontSize:'0.6rem', textAlign:'center', fontWeight:900}}>TB Pts</div><input id={`t1-${m.id}`} type="number" style={{width:60, padding:8, textAlign:'center', marginBottom:0}} /></div>
                   <div style={{alignSelf:'flex-end', paddingBottom:10}}>-</div>
                   <div><div style={{fontSize:'0.6rem', textAlign:'center', fontWeight:900}}>TB Pts</div><input id={`t2-${m.id}`} type="number" style={{width:60, padding:8, textAlign:'center', marginBottom:0}} /></div>
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
            {matches.filter(m => m.status === 'finished').length === 0 && <p style={{textAlign:'center', opacity:0.3}}>Nenhum jogo em quadra.</p>}
          </div>
        )}

        {activeTab === 'setup' && (
          <div style={{maxWidth:600, margin:'0 auto'}}>
            <h1 className="section-title">1. Configurar</h1>
            <div className="app-card">
              <label className="input-label">Nome do Torneio</label>
              <input value={newTName} onChange={e => setNewTName(e.target.value)} placeholder="Ex: Open 2026" />
              <button onClick={createTournament} className="btn-primary" style={{width:'100%', height:55}}>Salvar Evento</button>
            </div>
            {tournaments.length > 0 && (
              <div className="app-card">
                <label className="input-label">Selecionar Torneio</label>
                <select value={selectedT} onChange={e => setSelectedT(e.target.value)}>
                  <option value="">Escolha...</option>
                  {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {selectedT && (
                  <>
                    <label className="input-label">Nova Categoria</label>
                    <div style={{display:'flex', gap:10}}>
                      <input value={newCName} onChange={e => setNewCName(e.target.value)} placeholder="Ex: Masculino A" style={{marginBottom:0}} />
                      <button onClick={createCategory} className="btn-primary" style={{padding:'0 25px'}}>ADD</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'pairs' && (
          <div style={{maxWidth:600, margin:'0 auto'}}>
            <h1 className="section-title">2. Cadastro Duplas</h1>
            <div className="app-card">
               <label className="input-label">Torneio e Categoria</label>
               <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20}}>
                 <select value={selectedT} onChange={e => setSelectedT(e.target.value)} style={{marginBottom:0}}>
                   <option value="">Torneio...</option>
                   {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                 </select>
                 <select value={selectedC} onChange={e => setSelectedC(e.target.value)} style={{marginBottom:0}}>
                   <option value="">Categoria...</option>
                   {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
               </div>
               {selectedC && (
                 <>
                   <label className="input-label">Nomes dos Atletas</label>
                   <input placeholder="Atleta 1" value={atleta1} onChange={e => setAtleta1(e.target.value)} />
                   <input placeholder="Atleta 2" value={atleta2} onChange={e => setAtleta2(e.target.value)} />
                   <button onClick={createPair} className="btn-primary" style={{width:'100%', height:55}}>REGISTRAR DUPLA</button>
                 </>
               )}
            </div>
          </div>
        )}

        {activeTab === 'matches' && (
          <div style={{maxWidth:600, margin:'0 auto'}}>
            <h1 className="section-title">3. Agendar Partida</h1>
            <div className="app-card">
               <label className="input-label">Filtrar Categoria</label>
               <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20}}>
                 <select value={selectedT} onChange={e => setSelectedT(e.target.value)} style={{marginBottom:0}}>
                   <option value="">Torneio...</option>
                   {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                 </select>
                 <select value={selectedC} onChange={e => setSelectedC(e.target.value)} style={{marginBottom:0}}>
                   <option value="">Categoria...</option>
                   {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
               </div>
               {selectedC && (
                 <>
                   <label className="input-label">Escolher Confronto</label>
                   <select value={matchP1} onChange={e => setMatchP1(e.target.value)}>
                     <option value="">Selecione Dupla 1</option>
                     {pairs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                   </select>
                   <div style={{textAlign:'center', fontWeight:900, marginBottom:15, color:'var(--accent-primary)'}}>VERSUS</div>
                   <select value={matchP2} onChange={e => setMatchP2(e.target.value)}>
                     <option value="">Selecione Dupla 2</option>
                     {pairs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                   </select>
                   <button onClick={createMatch} className="btn-primary" style={{width:'100%', height:60, marginTop:10}}>CONFIRMAR E GERAR JOGO</button>
                 </>
               )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
