'use client';
// src/app/teacher/games/page.tsx
// إدارة الألعاب التعليمية والذكاء الاصطناعي

import { useState, useEffect } from 'react';
import { useTeacherStore } from '@/lib/store';
import { getGamesByTeacher, saveGame, deleteGame, getGameResultsByGame, uploadFileToStorage } from '@/lib/db';
import { showToast } from '@/lib/toast';
import type { EducationalGame, GameType, GameResult } from '@/types';
import { 
  Gamepad2, Plus, Sparkles, Trophy, Trash2, Users, 
  ChevronRight, Search, FileText, Upload, Loader2,
  Brain, Languages, Layers, Zap, GraduationCap, X,
  BarChart3, Eye
} from 'lucide-react';
import { GlobalFileUpload } from '@/components/GlobalFileUpload';
import { GamePortal } from '@/components/games/GamePortal';

export default function GamesPage() {
  const { user, groups } = useTeacherStore();
  const [games, setGames] = useState<EducationalGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState<EducationalGame | null>(null);
  const [results, setResults] = useState<GameResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedPreviewGame, setSelectedPreviewGame] = useState<EducationalGame | null>(null);

  // Form State
  const [generating, setGenerating] = useState(false);
  const [title, setTitle] = useState('');
  const [gameType, setGameType] = useState<GameType>('flashcards');
  const [topic, setTopic] = useState('');
  const [targetGroup, setTargetGroup] = useState('');
  const [aiContent, setAiContent] = useState<any>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileMime, setFileMime] = useState<string | null>(null);

  const loadGames = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getGamesByTeacher(user.id);
      setGames(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadGames(); }, [user?.id]);

  const handleFileChange = async (file: File) => {
    setUploadingFile(true);
    try {
      // Need base64 for Gemini API
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setFileBase64(base64);
        setFileMime(file.type);
        showToast('✅ تم تحليل الملف، يمكنك الآن توليد اللعبة');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      showToast('❌ فشل قراءة الملف');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!topic && !fileBase64) {
      showToast('⚠️ يرجى كتابة عنوان أو رفع ملف للمادة');
      return;
    }
    setGenerating(true);
    setAiContent(null);
    try {
      const res = await fetch('/api/generate-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameType,
          topic,
          fileData: fileBase64 ? { inlineData: fileBase64, mimeType: fileMime } : null,
          count: 10
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiContent(data.gameContent);
      showToast('✨ تم توليد محتوى اللعبة بالذكاء الاصطناعي');
    } catch (err: any) {
      showToast('❌ فشل التوليد: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveGame = async () => {
    if (!title) { showToast('⚠️ يرجى كتابة عنوان للعبة'); return; }
    if (!aiContent) { showToast('⚠️ لا يوجد محتوى لحفظه'); return; }

    try {
      await saveGame({
        teacherId: user?.id || '',
        title,
        type: gameType,
        content: aiContent,
        targetGroup: targetGroup || undefined,
        createdAt: new Date().toISOString()
      });
      showToast('✅ تم حفظ اللعبة ونشرها للطلاب');
      setShowCreateModal(false);
      resetForm();
      loadGames();
    } catch (err) {
      showToast('❌ فشل حفظ اللعبة');
    }
  };

  const resetForm = () => {
    setTitle('');
    setTopic('');
    setAiContent(null);
    setFileBase64(null);
    setFileMime(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه اللعبة وجميع نتائج الطلاب؟')) return;
    try {
      await deleteGame(id);
      showToast('تم الحذف بنجاح');
      loadGames();
    } catch (err) {
      showToast('فشل الحذف');
    }
  };

  const loadResults = async (game: EducationalGame) => {
    setShowResultsModal(game);
    setLoadingResults(true);
    try {
      const data = await getGameResultsByGame(game.id);
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingResults(false);
    }
  };

  const GAME_TYPES = [
    { id: 'flashcards', name: 'بطاقات تعليمية', icon: <Layers size={20} />, color: '#f5c518', desc: 'بطاقات خلف وأمام للمراجعة' },
    { id: 'match', name: 'سيد المطابقة', icon: <Trophy size={20} />, color: '#3b82f6', desc: 'توصيل المصطلحات بتعريفاتها' },
    { id: 'sentence', name: 'ترتيب الجمل', icon: <Languages size={20} />, color: '#8b5cf6', desc: 'تجميع الكلمات لتكوين جملة صحيحة' },
    { id: 'sort', name: 'تصنيف المواد', icon: <Brain size={20} />, color: '#10b981', desc: 'وضع العناصر في مجموعاتها الصحيحة' },
    { id: 'tf_run', name: 'سرعة الرد', icon: <Zap size={20} />, color: '#ec4899', desc: 'تحدي صح أو خطأ مع الوقت' },
    { id: 'quiz', name: 'تحدي الأسئلة', icon: <Sparkles size={18} />, color: '#f97316', desc: 'اختبار سريع تفاعلي' },
  ];

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black gold-text flex items-center gap-2">
            <Gamepad2 size={28} /> الألعاب التعليمية (AI)
          </h1>
          <p className="text-sm text-text-muted mt-1">حوّل مادتك العلمية إلى ألعاب تفاعلية ممتعة بضغطة زر</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="btn-gold flex items-center gap-2 px-6 h-12 shadow-lg shadow-gold/20"
        >
          <Plus size={20} /> إنشاء لعبة جديدة
        </button>
      </div>

      {/* Analytics Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الألعاب', value: games.length, icon: <Gamepad2 size={20} />, color: 'var(--gold)' },
          { label: 'تفاعلات الطلاب', value: '0', icon: <Users size={20} />, color: '#3b82f6' },
          { label: 'ألعاب Flashcards', value: games.filter(g => g.type === 'flashcards').length, icon: <Layers size={20} />, color: '#8b5cf6' },
          { label: 'ألعاب المطابقة', value: games.filter(g => g.type === 'match').length, icon: <Trophy size={20} />, color: '#10b981' },
        ].map((stat, i) => (
          <div key={i} className="card-base p-4 flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5" style={{ color: stat.color }}>
               {stat.icon}
             </div>
             <div>
               <div className="text-xl font-black text-white leading-none">{stat.value}</div>
               <div className="text-[10px] text-text-muted mt-1">{stat.label}</div>
             </div>
          </div>
        ))}
      </div>

      {/* Games List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center p-20"><Loader2 className="animate-spin text-gold" /></div>
        ) : games.length === 0 ? (
          <div className="card-base p-16 text-center space-y-4 border-dashed border-white/10">
            <div className="w-20 h-20 bg-gold/10 rounded-full flex items-center justify-center mx-auto text-gold/40">
              <Gamepad2 size={40} />
            </div>
            <div className="max-w-xs mx-auto">
              <h3 className="font-bold text-white">لا توجد ألعاب حالياً</h3>
              <p className="text-xs text-text-muted mt-2">ابدأ بإنشاء أول لعبة تعليمية بالذكاء الاصطناعي وشاركها مع طلابك الآن.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {games.map(game => (
              <div key={game.id} className="card-base p-5 group hover:border-gold/30 transition-all overflow-hidden relative">
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 text-gold border border-gold/10">
                      {GAME_TYPES.find(t => t.id === game.type)?.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-white group-hover:gold-text transition-colors">{game.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-md text-text-muted">
                          {GAME_TYPES.find(t => t.id === game.type)?.name}
                        </span>
                        {game.targetGroup && (
                          <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Users size={10} /> {groups.find(g => g.id === game.targetGroup)?.name || 'مجموعة'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => loadResults(game)}
                      className="p-2 hover:bg-blue-500/10 text-blue-400 rounded-lg transition-colors border border-transparent hover:border-blue-500/20"
                      title="نتائج الطلاب"
                    >
                      <BarChart3 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(game.id)}
                      className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
                      title="حذف"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-text-muted">
                   <span>تاريخ الإنشاء: {new Date(game.createdAt).toLocaleDateString('ar-EG')}</span>
                   <button 
                     onClick={(e) => { e.stopPropagation(); setSelectedPreviewGame(game); }}
                     className="flex items-center gap-1 text-gold hover:underline relative z-20 cursor-pointer"
                   >
                     معاينة اللعبة <ChevronRight size={14} />
                   </button>
                </div>
                
                {/* Background Decoration */}
                <div className="absolute -bottom-4 -right-4 opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-500">
                   <Gamepad2 size={100} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
             <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-dark z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h2 className="font-black text-white">إنشاء لعبة تعليمية ذكية</h2>
                    <p className="text-xs text-text-muted">اختر نوع اللعبة ومصدر المعلومات</p>
                  </div>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
             </div>

             <div className="p-6 space-y-6">
                {/* Step 1: Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="block">
                      <span className="text-sm font-bold text-gray-300">عنوان اللعبة *</span>
                      <input 
                        type="text" 
                        placeholder="مثال: أساسيات الكيمياء العضوية" 
                        className="input-base mt-2"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-bold text-gray-300">تخصيص لمجموعة (اختياري)</span>
                      <select 
                        className="input-base mt-2"
                        value={targetGroup}
                        onChange={e => setTargetGroup(e.target.value)}
                      >
                        <option value="">جميع الطلاب</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className="space-y-4">
                    <span className="text-sm font-bold text-gray-300">نوع اللعبة</span>
                    <div className="grid grid-cols-2 gap-2">
                       {GAME_TYPES.map(type => (
                         <button
                           key={type.id}
                           onClick={() => setGameType(type.id as GameType)}
                           className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 ${gameType === type.id ? 'bg-gold/10 border-gold shadow-lg shadow-gold/10' : 'bg-white/5 border-white/10 opacity-60 hover:opacity-100'}`}
                         >
                           <div className="flex items-center justify-between">
                             <span className="text-xs font-black">{type.name}</span>
                             {type.icon}
                           </div>
                           <span className="text-[9px] text-text-muted">{type.desc}</span>
                         </button>
                       ))}
                    </div>
                  </div>
                </div>

                <hr className="border-white/5" />

                {/* Step 2: Content Source */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black gold-text flex items-center gap-2">
                    <Brain size={18} /> تزويد الذكاء الاصطناعي بالمادة العلمية
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="card-base p-4 bg-white/2 space-y-3">
                      <span className="text-xs font-bold text-gray-400">عن طريق ملف (PDF / صور)</span>
                      <GlobalFileUpload 
                        accept=".pdf,image/*"
                        label="اسحب ملف الدرس هنا أو اضغط للتحميل"
                        onChange={e => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                        isUploading={uploadingFile}
                      />
                      {fileBase64 && <div className="text-[10px] text-green-400 flex items-center gap-1"><Zap size={10} /> تم إرفاق الملف بنجاح</div>}
                    </div>
                    <div className="card-base p-4 bg-white/2 space-y-3">
                       <span className="text-xs font-bold text-gray-400">عن طريق وصف موضوعي</span>
                       <textarea 
                         placeholder="اكتب عنوان الدرس أو النقاط الرئيسية ليقوم الذكاء الاصطناعي بتوليد اللعبة منها..."
                         className="input-base text-sm h-32 resize-none"
                         value={topic}
                         onChange={e => setTopic(e.target.value)}
                       />
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                <button 
                  onClick={handleGenerateAI}
                  disabled={generating || (!topic && !fileBase64)}
                  className="btn-gold w-full h-14 text-lg !bg-blue-600 !border-blue-600 shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {generating ? (
                    <><Loader2 className="animate-spin" /> جاري توليد اللعبة بالذكاء الاصطناعي...</>
                  ) : (
                    <><Sparkles size={22} /> توليد محتوى اللعبة بالذكاء الاصطناعي</>
                  )}
                </button>

                {/* Preview Result */}
                {aiContent && (
                  <div className="space-y-4 animate-slide-up">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-green-400 flex items-center gap-2">
                        <Eye size={18} /> معاينة المحتوى المتولد ({aiContent.length} بطاقات)
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 bg-black/20 rounded-xl">
                       {aiContent.map((item: any, i: number) => (
                         <div key={i} className="text-[11px] p-2 bg-white/5 rounded-lg border border-white/5">
                            <div className="font-bold gold-text"># {i+1}</div>
                            <div className="text-white mt-1">{item.front || item.term || item.text || item.correct || item.statement}</div>
                            <div className="text-gray-400 mt-1 italic">{item.back || item.definition || item.explanation || (item.scrambled?.join(' ')) || (item.isTrue ? 'صح' : 'خطأ')}</div>
                         </div>
                       ))}
                    </div>
                    <button onClick={handleSaveGame} className="btn-gold w-full py-4 text-base">حفظ ونشر اللعبة للطلاب ✅</button>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {showResultsModal && (
        <div className="modal-overlay" onClick={() => setShowResultsModal(null)}>
          <div className="modal-content modal-content-lg" onClick={e => e.stopPropagation()}>
             <div className="p-6 bg-gradient-to-r from-blue-500/20 to-transparent border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white">
                    <BarChart3 size={24} />
                  </div>
                  <div>
                    <h2 className="font-black text-white">نتائج الطلاب: {showResultsModal.title}</h2>
                    <p className="text-xs text-blue-300/60">متابعة تفاعل الطلاب مع اللعبة</p>
                  </div>
                </div>
                <button onClick={() => setShowResultsModal(null)} className="text-gray-400 hover:text-white"><X size={24} /></button>
             </div>
             
             <div className="p-6 max-h-[60vh] overflow-y-auto">
                {loadingResults ? (
                  <div className="flex items-center justify-center p-20"><Loader2 className="animate-spin text-blue-500" /></div>
                ) : results.length === 0 ? (
                  <div className="text-center py-20 text-gray-500 italic">لا يوجد نتائج بعد. الطلاب لم يلعبوا هذه اللعبة حتى الآن.</div>
                ) : (
                  <div className="space-y-2">
                    {results.map(res => (
                      <div key={res.id} className="flex items-center justify-between p-3 rounded-xl bg-white/2 border border-white/5">
                        <div className="flex items-center gap-3">
                           <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center font-bold text-blue-400 uppercase">
                             {res.studentName?.[0] || 'S'}
                           </div>
                           <div>
                              <div className="text-sm font-bold text-white">{res.studentName}</div>
                              <div className="text-[10px] text-gray-500">{new Date(res.completedAt).toLocaleString('ar-EG')}</div>
                           </div>
                        </div>
                        <div className="text-right">
                           <div className="text-sm font-black text-gold">{res.score} / {res.total}</div>
                           <div className="text-[10px] text-gray-500">النتيجة النهائية</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      {/* Game Preview Portal */}
      {selectedPreviewGame && user && (
        <GamePortal 
          game={selectedPreviewGame}
          studentId={user.id}
          studentName={user.name + " (معاينة)"}
          onClose={() => setSelectedPreviewGame(null)}
        />
      )}
    </div>
  );
}
