import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Trophy, Swords, LayoutList, Users, LogOut, FileUp, Monitor, CheckCircle2, PlusCircle, UserPlus, Gamepad2 } from 'lucide-react';

export default function Admin() {
  const [session, setSession] = useState(localStorage.getItem('bt_session'));
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('scoreboard');
  const [matches, setMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [selectedT, setSelectedT] = useState('');
  const [selectedC, setSelectedC] = useState('');
  const [newTName, setNewTName] = useState('');
  const [newCName, setNewCName] = useState('');
  const [p1Name, setP1Name] = useState('');
  const [p2Name, setP2Name] = useState('');
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
    } catch(e) { console.error('Erro:', e); }
  };

  useEffect(() => { if (session) loadData(); }, [session, selectedT, selectedC]);
  const login = (e) => { e.preventDefault(); if (password === 'admin123') { localStorage.setItem('bt_session', 'logged'); setSession('logged'); } else alert('Senha inválida'); };
  const logout = () => { localStorage.removeItem('bt_session'); setSession(null); };

  const finishMatch = async (match, g1, g2, t1, t2) => {
    const winnerId = parseInt(g1) > parseInt(g2) ? match.pair1_id : match.pair2_id;
    const { error } = await supabase.from('matches').update({ 
      pair1_games: parseInt(g1), 
      pair2_games: parseInt(g2), 
      pair1_tiebreak: t1 ? parseInt(t1) : 0,
      pair2_tiebreak: t2 ? parseInt(t2) : 0,
      status: 'finished', 
      winner_id: winnerId,
      updated_at: new Date().toISOString()
    }).eq('id', match.id);
    if (error) alert(error.message); else { alert('Resultado Finalizado!'); loadData(); }
  };

  const createTournament = async () => { await supabase.from('tournaments').insert([{ name: newTName }]); setNewTName(''); loadData(); };
  const createCategory = async () => { await supabase.from('categories').insert([{ tournament_id: selectedT, name: newCName }]); setNewCName(''); loadData(); };
  const createPair = async () => { await supabase.from('pairs').insert([{ category_id: selectedC, name: `${p1Name} / ${p2Name}` }]); setP1Name(''); setP2Name(''); loadData(); };
  const createMatch = async () => { await supabase.from('matches').insert([{ tournament_id: selectedT, category_id: selectedC, pair1_id: matchP1, pair2_id: matchP2, status: 'pending' }]); loadData(); setActiveTab('scoreboard'); };

  if (!session) return (<div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#000'}}><div className="glass-panel" style={{padding:50, textAlign:'center', border:'2px solid var(--accent-primary)', width:400, borderRadius:32}}><h2 style={{color:'#fff', marginBottom:30}}>CARECA’S CLUB</h2><form onSubmit={login}><input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} style={{width:'100%', padding:12, marginBottom:20, background:'#111', border:'1px solid #333', color:'#fff'}} /><button type="submit" className="btn-primary" style={{width:'100%'}}>ENTRAR</button></form></div></div>);

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar glass-panel">
        <div className="sidebar-brand">CARECA’S CLUB</div>
        <nav className="admin-nav">
          <div className={`nav-link ${activeTab === 'scoreboard' ? 'active' : ''}`} onClick={() => setActiveTab('scoreboard')}> <Swords size={18} /> Resultados</div>
          <div className={`nav-link ${activeTab === 'setup' ? 'active' : ''}`} onClick={() => setActiveTab('setup')}> <PlusCircle size={18} /> 1. Configurar</div>
          <div className={`nav-link ${activeTab === 'pairs' ? 'active' : ''}`} onClick={() => setActiveTab('pairs')}> <UserPlus size={18} /> 2. Duplas</div>
          <div className={`nav-link ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}> <Gamepad2 size={18} /> 3. Partidas</div>
          <div style={{flex:1}}></div>
          <a href="/tv" target="_blank" className="nav-link" style={{color:'var(--accent-primary)', textDecoration:'none'}}><Monitor size={18}/> Tela da TV</a>
        </nav>
      </aside>

      <main className="admin-main">
        {activeTab === 'scoreboard' && (
          <div className="admin-view-container">
            <h2 className="view-title">Digitar Resultado Final</h2>
            <div className="matches-list">
              {matches.filter(m => m.status !== 'finished').map(m => (
                <div key={m.id} className="glass-panel match-ctrl-card">
                  <div className="card-header"><span className="cat-badge">{m.category?.name || 'Geral'}</span></div>
                  <div style={{display:'flex', alignItems:'center', gap:20, justifyContent:'center', marginTop:20}}>
                    <div style={{textAlign:'center',flex:1}}><div style={{fontWeight:'900', color:'#fff', height:'3rem'}}>{m.pair1?.name || '...'}</div><input id={`g1-${m.id}`} type="number" placeholder="Games" style={{width:80, height:80, fontSize:'2rem', textAlign:'center', borderRadius:12}} /></div>
                    <div style={{opacity:0.3, fontSize:'2rem'}}>X</div>
                    <div style={{textAlign:'center',flex:1}}><div style={{fontWeight:'900', color:'#fff', height:'3rem'}}>{m.pair2?.name || '...'}</div><input id={`g2-${m.id}`} type="number" placeholder="Games" style={{width:80, height:80, fontSize:'2rem', textAlign:'center', borderRadius:12}} /></div>
                  </div>
                  
                  {/* Tie-break opcional */}
                  <div style={{marginTop: 20, textAlign:'center'}}>
                    <p style={{fontSize: '0.8rem', opacity: 0.5, marginBottom: 10}}>Teve Tie-break? (Opcional)</p>
                    <div style={{display:'flex', justifyContent:'center', gap: 10}}>
                       <input id={`t1-${m.id}`} type="number" placeholder="Pts" style={{width:60, background:'rgba(255,255,255,0.05)', textAlign:'center'}} />
                       <span style={{opacity:0.2}}>-</span>
                       <input id={`t2-${m.id}`} type="number" placeholder="Pts" style={{width:60, background:'rgba(255,255,255,0.05)', textAlign:'center'}} />
                    </div>
                  </div>

                  <button className="btn-primary" style={{width:'100%', marginTop:30, height:65}} onClick={() => {
                     const g1 = document.getElementById(`g1-${m.id}`).value;
                     const g2 = document.getElementById(`g2-${m.id}`).value;
                     const t1 = document.getElementById(`t1-${m.id}`).value;
                     const t2 = document.getElementById(`t2-${m.id}`).value;
                     if (g1 === '' || g2 === '') return alert('Preencha os games!');
                     finishMatch(m, g1, g2, t1, t2);
                  }}> FINALIZAR E LANÇAR NA TV </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="admin-view-container" style={{maxWidth:700}}>
             <input style={{width:'100%', marginBottom:15}} value={newTName} onChange={e => setNewTName(e.target.value)} placeholder="Novo Torneio" /><button onClick={createTournament} className="btn-primary" style={{width:'100%'}}>Salvar</button>
             {tournaments.length > 0 && <div style={{marginTop:30}}><select style={{width:'100%', marginBottom:15}} value={selectedT} onChange={e => setSelectedT(e.target.value)}><option value="">Selecione o Torneio</option>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>{selectedT && <div style={{display:'flex', gap:10}}><input style={{flex:1}} value={newCName} onChange={e => setNewCName(e.target.value)} placeholder="Categoria" /><button onClick={createCategory} className="btn-primary">Criar</button></div>}</div>}
          </div>
        )}
        {activeTab === 'pairs' && (
          <div className="admin-view-container" style={{maxWidth:700}}>
             <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20}}><select value={selectedT} onChange={e => setSelectedT(e.target.value)}><option value="">Torneio...</option>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><select value={selectedC} onChange={e => setSelectedC(e.target.value)}><option value="">Categoria...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
             {selectedC && <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}><input placeholder="Atleta 1" value={p1Name} onChange={e => setP1Name(e.target.value)} /><input placeholder="Atleta 2" value={p2Name} onChange={e => setP2Name(e.target.value)} /><button onClick={createPair} className="btn-primary" style={{gridColumn:'1 / span 2'}}>REGISTRAR DUPLA</button></div>}
          </div>
        )}
        {activeTab === 'matches' && (
          <div className="admin-view-container" style={{maxWidth:700}}>
             <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20}}><select value={selectedT} onChange={e => setSelectedT(e.target.value)}><option value="">Torneio...</option>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><select value={selectedC} onChange={e => setSelectedC(e.target.value)}><option value="">Categoria...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
             {selectedC && <div><div style={{display:'flex', gap:15, marginBottom:20, alignItems:'center'}}><select style={{flex:1}} value={matchP1} onChange={e => setMatchP1(e.target.value)}><option value="">Dupla 1</option>{pairs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><div style={{fontWeight:'900', color:'var(--accent-primary)'}}>X</div><select style={{flex:1}} value={matchP2} onChange={e => setMatchP2(e.target.value)}><option value="">Dupla 2</option>{pairs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><button onClick={createMatch} className="btn-primary" style={{width:'100%'}}>AGENDAR JOGO AGORA</button></div>}
          </div>
        )}
      </main>
    </div>
  );
}
