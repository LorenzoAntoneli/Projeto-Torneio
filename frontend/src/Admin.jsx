import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import Papa from 'papaparse';
import { Trophy, Swords, LayoutList, Users, LogOut, FileUp, Monitor, PlayCircle, Settings, PlusCircle, Gamepad2, UserPlus, CheckCircle2 } from 'lucide-react';

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
      setTournaments(tData || []);
      const { data: mData } = await supabase.from('matches').select('*, pair1:pairs!matches_pair1_id_fkey(name), pair2:pairs!matches_pair2_id_fkey(name), category:categories(name)').order('updated_at', { ascending: false });
      setMatches(mData || []);
    } catch(e) { console.error(e); }
  };

  useEffect(() => { if (session) loadData(); }, [session]);
  
  useEffect(() => { 
    if (selectedT) {
      supabase.from('categories').select('*').eq('tournament_id', selectedT).then(({ data }) => setCategories(data || [])); 
    } else {
      setCategories([]);
      setSelectedC('');
    }
  }, [selectedT]);
  
  useEffect(() => { 
    if (selectedC) {
       supabase.from('pairs').select('*').eq('category_id', selectedC).then(({ data }) => setPairs(data || [])); 
    } else {
       setPairs([]);
    }
  }, [selectedC]);

  const login = (e) => { e.preventDefault(); if (password === 'admin123') { localStorage.setItem('bt_session', 'logged'); setSession('logged'); } else alert('Senha inválida'); };
  const logout = () => { localStorage.removeItem('bt_session'); setSession(null); };

  const createTournament = async () => { 
    if (!newTName) return alert('Insira o nome do torneio!'); 
    const { error } = await supabase.from('tournaments').insert([{ name: newTName }]); 
    if (error) alert('Erro: ' + error.message);
    else { alert('Torneio criado com sucesso!'); setNewTName(''); loadData(); }
  };

  const createCategory = async () => { 
    if (!selectedT || !newCName) return alert('Selecione o torneio e o nome da categoria!'); 
    const { error } = await supabase.from('categories').insert([{ tournament_id: selectedT, name: newCName }]); 
    if (error) alert('Erro: ' + error.message);
    else { alert('Categoria adicionada!'); setNewCName(''); loadData(); }
  };

  const createPair = async () => { 
    if (!selectedC || !p1Name || !p2Name) return alert('Escolha a categoria e digite o nome dos dois atletas!'); 
    const fullName = `${p1Name} / ${p2Name}`;
    const { error } = await supabase.from('pairs').insert([{ category_id: selectedC, name: fullName }]); 
    if (error) alert('Erro: ' + error.message);
    else { alert(`Dupla ${fullName} registrada!`); setP1Name(''); setP2Name(''); loadData(); }
  };

  const createMatch = async () => { 
    if (!selectedT || !selectedC || !matchP1 || !matchP2) return alert('Por favor, selecione todos os campos para criar a partida!'); 
    if (matchP1 === matchP2) return alert('Uma dupla não pode jogar contra ela mesma!');

    const { error } = await supabase.from('matches').insert([{ 
      tournament_id: selectedT,
      category_id: selectedC, 
      pair1_id: matchP1, 
      pair2_id: matchP2, 
      pair1_games: 0, 
      pair2_games: 0, 
      status: 'pending' 
    }]); 

    if (error) {
      alert('Erro ao criar partida: ' + error.message);
    } else {
      alert('Partida agendada e enviada para a tela de resultados!');
      setMatchP1(''); 
      setMatchP2(''); 
      loadData(); 
      setActiveTab('scoreboard'); 
    }
  };

  const finishMatch = async (match, g1, g2) => {
    const winnerId = parseInt(g1) > parseInt(g2) ? match.pair1_id : match.pair2_id;
    const { error } = await supabase.from('matches').update({ 
      pair1_games: parseInt(g1), 
      pair2_games: parseInt(g2), 
      status: 'finished', 
      winner_id: winnerId,
      updated_at: new Date() 
    }).eq('id', match.id);
    
    if (error) alert('Erro ao finalizar: ' + error.message);
    else { alert('Resultado enviado com sucesso!'); loadData(); }
  };

  if (!session) return (
    <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#000'}}>
      <div className="glass-panel" style={{padding:50, textAlign:'center', border:'2px solid var(--accent-primary)', width:400, borderRadius:32}}>
        <h2 style={{color:'#fff', marginBottom:30}}>CARECA’S ADMIN</h2>
        <form onSubmit={login}>
          <input type="password" placeholder="Senha Master" value={password} onChange={e => setPassword(e.target.value)} style={{width:'100%', padding:12, marginBottom:20, background:'#111', border:'1px solid #333', color:'#fff'}} />
          <button type="submit" className="btn-primary" style={{width:'100%', padding:12}}>CONECTAR</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar glass-panel">
        <div className="sidebar-brand">CARECA’S CLUB</div>
        <nav className="admin-nav">
          <div className={`nav-link ${activeTab === 'scoreboard' ? 'active' : ''}`} onClick={() => setActiveTab('scoreboard')}> <Swords size={18} /> Resultados</div>
          <div style={{height: 20}}></div>
          <div className={`nav-link ${activeTab === 'setup' ? 'active' : ''}`} onClick={() => setActiveTab('setup')}> <PlusCircle size={18} /> 1. Configurar</div>
          <div className={`nav-link ${activeTab === 'pairs' ? 'active' : ''}`} onClick={() => setActiveTab('pairs')}> <UserPlus size={18} /> 2. Duplas</div>
          <div className={`nav-link ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}> <Gamepad2 size={18} /> 3. Partidas</div>
          <div style={{flex: 1}}></div>
          <a href="/tv" target="_blank" className="nav-link" style={{color:'var(--accent-primary)', textDecoration:'none'}}><Monitor size={18}/> Tela da TV</a>
          <div className="nav-link" onClick={logout} style={{color:'var(--accent-danger)'}}><LogOut size={18}/> Sair</div>
        </nav>
      </aside>

      <main className="admin-main">
        {activeTab === 'scoreboard' && (
          <div className="admin-view-container">
            <h2 className="view-title">Placar de Campo</h2>
            <div className="matches-list">
              {matches.filter(m => m.status !== 'finished').map(m => (
                <div key={m.id} className="glass-panel match-ctrl-card">
                  <div className="card-header">
                    <span className="cat-badge">{m.category?.name}</span>
                    <span style={{color: 'var(--accent-warning)', fontWeight:'bold'}}>EM QUADRA</span>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:20, justifyContent:'center', marginTop:20}}>
                    <div style={{textAlign:'center', flex:1}}>
                      <div style={{fontSize:'1.3rem', fontWeight:'900', marginBottom:15, color:'#fff'}}>{m.pair1?.name}</div>
                      <input id={`g1-${m.id}`} type="number" placeholder="0" style={{width:80, height:80, fontSize:'2.5rem', textAlign:'center', fontWeight:'bold', border:'2px solid var(--accent-primary)', borderRadius:12}} />
                    </div>
                    <div style={{fontSize:'2rem', fontWeight:'900', opacity:0.3}}>X</div>
                    <div style={{textAlign:'center', flex:1}}>
                      <div style={{fontSize:'1.3rem', fontWeight:'900', marginBottom:15, color:'#fff'}}>{m.pair2?.name}</div>
                      <input id={`g2-${m.id}`} type="number" placeholder="0" style={{width:80, height:80, fontSize:'2.5rem', textAlign:'center', fontWeight:'bold', border:'2px solid var(--accent-primary)', borderRadius:12}} />
                    </div>
                  </div>
                  <button className="btn-primary" style={{width:'100%', marginTop:30, height:65}} 
                    onClick={() => {
                       const g1Input = document.getElementById(`g1-${m.id}`);
                       const g2Input = document.getElementById(`g2-${m.id}`);
                       if (g1Input.value === '' || g2Input.value === '') return alert('Por favor, informe a pontuação das duas duplas!');
                       finishMatch(m, g1Input.value, g2Input.value);
                    }}>
                    SALVAR RESULTADO FINAL
                  </button>
                </div>
              ))}
              
              {matches.filter(m => m.status === 'finished').length > 0 && <h3 style={{margin:'40px 0 20px', color: 'var(--accent-primary)'}}>RESULTADOS RECENTES</h3>}
              <div style={{display:'grid', gap:10}}>
                {matches.filter(m => m.status === 'finished').slice(0, 10).map(m => (
                  <div key={m.id} className="glass-panel" style={{padding:20, display:'flex', justifyContent:'space-between', borderRadius:12, opacity:0.8}}>
                    <span style={{fontWeight:'900'}}>{m.pair1?.name} <span style={{color:'var(--accent-primary)', margin:'0 10px'}}>{m.pair1_games}</span></span>
                    <span style={{opacity:0.3}}>X</span>
                    <span style={{fontWeight:'900'}}><span style={{color:'var(--accent-primary)', margin:'0 10px'}}>{m.pair2_games}</span> {m.pair2?.name}</span>
                    <span style={{color:'var(--accent-success)', fontSize:'0.7rem', fontWeight:'bold'}}>FINALIZADO</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="admin-view-container" style={{maxWidth:700}}>
             <h2 className="view-title">Configurar Torneio</h2>
             <div className="glass-panel" style={{padding:30, borderRadius:20, marginBottom:30}}>
                <h3 style={{marginBottom:15}}>1. Novo Evento</h3>
                <input style={{width:'100%', marginBottom:15}} value={newTName} onChange={e => setNewTName(e.target.value)} placeholder="Ex: Torneio Interno Careca’s" />
                <button onClick={createTournament} className="btn-primary" style={{width:'100%'}}>Salvar Evento</button>
             </div>
             {tournaments.length > 0 && <div className="glass-panel" style={{padding:30, borderRadius:20}}>
                <h3 style={{marginBottom:15}}>2. Adicionar Categoria</h3>
                <select style={{width:'100%', marginBottom:15}} value={selectedT} onChange={e => setSelectedT(e.target.value)}>
                   <option value="">Escolha o Torneio...</option>
                   {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {selectedT && <div style={{display:'flex', gap:10}}><input style={{flex:1}} value={newCName} onChange={e => setNewCName(e.target.value)} placeholder="Ex: Masculino B" /><button onClick={createCategory} className="btn-primary">Adicionar</button></div>}
             </div>}
          </div>
        )}

        {activeTab === 'pairs' && (
          <div className="admin-view-container" style={{maxWidth:700}}>
             <h2 className="view-title">Cadastro de Atletas</h2>
             <div className="glass-panel" style={{padding:30, borderRadius:20}}>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20}}>
                   <select value={selectedT} onChange={e => setSelectedT(e.target.value)}>
                      <option value="">Torneio...</option>
                      {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                   </select>
                   <select value={selectedC} onChange={e => setSelectedC(e.target.value)}>
                      <option value="">Categoria...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>
                </div>
                {selectedC && <div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:15}}>
                      <input placeholder="Nome Atleta 1" value={p1Name} onChange={e => setP1Name(e.target.value)} />
                      <input placeholder="Nome Atleta 2" value={p2Name} onChange={e => setP2Name(e.target.value)} />
                   </div>
                   <button onClick={createPair} className="btn-primary" style={{width:'100%'}}>REGISTRAR DUPLA</button>
                   <p style={{fontSize:'0.8rem', opacity:0.5, marginTop:10, textAlign:'center'}}>Dica: A dupla será registrada na categoria selecionada acima.</p>
                </div>}
             </div>
          </div>
        )}

        {activeTab === 'matches' && (
          <div className="admin-view-container" style={{maxWidth:700}}>
             <h2 className="view-title">Agendar Jogos</h2>
             <div className="glass-panel" style={{padding:30, borderRadius:20}}>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20}}>
                   <select value={selectedT} onChange={e => setSelectedT(e.target.value)}>
                      <option value="">Torneio...</option>
                      {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                   </select>
                   <select value={selectedC} onChange={e => setSelectedC(e.target.value)}>
                      <option value="">Categoria...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>
                </div>
                {selectedC && <div>
                   <h3 style={{marginBottom:15, textAlign:'center'}}>Quem vai se enfrentar?</h3>
                   <div style={{display:'flex', gap:15, marginBottom:20, alignItems:'center'}}>
                      <select style={{flex:1}} value={matchP1} onChange={e => setMatchP1(e.target.value)}>
                         <option value="">Dupla Alpha</option>
                         {pairs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <div style={{fontWeight:'900', color:'var(--accent-primary)'}}>X</div>
                      <select style={{flex:1}} value={matchP2} onChange={e => setMatchP2(e.target.value)}>
                         <option value="">Dupla Beta</option>
                         {pairs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                   </div>
                   <button onClick={createMatch} className="btn-primary" style={{width:'100%', height:55}}>CONFIRMAR PARTIDA</button>
                </div>}
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
