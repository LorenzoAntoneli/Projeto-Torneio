import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Trophy, Clock, MapPin, Star } from 'lucide-react';
import logo from './assets/logo.jpg';

export default function TVDisplay() {
  const [matches, setMatches] = useState([]);
  const [victory, setVictory] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  const [callingMatch, setCallingMatch] = useState(null);
  const [calledIds, setCalledIds] = useState(new Set());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0); // 0: Geral, 1: Próximas, 2: Resultados
  const [sponsors, setSponsors] = useState([]);
  const [callQueue, setCallQueue] = useState([]);
  const [voiceKey, setVoiceKey] = useState('');
  const [elevenKey, setElevenKey] = useState(import.meta.env.VITE_ELEVENLABS_KEY || '');

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

  const loadSponsors = async () => {
    const { data } = await supabase.from('sponsors').select('*').eq('active', true).order('created_at', { ascending: true });
    setSponsors(data || []);
  };

  const loadSettings = async () => {
    const { data } = await supabase.from('settings').select('*');
    if (data) {
      const eKey = data.find(s => s.id === 'elevenlabs_key')?.value;
      if (vKey) setVoiceKey(vKey);
      // Priorizar a chave vinda do banco de dados (que você salva no admin)
      if (eKey) setElevenKey(eKey);
    }
  };

  useEffect(() => {
    loadMatches();
    loadSponsors();
    loadSettings();
    const timer = setInterval(() => {
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setCurrentTime(now);
    }, 10000);

    const ch = supabase.channel('tv_rt').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (p) => {
      if (p.eventType === 'UPDATE' && p.new.status === 'finished' && p.old?.status !== 'finished') loadMatches(p.new.id);
      else loadMatches();
    }).on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' }, () => {
      loadSponsors();
    }).subscribe();

    // Ciclo de Slides (1 minuto = 60000ms) - Agora com 4 telas (Geral, Próximas, Resultados, Patrocinadores)
    const slideTimer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % 4);
    }, 60000);

    return () => { clearInterval(timer); clearInterval(slideTimer); supabase.removeChannel(ch); };
  }, []);

  // Pré-carregar vozes do sistema (necessário em alguns navegadores)
  useEffect(() => {
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  // Chamada de Voz (TTS) com aviso sonoro inicial
  const playVoiceAnnouncement = (match) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      // 1. Sinal sonoro curto (Ding-Dong) - Atenção
      const playNote = (freq, startTime, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(startTime); osc.stop(startTime + duration);
      };
      playNote(523.25, audioCtx.currentTime, 0.6); // Dó
      playNote(659.25, audioCtx.currentTime + 0.15, 0.7); // Mi

      // 2. Anúncio da Dupla via IA Google (Nuvem)
      // 2. Anúncio da Dupla via ElevenLabs (IA de Elite)
      setTimeout(async () => {
        const p1 = match.pair1_name.replace('/', ' e ');
        const p2 = match.pair2_name.replace('/', ' e ');
        const court = match.court_name;

        // Limpeza simples e eficaz para não confundir a IA
        const cleanCat = (match.category_name || 'Geral')
          .replace(/masc\.?/gi, 'Masculino').replace(/fem\.?/gi, 'Feminino');

        // Frase direta e sem pontos excessivos (evita pular palavras)
        const speechText = `Atenção jogadores. Próximo jogo pela categoria ${cleanCat}. ${p1} contra ${p2}. Favor dirigir-se à ${court}.`;

        if (elevenKey) {
          try {
            // Voice ID atualizado para 'Rachel' (Estável e Profissional)
            // Outras opções: 'pNIn79O7S7GWmkh8p3DG' (Adam), 'EXAVITQu4vr4xnSDxMaL' (Bella)
            // Voz da Rachel (Brasileira/Multilingual) e modelo v2 estável
            const voiceId = '21m00Tcm4TlvDq8ikWAM'; 
            const finalKey = elevenKey.trim() || 'sk_5d5169133c0b408c2c108e9f9818f316623d3fe1db242bfc';
            
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
              method: 'POST',
              headers: { 
                'xi-api-key': finalKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                text: speechText,
                model_id: 'eleven_multilingual_v2',
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
              })
            });

            if (response.ok) {
              const blob = await response.blob();
              const audioUrl = URL.createObjectURL(blob);
              const audio = new Audio(audioUrl);
              audio.onended = () => URL.revokeObjectURL(audioUrl); // Limpeza de memória
              audio.play().catch(e => console.error('Erro play ElevenLabs:', e));
            } else {
              const errorData = await response.json().catch(() => ({}));
              console.error('Erro ElevenLabs:', response.status, errorData);

              // Fallback 1: Google TTS
              try {
                const gUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(speechText)}&tl=pt-br&client=tw-ob`;
                const gAudio = new Audio(gUrl);
                gAudio.play().catch(() => {
                  // Fallback 2: Voz Nativa do Navegador (Fim da linha)
                  const utterance = new SpeechSynthesisUtterance(speechText);
                  utterance.lang = 'pt-BR';
                  window.speechSynthesis.speak(utterance);
                });
              } catch (e) {
                const utterance = new SpeechSynthesisUtterance(speechText);
                utterance.lang = 'pt-BR';
                window.speechSynthesis.speak(utterance);
              }
            }
          } catch (e) {
            console.error('Erro de conexão ElevenLabs:', e);
            const utterance = new SpeechSynthesisUtterance(speechText);
            utterance.lang = 'pt-BR';
            window.speechSynthesis.speak(utterance);
          }
        } else {
          // Fallback para Google se não houver chave
          const gUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(speechText)}&tl=pt-br&client=tw-ob`;
          new Audio(gUrl).play();
        }
      }, 1000);

    } catch (e) { console.error('Erro áudio/voz:', e); }
  };

  // 1. COLETOR: Monitora partidas para o horário atual e adiciona na fila
  useEffect(() => {
    const toQueue = matches.filter(m => m.status === 'pending' && m.scheduled_time === currentTime && !calledIds.has(m.id));
    if (toQueue.length > 0) {
      setCallQueue(prev => [...prev, ...toQueue]);
      setCalledIds(prev => {
        const next = new Set(prev);
        toQueue.forEach(m => next.add(m.id));
        return next;
      });
    }
  }, [currentTime, matches, calledIds]);

  // 2. PROCESSADOR: Executa as chamadas da fila uma por uma
  useEffect(() => {
    if (callQueue.length > 0 && !callingMatch) {
      const nextMatch = callQueue[0];
      setCallingMatch(nextMatch);
      // Remove da fila
      setCallQueue(prev => prev.slice(1));

      // Toca áudio e aguarda tempo da animação
      if (audioEnabled) playVoiceAnnouncement(nextMatch);
      setTimeout(() => setCallingMatch(null), 30000);
    }
  }, [callQueue, callingMatch, audioEnabled]);

  const activeMatches = matches.filter(m => m.status !== 'finished');
  const categoriesPresent = [...new Set(activeMatches.map(m => m.category_name))];
  const lastResults = matches
    .filter(m => m.status === 'finished')
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  return (
    <div className="tv-container" style={{ background: '#000', height: '100vh', color: '#fff', padding: '40px 60px', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', fontFamily: 'system-ui, sans-serif' }}>

      {/* HEADER CLÁSSICO (RESTAURADO) */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, paddingBottom: 25, borderBottom: '1px solid rgba(212,175,55,0.2)', background: '#000', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          <img src={logo} alt="Logo" style={{ height: 160, objectFit: 'contain' }} />
          <div>
            <h1 style={{ fontSize: '3.2rem', fontWeight: 950, color: 'var(--accent-primary)', textTransform: 'uppercase', margin: 0, letterSpacing: 2 }}>CARECA’S BEACH CLUB</h1>
            <div style={{ display: 'flex', gap: 15, alignItems: 'center', marginTop: 5 }}>
              <span style={{ letterSpacing: 5, opacity: 0.5, fontSize: '0.8rem' }}>Torneio em Tempo Real</span>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2ecc71', boxShadow: '0 0 10px #2ecc71' }}></div>
              <span style={{ fontSize: '0.6rem', opacity: 0.3, textTransform: 'uppercase' }}>
                {currentSlide === 0 ? "Geral" : currentSlide === 1 ? "Próximas" : currentSlide === 2 ? "Resultados" : "Patrocinadores"}
              </span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '3.5rem', fontWeight: 900, color: '#fff' }}>{currentTime}</div>
        </div>
      </header>

      {/* ÁREA DE SLIDES (FLEX GROW) */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', transition: 'opacity 2s ease-in-out', marginBottom: 30 }}>

        {/* SLIDE 0: PAINEL GERAL (A visão original) */}
        {currentSlide === 0 && (
          <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 40 }}>
            <section>
              {categoriesPresent.map(cat => (
                <div key={cat} style={{ marginBottom: 40 }}>
                  <h2 style={{ color: 'var(--accent-primary)', fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: 4, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 15 }}><Star size={18} /> {cat}</h2>
                  <div style={{ display: 'grid', gap: 15 }}>
                    {activeMatches.filter(m => m.category_name === cat).map(m => (
                      <div key={m.id} className="glass-panel" style={{ padding: '25px 35px', borderRadius: 25, borderLeft: '10px solid var(--accent-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}><div style={{ fontSize: '2rem', fontWeight: 900 }}>{m.pair1_name} <span style={{ opacity: 0.2, fontSize: '1rem', margin: '0 10px' }}>VS</span> {m.pair2_name}</div></div>
                        <div style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
                          <div style={{ textAlign: 'center' }}><div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 900 }}>QUADRA</div><div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-primary)' }}>{m.court_name}</div></div>
                          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px 15px', borderRadius: 12 }}><div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 900 }}>INÍCIO</div><div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{m.scheduled_time || '--:--'}</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {activeMatches.length === 0 && <div style={{ textAlign: 'center', padding: 100, opacity: 0.2, fontSize: '2rem' }}>Aguardando próximas partidas...</div>}
            </section>
            <aside>
              <h2 style={{ fontSize: '1rem', opacity: 0.5, letterSpacing: 3, marginBottom: 20, textTransform: 'uppercase' }}>Encerrados (Top 8)</h2>
              <div style={{ display: 'grid', gap: 15 }}>
                {lastResults.slice(0, 8).map(m => (
                  <div key={m.id} className="glass-panel" style={{ padding: 20, borderRadius: 20, opacity: 0.7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--accent-primary)', fontWeight: 900, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 2 }}><span>{m.category_name}</span><span style={{ opacity: 0.5 }}>{new Date(m.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '1rem', fontWeight: m.winner_id === m.pair1_id ? 900 : 400, color: m.winner_id === m.pair1_id ? '#fff' : '#888' }}>{m.pair1_name}</span><span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--accent-primary)' }}>{m.pair1_games}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '1rem', fontWeight: m.winner_id === m.pair2_id ? 900 : 400, color: m.winner_id === m.pair2_id ? '#fff' : '#888' }}>{m.pair2_name}</span><span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--accent-primary)' }}>{m.pair2_games}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}

        {/* SLIDE 1: PRÓXIMAS PARTIDAS (Foco macro) */}
        {currentSlide === 1 && (
          <div className="fade-in">
            <h2 style={{ color: 'var(--accent-primary)', fontSize: '2rem', textTransform: 'uppercase', letterSpacing: 6, marginBottom: 40, textAlign: 'center' }}>• Próximas Partidas •</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 25 }}>
              {activeMatches.length > 0 ? activeMatches.map(m => (
                <div key={m.id} className="glass-panel" style={{ padding: '40px', borderRadius: 30, textAlign: 'center', border: '1px solid rgba(212,175,55,0.1)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 800, marginBottom: 15, textTransform: 'uppercase' }}>{m.category_name}</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: 20 }}>{m.pair1_name} <br /><span style={{ opacity: 0.2, fontSize: '1rem' }}>VS</span><br /> {m.pair2_name}</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 40, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20 }}>
                    <div><div style={{ fontSize: '0.6rem', opacity: 0.5 }}>QUADRA</div><div style={{ fontSize: '1.8rem', fontWeight: 950, color: 'var(--accent-primary)' }}>{m.court_name}</div></div>
                    <div><div style={{ fontSize: '0.6rem', opacity: 0.5 }}>HORÁRIO</div><div style={{ fontSize: '1.8rem', fontWeight: 950 }}>{m.scheduled_time || '--:--'}</div></div>
                  </div>
                </div>
              )) : <p style={{ gridColumn: '1/-1', textAlign: 'center', opacity: 0.2, fontSize: '2rem', marginTop: 100 }}>Nenhuma partida pendente no momento.</p>}
            </div>
          </div>
        )}

        {/* SLIDE 2: MURAL DE RESULTADOS (Histórico Expandido) */}
        {currentSlide === 2 && (
          <div className="fade-in">
            <h2 style={{ color: 'var(--accent-primary)', fontSize: '2rem', textTransform: 'uppercase', letterSpacing: 6, marginBottom: 40, textAlign: 'center' }}>• Mural de Resultados •</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {lastResults.length > 0 ? lastResults.slice(0, 16).map(m => (
                <div key={m.id} className="glass-panel" style={{ padding: '25px', borderRadius: 20, opacity: 0.8 }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--accent-primary)', fontWeight: 800, marginBottom: 15 }}>{m.category_name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: m.winner_id === m.pair1_id ? 900 : 400, color: m.winner_id === m.pair1_id ? '#fff' : '#666' }}>{m.pair1_name}</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 950, color: 'var(--accent-primary)' }}>{m.pair1_games}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: m.winner_id === m.pair2_id ? 900 : 400, color: m.winner_id === m.pair2_id ? '#fff' : '#666' }}>{m.pair2_name}</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 950, color: 'var(--accent-primary)' }}>{m.pair2_games}</span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.6rem', opacity: 0.2, marginTop: 15 }}>Fim: {new Date(m.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              )) : <p style={{ gridColumn: '1/-1', textAlign: 'center', opacity: 0.2, fontSize: '2rem', marginTop: 100 }}>Aguardando primeiros resultados...</p>}
            </div>
          </div>
        )}

        {/* SLIDE 3: PATROCINADORES (Foco total nas marcas) */}
        {currentSlide === 3 && (
          <div className="fade-in" style={{ textAlign: 'center', height: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 style={{ color: 'var(--accent-primary)', fontSize: '2.5rem', textTransform: 'uppercase', letterSpacing: 10, marginBottom: 60 }}>• Nossos Patrocinadores •</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 60, padding: '0 100px', alignItems: 'center' }}>
              {sponsors.length > 0 ? sponsors.map(s => (
                <div key={s.id} style={{ animation: 'fadeIn 1s ease-in-out', textAlign: 'center' }}>
                  <img src={s.logo_url} alt={s.name} style={{ width: '100%', maxHeight: 180, objectFit: 'contain', filter: 'drop-shadow(0 10px 20px rgba(212,175,55,0.2))' }} />
                  <p style={{ marginTop: 25, fontSize: '1.2rem', fontWeight: 900, letterSpacing: 4, opacity: 0.6 }}>{s.name.toUpperCase()}</p>
                </div>
              )) : <p style={{ opacity: 0.2, fontSize: '2rem' }}>Agradecemos aos nossos apoiadores!</p>}
            </div>
          </div>
        )}
      </div>

      {/* OVERLAY: Chamada de Dupla (Alert) */}
      {callingMatch && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#000', zIndex: 20000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', animation: 'pulse 1.5s infinite' }}>
            <Clock size={120} color="var(--accent-primary)" style={{ marginBottom: 30 }} />
            <h2 style={{ fontSize: '2rem', letterSpacing: 10, opacity: 0.6 }}>CHAMADA DE JOGO</h2>
            <h1 style={{ fontSize: '5rem', fontWeight: 950, margin: '20px 0', lineHeight: 1.1 }}>{callingMatch.pair1_name} <br /> <small style={{ fontSize: '2rem', opacity: 0.2 }}>X</small> <br /> {callingMatch.pair2_name}</h1>
            <div style={{ background: 'var(--accent-primary)', color: '#000', padding: '30px 60px', borderRadius: 30, fontSize: '3rem', fontWeight: 950, marginTop: 40 }}>
              DIRIJAM-SE À {callingMatch.court_name.toUpperCase()}
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY: Vitória */}
      {victory && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 21000, backdropFilter: 'blur(20px)' }}>
          <div style={{ textAlign: 'center' }}>
            <Trophy size={180} color="var(--accent-primary)" style={{ marginBottom: 30 }} />
            <h3 style={{ fontSize: '1.5rem', color: '#fff', letterSpacing: 5, opacity: 0.6 }}>{victory.category.toUpperCase()}</h3>
            <h1 style={{ fontSize: '7rem', fontWeight: 950, color: '#fff', margin: '20px 0' }}>{victory.winner}</h1>
            <div style={{ fontSize: '2.5rem', color: 'var(--accent-primary)', fontWeight: '900' }}>{victory.score} • VENCEU A PARTIDA! 🏆🎾</div>
          </div>
        </div>
      )}

      {/* Overlay de Ativação Inicial */}
      {!audioEnabled && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#000', zIndex: 100000, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', backdropFilter: 'blur(30px)' }}>
          <Trophy size={100} color="var(--accent-primary)" style={{ marginBottom: 30 }} />
          <h2 style={{ color: '#fff', fontSize: '2rem', marginBottom: 40, letterSpacing: 5, fontWeight: 900 }}>CARECA’S BEACH CLUB</h2>
          <button className="btn-primary" style={{ padding: '35px 70px', fontSize: '1.8rem', fontWeight: 950, borderRadius: 100, display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 20px 50px rgba(212,175,55,0.3)' }} onClick={() => setAudioEnabled(true)}>
            <Star size={35} fill="currentColor" /> INICIAR PAINEL DA TV
          </button>
          <p style={{ marginTop: 30, opacity: 0.4, fontSize: '0.9rem', letterSpacing: 2 }}>Clique para ativar a chamada de voz e sinal sonoro das quadras.</p>
        </div>
      )}

      <style>{`
        .fade-in { animation: fadeIn 2s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        
        .ticker-wrap { width: 100%; height: 140px; background: #000; border-top: 1px solid rgba(212,175,55,0.2); overflow: hidden; display: flex; flex-direction: column; justify-content: center; padding: 10px 0; flex-shrink: 0; }
        .ticker-label { color: var(--accent-primary); font-size: 0.8rem; font-weight: 900; letter-spacing: 5px; text-transform: uppercase; margin-bottom: 12px; padding-left: 20px; opacity: 0.5; }
        .ticker { display: flex; white-space: nowrap; animation: scroll-ticker 40s linear infinite; align-items: center; }
        .ticker-item { display: flex; align-items: center; gap: 15px; margin-right: 30px; background: rgba(255,255,255,0.95); padding: 10px 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(212,175,55,0.15); min-width: 220px; justify-content: center; height: 80px; }
        .ticker-item img { height: 100%; width: auto; max-width: 180px; object-fit: contain; }
        
        @keyframes scroll-ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {/* RODAPÉ DE PATROCINADORES (TICKER SEGURO) */}
      {sponsors.length > 0 && (
        <div className="ticker-wrap">
          <div className="ticker-label">Patrocinadores:</div>
          <div className="ticker">
            {/* Duplicamos a lista para o efeito infinito suave */}
            {[...sponsors, ...sponsors, ...sponsors, ...sponsors].map((s, idx) => (
              <div key={`${s.id}-${idx}`} className="ticker-item">
                <img src={s.logo_url} alt={s.name} title={s.name} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
