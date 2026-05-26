'use client';

import { useState, useEffect } from 'react';
import { useTeacherStore } from '@/lib/store';
import { 
  getAssistants, saveAssistant, deleteAssistant, getAssistantProfileByCode, getAllAssistantProfiles,
  saveAssistantJob, getJobsByTeacher, getApplicationsForJob, updateApplicationStatus, saveAssistantLink,
  deleteAssistantJob
} from '@/lib/db';
import { Assistant, AssistantProfile, AssistantJob, AssistantJobApplication } from '@/types';
import { showToast } from '@/lib/toast';
import { 
  Users, PlusCircle, Trash2, Edit2, ShieldCheck, DollarSign, Briefcase, Search, 
  CheckCircle, HelpCircle, UserCheck, Eye, Sparkles, MessageSquare, Phone, X, 
  ExternalLink, FileText, Check, AlertCircle, Clock, XCircle
} from 'lucide-react';
import Link from 'next/link';

export default function StaffPage() {
  const user = useTeacherStore(state => state.user);
  
  const [activeTab, setActiveTab] = useState<'my_team' | 'directory' | 'recruitment'>('my_team');
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Available assistants directory state
  const [availableProfiles, setAvailableProfiles] = useState<AssistantProfile[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  
  // Recruitment states
  const [jobs, setJobs] = useState<AssistantJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<AssistantJob | null>(null);
  const [applications, setApplications] = useState<AssistantJobApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [viewingAppsForJobId, setViewingAppsForJobId] = useState<string | null>(null);

  // Verification states for linking assistant
  const [astCode, setAstCode] = useState('');
  const [verifiedAst, setVerifiedAst] = useState<any | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Form states
  const [form, setForm] = useState<Partial<Assistant> & { assistantId?: string, subStart?: number, subExpiry?: number }>({
    name: '',
    phone: '',
    role: 'مساعد',
    permissions: ['attendance'],
    salaryType: 'fixed',
    salaryValue: 0,
  });

  const [jobForm, setJobForm] = useState<Partial<AssistantJob>>({
    title: '',
    description: '',
    requirements: '',
    salaryType: 'fixed',
    salaryValue: 0,
  });

  const fetchAssistants = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getAssistants(user.id);
      setAssistants(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDirectory = async () => {
    setLoadingDirectory(true);
    try {
      const profiles = await getAllAssistantProfiles();
      // Only show approved assistants
      setAvailableProfiles(profiles.filter(p => p.status === 'approved'));
    } catch (err) {
      console.error(err);
      showToast('فشل تحميل دليل المساعدين', 'error');
    } finally {
      setLoadingDirectory(false);
    }
  };

  const fetchJobs = async () => {
    if (!user) return;
    setLoadingJobs(true);
    try {
      const data = await getJobsByTeacher(user.id);
      setJobs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingJobs(false);
    }
  };

  const fetchApplications = async (jobId: string) => {
    setLoadingApps(true);
    try {
      const data = await getApplicationsForJob(jobId);
      setApplications(data);
    } catch (err) {
      console.error(err);
      showToast('فشل تحميل طلبات التقديم', 'error');
    } finally {
      setLoadingApps(false);
    }
  };

  useEffect(() => {
    fetchAssistants();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'directory') {
      fetchDirectory();
    } else if (activeTab === 'recruitment') {
      fetchJobs();
    }
  }, [activeTab]);

  const handleVerifyCode = async (codeToVerify?: string) => {
    const code = (codeToVerify || astCode).trim().toUpperCase();
    if (!code) {
      showToast('يرجى إدخال كود المساعد الموحد', 'error');
      return;
    }
    setVerifying(true);
    setVerifiedAst(null);
    try {
      const profile = await getAssistantProfileByCode(code);
      if (profile) {
        if (profile.status !== 'approved') {
          showToast('❌ هذا المساعد غير معتمد من قبل الإدارة بعد', 'error');
          return;
        }
        setVerifiedAst(profile);
        setForm(f => ({
          ...f,
          name: profile.name,
          phone: profile.phone,
          role: profile.roleTitle || 'مساعد مادة',
          assistantId: profile.id
        }));
        if (!codeToVerify) {
          showToast('تم التحقق بنجاح والعثور على المساعد', 'success');
        }
      } else {
        showToast('كود المساعد غير صحيح أو غير مسجل في المنصة', 'error');
      }
    } catch (err) {
      showToast('حدث خطأ أثناء التحقق من الكود', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleLinkFromDirectory = async (profile: AssistantProfile) => {
    setForm({
      name: profile.name,
      phone: profile.phone,
      role: profile.roleTitle || 'مساعد مادة',
      permissions: ['attendance'],
      salaryType: 'fixed',
      salaryValue: 0,
      assistantId: profile.id
    });
    setAstCode(profile.code || '');
    setVerifiedAst(profile);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.name || !form.phone) {
      showToast('يرجى إدخال اسم ورقم هاتف المساعد أو التحقق من الكود', 'error');
      return;
    }
    
    try {
      const isNew = !form.id;
      const newAssistant = {
        ...form,
        teacherId: user.id,
        status: isNew ? 'pending' : (form.status || 'active'),
        createdAt: form.createdAt || Date.now()
      } as Assistant;
      
      await saveAssistant(newAssistant);
      await fetchAssistants();
      
      setShowModal(false);
      setVerifiedAst(null);
      setAstCode('');
      showToast(isNew ? 'تم إرسال العرض للمساعد بانتظار موافقته' : 'تم حفظ بيانات المساعد بنجاح', 'success');
    } catch (err) {
      showToast('فشل الحفظ', 'error');
    }
  };

  const handleSaveJob = async () => {
    if (!user) return;
    if (!jobForm.title || !jobForm.description) {
      showToast('يرجى كتابة عنوان ووصف فرصة العمل', 'error');
      return;
    }

    try {
      await saveAssistantJob({
        ...jobForm,
        teacherId: user.id,
        teacherName: user.name,
        teacherPhone: user.phone
      } as AssistantJob);
      
      setShowJobModal(false);
      setJobForm({ title: '', description: '', requirements: '', salaryType: 'fixed', salaryValue: 0 });
      await fetchJobs();
      showToast('تم نشر فرصة العمل بنجاح', 'success');
    } catch (err) {
      showToast('فشل نشر فرصة العمل', 'error');
    }
  };

  const handleToggleJobStatus = async (job: AssistantJob) => {
    const newStatus = job.status === 'open' ? 'closed' : 'open';
    try {
      await saveAssistantJob({
        ...job,
        status: newStatus
      });
      await fetchJobs();
      showToast(newStatus === 'open' ? 'تم إعادة فتح التقديم' : 'تم إغلاق التقديم', 'success');
    } catch (err) {
      showToast('فشل تعديل حالة فرصة العمل', 'error');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('هل أنت متأكد من حذف فرصة العمل هذه نهائياً؟')) return;
    try {
      await deleteAssistantJob(jobId);
      await fetchJobs();
      showToast('تم حذف فرصة العمل بنجاح', 'success');
    } catch (err) {
      showToast('حدث خطأ أثناء الحذف', 'error');
    }
  };

  const handleEditJob = (job: AssistantJob) => {
    setJobForm(job);
    setShowJobModal(true);
  };

  const handleAcceptApplication = async (app: AssistantJobApplication, job: AssistantJob) => {
    if (!user) return;
    if (!confirm(`هل أنت متأكد من قبول طلب المساعد "${app.assistant?.name}" وتعيينه رسمياً؟`)) return;

    try {
      // 1. Update application status
      await updateApplicationStatus(app.id, 'accepted');

      // 2. Create the teacher-assistant contract
      await saveAssistantLink({
        teacherId: user.id,
        assistantId: app.assistantId,
        role: job.title || 'مساعد مادة',
        permissions: ['attendance', 'grading'], // Default helper permissions
        salaryType: job.salaryType,
        salaryValue: job.salaryValue,
        status: 'active',
        createdAt: Date.now()
      });

      showToast('تم قبول طلب المساعد وربطه بفريق عملك بنجاح', 'success');
      await fetchAssistants();
      if (viewingAppsForJobId) {
        await fetchApplications(viewingAppsForJobId);
      }
    } catch (err) {
      showToast('فشل تعيين المساعد', 'error');
    }
  };

  const handleRejectApplication = async (appId: string) => {
    if (!confirm('هل أنت متأكد من رفض هذا الطلب؟')) return;
    try {
      await updateApplicationStatus(appId, 'rejected');
      showToast('تم رفض الطلب', 'success');
      if (viewingAppsForJobId) {
        await fetchApplications(viewingAppsForJobId);
      }
    } catch (err) {
      showToast('فشل تعديل حالة الطلب', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من إلغاء تعاقد هذا المساعد وحذفه؟')) return;
    try {
      await deleteAssistant(id);
      setAssistants(assistants.filter(a => a.id !== id));
      showToast('تم الحذف', 'success');
    } catch (err) {
      showToast('فشل الحذف', 'error');
    }
  };

  const handleTogglePause = async (assistant: Assistant) => {
    try {
      const newStatus = assistant.status === 'paused' ? 'active' : 'paused';
      // In getAssistants, we map id to link.id, so assistant.id is link id.
      // Assuming we have updateAssistantLinkStatus, wait let me just saveAssistant with new status.
      await saveAssistant({ ...assistant, status: newStatus });
      
      if (newStatus === 'paused') {
        showToast('تم إيقاف المساعد مؤقتاً', 'success');
        // Notify via WhatsApp
        if (assistant.phone) {
          const msg = `مرحباً أ. ${assistant.name}، نود إعلامك بأنه تم إيقاف عملك مؤقتاً في أكاديمية ${user?.name || ''}.`;
          window.open(`https://wa.me/20${assistant.phone.replace(/^0/, '')}?text=${encodeURIComponent(msg)}`, '_blank');
        }
      } else {
        showToast('تم إعادة تفعيل المساعد', 'success');
      }
      await fetchAssistants();
    } catch (err) {
      showToast('حدث خطأ أثناء تغيير الحالة', 'error');
    }
  };

  const togglePermission = (perm: string) => {
    const current = form.permissions || [];
    if (current.includes(perm)) {
      setForm({ ...form, permissions: current.filter(p => p !== perm) });
    } else {
      setForm({ ...form, permissions: [...current, perm] });
    }
  };

  const calculatePayroll = (a: any) => {
    if (a.salaryType === 'fixed') return `${a.salaryValue} ج.م شهرياً`;
    if (a.salaryType === 'hourly') return `${a.salaryValue} ج.م / ساعة`;
    if (a.salaryType === 'percentage') return `${a.salaryValue}% من الدخل`;
    return '-';
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black font-cairo gold-text mb-1 flex items-center gap-2">
            <Briefcase size={24} /> الموارد البشرية وفريق العمل
          </h1>
          <p className="text-sm text-text-muted">إدارة فريق عمل مساعدي المادة، طلبات التوظيف، والتراخيص</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'recruitment' ? (
            <button onClick={() => { 
              setJobForm({ title: '', description: '', requirements: '', salaryType: 'fixed', salaryValue: 0 }); 
              setShowJobModal(true); 
            }} className="btn-gold bg-amber-500 hover:bg-amber-600 text-black font-black">
              <PlusCircle size={18} /> نشر فرصة عمل جديدة
            </button>
          ) : (
            <button onClick={() => { 
              setForm({ name: '', phone: '', role: 'مساعد', permissions: ['attendance'], salaryType: 'fixed', salaryValue: 0 }); 
              setVerifiedAst(null);
              setAstCode('');
              setShowModal(true); 
            }} className="btn-gold bg-amber-500 hover:bg-amber-600 text-black font-black">
              <PlusCircle size={18} /> إضافة مساعد بالرمز الموحد
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 gap-2">
        <button
          onClick={() => { setActiveTab('my_team'); setViewingAppsForJobId(null); }}
          className={`px-5 py-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'my_team'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5'
              : 'border-transparent text-text-muted hover:text-white'
          }`}
        >
          <Users size={16} /> فريق العمل الحالي ({assistants.length})
        </button>
        <button
          onClick={() => { setActiveTab('directory'); setViewingAppsForJobId(null); }}
          className={`px-5 py-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'directory'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5'
              : 'border-transparent text-text-muted hover:text-white'
          }`}
        >
          <Search size={16} /> دليل المساعدين المتاحين بالمنصة ({availableProfiles.length})
        </button>
        <button
          onClick={() => setActiveTab('recruitment')}
          className={`px-5 py-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'recruitment'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5'
              : 'border-transparent text-text-muted hover:text-white'
          }`}
        >
          <Briefcase size={16} /> طلبات التوظيف والفرص ({jobs.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'my_team' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
             <div className="col-span-full p-8 text-center"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
          ) : assistants.length === 0 ? (
             <div className="col-span-full p-12 text-center text-text-muted bg-white/5 border border-white/5 rounded-2xl">
               <Users size={40} className="mx-auto mb-2 opacity-30 text-amber-500" />
               لا يوجد مساعدين مسجلين في فريق عملك حالياً.
               <button 
                 onClick={() => setActiveTab('directory')} 
                 className="block mx-auto mt-4 text-xs font-bold text-amber-500 underline hover:text-amber-400"
               >
                 تصفح المساعدين المتاحين للتوظيف بالمنصة
               </button>
             </div>
          ) : (
            assistants.map(assistant => (
              <div key={assistant.id} className="card-base p-5 border-white/10 hover:border-amber-500/30 transition-all group relative overflow-hidden bg-gradient-to-b from-white/5 to-transparent">
                {assistant.code && (
                  <div className="absolute top-0 left-0 bg-amber-500/10 text-amber-500 text-[9px] font-mono font-bold px-2.5 py-1 rounded-br-lg border-r border-b border-amber-500/20">
                    {assistant.code}
                  </div>
                )}
                
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {assistant.imageUrl ? (
                      <img src={assistant.imageUrl} alt={assistant.name} className="w-12 h-12 rounded-full object-cover border border-white/10 shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 font-black text-xl border border-amber-500/20 shrink-0">
                        {assistant.name[0]}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-white group-hover:text-amber-400 transition-colors">{assistant.name}</h3>
                      <div className="text-xs text-text-muted">{assistant.role} • {assistant.phone}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Add Direct Chat Action */}
                    {assistant.assistantId && (
                      <Link 
                        href={`/teacher/messages?userId=${assistant.assistantId}&userName=${encodeURIComponent(assistant.name)}`}
                        className="p-1.5 bg-white/5 rounded-md hover:bg-gold/20 text-gold"
                        title="دردشة داخلية"
                      >
                        <MessageSquare size={14} />
                      </Link>
                    )}
                    {assistant.status !== 'pending' && assistant.status !== 'rejected' && (
                      <button onClick={() => handleTogglePause(assistant)} className="p-1.5 bg-white/5 rounded-md hover:bg-orange-500/20 text-orange-400" title={assistant.status === 'paused' ? 'إعادة تفعيل' : 'إيقاف مؤقت'}>
                        {assistant.status === 'paused' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      </button>
                    )}
                    <button onClick={() => { setForm(assistant); setVerifiedAst(assistant); setAstCode(assistant.code || ''); setShowModal(true); }} className="p-1.5 bg-white/5 rounded-md hover:bg-amber-500/20 text-amber-400"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(assistant.id)} className="p-1.5 bg-white/5 rounded-md hover:bg-red-500/20 text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
                
                {assistant.status === 'paused' && (
                  <div className="mb-3 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400 text-xs font-bold flex items-center justify-center gap-1.5">
                    <XCircle size={14} /> موقوف مؤقتاً من قبل المعلم
                  </div>
                )}
                {assistant.status === 'pending' && (
                  <div className="mb-3 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs font-bold flex items-center justify-center gap-1.5">
                    <Clock size={14} /> عرض قيد الانتظار (في انتظار موافقة المساعد)
                  </div>
                )}
                {assistant.status === 'rejected' && (
                  <div className="mb-3 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-bold flex items-center justify-center gap-1.5">
                    <XCircle size={14} /> رفض المساعد هذا العرض
                  </div>
                )}

                <div className="space-y-3 pt-3 border-t border-white/5">
                  <div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {assistant.permissions.length === 0 && <span className="text-[10px] text-gray-500">لا توجد صلاحيات</span>}
                      {assistant.permissions.map(p => {
                        const label = {
                          dashboard: 'الرئيسية', notifications: 'الإشعارات', analytics: 'التحليلات', messages: 'الرسائل',
                          exams: 'الاختبارات', essays: 'المقالي', results: 'النتائج', qbank: 'بنك الأسئلة',
                          ai: 'الذكاء الاصطناعي', games: 'الألعاب', students: 'الطلاب', attendance: 'الحضور والغياب',
                          groups: 'الفصول', subscriptions: 'الاشتراكات', finances: 'الماليات', courses: 'المناهج',
                          assignments: 'الواجبات', calendar: 'التقويم', schedule: 'جدول الحصص', tools: 'أدوات PDF',
                          settings: 'الإعدادات'
                        }[p as string] || p;
                        return (
                          <span key={p} className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm bg-white/5 p-2 rounded-lg border border-white/5">
                    <DollarSign size={16} className="text-amber-400" />
                    <span className="font-mono font-bold text-white">{calculatePayroll(assistant)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'directory' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadingDirectory ? (
             <div className="col-span-full p-8 text-center"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
          ) : availableProfiles.length === 0 ? (
             <div className="col-span-full p-12 text-center text-text-muted bg-white/5 border border-white/5 rounded-2xl">
               لا يوجد مساعدين معتمدين ومتاحين في المنصة حالياً
             </div>
          ) : (
            availableProfiles.map(profile => {
              const isAlreadyInTeam = assistants.some(a => a.assistantId === profile.id);
              
              return (
                <div key={profile.id} className="card-base p-5 border-white/10 hover:border-amber-500/30 transition-all flex flex-col justify-between h-full bg-gradient-to-b from-white/5 to-transparent relative group">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      {profile.imageUrl ? (
                        <img src={profile.imageUrl} alt={profile.name} className="w-12 h-12 rounded-full object-cover border border-white/10 shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-xl border border-amber-500/20 shrink-0">
                          {profile.name[0]}
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-white group-hover:text-amber-400 transition-colors">{profile.name}</h3>
                        <p className="text-xs text-text-muted">التخصص: {profile.roleTitle || 'مساعد مادة'}</p>
                      </div>
                    </div>

                    <div className="py-2.5 border-t border-white/5 space-y-1.5 text-xs text-text-muted">
                      {profile.bio && (
                        <p className="text-[11px] text-gray-400 bg-white/5 p-2 rounded-lg mb-2 italic">"{profile.bio}"</p>
                      )}
                      {profile.experience && (
                        <div>
                          <span className="font-bold text-white block mb-0.5">الخبرات السابقة:</span>
                          <p className="text-[11px] text-gray-400 line-clamp-2">{profile.experience}</p>
                        </div>
                      )}
                      {profile.education && (
                        <div className="pt-1">
                          <span className="font-bold text-white block mb-0.5">التعليم:</span>
                          <p className="text-[11px] text-gray-400 line-clamp-1">{profile.education}</p>
                        </div>
                      )}
                      <div className="flex justify-between pt-2">
                        <span>رقم الهاتف:</span>
                        <span className="text-white font-bold">{profile.phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>الرمز الموحد:</span>
                        <span className="text-amber-400 font-mono font-bold">{profile.code}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>طريقة الدفع المفضلة:</span>
                        <span className="text-white font-bold">
                          {profile.salaryPaymentMethod === 'fixed' ? 'راتب شهري ثابت' :
                           profile.salaryPaymentMethod === 'hourly' ? 'بالساعة' :
                           profile.salaryPaymentMethod === 'percentage' ? 'نسبة مئوية' :
                           profile.salaryPaymentMethod === 'flexible' ? 'مرن / بالاتفاق' :
                           'راتب شهري ثابت'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {/* CV Download / Preview button */}
                    {profile.cvUrl && (
                      <a 
                        href={profile.cvUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 border border-white/10"
                      >
                        <FileText size={14} className="text-amber-400" /> عرض السيرة الذاتية
                      </a>
                    )}
                    
                    <div className="flex gap-2">
                      {/* Contact Actions */}
                      <a 
                        href={`https://wa.me/20${profile.phone.replace(/^0/, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 bg-green-600/10 hover:bg-green-600/20 text-green-400 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 border border-green-500/20"
                      >
                        <Phone size={13} /> واتساب
                      </a>
                      <Link 
                        href={`/teacher/messages?userId=${profile.id}&userName=${encodeURIComponent(profile.name)}`}
                        className="flex-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 border border-blue-500/20"
                      >
                        <MessageSquare size={13} /> دردشة
                      </Link>
                    </div>

                    {isAlreadyInTeam ? (
                      <div className="w-full bg-green-500/10 text-green-400 font-bold text-xs py-2 rounded-xl border border-green-500/20 text-center flex items-center justify-center gap-1">
                        <CheckCircle size={14} /> مشترك في أكاديميتك
                      </div>
                    ) : (
                      <button
                        onClick={() => handleLinkFromDirectory(profile)}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black py-2 rounded-xl text-xs transition flex items-center justify-center gap-1"
                      >
                        <PlusCircle size={14} /> إضافة إلى فريقي
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'recruitment' && (
        <div className="space-y-6">
          {viewingAppsForJobId ? (
            /* Applications list for selected job */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setViewingAppsForJobId(null)} 
                  className="text-xs font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1"
                >
                  &rarr; العودة لإعلانات التوظيف
                </button>
                <h3 className="font-bold text-lg text-white">
                  المتقدمين لوظيفة: <span className="text-amber-400">{jobs.find(j => j.id === viewingAppsForJobId)?.title}</span>
                </h3>
              </div>

              {loadingApps ? (
                <div className="p-8 text-center"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
              ) : applications.length === 0 ? (
                <div className="p-12 text-center text-text-muted bg-white/5 border border-white/5 rounded-2xl">
                  لا توجد طلبات تقديم على هذه الوظيفة بعد.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {applications.map(app => (
                    <div key={app.id} className="card-base p-5 border-white/10 bg-gradient-to-b from-white/5 to-transparent space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {app.assistant?.imageUrl ? (
                            <img src={app.assistant.imageUrl} alt={app.assistant.name} className="w-12 h-12 rounded-full object-cover border border-white/10 shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-xl border border-amber-500/20 shrink-0">
                              {app.assistant?.name[0]}
                            </div>
                          )}
                          <div>
                            <h4 className="font-bold text-white">{app.assistant?.name}</h4>
                            <p className="text-xs text-text-muted">الهاتف: {app.assistant?.phone}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          app.status === 'accepted' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                          app.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {app.status === 'accepted' ? 'مقبول' : app.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                        </span>
                      </div>

                      {app.message && (
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-gray-300">
                          <span className="font-bold text-white block mb-1">الرسالة التعريفية:</span>
                          "{app.message}"
                        </div>
                      )}

                      <div className="text-xs text-text-muted space-y-1 bg-black/20 p-3 rounded-xl">
                        {app.assistant?.bio && (
                          <p><strong>النبذة:</strong> {app.assistant.bio}</p>
                        )}
                        {app.assistant?.experience && (
                          <p><strong>الخبرات:</strong> {app.assistant.experience}</p>
                        )}
                        {app.assistant?.education && (
                          <p><strong>التعليم:</strong> {app.assistant.education}</p>
                        )}
                        <p>
                          <strong>طريقة الدفع المفضلة:</strong>{' '}
                          {app.assistant?.salaryPaymentMethod === 'hourly' ? 'بالساعة' :
                           app.assistant?.salaryPaymentMethod === 'percentage' ? 'نسبة مئوية' :
                           app.assistant?.salaryPaymentMethod === 'flexible' ? 'مرن / بالاتفاق' :
                           'راتب شهري ثابت'}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {app.cvUrl && (
                          <a 
                            href={app.cvUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex-1 min-w-[120px] bg-white/5 hover:bg-white/10 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 border border-white/10"
                          >
                            <FileText size={14} className="text-amber-400" /> السيرة الذاتية
                          </a>
                        )}

                        <a 
                          href={`https://wa.me/20${app.assistant?.phone.replace(/^0/, '')}?text=${encodeURIComponent(
                            `مرحباً أ. ${app.assistant?.name}، أنا المعلم ${user?.name} من منصة A-N Academy، مهتم بطلب توظيفك لوظيفة: ${jobs.find(j => j.id === viewingAppsForJobId)?.title}`
                          )}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-1 bg-green-600/10 hover:bg-green-600/20 text-green-400 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 border border-green-500/20"
                        >
                          <Phone size={13} /> واتساب
                        </a>

                        {app.assistant && (
                          <Link 
                            href={`/teacher/messages?userId=${app.assistantId}&userName=${encodeURIComponent(app.assistant.name)}`}
                            className="flex-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 border border-blue-500/20"
                          >
                            <MessageSquare size={13} /> دردشة
                          </Link>
                        )}

                        {app.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleRejectApplication(app.id)}
                              className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-2 rounded-xl text-xs transition border border-red-500/20"
                            >
                              رفض
                            </button>
                            <button
                              onClick={() => handleAcceptApplication(app, jobs.find(j => j.id === viewingAppsForJobId)!)}
                              className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-black py-2 rounded-xl text-xs transition"
                            >
                              توظيف وقبول
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Jobs listing */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingJobs ? (
                <div className="col-span-full p-8 text-center"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
              ) : jobs.length === 0 ? (
                <div className="col-span-full p-12 text-center text-text-muted bg-white/5 border border-white/5 rounded-2xl">
                  لم تقم بنشر أي طلبات توظيف بعد. انقر على "نشر فرصة عمل جديدة" بالأعلى للبدء.
                </div>
              ) : (
                jobs.map(job => (
                  <div key={job.id} className="card-base p-5 border-white/10 hover:border-amber-500/30 transition-all flex flex-col justify-between h-full bg-gradient-to-b from-white/5 to-transparent relative">
                    <span className={`absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      job.status === 'open' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {job.status === 'open' ? 'مفتوح للتقديم' : 'مغلق'}
                    </span>

                    <div className="absolute top-3 right-3 flex gap-1">
                      <button onClick={() => handleEditJob(job)} className="p-1.5 bg-white/5 rounded-md hover:bg-amber-500/20 text-amber-400 transition" title="تعديل">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDeleteJob(job.id)} className="p-1.5 bg-white/5 rounded-md hover:bg-red-500/20 text-red-400 transition" title="حذف">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="space-y-3 mt-4">
                      <h3 className="font-bold text-white text-lg pr-12">{job.title}</h3>
                      <p className="text-xs text-gray-400 line-clamp-3">"{job.description}"</p>
                      
                      {job.requirements && (
                        <div className="text-xs text-text-muted">
                          <strong>المتطلبات:</strong> {job.requirements}
                        </div>
                      )}

                      <div className="text-xs font-bold text-amber-400 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 w-max">
                        الراتب: {calculatePayroll(job)}
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-white/5 flex gap-2">
                      <button
                        onClick={() => { setViewingAppsForJobId(job.id); fetchApplications(job.id); }}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-black py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                      >
                        <Users size={14} /> عرض المتقدمين
                      </button>
                      <button
                        onClick={() => handleToggleJobStatus(job)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                          job.status === 'open' 
                            ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400' 
                            : 'bg-green-500/10 hover:bg-green-500/20 border-green-500/20 text-green-400'
                        }`}
                      >
                        {job.status === 'open' ? 'إغلاق' : 'إعادة فتح'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Staff Link Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content border-amber-500/20">
            <div className="modal-header">
              <h3 className="font-bold text-lg text-amber-400 flex items-center gap-2">
                <Briefcase size={20} /> {form.id ? 'تعديل بيانات المساعد' : 'ربط مساعد جديد'}
              </h3>
            </div>
            <div className="modal-body space-y-4">
              
              {!form.id && (
                <div className="p-3.5 border border-amber-500/10 bg-amber-500/5 rounded-xl space-y-2">
                  <label className="block text-xs font-bold text-amber-400 mb-1 flex items-center gap-1">
                    <UserCheck size={14} /> اربط المساعد عن طريق كوده الموحد
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={astCode} 
                      onChange={e => setAstCode(e.target.value)} 
                      className="input-base w-full text-left font-mono font-bold" 
                      placeholder="AST-XXXXXX"
                      dir="ltr"
                    />
                    <button 
                      type="button" 
                      onClick={() => handleVerifyCode()} 
                      disabled={verifying}
                      className="px-4 py-2 bg-amber-500 text-black hover:bg-amber-600 rounded-xl text-xs font-bold shrink-0 transition"
                    >
                      {verifying ? 'جاري التحقق...' : 'تحقق'}
                    </button>
                  </div>
                  {verifiedAst && (
                    <div className="mt-2 p-2 bg-black/40 rounded-lg flex items-center gap-2 text-xs border border-green-500/20 text-green-400 font-bold">
                      <CheckCircle size={14} /> تم تأكيد الحساب: {verifiedAst.name} ({verifiedAst.roleTitle || 'مساعد'})
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">الاسم</label>
                  <input 
                    type="text" 
                    value={form.name || ''} 
                    onChange={e => setForm({ ...form, name: e.target.value })} 
                    className="input-base w-full disabled:opacity-50" 
                    placeholder="اسم المساعد..." 
                    disabled={!!verifiedAst}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">رقم الهاتف</label>
                  <input 
                    type="tel" 
                    value={form.phone || ''} 
                    onChange={e => setForm({ ...form, phone: e.target.value })} 
                    className="input-base w-full disabled:opacity-50" 
                    placeholder="01..." 
                    dir="ltr" 
                    disabled={!!verifiedAst}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">المسمى الوظيفي لدى المعلم</label>
                <input type="text" value={form.role || ''} onChange={e => setForm({ ...form, role: e.target.value })} className="input-base w-full" placeholder="مثال: سكرتير، مساعد أول، مصحح..." />
              </div>

              <div className="p-3 border border-white/10 rounded-xl bg-white/5 space-y-3">
                <label className="block text-xs font-bold text-white mb-2 flex items-center gap-1"><ShieldCheck size={14} className="text-amber-400" /> الصلاحيات الممنوحة</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {[
                    { id: 'dashboard', label: 'الرئيسية' },
                    { id: 'notifications', label: 'الإشعارات' },
                    { id: 'analytics', label: 'التحليلات' },
                    { id: 'messages', label: 'الرسائل' },
                    { id: 'exams', label: 'الاختبارات' },
                    { id: 'essays', label: 'المقالي' },
                    { id: 'results', label: 'النتائج' },
                    { id: 'qbank', label: 'بنك الأسئلة' },
                    { id: 'ai', label: 'الذكاء الاصطناعي' },
                    { id: 'games', label: 'الألعاب' },
                    { id: 'students', label: 'الطلاب' },
                    { id: 'attendance', label: 'الحضور' },
                    { id: 'groups', label: 'الفصول' },
                    { id: 'subscriptions', label: 'الاشتراكات' },
                    { id: 'finances', label: 'الماليات' },
                    { id: 'courses', label: 'المناهج' },
                    { id: 'assignments', label: 'الواجبات' },
                    { id: 'calendar', label: 'التقويم' },
                    { id: 'schedule', label: 'جدول الحصص' },
                    { id: 'tools', label: 'أدوات PDF' }
                  ].map(perm => (
                    <label key={perm.id} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                      <input type="checkbox" checked={(form.permissions || []).includes(perm.id)} onChange={() => togglePermission(perm.id)} className="accent-amber-500 w-3.5 h-3.5" />
                      <span className="text-[11px] font-bold">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">نوع الراتب</label>
                  <select value={form.salaryType || 'fixed'} onChange={e => setForm({ ...form, salaryType: e.target.value as any })} className="input-base w-full">
                    <option value="fixed">راتب شهري ثابت</option>
                    <option value="hourly">بالساعة</option>
                    <option value="percentage">نسبة من الدخل</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">القيمة ({form.salaryType === 'percentage' ? '%' : 'ج.م'})</label>
                  <input type="number" value={form.salaryValue || 0} onChange={e => setForm({ ...form, salaryValue: Number(e.target.value) })} className="input-base w-full font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">تاريخ بدء العمل (اختياري)</label>
                  <input 
                    type="date" 
                    value={form.subStart ? new Date(form.subStart).toISOString().split('T')[0] : ''} 
                    onChange={e => setForm({ ...form, subStart: e.target.value ? new Date(e.target.value).getTime() : undefined })} 
                    className="input-base w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">تاريخ انتهاء التعاقد (اختياري)</label>
                  <input 
                    type="date" 
                    value={form.subExpiry ? new Date(form.subExpiry).toISOString().split('T')[0] : ''} 
                    onChange={e => setForm({ ...form, subExpiry: e.target.value ? new Date(e.target.value).getTime() : undefined })} 
                    className="input-base w-full"
                  />
                </div>
              </div>

            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-outline flex-1">إلغاء</button>
              <button onClick={handleSave} className="btn-gold flex-1 justify-center text-black bg-amber-500 hover:bg-amber-600 font-bold">
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Job Modal */}
      {showJobModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowJobModal(false)}>
          <div className="modal-content border-amber-500/20 max-w-lg">
            <div className="modal-header">
              <h3 className="font-bold text-lg text-amber-400 flex items-center gap-2">
                <Briefcase size={20} /> نشر فرصة عمل بالمنصة
              </h3>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">مسمى الوظيفة المطلوبة</label>
                <input 
                  type="text" 
                  value={jobForm.title || ''} 
                  onChange={e => setJobForm({ ...jobForm, title: e.target.value })} 
                  className="input-base w-full" 
                  placeholder="مثال: مصحح مقالي لغة عربية، سكرتير مجموعة..." 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">وصف فرصة العمل والمهام</label>
                <textarea 
                  value={jobForm.description || ''} 
                  onChange={e => setJobForm({ ...jobForm, description: e.target.value })} 
                  className="input-base w-full min-h-[100px]" 
                  placeholder="اكتب وصفاً مفصلاً للمسؤوليات والمهام اليومية..." 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">شروط المتقدم (اختياري)</label>
                <input 
                  type="text" 
                  value={jobForm.requirements || ''} 
                  onChange={e => setJobForm({ ...jobForm, requirements: e.target.value })} 
                  className="input-base w-full" 
                  placeholder="مثال: خبرة لا تقل عن سنة، خريج كلية تربية..." 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">نوع الراتب المعروض</label>
                  <select value={jobForm.salaryType || 'fixed'} onChange={e => setJobForm({ ...jobForm, salaryType: e.target.value as any })} className="input-base w-full">
                    <option value="fixed">راتب شهري ثابت</option>
                    <option value="hourly">بالساعة</option>
                    <option value="percentage">نسبة من الدخل</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">القيمة ({jobForm.salaryType === 'percentage' ? '%' : 'ج.م'})</label>
                  <input type="number" value={jobForm.salaryValue || 0} onChange={e => setJobForm({ ...jobForm, salaryValue: Number(e.target.value) })} className="input-base w-full font-mono" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowJobModal(false)} className="btn-outline flex-1">إلغاء</button>
              <button onClick={handleSaveJob} className="btn-gold flex-1 justify-center text-black bg-amber-500 hover:bg-amber-600 font-bold">
                نشر الفرصة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
