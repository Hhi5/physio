// =======================================================================
// PhysioRecord — Multi-Therapist Appointment Schedule & Waiting List (Phase 7)
// Full Scheduling, Status Transitions, and Waitlist-to-Appointment Conversion
// =======================================================================

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { usePatients } from '../../context/PatientContext';
import {
  ClinicOperationsService,
  CLINIC_STAFF_ROSTER,
} from '../../services/clinicOperationsService';
import type {
  ClinicAppointment,
  AppointmentStatus,
  WaitingListEntry,
} from '../../types/clinicManagement';
import type { SessionType } from '../../types/clinical';
import {
  Calendar,
  Plus,
  Clock,
  Phone,
  Stethoscope,
  Trash2,
  ClipboardList,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export const AppointmentScheduleView: React.FC = () => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';
  const { activePatients } = usePatients();

  const [appointments, setAppointments] = useState<ClinicAppointment[]>([]);
  const [waitingList, setWaitingList] = useState<WaitingListEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTherapist, setSelectedTherapist] = useState<string>('all');
  const [showNewApptForm, setShowNewApptForm] = useState(false);
  const [showNewWaitlistForm, setShowNewWaitlistForm] = useState(false);

  // New Appointment Form State
  const [patientId, setPatientId] = useState('');
  const [customPatientName, setCustomPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [therapistName, setTherapistName] = useState(CLINIC_STAFF_ROSTER[0].nameAr);
  const [startTime, setStartTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [visitType, setVisitType] = useState<SessionType>('follow_up');
  const [roomOrBed, setRoomOrBed] = useState('وحدة العلاج الطبيعي 1');
  const [notes, setNotes] = useState('');

  // New Waitlist Form State
  const [waitName, setWaitName] = useState('');
  const [waitPhone, setWaitPhone] = useState('');
  const [waitCondition, setWaitCondition] = useState('');
  const [waitDays, setWaitDays] = useState('السبت، الإثنين، الأربعاء');
  const [waitPriority, setWaitPriority] = useState<'urgent' | 'high' | 'normal'>('normal');

  useEffect(() => {
    setAppointments(ClinicOperationsService.getAppointments());
    setWaitingList(ClinicOperationsService.getWaitingList());
  }, []);

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedPatient = activePatients.find((p) => p.id === patientId);
    const resolvedName = matchedPatient ? matchedPatient.data.fullName : customPatientName.trim();
    if (!resolvedName) return;

    ClinicOperationsService.saveAppointment({
      patientId: matchedPatient?.id || `walkin_${Date.now()}`,
      patientName: resolvedName,
      patientPhone: matchedPatient?.data.phoneNumber || patientPhone,
      episodeTitle: episodeTitle || (isAr ? 'جلسة علاج طبيعي وتأهيل' : 'PT Rehab Session'),
      therapistName,
      date: selectedDate,
      startTime,
      durationMinutes,
      visitType,
      status: 'scheduled',
      roomOrBed,
      notes,
    });

    setAppointments(ClinicOperationsService.getAppointments());
    setShowNewApptForm(false);
    setCustomPatientName('');
    setEpisodeTitle('');
    setNotes('');
  };

  const handleAddWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitName.trim()) return;
    const updated = ClinicOperationsService.addWaitingListEntry({
      patientName: waitName.trim(),
      phone: waitPhone.trim(),
      conditionOrRegion: waitCondition.trim() || (isAr ? 'تأهيل عظام ومفاصل' : 'Orthopedic Rehab'),
      preferredDays: waitDays,
      preferredTimeWindow: 'evening',
      priority: waitPriority,
    });
    setWaitingList(updated);
    setShowNewWaitlistForm(false);
    setWaitName('');
    setWaitPhone('');
    setWaitCondition('');
  };

  const handlePromoteWaitlistToAppointment = (entry: WaitingListEntry) => {
    ClinicOperationsService.saveAppointment({
      patientId: entry.patientId || `wait_${Date.now()}`,
      patientName: entry.patientName,
      patientPhone: entry.phone,
      episodeTitle: entry.conditionOrRegion,
      therapistName: entry.preferredTherapist || CLINIC_STAFF_ROSTER[0].nameAr,
      date: selectedDate,
      startTime: '12:30',
      durationMinutes: 45,
      visitType: 'initial_evaluation',
      status: 'scheduled',
      roomOrBed: 'غرفة التقييم 1',
      notes: `تمت الجدولة من قائمة الانتظار (${entry.preferredDays})`,
    });
    const remainingWaitlist = ClinicOperationsService.removeWaitingListEntry(entry.id);
    setWaitingList(remainingWaitlist);
    setAppointments(ClinicOperationsService.getAppointments());
  };

  const filteredAppointments = appointments.filter((a) => {
    const matchDate = !selectedDate || a.date === selectedDate;
    const matchTherapist =
      selectedTherapist === 'all' || a.therapistName === selectedTherapist;
    return matchDate && matchTherapist;
  });

  const therapists = CLINIC_STAFF_ROSTER.filter((s) => s.role !== 'receptionist');

  return (
    <div
      className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Header & Controls */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
            {isAr
              ? 'جدول مواعيد المعالجين وقائمة الانتظار (Appointment Calendar & Waitlist)'
              : 'Therapist Appointment Schedule & Waiting List'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'إدارة مواعيد التقييم الأولي، جلسات المتابعة، إعادة التقييم، وتحويل قائمة الانتظار إلى مواعيد مؤكدة.'
              : 'Manage Initial Evaluations, Follow-up visits, Re-evaluations, and Waitlist slot assignments.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums"
          />

          <select
            value={selectedTherapist}
            onChange={(e) => setSelectedTherapist(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            <option value="all">{isAr ? 'جميع المعالجين' : 'All Therapists'}</option>
            {therapists.map((t) => (
              <option key={t.id} value={t.nameAr}>
                {isAr ? t.nameAr : t.nameEn}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowNewApptForm(!showNewApptForm)}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{isAr ? '+ حجز موعد جديد' : '+ Book Appointment'}</span>
          </button>
        </div>
      </div>

      {/* Collapsible New Appointment Form */}
      {showNewApptForm && (
        <form
          onSubmit={handleCreateAppointment}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-teal-300 dark:border-teal-800 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isAr ? 'حجز موعد جلسة أو تقييم جديد' : 'Schedule New Clinical Appointment'}
            </h3>
            <button
              type="button"
              onClick={() => setShowNewApptForm(false)}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'اختيار مريض مسجل:' : 'Existing Patient:'}
              </label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">{isAr ? '-- أو اكتب اسم مريض جديد --' : '-- Or type walk-in name --'}</option>
                {activePatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.data.fullName}
                  </option>
                ))}
              </select>
            </div>

            {!patientId && (
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {isAr ? 'اسم المريض (مراجع جديد):' : 'Patient Full Name:'}
                </label>
                <input
                  type="text"
                  value={customPatientName}
                  onChange={(e) => setCustomPatientName(e.target.value)}
                  placeholder={isAr ? 'الاسم الثلاثي...' : 'Full Name...'}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'المعالج المسؤول:' : 'Assigned Therapist:'}
              </label>
              <select
                value={therapistName}
                onChange={(e) => setTherapistName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                {therapists.map((t) => (
                  <option key={t.id} value={t.nameAr}>
                    {isAr ? t.nameAr : t.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'نوع الزيارة:' : 'Visit Type:'}
              </label>
              <select
                value={visitType}
                onChange={(e) => setVisitType(e.target.value as SessionType)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                <option value="initial_evaluation">{isAr ? 'تقييم أولي شامل' : 'Initial Evaluation'}</option>
                <option value="follow_up">{isAr ? 'جلسة متابعة علاجية' : 'Follow-up Session'}</option>
                <option value="re_evaluation">{isAr ? 'إعادة تقييم مرحلي' : 'Re-evaluation'}</option>
                <option value="discharge_summary">{isAr ? 'جلسة تخريج' : 'Discharge Session'}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'وقت البدء:' : 'Start Time:'}
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'المدة (بالدقائق):' : 'Duration (min):'}
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'الحالة / التشخيص:' : 'Condition / Episode:'}
              </label>
              <input
                type="text"
                value={episodeTitle}
                onChange={(e) => setEpisodeTitle(e.target.value)}
                placeholder={isAr ? 'مثال: تأهيل الكتف الأيمن...' : 'e.g., Right Shoulder Rehab...'}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'الغرفة / الوحدة العلاجية:' : 'Treatment Room / Bay:'}
              </label>
              <input
                type="text"
                value={roomOrBed}
                onChange={(e) => setRoomOrBed(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold cursor-pointer"
            >
              {isAr ? 'تأكيد وحفظ الموعد' : 'Confirm Appointment'}
            </button>
          </div>
        </form>
      )}

      {/* Main Split: Schedule Table (2/3) + Waiting List Panel (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Appointments List */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr ? `المواعيد المجدولة ليوم ${selectedDate}` : `Appointments for ${selectedDate}`}
              </h2>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500 tabular-nums">
              {filteredAppointments.length} {isAr ? 'موعد' : 'slots'}
            </span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredAppointments.map((appt) => (
              <div
                key={appt.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-extrabold text-teal-600 dark:text-teal-400 tabular-nums">
                      {appt.startTime} ({appt.durationMinutes}m)
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {appt.patientName}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      ({appt.visitType === 'initial_evaluation'
                        ? isAr
                          ? 'تقييم أولي'
                          : 'Initial Eval'
                        : appt.visitType === 're_evaluation'
                        ? isAr
                          ? 'إعادة تقييم'
                          : 'Re-eval'
                        : isAr
                        ? 'جلسة متابعة'
                        : 'Follow-up'})
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {appt.episodeTitle}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Stethoscope className="w-3 h-3" />
                      {appt.therapistName}
                    </span>
                    {appt.roomOrBed && <span>· {appt.roomOrBed}</span>}
                    {appt.patientPhone && (
                      <span className="flex items-center gap-1 font-mono" dir="ltr">
                        <Phone className="w-3 h-3" />
                        {appt.patientPhone}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={appt.status}
                    onChange={(e) => {
                      const updated = ClinicOperationsService.updateAppointmentStatus(
                        appt.id,
                        e.target.value as AppointmentStatus
                      );
                      setAppointments(updated);
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="scheduled">{isAr ? 'مجدول (Scheduled)' : 'Scheduled'}</option>
                    <option value="arrived">{isAr ? 'وصل (Arrived)' : 'Arrived'}</option>
                    <option value="in_session">{isAr ? 'في الجلسة (In Session)' : 'In Session'}</option>
                    <option value="completed">{isAr ? 'مكتمل (Completed)' : 'Completed'}</option>
                    <option value="cancelled">{isAr ? 'ملغى (Cancelled)' : 'Cancelled'}</option>
                    <option value="no_show">{isAr ? 'تخلف عن الحضور (No-Show)' : 'No-Show'}</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setAppointments(ClinicOperationsService.deleteAppointment(appt.id));
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    title={isAr ? 'حذف الموعد' : 'Delete'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Waiting List Management Column */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden h-fit">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr ? 'قائمة الانتظار (Waitlist)' : 'Waiting List'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowNewWaitlistForm(!showNewWaitlistForm)}
              className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold cursor-pointer"
            >
              {isAr ? '+ إضافة للانتظار' : '+ Add Waitlist'}
            </button>
          </div>

          {showNewWaitlistForm && (
            <form
              onSubmit={handleAddWaitlist}
              className="p-4 bg-amber-50/40 dark:bg-amber-950/20 border-b border-slate-200 dark:border-slate-800 space-y-2.5"
            >
              <input
                type="text"
                required
                value={waitName}
                onChange={(e) => setWaitName(e.target.value)}
                placeholder={isAr ? 'اسم المريض...' : 'Patient Name...'}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={waitPhone}
                onChange={(e) => setWaitPhone(e.target.value)}
                placeholder="+964 770 000 0000"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
              />
              <input
                type="text"
                value={waitCondition}
                onChange={(e) => setWaitCondition(e.target.value)}
                placeholder={isAr ? 'الحالة / الإصابة...' : 'Condition...'}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
              <div className="flex items-center gap-2">
                <select
                  value={waitPriority}
                  onChange={(e) => setWaitPriority(e.target.value as any)}
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  <option value="normal">{isAr ? 'أولوية اعتيادية' : 'Normal Priority'}</option>
                  <option value="urgent">{isAr ? 'أولوية عاجلة (ما بعد جراحة)' : 'Urgent Post-Op'}</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold cursor-pointer"
                >
                  {isAr ? 'حفظ' : 'Save'}
                </button>
              </div>
            </form>
          )}

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {waitingList.map((entry) => (
              <div key={entry.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {entry.patientName}
                  </span>
                  <span
                    className={`text-[10px] font-bold ${
                      entry.priority === 'urgent'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {entry.priority === 'urgent'
                      ? isAr
                        ? 'عاجل'
                        : 'Urgent'
                      : isAr
                      ? 'اعتيادي'
                      : 'Normal'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {entry.conditionOrRegion}
                </p>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span className="font-mono" dir="ltr">
                    {entry.phone}
                  </span>
                  <span>{entry.preferredDays}</span>
                </div>
                <div className="pt-1 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handlePromoteWaitlistToAppointment(entry)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تحويل لموعد اليوم' : 'Book Today'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setWaitingList(ClinicOperationsService.removeWaitingListEntry(entry.id))
                    }
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
