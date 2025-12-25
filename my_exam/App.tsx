
import React, { useState, useEffect, useCallback } from 'react';
import { Question, QuestionType, Category, UserAnswer, ExamResult } from './types';
import { QUESTION_BANK } from './questions';

const EXAM_SIZE = 30; 
const STATS_KEY = 'qianchuan_exam_v1.5_mobile_final';

interface QuestionStats {
  correct: number;
  total: number;
}

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'exam' | 'result'>('home');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [finalResult, setFinalResult] = useState<ExamResult | null>(null);
  const [stats, setStats] = useState<Record<string, QuestionStats>>({});

  // 初始化加载统计
  useEffect(() => {
    const saved = localStorage.getItem(STATS_KEY);
    if (saved) {
      try {
        setStats(JSON.parse(saved));
      } catch (e) {
        console.error("加载缓存失败", e);
      }
    }
  }, []);

  const startExam = useCallback(() => {
    const weightedPool: Question[] = [];
    QUESTION_BANK.forEach(q => {
      const qStat = stats[q.id] || { correct: 0, total: 0 };
      let effectiveWeight = q.weight || 1;
      
      // 智能降权：如果这道题已经练的很熟（正确率>80%且练过3次以上），降低出现概率
      if (qStat.total >= 3) {
        const accuracy = qStat.correct / qStat.total;
        if (accuracy > 0.8) effectiveWeight = Math.max(0.1, effectiveWeight * (1.1 - accuracy));
      }
      
      const slots = Math.max(1, Math.round(effectiveWeight * 10));
      for (let i = 0; i < slots; i++) weightedPool.push(q);
    });

    // 乱序并抽取
    const shuffled = weightedPool.sort(() => Math.random() - 0.5);
    const selected: Question[] = [];
    const ids = new Set<string>();
    
    for (const q of shuffled) {
      if (!ids.has(q.id)) {
        selected.push(q);
        ids.add(q.id);
      }
      if (selected.length === EXAM_SIZE || selected.length === QUESTION_BANK.length) break;
    }
    
    setQuestions(selected);
    setUserAnswers([]);
    setCurrentIndex(0);
    setStartTime(Date.now());
    setView('exam');
    window.scrollTo(0, 0);
  }, [stats]);

  const handleSelect = (val: string | string[]) => {
    const qId = questions[currentIndex].id;
    setUserAnswers(prev => {
      const filtered = prev.filter(a => a.questionId !== qId);
      return [...filtered, { questionId: qId, selected: val }];
    });
  };

  const submitExam = () => {
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    let correctCount = 0;
    const newStats = { ...stats };
    
    questions.forEach(q => {
      const u = userAnswers.find(a => a.questionId === q.id);
      const isCorrect = (() => {
        if (!u) return false;
        if (q.type === QuestionType.MULTIPLE) {
          const sUser = [...(u.selected as string[] || [])].sort();
          const sAns = [...(q.answer as string[])].sort();
          return JSON.stringify(sUser) === JSON.stringify(sAns);
        }
        return u.selected === q.answer;
      })();
      
      if (isCorrect) correctCount++;
      if (!newStats[q.id]) newStats[q.id] = { correct: 0, total: 0 };
      newStats[q.id].total++;
      if (isCorrect) newStats[q.id].correct++;
    });

    setStats(newStats);
    localStorage.setItem(STATS_KEY, JSON.stringify(newStats));
    setFinalResult({
      score: Math.round((correctCount / questions.length) * 100),
      totalQuestions: questions.length,
      correctCount,
      wrongCount: questions.length - correctCount,
      timeTaken
    });
    setView('result');
    window.scrollTo(0, 0);
  };

  if (view === 'home') return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 text-center border border-slate-100 animate-fadeIn">
        <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-blue-100 rotate-3">
          <i className="fa-solid fa-graduation-cap text-4xl text-white -rotate-3"></i>
        </div>
        <h1 className="text-2xl font-black text-slate-800 mb-2">千川认证模拟练习</h1>
        <p className="text-slate-400 mb-10 text-sm tracking-wide">真题库 · 权重算法 · 极简体验</p>
        
        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
            <div className="text-3xl font-black text-blue-600">
              {Object.values(stats).filter(s => s.total >= 3 && s.correct/s.total > 0.8).length}
            </div>
            <div className="text-[10px] text-slate-500 uppercase font-black mt-1">已掌握</div>
          </div>
          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
            <div className="text-3xl font-black text-slate-700">{Object.keys(stats).length}</div>
            <div className="text-[10px] text-slate-500 uppercase font-black mt-1">总题数</div>
          </div>
        </div>

        <button onClick={startExam} className="w-full bg-blue-600 active:bg-blue-800 text-white font-bold py-5 rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-95 text-lg mb-6">
          开始 30 题模拟考
        </button>

        <button onClick={() => { if(confirm('确定清空记录？')) { localStorage.removeItem(STATS_KEY); setStats({}); } }} className="text-xs text-slate-300 hover:text-red-400">
          重置练习数据
        </button>
      </div>
    </div>
  );

  if (view === 'exam') {
    const q = questions[currentIndex];
    const uAns = userAnswers.find(a => a.questionId === q.id)?.selected;
    
    return (
      <div className="min-h-screen pb-28">
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-slate-100 p-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button onClick={() => setView('home')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400"><i className="fa-solid fa-xmark"></i></button>
            <div className="flex flex-col items-center">
              <span className="text-lg font-black text-blue-600">{currentIndex + 1} <span className="text-slate-300 font-normal">/ {questions.length}</span></span>
            </div>
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-black text-[10px]">{Math.round(((currentIndex+1)/questions.length)*100)}%</div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto p-4 md:p-8 animate-fadeIn">
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 md:p-10 mb-6">
            <div className="flex gap-2 mb-6">
              <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-lg uppercase">{q.type === QuestionType.SINGLE ? '单选' : q.type === QuestionType.MULTIPLE ? '多选' : '判断'}</span>
              <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg">{q.category}</span>
              {q.weight === 3 && <span className="px-3 py-1 bg-rose-50 text-rose-600 text-[10px] font-black rounded-lg">必考真题</span>}
            </div>
            <h2 className="text-xl font-bold text-slate-800 leading-snug mb-10">{q.text}</h2>
            <div className="space-y-4">
              {(q.type === QuestionType.BOOLEAN ? ['A. 正确', 'B. 错误'] : (q.options || [])).map(opt => {
                const key = opt.charAt(0);
                const isSelected = q.type === QuestionType.MULTIPLE ? (uAns as string[])?.includes(key) : uAns === key;
                return (
                  <button key={key} onClick={() => {
                    if(q.type === QuestionType.MULTIPLE) {
                      const cur = (uAns as string[]) || [];
                      handleSelect(cur.includes(key) ? cur.filter(k=>k!==key) : [...cur, key]);
                    } else handleSelect(key);
                  }} className={`w-full p-5 rounded-2xl border-2 text-left transition-all flex items-center gap-4 active:scale-[0.98] ${isSelected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-50 bg-slate-50 text-slate-600'}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black border-2 transition-colors shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-300'}`}>{key}</div>
                    <span className="font-semibold">{opt.includes('、') ? opt.split('、')[1] : (opt.includes('.') ? opt.split('.')[1] : opt.substring(2))}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-xl border-t border-slate-100 z-20">
          <div className="max-w-3xl mx-auto flex gap-4">
            <button disabled={currentIndex === 0} onClick={() => { setCurrentIndex(currentIndex - 1); window.scrollTo(0,0); }} className="h-14 px-6 rounded-2xl bg-slate-100 text-slate-400 font-bold disabled:opacity-30">上题</button>
            {currentIndex === questions.length - 1 ? (
              <button onClick={submitExam} className="h-14 flex-1 bg-green-600 text-white font-black rounded-2xl shadow-lg active:scale-95">提交评分</button>
            ) : (
              <button onClick={() => { setCurrentIndex(currentIndex + 1); window.scrollTo(0,0); }} className="h-14 flex-1 bg-blue-600 text-white font-black rounded-2xl shadow-lg active:scale-95">下一题</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'result' && finalResult) {
    return (
      <div className="min-h-screen bg-slate-50 pb-20 animate-fadeIn">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-b-[3rem] shadow-xl overflow-hidden mb-8">
            <div className={`p-14 text-center text-white ${finalResult.score >= 60 ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-rose-500 to-red-600'}`}>
              <div className="text-[8rem] font-black leading-none mb-4 drop-shadow-lg">{finalResult.score}</div>
              <p className="font-black text-white/80 uppercase tracking-widest text-sm">模拟测评分数</p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-50 p-8 text-center bg-white">
              <div><div className="text-2xl font-black text-emerald-500">{finalResult.correctCount}</div><div className="text-[10px] font-bold text-slate-400">正确</div></div>
              <div><div className="text-2xl font-black text-rose-500">{finalResult.wrongCount}</div><div className="text-[10px] font-bold text-slate-400">错误</div></div>
              <div><div className="text-2xl font-black text-slate-700">{Math.floor(finalResult.timeTaken/60)}m</div><div className="text-[10px] font-bold text-slate-400">用时</div></div>
            </div>
          </div>

          <div className="p-4 space-y-6">
             <h3 className="px-4 text-lg font-black text-slate-800">错题复盘 (只显示错误)</h3>
             {questions.map((q, idx) => {
               const u = userAnswers.find(a => a.questionId === q.id);
               const isCorrect = q.type === QuestionType.MULTIPLE ? JSON.stringify([...(u?.selected as string[] || [])].sort()) === JSON.stringify([...(q.answer as string[])].sort()) : u?.selected === q.answer;
               if (isCorrect) return null;
               
               return (
                 <div key={q.id} className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm">
                    <div className="flex gap-4 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center font-black shrink-0 text-xs">{idx+1}</div>
                      <p className="font-bold text-slate-700 leading-snug">{q.text}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl mb-4 border border-slate-100">
                      <div className="text-[10px] font-black text-slate-400 uppercase mb-2">标准解析</div>
                      <div className="text-sm text-slate-600 font-medium leading-relaxed">
                        正确答案：<span className="text-emerald-600 font-black">{Array.isArray(q.answer) ? q.answer.join('') : q.answer}</span>
                        <br/>
                        你的回答：<span className="text-rose-500 font-black">{Array.isArray(u?.selected) ? u.selected.join('') : (u?.selected || '未答')}</span>
                      </div>
                    </div>
                    {q.explanation && <div className="text-xs text-blue-500 bg-blue-50 p-4 rounded-xl leading-relaxed font-medium">考点：{q.explanation}</div>}
                 </div>
               );
             })}
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl">
             <button onClick={() => setView('home')} className="max-w-3xl mx-auto w-full h-14 bg-slate-900 text-white font-black rounded-2xl shadow-xl active:scale-95">返回练习中心</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default App;
