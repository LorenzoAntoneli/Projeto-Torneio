import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { Trophy, Trash2, Play, Swords, LayoutList, Users, LogOut, FileUp, Monitor } from 'lucide-react';

export default function Admin() {
  const [session, setSession] = useState(localStorage.getItem('bt_session'));
  const [password, setPassword] = useState('');
  
  const [activeTab, setActiveTab] = useState('scoreboard');
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);

  const [tournaments, setTournaments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [matches, setMatches] = useState([]);
  
  const [selectedT, setSelectedT] = useState('');
  const [selectedC, setSelectedC] = useState('');
  
  const [newTName, setNewTName] = useState('');
  const [newTMax, setNewTMax] = useState(0);
  const [newCName, setNewCName] = useState('');
  const [newPairName, setNewPairName] = useState('');
  const [matchP1, setMatchP1] = useState('');
  const [matchP2, setMatchP2] = useState('');

  const loadData = async () => {
    try {
      const { data: tData } = await supabase.from('tournaments').select('*');
      setTournaments(tData || []);

      const { data: mData } = await supabase
        .from('matches')
        .select(`
          *,
          pair1:pairs!matches_pair1_id_fkey(name),
          pair2:pairs!matches_pair2_id_fkey(name),
          category:categories(name)
        `)
        .order('updated_at', { ascending: false });
      
      // Transform for easier use
      const formattedMatches = (mData || []).map(m => ({
        ...m,
        pair1_name: m.pair1?.name,
        pair2_name: m.pair2?.name,
        category_name: m.category?.name
      }));
      setMatches(formattedMatches);
    } catch(e) { console.error(e); }
  };

  useEffect(() => {
    if (session) loadData();
  }, [session]);

  useEffect(() => {
    if (selectedT) {
      supabase.from('categories').select('*').eq('tournament_id', selectedT).then(({ data }) => setCategories(data || []));
    } else {
      setCategories([]);
    }
    setSelectedC('');
  }, [selectedT]);

  useEffect(() => {
    if (selectedC) {
      supabase.from('pairs').select('*').eq('category_id', selectedC).then(({ data }) => setPairs(data || []));
    } else {
      setPairs([]);
    }
  }, [selectedC]);

  const login = (e) => {
    e.preventDefault();
    if (password === 'admin123') {
      localStorage.setItem('bt_session', 'logged');
      setSession('logged');
    } else {
      alert('Senha inválida');
    }
  };

  const logout = () => {
    localStorage.removeItem('bt_session');
    setSession(null);
  }

  const createTournament = async () => {
    if (!newTName) return;
    await supabase.from('tournaments').insert([{ name: newTName, max_pairs: newTMax }]);
    setNewTName(''); setNewTMax(0);
    loadData();
    setActiveTab('categories');
  };

  const createCategory = async () => {
    if (!selectedT || !newCName) return;
    await supabase.from('categories').insert([{ tournament_id: selectedT, name: newCName }]);
    setNewCName('');
    const { data } = await supabase.from('categories').select('*').eq('tournament_id', selectedT);
    setCategories(data || []);
  };

  const createPair = async () => {
    if (!selectedC || !newPairName) return;
    
    // Check limit
    const { data: tournamentData } = await supabase
      .from('categories')
      .select('tournaments(max_pairs)')
      .eq('id', selectedC)
      .single();
    
    const { count } = await supabase
      .from('pairs')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', selectedC);

    const max = tournamentData?.tournaments?.max_pairs || 0;
    if (max > 0 && count >= max) {
      return alert('Número máximo de duplas atingido para este torneio');
    }

    await supabase.from('pairs').insert([{ category_id: selectedC, name: newPairName }]);
    setNewPairName('');
    const { data } = await supabase.from('pairs').select('*').eq('category_id', selectedC);
    setPairs(data || []);
  };

  const createMatch = async () => {
    if (!selectedC || !matchP1 || !matchP2 || matchP1 === matchP2) return alert('Selecione duplas diferentes');
    await supabase.from('matches').insert([{ 
      category_id: selectedC, 
      pair1_id: matchP1, 
      pair2_id: matchP2 
    }]);
    setMatchP1(''); setMatchP2('');
    loadData();
    setActiveTab('scoreboard');
  };

  const startMatch = async (id) => {
    await supabase.from('matches').update({ status: 'in_progress', updated_at: new Date() }).eq('id', id);
    loadData();
  };

  const handleScore = async (match, teamIdx, action) => {
    let m = { ...match };
    const getNextPt = (pt) => pt === '0' ? '15' : pt === '15' ? '30' : pt === '30' ? '40' : 'A';
    const getPrevPt = (pt) => pt === 'A' ? '40' : pt === '40' ? '30' : pt === '30' ? '15' : '0';

    if (action === '+pt') {
      if (teamIdx === 1) {
          if (m.pair1_score === '40') {
             m.pair1_score = '0'; m.pair2_score = '0'; m.pair1_games += 1;
             if (m.pair1_games >= 6 && (m.pair1_games - m.pair2_games >= 2 || m.pair1_games === 7)) {
                m.pair1_sets += 1; m.pair1_games = 0; m.pair2_games = 0;
             }
          } else { m.pair1_score = getNextPt(m.pair1_score); }
      } else {
          if (m.pair2_score === '40') {
             m.pair1_score = '0'; m.pair2_score = '0'; m.pair2_games += 1;
             if (m.pair2_games >= 6 && (m.pair2_games - m.pair1_games >= 2 || m.pair2_games === 7)) {
                m.pair2_sets += 1; m.pair1_games = 0; m.pair2_games = 0;
             }
          } else { m.pair2_score = getNextPt(m.pair2_score); }
      }
    } else {
      if (teamIdx === 1) m.pair1_score = getPrevPt(m.pair1_score);
      else m.pair2_score = getPrevPt(m.pair2_score);
    }
    
    if (m.pair1_sets >= 1 || m.pair2_sets >= 1) {
       m.status = 'finished';
       m.winner_id = m.pair1_sets >= 1 ? m.pair1_id : m.pair2_id;
    }

    await supabase.from('matches').update({
      pair1_score: m.pair1_score, pair2_score: m.pair2_score,
      pair1_games: m.pair1_games, pair2_games: m.pair2_games,
      pair1_sets: m.pair1_sets, pair2_sets: m.pair2_sets,
      status: m.status, winner_id: m.winner_id,
      updated_at: new Date()
    }).eq('id', m.id);
    loadData();
  };

  const handleImport = (e) => {
    e.preventDefault();
    if (!importFile) return;
    setIsImporting(true);

    Papa.parse(importFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const tournamentCache = {};
          const categoryCache = {};

          for (const row of results.data) {
            const tName = row.Tournament || row.torneio || 'Torneio Importado';
            const cName = row.Category || row.categoria || 'Geral';
            const pName = row.PairName || row.dupla || 'Anonimo';

            // Tournament
            if (!tournamentCache[tName]) {
              let { data: t } = await supabase.from('tournaments').select('id').eq('name', tName).single();
              if (!t) {
                const { data: newT } = await supabase.from('tournaments').insert([{ name: tName }]).select('id').single();
                t = newT;
              }
              tournamentCache[tName] = t.id;
            }

            // Category
            const catKey = `${tournamentCache[tName]}_${cName}`;
            if (!categoryCache[catKey]) {
              let { data: c } = await supabase.from('categories').select('id').eq('name', cName).eq('tournament_id', tournamentCache[tName]).single();
              if (!c) {
                const { data: newC } = await supabase.from('categories').insert([{ name: cName, tournament_id: tournamentCache[tName] }]).select('id').single();
                c = newC;
              }
              categoryCache[catKey] = c.id;
            }

            // Pair
            await supabase.from('pairs').insert([{ name: pName, category_id: categoryCache[catKey] }]);
          }
          alert('Importação concluída com sucesso!');
          loadData();
          setActiveTab('scoreboard');
        } catch (err) {
          alert('Erro ao importar: ' + err.message);
        } finally {
          setIsImporting(false);
          setImportFile(null);
        }
      }
    });
  };

  if (!session) {
    return (
      <div className="login-container">
        <div className="login-box">
          <Trophy size={48} color="var(--text-primary)" style={{marginBottom: 20}} />
          <h2 style={{color: 'white', marginBottom: '20px'}}>Área do Administrador</h2>
          <form onSubmit={login}>
            <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="submit" className="primary">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <div className="admin-sidebar">
        <h2>Painel de Controle</h2>
        <div className={`admin-nav-item ${activeTab === 'scoreboard' ? 'active' : ''}`} onClick={() => setActiveTab('scoreboard')}><Swords size={20} /> Placar Ativo</div>
        <div className={`admin-nav-item ${activeTab === 'tournaments' ? 'active' : ''}`} onClick={() => setActiveTab('tournaments')}><Trophy size={20} /> 1. Torneios</div>
        <div className={`admin-nav-item ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}><LayoutList size={20} /> 2. Categorias</div>
        <div className={`admin-nav-item ${activeTab === 'pairs' ? 'active' : ''}`} onClick={() => setActiveTab('pairs')}><Users size={20} /> 3. Duplas</div>
        <div className={`admin-nav-item ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}><Play size={20} /> 4. Criar Partida</div>
        <div className={`admin-nav-item ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}><FileUp size={20} /> 5. Importar LetzPlay</div>
        <a href="/tv" target="_blank" rel="noopener noreferrer" className="admin-nav-item" style={{textDecoration: 'none', color: 'var(--text-primary)'}}><Monitor size={20} /> Ver Tela da TV</a>
        <div style={{flex: 1}}></div>
        <div className="admin-nav-item" onClick={logout} style={{color: 'var(--text-danger)'}}><LogOut size={20} /> Sair</div>
      </div>

      <div className="admin-content">
        <div className="admin-container">
          {activeTab === 'scoreboard' && (
             <div className="admin-panel">
               {matches.length === 0 && <p style={{color: '#8b949e'}}>Nenhuma partida cadastrada.</p>}
               {matches.map(m => (
                 <div key={m.id} style={{background: 'var(--panel-bg)', border: '1px solid var(--border-color)', padding: 20, borderRadius: 12, marginBottom: 20}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 15}}>
                      <strong style={{color: '#c9d1d9'}}>{m.category_name}</strong>
                      <span style={{color: m.status === 'in_progress' ? 'var(--text-primary)' : m.status === 'finished' ? 'var(--text-success)' : 'var(--text-warning)'}}>
                        {m.status === 'pending' ? 'Aguardando' : m.status === 'in_progress' ? 'Em Quadra' : 'Finalizado'}
                      </span>
                    </div>
                    <div className="match-controller">
                      <div className="match-controller-team">
                        <h4 style={{color: '#fff'}}>{m.pair1_name}</h4>
                        <div style={{color: 'var(--text-primary)'}}>S: {m.pair1_sets} | G: {m.pair1_games} | P: {m.pair1_score}</div>
                        {m.status === 'in_progress' && (
                          <div className="score-control-btns">
                            <button className="score-btn sub" onClick={() => handleScore(m, 1, '-pt')}>-</button>
                            <button className="score-btn add" onClick={() => handleScore(m, 1, '+pt')}>+</button>
                          </div>
                        )}
                      </div>
                      <div style={{color: '#8b949e'}}>VS</div>
                      <div className="match-controller-team">
                        <h4 style={{color: '#fff'}}>{m.pair2_name}</h4>
                        <div style={{color: 'var(--text-primary)'}}>S: {m.pair2_sets} | G: {m.pair2_games} | P: {m.pair2_score}</div>
                        {m.status === 'in_progress' && (
                          <div className="score-control-btns">
                            <button className="score-btn sub" onClick={() => handleScore(m, 2, '-pt')}>-</button>
                            <button className="score-btn add" onClick={() => handleScore(m, 2, '+pt')}>+</button>
                          </div>
                        )}
                      </div>
                    </div>
                    {m.status === 'pending' && <button className="primary" style={{width:'100%'}} onClick={() => startMatch(m.id)}>Iniciar Partida</button>}
                 </div>
               ))}
             </div>
          )}

          {activeTab === 'tournaments' && (
            <div className="admin-panel">
              <h3 style={{color: '#fff', marginBottom: 15}}>Novo Torneio</h3>
              <div className="admin-form-group">
                <input value={newTName} onChange={e => setNewTName(e.target.value)} placeholder="Nome do Torneio" />
                <input type="number" value={newTMax} onChange={e => setNewTMax(parseInt(e.target.value))} placeholder="Máx Duplas" />
                <button onClick={createTournament} className="primary">Criar</button>
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="admin-panel">
              <select value={selectedT} onChange={e => setSelectedT(e.target.value)} style={{width: '100%', marginBottom: 15}}>
                <option value="">Selecione o Torneio</option>
                {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {selectedT && (
                <div className="admin-form-group">
                  <input value={newCName} onChange={e => setNewCName(e.target.value)} placeholder="Nova Categoria" />
                  <button onClick={createCategory} className="primary">Adicionar</button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pairs' && (
            <div className="admin-panel">
              <select value={selectedC} onChange={e => setSelectedC(e.target.value)} style={{width: '100%', marginBottom: 15}}>
                <option value="">Selecione a Categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {selectedC && (
                <div className="admin-form-group">
                  <input value={newPairName} onChange={e => setNewPairName(e.target.value)} placeholder="Nome da Dupla" />
                  <button onClick={createPair} className="primary">Adicionar</button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'matches' && (
            <div className="admin-panel">
              <select value={selectedC} onChange={e => setSelectedC(e.target.value)} style={{width: '100%', marginBottom: 15}}>
                <option value="">Selecione a Categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {selectedC && (
                <div className="admin-form-group">
                  <select value={matchP1} onChange={e => setMatchP1(e.target.value)}>
                    <option value="">Dupla 1</option>
                    {pairs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={matchP2} onChange={e => setMatchP2(e.target.value)}>
                    <option value="">Dupla 2</option>
                    {pairs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button onClick={createMatch} className="primary">Criar Partida</button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'import' && (
            <div className="admin-panel">
              <h3 style={{color: '#fff', marginBottom: 15}}>Importar CSV LetzPlay</h3>
              <form onSubmit={handleImport}>
                <div style={{border: '2px dashed var(--border-color)', padding: 30, borderRadius: 12, textAlign: 'center', marginBottom: 20}}>
                   <input type="file" accept=".csv" onChange={e => setImportFile(e.target.files[0])} id="csv-up" style={{display: 'none'}} />
                   <label htmlFor="csv-up" style={{cursor: 'pointer'}}>
                     <FileUp size={48} color={importFile ? 'var(--text-success)' : 'var(--text-primary)'} />
                     <p style={{marginTop: 10}}>{importFile ? importFile.name : 'Selecionar Arquivo CSV'}</p>
                   </label>
                </div>
                <button type="submit" className="primary" style={{width: '100%'}} disabled={!importFile || isImporting}>
                  {isImporting ? 'Processando...' : 'Importar Tudo'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
