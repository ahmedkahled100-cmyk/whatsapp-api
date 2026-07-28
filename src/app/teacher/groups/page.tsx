'use client';
// src/app/teacher/groups/page.tsx

import { useState } from 'react';
import { useTeacherStore } from '@/lib/store';
import { saveGroup, deleteGroup } from '@/lib/db';
import { showToast } from '@/lib/toast';
import type { Group } from '@/types';
import { PlusCircle, Trash2, Users, Edit, Save, X, School } from 'lucide-react';
import { generateId } from '@/lib/utils';

export default function GroupsPage() {
  const { groups, students } = useTeacherStore();
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditingGroup(null);
    setName(''); setDesc(''); setSelectedStudents([]);
    setShowModal(true);
  };

  const openEdit = (group: Group) => {
    setEditingGroup(group);
    setName(group.name);
    setDesc(group.desc || '');
    setSelectedStudents([...group.studentIds]);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { showToast('❗ أدخل اسم الفصل'); return; }
    setSaving(true);
    const teacherId = useTeacherStore.getState().user?.id || '';
    // Optimistic Update
    const tempId = editingGroup?.id || crypto.randomUUID();
    const groupData: any = {
      id: tempId,
      teacherId,
      name, desc, studentIds: selectedStudents,
      createdAt: editingGroup?.createdAt || new Date().toISOString(),
    };

    const previousGroups = [...useTeacherStore.getState().groups];
    if (editingGroup) {
      useTeacherStore.getState().setGroups(previousGroups.map(g => g.id === tempId ? groupData : g));
    } else {
      useTeacherStore.getState().setGroups([...previousGroups, groupData]);
    }
    
    setShowModal(false);
    showToast('✅ تم حفظ الفصل');

    try {
      const realId = await saveGroup(groupData);
      if (!editingGroup && realId !== tempId) {
        // Update temp ID with real ID silently
        useTeacherStore.getState().setGroups(useTeacherStore.getState().groups.map(g => g.id === tempId ? { ...g, id: realId } : g));
      }
    } catch (err) {
      useTeacherStore.getState().setGroups(previousGroups);
      showToast('❌ فشل الحفظ'); 
    }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`حذف الفصل "${name}"؟`)) return;
    const previousGroups = [...useTeacherStore.getState().groups];
    useTeacherStore.getState().setGroups(previousGroups.filter(g => g.id !== id));
    try {
      await deleteGroup(id);
      showToast('✅ تم حذف الفصل');
    } catch (err) {
      useTeacherStore.getState().setGroups(previousGroups);
      showToast('❌ فشل الحذف');
    }
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-cairo font-black gold-text flex items-center gap-2">
          <School size={24} /> الفصول والمجموعات
        </h1>
        <button onClick={openAdd} className="btn-gold"><PlusCircle size={15} /> فصل جديد</button>
      </div>

      {groups.length === 0 ? (
        <div className="card-base p-12 text-center text-text-muted">
          <div className="w-16 h-16 mx-auto mb-3 opacity-20 flex items-center justify-center">
            <School size={40} />
          </div>
          <p>لا توجد فصول بعد</p>
          <button onClick={openAdd} className="btn-gold inline-flex mt-4 text-sm">
            <PlusCircle size={14} /> أنشئ أول فصل
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {groups.map(group => {
            const groupStudents = students.filter(s => group.studentIds.includes(s.id));
            return (
              <div key={group.id} className="card-base p-4 transition-all hover:border-yellow-500/20">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-cairo font-bold text-base">{group.name}</h3>
                    {group.desc && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{group.desc}</p>}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(group)} className="btn-outline text-xs py-1 px-2"><Edit size={12} /></button>
                    <button onClick={() => handleDelete(group.id, group.name)} className="btn-danger text-xs py-1 px-2"><Trash2 size={12} /></button>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <Users size={16} style={{ color: 'var(--gold)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--gold)' }}>{groupStudents.length}</span>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>طالب</span>
                </div>
                {groupStudents.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {groupStudents.slice(0, 5).map(s => (
                      <span key={s.id} className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(245,197,24,0.1)', color: 'var(--gold)' }}>
                        {s.name}
                      </span>
                    ))}
                    {groupStudents.length > 5 && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                        +{groupStudents.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" >
          <div className="modal-content modal-content-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-cairo font-black text-lg text-gold flex items-center gap-2">
                <Users size={20} />
                {editingGroup ? 'تعديل الفصل' : 'فصل جديد'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>

            <div className="modal-body space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5 uppercase tracking-wider">اسم الفصل *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: الصف الأول أ" className="input-base" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5 uppercase tracking-wider">وصف (اختياري)</label>
                  <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="وصف الفصل..." className="input-base" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    الطلاب ({selectedStudents.length} مختار)
                  </label>
                  <button onClick={() => setSelectedStudents(selectedStudents.length === students.length ? [] : students.map(s => s.id))}
                    className="text-xs font-bold text-gold hover:underline">
                    {selectedStudents.length === students.length ? 'إلغاء الكل' : 'اختيار الكل'}
                  </button>
                </div>
                <div className="rounded-xl overflow-hidden max-h-48 overflow-y-auto border border-white/5 bg-black/20">
                  {students.length === 0 ? (
                    <div className="p-4 text-center text-sm text-text-muted">لا يوجد طلاب مسجلون</div>
                  ) : students.map(s => (
                    <div key={s.id} onClick={() => toggleStudent(s.id)}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all hover:bg-white/[0.02]"
                      style={{ background: selectedStudents.includes(s.id) ? 'rgba(245,197,24,0.08)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all`}
                        style={{ borderColor: selectedStudents.includes(s.id) ? 'var(--gold)' : 'rgba(255,255,255,0.2)', background: selectedStudents.includes(s.id) ? 'var(--gold)' : 'transparent' }}>
                        {selectedStudents.includes(s.id) && <div className="w-2 h-2 rounded-sm bg-black" />}
                      </div>
                      <span className="text-sm font-medium">{s.name}</span>
                      <code className="text-xs mr-auto text-text-muted">{s.code}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-outline flex-1 py-2.5">إلغاء</button>
              <button onClick={handleSave} disabled={saving} className="btn-gold flex-1 justify-center py-2.5 disabled:opacity-60">
                <Save size={14} /> {saving ? 'جاري الحفظ...' : 'حفظ الفصل'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
