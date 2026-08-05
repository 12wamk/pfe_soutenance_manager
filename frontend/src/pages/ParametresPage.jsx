import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import { Button } from '../components/ui';
import { useTheme } from '../context/ThemeContext';
import { adminApi } from '../services/api';
import { Settings, Moon, Sun, Bell, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ParametresPage() {
  const { dark, toggle } = useTheme();

  const [notifForm, setNotifForm] = useState({
    delai_expiration_jours: 3,
    delai_expiration_participation_jours: 5,
    delai_rappel_heures: 24,
    message_expiration: '',
  });
  const [loadingNotif, setLoadingNotif] = useState(true);
  const [savingNotif, setSavingNotif] = useState(false);

  useEffect(() => {
    adminApi.getParametresNotifications()
      .then((r) => {
        const params = r.data.data ?? r.data;
        if (params) {
          setNotifForm({
            delai_expiration_jours: params.delai_expiration_jours ?? 3,
            delai_expiration_participation_jours: params.delai_expiration_participation_jours ?? 5,
            delai_rappel_heures: params.delai_rappel_heures ?? 24,
            message_expiration: params.message_expiration ?? '',
          });
        }
      })
      .catch(() => toast.error('Impossible de charger les paramètres de notifications'))
      .finally(() => setLoadingNotif(false));
  }, []);

  const setNotifField = (key) => (e) => {
    const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setNotifForm((f) => ({ ...f, [key]: value }));
  };

  const handleSaveNotif = async () => {
    setSavingNotif(true);
    try {
      await adminApi.updateParametresNotifications(notifForm);
      toast.success('Paramètres de notifications enregistrés');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSavingNotif(false);
    }
  };

  return (
    <Layout title="Paramètres">
      <div className="flex justify-center">
        <div className="w-full max-w-xl space-y-6 py-4">
          <div className="text-center mb-2">
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Paramètres
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Préférences d'affichage et de notifications</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-5 text-white flex items-center gap-2.5"
              style={{ background: 'linear-gradient(135deg, #1a5276 0%, #2980d9 100%)' }}>
              <Settings size={19} />
              <h2 className="font-bold text-base" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Paramètres</h2>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2 text-sm">
                  {dark ? <Sun size={16} className="text-blue-500" /> : <Moon size={16} className="text-blue-500" />} Affichage
                </h3>
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <span className="text-sm text-slate-700 dark:text-slate-200">Mode sombre</span>
                  <button onClick={toggle}
                    className={`w-11 h-6 rounded-full transition-colors relative ${dark ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${dark ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              <hr className="border-slate-100 dark:border-slate-800" />

              <div>
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2 text-sm">
                  <Clock size={16} className="text-blue-500" /> Délais d'expiration des notifications
                </h3>

                {loadingNotif ? (
                  <p className="text-sm text-slate-400 px-1">Chargement...</p>
                ) : (
                  <div className="space-y-4">
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        Invitations jury (rapporteur / président) — délai avant expiration
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={notifForm.delai_expiration_jours}
                          onChange={setNotifField('delai_expiration_jours')}
                          className="w-20 px-2.5 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                        <span className="text-sm text-slate-500">jour(s)</span>
                      </div>
                    </div>

                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        Demandes de participation inter-département — délai avant expiration
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={notifForm.delai_expiration_participation_jours}
                          onChange={setNotifField('delai_expiration_participation_jours')}
                          className="w-20 px-2.5 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                        <span className="text-sm text-slate-500">jour(s)</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        Délai laissé au chef de département (ou à l'enseignant invité) pour répondre
                        avant que la demande soit automatiquement marquée comme expirée.
                      </p>
                    </div>

                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        Rappel avant expiration
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={notifForm.delai_rappel_heures}
                          onChange={setNotifField('delai_rappel_heures')}
                          className="w-20 px-2.5 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                        <span className="text-sm text-slate-500">heure(s) avant l'échéance</span>
                      </div>
                    </div>

                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        Message affiché en cas d'expiration (invitations jury)
                      </label>
                      <textarea
                        value={notifForm.message_expiration}
                        onChange={setNotifField('message_expiration')}
                        rows={2}
                        className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                  </div>
                )}
              </div>

              <hr className="border-slate-100 dark:border-slate-800" />

              <div>
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2 text-sm">
                  <Bell size={16} className="text-blue-500" /> Notifications
                </h3>
                <label className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm text-slate-700 dark:text-slate-200">Activer les notifications par email</span>
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="primary" onClick={handleSaveNotif} loading={savingNotif}>
                  Enregistrer
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}